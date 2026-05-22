import "server-only";
import { cache } from "react";
import {
  dbForSlug,
  dbConfigured,
  getAcharyaSlugFromRequest,
  acharyaSchemaFor,
  isMissingDbObject,
  isNetworkUnavailable,
  publicAcharyaTable,
  type AcharyaSlug,
} from "./supabase";
import { ACHARYAS } from "../acharya-config";

export interface AcharyaBrand {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  initials: string;
  themeColor: string;
  accentColor: string;
}

export interface AcharyaFeatureFlags {
  tools: boolean;
  weather: boolean;
  mandi: boolean;
  telegram: boolean;
  imageQuestions: boolean;
}

export interface AcharyaPromptConfig {
  systemPrompt: string;
}

export interface AcharyaContext {
  slug: AcharyaSlug;
  id: string | null;
  schema: string;
  brand: AcharyaBrand;
  features: AcharyaFeatureFlags;
  prompt: AcharyaPromptConfig;
}

const fallbackBySlug: Record<string, AcharyaBrand> = {};
for (const a of ACHARYAS) {
  fallbackBySlug[a.slug] = {
    name: a.name,
    shortName: a.shortName,
    tagline: a.tagline,
    description: a.description,
    initials: a.initials,
    themeColor: a.themeColor,
    accentColor: a.accentColor,
  };
}

const defaultFeatures: AcharyaFeatureFlags = {
  tools: false,
  weather: false,
  mandi: false,
  telegram: false,
  imageQuestions: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringFrom(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanFrom(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return fallback;
}

async function loadConfig(slug: AcharyaSlug): Promise<Record<string, unknown>> {
  if (!dbConfigured) return {};
  const { data, error } = await dbForSlug(slug)
    .from(publicAcharyaTable(slug, "config"))
    .select("key,value")
    .eq("is_deleted", false);

  if (error || !data) {
    if (error && !isMissingDbObject(error) && !isNetworkUnavailable(error)) {
      console.warn(`[acharya:${slug}] config lookup failed:`, error.message);
    }
    return {};
  }

  const config: Record<string, unknown> = {};
  for (const row of data as Array<{ key?: string | null; value?: unknown }>) {
    if (row.key) config[row.key] = row.value;
  }
  return config;
}

function parseBrand(slug: AcharyaSlug, config: Record<string, unknown>): AcharyaBrand {
  const fallback = fallbackBySlug[slug];
  const brand = isRecord(config.brand) ? config.brand : config;
  return {
    name: stringFrom(brand.name || brand.app_name, fallback.name),
    shortName: stringFrom(brand.shortName || brand.short_name, fallback.shortName),
    tagline: stringFrom(brand.tagline, fallback.tagline),
    description: stringFrom(brand.description, fallback.description),
    initials: stringFrom(brand.initials, fallback.initials).slice(0, 2).toUpperCase(),
    themeColor: stringFrom(brand.themeColor || brand.theme_color, fallback.themeColor),
    accentColor: stringFrom(brand.accentColor || brand.accent_color, fallback.accentColor),
  };
}

function parseFeatures(slug: AcharyaSlug, config: Record<string, unknown>): AcharyaFeatureFlags {
  const fromConfig = isRecord(config.features) ? config.features : {};
  const farmerDefaults = slug === "farmer"
    ? { tools: true, weather: true, mandi: true, telegram: true, imageQuestions: true }
    : {};
  return {
    ...defaultFeatures,
    ...farmerDefaults,
    tools: booleanFrom(fromConfig.tools ?? config.feature_tools, farmerDefaults.tools || false),
    weather: booleanFrom(fromConfig.weather ?? config.feature_weather, farmerDefaults.weather || false),
    mandi: booleanFrom(fromConfig.mandi ?? config.feature_mandi, farmerDefaults.mandi || false),
    telegram: booleanFrom(fromConfig.telegram ?? config.feature_telegram, farmerDefaults.telegram || false),
    imageQuestions: booleanFrom(
      fromConfig.imageQuestions ?? fromConfig.image_questions ?? config.feature_image_questions,
      farmerDefaults.imageQuestions || false
    ),
  };
}

function parsePrompt(slug: AcharyaSlug, config: Record<string, unknown>): AcharyaPromptConfig {
  const fallback = `You are ${fallbackBySlug[slug].name}. Answer in the learner's selected language and stay within this Acharya's training domain.`;
  return {
    systemPrompt: stringFrom(config.system_prompt || config.systemPrompt, fallback),
  };
}

export const getAcharyaContextBySlug = cache(async (slug: AcharyaSlug): Promise<AcharyaContext> => {
  const config = await loadConfig(slug);
  return {
    slug,
    id: slug,
    schema: acharyaSchemaFor(slug),
    brand: parseBrand(slug, config),
    features: parseFeatures(slug, config),
    prompt: parsePrompt(slug, config),
  };
});

export async function getAcharyaContext(req?: Request): Promise<AcharyaContext> {
  return getAcharyaContextBySlug(getAcharyaSlugFromRequest(req));
}

export async function validateAcharyaAccess(req?: Request): Promise<AcharyaContext | null> {
  const ctx = await getAcharyaContext(req);
  return ctx;
}
