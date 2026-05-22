import "server-only";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ACHARYAS, SUPPORTED_SLUGS, getDefaultAcharya, type AcharyaSlug } from "../acharya-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = ReturnType<typeof createClient<any, any, any>>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const effectiveKey = serviceKey || anonKey;
const authOpts = { persistSession: false, autoRefreshToken: false } as const;

export type { AcharyaSlug };
export { ACHARYAS, SUPPORTED_SLUGS };
export const SUPPORTED_ACHARYAS = SUPPORTED_SLUGS;

export function normalizeAcharyaSlug(value: string | null | undefined): AcharyaSlug {
  const slug = (value || "").toLowerCase();
  const match = ACHARYAS.find((a) => a.slug === slug);
  return match ? (slug as AcharyaSlug) : (getDefaultAcharya().slug as AcharyaSlug);
}

export const ACHARYA_SLUG: AcharyaSlug = normalizeAcharyaSlug(
  process.env.NEXT_PUBLIC_DEFAULT_ACHARYA || process.env.NEXT_PUBLIC_ACHARYA_SLUG || getDefaultAcharya().slug
) as AcharyaSlug;

const defaultAcharyaSlug = ACHARYA_SLUG;

export function acharyaSchemaFor(slug: string): string {
  return `acharya_${normalizeAcharyaSlug(slug)}`;
}

export function publicAcharyaTable(slug: string, resource: string): string {
  const cleanResource = resource.replace(/[^a-z0-9_]/gi, "").toLowerCase();
  return `${normalizeAcharyaSlug(slug)}_${cleanResource}`;
}

export function isMissingDbObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST106" ||
    err.code === "PGRST205" ||
    /Invalid schema|schema cache|Could not find the table/i.test(err.message || "")
  );
}

export function isNetworkUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: string; details?: string };
  const text = `${err.message || ""} ${err.details || ""}`;
  return /fetch failed|EACCES|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(text);
}

export function getAcharyaSlugFromRequest(req?: Request): AcharyaSlug {
  const fromHeader = req?.headers.get("x-acharya-slug");
  if (fromHeader) return normalizeAcharyaSlug(fromHeader);

  if (req?.url) {
    try {
      const pathname = new URL(req.url).pathname;
      const querySlug = new URL(req.url).searchParams.get("acharya");
      const apiMatch = pathname.match(/^\/api\/([^/]+)/);
      const pageMatch = pathname.match(/^\/([^/]+)/);
      return normalizeAcharyaSlug(querySlug || apiMatch?.[1] || pageMatch?.[1]);
    } catch {
      return defaultAcharyaSlug;
    }
  }

  return defaultAcharyaSlug;
}

export async function getCurrentAcharyaSlug(): Promise<AcharyaSlug> {
  try {
    const h = await headers();
    return normalizeAcharyaSlug(h.get("x-acharya-slug"));
  } catch {
    return defaultAcharyaSlug;
  }
}

export const dbPublic: DB = url && effectiveKey
  ? createClient(url, effectiveKey, { auth: authOpts })
  : createClient("https://placeholder.supabase.co", "placeholder", { auth: authOpts });

export const db = dbPublic;

export const dbConfigured = !!url && !!effectiveKey
  && url !== "placeholder"
  && effectiveKey !== "placeholder";

// Per-acharya Supabase clients — each acharya can point to its own project
export function dbForSlug(_slug: AcharyaSlug): DB {
  void _slug;
  // NOTE (2026-05-21): All acharya tables currently live in the default DB with
  // prefixed names (e.g. vajra_modules, taksha_modules). The per-acharya DBs
  // either have unprefixed tables (vajra) or are empty (taksha). Until those
  // DBs are re-provisioned with the correct prefixed schema, we route ALL
  // acharya queries through dbPublic so that modules, chat logs, users, etc.
  // actually resolve to existing tables. Re-enable per-acharya clients once
  // the separate projects are fully set up.
  return dbPublic;

  /* Original per-acharya logic — re-enable after DB migration:
  if (acharyaDbCache[slug]) return acharyaDbCache[slug];
  const acharya = ACHARYAS.find((a) => a.slug === slug);

  const achUrl = envForSlug(slug, "SUPABASE_URL")
    || envForSlug(slug, "NEXT_PUBLIC_SUPABASE_URL")
    || url;

  const achKey = envForSlug(slug, "SUPABASE_SERVICE_ROLE_KEY")
    || envForSlug(slug, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    || serviceKey
    || anonKey;

  if (achUrl && achUrl !== url && achKey && achKey !== effectiveKey) {
    acharyaDbCache[slug] = createClient(achUrl, achKey, { auth: authOpts });
    console.log(`[dbForSlug] ✓ per-acharya client for ${slug}: ${achUrl}`);
    return acharyaDbCache[slug];
  }

  if (slug === defaultAcharyaSlug || !acharya?.hasOwnDatabase) {
    return dbPublic;
  }

  console.warn(`[dbForSlug] ⚠ default fallback for ${slug}: sameUrl=${achUrl === url} sameKey=${achKey === effectiveKey}`);
  return dbPublic;
  */
}

export async function getAcharyaId(slug?: string): Promise<string | null> {
  return normalizeAcharyaSlug(slug || await getCurrentAcharyaSlug());
}

function roleOf(key: string): string | null {
  if (!key) return null;
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  if (key.startsWith("eyJ")) {
    try {
      const payload = key.split(".")[1];
      if (!payload) return null;
      const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      return typeof json.role === "string" ? json.role : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const effectiveKeyRole = effectiveKey ? roleOf(effectiveKey) : null;
export const usingServiceRole = effectiveKeyRole === "service_role";

if (dbConfigured) {
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  if (usingServiceRole) {
    console.log(`[acharya-db] service_role active (${host}), tables={slug}_{resource}, default=${ACHARYA_SLUG}`);
  } else {
    console.warn(
      `\n[acharya-db] Not using service_role (${host}). anon grants required on public {slug}_{resource} tables.`
    );
  }
}
