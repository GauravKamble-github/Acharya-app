import "server-only";
import { dbForSlug, dbPublic, isMissingDbObject, publicAcharyaTable, type AcharyaSlug } from "./supabase";

export function tableFor(slug: AcharyaSlug, resource: string): string {
  return publicAcharyaTable(slug, resource);
}

export function logIfRealDbError(label: string, error: unknown) {
  if (!error || isMissingDbObject(error)) return;
  const err = error as { message?: string };
  console.error(label, err.message || error);
}

// Always use the default project (dbPublic) for shared content.
// Per-acharya databases are used for user-specific data (auth, progress).
export function dbForContent(slug: AcharyaSlug, resource: string) {
  return dbPublic;
}

export async function resolveModuleId(slug: AcharyaSlug, moduleSlug: string): Promise<string | null> {
  const db = await dbForContent(slug, "modules");
  const { data, error } = await db
    .from(tableFor(slug, "modules"))
    .select("id")
    .eq("slug", moduleSlug)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    logIfRealDbError(`[acharya:${slug}] module lookup failed`, error);
    return null;
  }
  return (data?.id as string) || null;
}

export async function publicTableExists(slug: AcharyaSlug, resource: string): Promise<boolean> {
  const db = await dbForContent(slug, resource);
  const { error } = await db
    .from(tableFor(slug, resource))
    .select("id", { count: "exact", head: true })
    .limit(1);
  return !error || !isMissingDbObject(error);
}
