import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, dbPublic, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { dbForContent, resolveModuleId, tableFor } from "@/lib/server/acharya-data";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/content/sections?moduleId=M01-north-star&lang=bn
 *
 * Resolves the module slug to a UUID, then returns sections + the
 * requested-language body. Shape backwards-compatible with the legacy
 * arjun_sections response: each section carries { id, title_*, content }.
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ sections: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const slug = getAcharyaSlugFromRequest(req);
  const moduleSlug = url.searchParams.get("moduleId");
  const lang = url.searchParams.get("lang") || "bn";

  if (!moduleSlug || moduleSlug.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (!["bn", "hi", "en"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  const cacheKey = `acharya:${slug}:sections:${moduleSlug}:${lang}`;
  let merged: unknown[] = [];
  try {
    merged = await memoCache(cacheKey, 60, async () => {
      const moduleId = await resolveModuleId(slug, moduleSlug);
      if (!moduleId) return [];

      const db = dbForContent(slug, "sections");
      const { data: sections, error: sErr } = await db
        .from(tableFor(slug, "sections"))
        .select(`
          id, module_id, slug, sort_order, estimated_hours,
          title_en, title_bn, title_hi, body_en, body_bn, body_hi, status
        `)
        .eq("module_id", moduleId)
        .eq("is_deleted", false)
        .order("sort_order");
      if (sErr || !sections) {
        if (sErr && isMissingDbObject(sErr)) return [];
        console.error(`[sections:${slug}] query error:`, sErr?.message || "no data");
        return [];
      }

      return (sections || []).map((s) => {
        const chosenBody = (s as Record<string, string | null>)[`body_${lang}`] || s.body_en || null;
        return {
          id: s.id,
          module_id: moduleSlug,
          title_en: s.title_en || "",
          title_bn: s.title_bn || s.title_en || "",
          title_hi: s.title_hi || s.title_en || "",
          sort_order: s.sort_order,
          estimated_hours: s.estimated_hours,
          content: chosenBody ? { body: chosenBody } : null,
        };
      });
    });
  } catch (err) {
    console.error("acharya sections error:", err);
    merged = [];
  }

  return NextResponse.json({ sections: merged }, { headers: CONTENT_CACHE_HEADERS });
}
