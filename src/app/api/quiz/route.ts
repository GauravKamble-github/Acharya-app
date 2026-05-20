import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { logQuizCall } from '@/lib/server/ai-logger';
import { memoCache } from '@/lib/server/cache';
import { tableFor } from '@/lib/server/acharya-data';
import { getAcharyaContext, type AcharyaContext } from '@/lib/server/acharya-context';
import { dbConfigured, dbForSlug, dbPublic, isMissingDbObject, type AcharyaSlug } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const MODEL = process.env.GEMINI_QUIZ_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = 'local-content-quiz';
let geminiDisabledUntil = 0;

function geminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
}

function isPermanentGeminiKeyError(message: string): boolean {
  return /api key.*leaked|api_key_invalid|invalid api key|permission denied/i.test(message);
}

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      q: z.string().describe('Question text, under 20 words'),
      options: z.array(z.string()).length(4).describe('Exactly 4 short options, each under 12 words'),
      correct: z.number().int().min(0).max(3).describe('Zero-based index of correct option (0-3)'),
      explanation: z.string().describe('One short sentence, under 25 words'),
    })
  ).length(5).describe('Exactly 5 questions'),
});

type Quiz = z.infer<typeof QuizSchema>;
type QuizQuestion = Quiz['questions'][number];

const LANG_INSTRUCTIONS: Record<string, string> = {
  bn: 'Generate all questions, options, and explanations in Bengali script. Do not mix Latin letters.',
  hi: 'Generate all questions, options, and explanations in Hindi script. Do not mix Latin letters.',
  en: 'Generate all questions, options, and explanations in simple English.',
};

const FALLBACK_COPY = {
  en: {
    moduleFallback: 'this module',
    questions: [
      (topic: string) => `What should a learner focus on in ${topic}?`,
      (topic: string) => `Which practice best fits ${topic}?`,
      (topic: string) => `What is the safest habit during ${topic}?`,
      (topic: string) => `How should the learner apply ${topic}?`,
      (topic: string) => `Which choice shows good understanding of ${topic}?`,
    ],
    correctGeneric: () => 'Practice the key steps carefully',
    explanation: 'This point comes from the module and should be practiced carefully.',
    distractors: [
      'Skip the recommended sequence',
      'Ignore quality checks',
      'Rush without practice',
      'Avoid asking doubts',
      'Guess without observing',
      'Leave tools unprepared',
    ],
  },
  hi: {
    moduleFallback: 'इस पाठ',
    questions: [
      (topic: string) => `${topic} में विद्यार्थी को किस पर ध्यान देना चाहिए?`,
      (topic: string) => `${topic} के लिए कौन सा अभ्यास सही है?`,
      (topic: string) => `${topic} के दौरान सबसे सुरक्षित आदत क्या है?`,
      (topic: string) => `${topic} को काम में कैसे लगाना चाहिए?`,
      (topic: string) => `${topic} की सही समझ कौन दिखाता है?`,
    ],
    correctGeneric: () => 'मुख्य चरण ध्यान से अपनाना',
    explanation: 'यह बात पाठ से आती है और इसे सावधानी से अभ्यास करना चाहिए।',
    distractors: [
      'बताए गए क्रम को छोड़ना',
      'गुणवत्ता जांच अनदेखी करना',
      'बिना अभ्यास जल्दबाजी करना',
      'सवाल पूछने से बचना',
      'देखे बिना अंदाजा लगाना',
      'औजार तैयार न रखना',
    ],
  },
  bn: {
    moduleFallback: 'এই পাঠে',
    questions: [
      (topic: string) => `${topic} শেখার সময় কীতে বেশি মন দিতে হবে?`,
      (topic: string) => `${topic} এর জন্য কোন অনুশীলনটি ঠিক?`,
      (topic: string) => `${topic} করার সময় নিরাপদ অভ্যাস কোনটি?`,
      (topic: string) => `${topic} মাঠে কীভাবে কাজে লাগাবে?`,
      (topic: string) => `${topic} বোঝার সঠিক লক্ষণ কোনটি?`,
    ],
    correctGeneric: () => 'মূল ধাপগুলো মন দিয়ে অনুসরণ করা',
    explanation: 'এই বিষয়টি পাঠ থেকে এসেছে এবং সাবধানে অনুশীলন করা দরকার।',
    distractors: [
      'নির্দেশিত ধাপ এড়িয়ে যাওয়া',
      'মান যাচাই না করা',
      'অনুশীলন ছাড়া তাড়াহুড়া করা',
      'প্রশ্ন করা এড়িয়ে যাওয়া',
      'না দেখে অনুমান করা',
      'সরঞ্জাম প্রস্তুত না রাখা',
    ],
  },
} as const;

function langKey(lang: unknown): keyof typeof FALLBACK_COPY {
  return lang === 'hi' || lang === 'en' ? lang : 'bn';
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/[`*_#[\]()>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortOption(value: string, fallback: string): string {
  const cleaned = cleanText(value) || fallback;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 10).join(' ');
}

function snippetsFromText(text: string): string[] {
  return cleanText(text)
    .split(/[.!?।\n]+/)
    .map((s) => cleanText(s))
    .filter((s) => s.length >= 12)
    .slice(0, 8);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

async function loadQuizSeeds(slug: AcharyaSlug, moduleSlug: string, lang: keyof typeof FALLBACK_COPY) {
  if (!dbConfigured) return { moduleTitle: '', sectionTitles: [] as string[], snippets: [] as string[] };

  const clients = slug === 'farmer' ? [dbPublic] : [dbForSlug(slug), dbPublic];
  for (const db of clients) {
    const { data: mod, error: moduleError } = await db
      .from(tableFor(slug, 'modules'))
      .select('id, title_en, title_bn, title_hi')
      .eq('slug', moduleSlug)
      .eq('is_deleted', false)
      .maybeSingle();

    if (moduleError || !mod) {
      if (moduleError && !isMissingDbObject(moduleError)) {
        console.warn(`[quiz:fallback:${slug}] module lookup failed:`, moduleError.message);
      }
      continue;
    }

    const titleColumn = `title_${lang}` as 'title_bn' | 'title_hi' | 'title_en';
    const bodyColumn = `body_${lang}` as 'body_bn' | 'body_hi' | 'body_en';
    const moduleTitle = cleanText(mod[titleColumn] || mod.title_en || moduleSlug);

    const { data: sections, error: sectionsError } = await db
      .from(tableFor(slug, 'sections'))
      .select('title_en, title_bn, title_hi, body_en, body_bn, body_hi')
      .eq('module_id', mod.id)
      .eq('is_deleted', false)
      .order('sort_order');

    if (sectionsError) {
      if (!isMissingDbObject(sectionsError)) {
        console.warn(`[quiz:fallback:${slug}] sections lookup failed:`, sectionsError.message);
      }
      return { moduleTitle, sectionTitles: [] as string[], snippets: [] as string[] };
    }

    const sectionTitles = uniqueValues(
      (sections || []).map((s) => cleanText(s[titleColumn] || s.title_en))
    ).slice(0, 8);
    const snippets = uniqueValues(
      (sections || []).flatMap((s) => snippetsFromText(String(s[bodyColumn] || s.body_en || '')))
    ).slice(0, 12);

    return { moduleTitle, sectionTitles, snippets };
  }

  return { moduleTitle: '', sectionTitles: [] as string[], snippets: [] as string[] };
}

async function buildFallbackQuiz(
  acharya: AcharyaContext,
  moduleId: string,
  langValue: unknown,
): Promise<QuizQuestion[]> {
  const lang = langKey(langValue);
  const copy = FALLBACK_COPY[lang];
  const seeds = await loadQuizSeeds(acharya.slug, moduleId, lang).catch((err) => {
    console.warn(`[quiz:fallback:${acharya.slug}] seed load failed:`, err);
    return { moduleTitle: '', sectionTitles: [] as string[], snippets: [] as string[] };
  });

  const moduleTitle = seeds.moduleTitle || copy.moduleFallback;
  const questionTopics = uniqueValues([
    ...seeds.sectionTitles,
    moduleTitle,
  ]).filter(Boolean);

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < 5; i++) {
    const topic = shortOption(questionTopics[i % questionTopics.length] || moduleTitle, moduleTitle);
    const correct = shortOption(seeds.snippets[i] || seeds.sectionTitles[i] || '', copy.correctGeneric());
    const distractors = uniqueValues(copy.distractors.filter((d) => d !== correct)).slice(0, 3);
    const options = [correct, ...distractors];
    const correctIndex = i % 4;
    [options[0], options[correctIndex]] = [options[correctIndex], options[0]];

    questions.push({
      q: copy.questions[i](topic),
      options,
      correct: correctIndex,
      explanation: copy.explanation,
    });
  }

  return questions;
}

export async function POST(req: NextRequest) {
  const acharya = await getAcharyaContext(req);
  const { moduleId, lang, completedModuleIds, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, 'quiz');
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  if (!moduleId || typeof moduleId !== 'string' || moduleId.length > 50) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }

  let completedIds: string[] = [];
  if (Array.isArray(completedModuleIds)) {
    completedIds = completedModuleIds
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80)
      .slice(0, 40);
  }

  const apiKey = geminiApiKey();

  const completedBlock = completedIds.length > 0
    ? `\n\nThe learner has already completed these modules: ${completedIds.join(', ')}.\nKeep 3 of 5 questions on ${moduleId} itself; 1-2 can cross-reference completed modules where relevant.`
    : '';

  const prompt = `Generate exactly 5 multiple-choice questions for ${acharya.brand.name}, module: ${moduleId}

Each question must test practical knowledge from this Acharya's training content.

ACHARYA CONTEXT: ${acharya.prompt.systemPrompt}

${LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.bn}${completedBlock}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  const started = Date.now();

  async function runGeneration() {
    if (!apiKey || Date.now() < geminiDisabledUntil) {
      const questions = await buildFallbackQuiz(acharya, moduleId, lang);
      logQuizCall({
        model: FALLBACK_MODEL,
        status: 'ok',
        durationMs: Date.now() - started,
        lang,
        moduleId,
        acharyaSlug: acharya.slug,
      });
      return questions;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const result = await generateObject({
      model: google(MODEL),
      schema: QuizSchema,
      prompt,
      maxOutputTokens: 1500,
      providerOptions: {
        google: {
          structuredOutputs: true,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      abortSignal: controller.signal,
    });

    const u = result.usage as { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number } | undefined;
    logQuizCall({
      model: MODEL,
      status: 'ok',
      durationMs: Date.now() - started,
      usage: { inputTokens: u?.inputTokens, outputTokens: u?.outputTokens, cachedInputTokens: u?.cachedInputTokens },
      lang,
      moduleId,
      acharyaSlug: acharya.slug,
    });

    return result.object.questions;
  }

  const cacheable = completedIds.length === 0;
  const cacheKey = `quiz:${acharya.slug}:${moduleId}:${lang}`;

  try {
    const questions = cacheable
      ? await memoCache(cacheKey, 15 * 60, runGeneration)
      : await runGeneration();

    clearTimeout(timeoutId);
    return NextResponse.json({ questions });
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMessage = err instanceof Error ? err.message : String(err);
    logQuizCall({
      model: MODEL,
      status: 'error',
      durationMs: Date.now() - started,
      lang,
      moduleId,
      acharyaSlug: acharya.slug,
      errorMessage,
    });
    if (isPermanentGeminiKeyError(errorMessage)) {
      geminiDisabledUntil = Date.now() + 10 * 60 * 1000;
    }
    console.warn('Quiz AI unavailable, using local fallback:', errorMessage);

    const fallbackStarted = Date.now();
    const questions = await buildFallbackQuiz(acharya, moduleId, lang);
    logQuizCall({
      model: FALLBACK_MODEL,
      status: 'ok',
      durationMs: Date.now() - fallbackStarted,
      lang,
      moduleId,
      acharyaSlug: acharya.slug,
    });
    return NextResponse.json({ questions });
  }
}
