import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ModelMessage } from 'ai';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { logChatCall } from '@/lib/server/ai-logger';
import { getAcharyaContext } from '@/lib/server/acharya-context';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MODEL = 'claude-4-sonnet-20250514';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'] as const;

type ChatHistoryItem = { role?: unknown; content?: unknown };

function hasRealSecret(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v.length > 12 && !v.includes('your-') && !v.includes('placeholder') && !v.includes('replace-me') && !v.includes('change-me');
}

function imageToGeminiPart(image: string) {
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { inline_data: { mime_type: m[1], data: m[2] } };
}

async function geminiReply({
  message, history, moduleId, lang, image, systemPrompt, systemSuffix,
}: {
  message: string; history: unknown; moduleId?: string; lang?: string; image?: string;
  systemPrompt: string; systemSuffix: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasRealSecret(apiKey)) {
    return NextResponse.json({ error: 'Chat service not configured' }, { status: 500 });
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-10) as ChatHistoryItem[]) {
      if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.length <= 4000) {
        contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
      }
    }
  }
  const userParts: Array<Record<string, unknown>> = [{ text: message }];
  if (image) {
    const ip = imageToGeminiPart(image);
    if (!ip) return NextResponse.json({ error: 'Gemini only supports uploaded image data URLs.' }, { status: 400 });
    userParts.push(ip);
  }
  contents.push({ role: 'user', parts: userParts });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `${systemPrompt}\n\n${systemSuffix}` }] },
    contents,
    generationConfig: { maxOutputTokens: 900, temperature: 0.5 },
  });

  const started = Date.now();
  let res: Response | null = null;
  let usedModel: string = GEMINI_MODELS[0];
  let lastDetail = '';

  for (const candidate of GEMINI_MODELS) {
    usedModel = candidate;
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body,
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) break;
    lastDetail = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status === 503 || /high demand|unavailable|quota/i.test(lastDetail);
    console.warn(`[chat] ${candidate} failed ${res.status}: ${lastDetail.slice(0, 220)}`);
    if (!retryable) break;
  }

  if (!res?.ok) {
    logChatCall({ model: usedModel, status: res?.status === 504 ? 'timeout' : 'error', durationMs: Date.now() - started, lang, moduleId, hasImage: !!image, errorMessage: lastDetail.slice(0, 500) });
    return NextResponse.json(
      { error: /high demand|unavailable/i.test(lastDetail) ? 'AI busy. Try again in a minute.' : 'AI chat failed' },
      { status: /high demand|unavailable/i.test(lastDetail) ? 503 : 502 }
    );
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: Record<string, unknown>) => typeof p?.text === 'string' ? p.text : '').join('') : '';
  logChatCall({ model: usedModel, status: 'ok', durationMs: Date.now() - started, usage: { inputTokens: data?.usageMetadata?.promptTokenCount, outputTokens: data?.usageMetadata?.candidatesTokenCount }, lang, moduleId, hasImage: !!image });

  return new Response(text || 'Could not generate reply.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: NextRequest) {
  const acharya = await getAcharyaContext(req);
  const { message, history, moduleId, lang, image, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, 'chat');
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.', retryInSeconds: rl.resetInSeconds }, { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } });
  }

  if (!message || typeof message !== 'string' || message.length > 4000) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  if (image !== undefined && image !== null) {
    if (typeof image !== 'string') return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
    if (image.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    if (!image.startsWith('data:image/') && !/^https?:\/\//.test(image)) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
  }

  const langMap: Record<string, string> = { bn: 'Bengali (বাংলা লিপি)', hi: 'Hindi (हिन्दी)', en: 'English' };
  const langName = langMap[lang] || 'English';

  const scriptRule = lang === 'bn'
    ? `\n\nSCRIPT RULE (strict): Write the ENTIRE response in Bengali script. Any English loan word must be transliterated into Bengali script, NOT left in Latin letters.`
    : lang === 'hi'
    ? `\n\nSCRIPT RULE (strict): Write the ENTIRE response in Devanagari script. Any English loan word must be transliterated into Devanagari, NOT left in Latin letters.`
    : '';

  const systemSuffix = moduleId
    ? `\n\nThe user is currently studying module: ${moduleId}. Tailor your answers to this topic when relevant. Respond in ${langName}.${scriptRule}`
    : `\n\nRespond in ${langName}.${scriptRule}`;

  // Use Gemini if Claude key isn't configured (Gemini key is the working one)
  if (!hasRealSecret(process.env.ANTHROPIC_API_KEY)) {
    return geminiReply({ message, history, moduleId, lang, image, systemPrompt: acharya.prompt.systemPrompt, systemSuffix });
  }

  // Claude path (streaming)
  const messages: ModelMessage[] = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-10) as ChatHistoryItem[]) {
      if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.length <= 4000) {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  if (image) {
    messages.push({ role: 'user', content: [{ type: 'text', text: message }, { type: 'image', image }] });
  } else {
    messages.push({ role: 'user', content: message });
  }

  const started = Date.now();
  const abortSignal = AbortSignal.timeout(25000);

  const result = streamText({
    model: anthropic(MODEL),
    system: [
      { role: 'system', content: acharya.prompt.systemPrompt, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
      { role: 'system', content: systemSuffix },
    ],
    messages,
    maxOutputTokens: 900,
    abortSignal,
    onFinish({ usage, providerMetadata }) {
      const u = usage as unknown as { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number } | undefined;
      const anthropicMeta = (providerMetadata as Record<string, unknown> | undefined)?.anthropic as { cacheReadInputTokens?: number; cacheCreationInputTokens?: number } | undefined;
      logChatCall({ model: MODEL, status: 'ok', durationMs: Date.now() - started, usage: { inputTokens: u?.inputTokens, outputTokens: u?.outputTokens, cachedInputTokens: u?.cachedInputTokens ?? anthropicMeta?.cacheReadInputTokens ?? 0 }, lang, moduleId, hasImage: !!image });
    },
    onError({ error }) {
      const aborted = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
      logChatCall({ model: MODEL, status: aborted ? 'timeout' : 'error', durationMs: Date.now() - started, lang, moduleId, hasImage: !!image, errorMessage: error instanceof Error ? error.message : String(error) });
      console.error('Chat stream error:', error);
    },
  });

  return result.toTextStreamResponse();
}
