import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, dbPublic, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { dbForContent, resolveModuleId, tableFor } from "@/lib/server/acharya-data";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/content/videos?moduleId=M15-video-library&limit=3
 *
 * Returns videos for a module (by slug). Shape stays backwards-compatible
 * with the legacy arjun_videos response.
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ videos: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const slug = getAcharyaSlugFromRequest(req);
  const moduleSlug = url.searchParams.get("moduleId") || "M15-video-library";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.max(1, Math.min(50, parseInt(limitParam, 10) || 0))
    : undefined;

  if (moduleSlug.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }

  const cacheKey = `acharya:${slug}:videos:${moduleSlug}:${limit ?? "all"}`;
  let videos: unknown[] = [];
  try {
    videos = await memoCache(cacheKey, 60, async () => {
      const moduleId = await resolveModuleId(slug, moduleSlug);
      if (!moduleId) return [];

      const db = dbForContent(slug, "videos");
      let q = db
        .from(tableFor(slug, "videos"))
        .select(`
          id, youtube_id, start_seconds, duration, sort_order,
          title_en, title_bn, title_hi
        `)
        .eq("module_id", moduleId)
        .eq("is_deleted", false)
        .order("sort_order");
      if (limit) q = q.limit(limit);

      const { data, error } = await q;
      if (error || !data) {
        if (error && isMissingDbObject(error)) return [];
        console.error(`[videos:${slug}] query error:`, error?.message || "no data");
        return [];
      }

      return (data || []).map((v) => {
        return {
          id: v.id,
          youtube_id: v.youtube_id,
          module_id: moduleSlug,
          title_en: v.title_en || "",
          title_bn: v.title_bn || v.title_en || "",
          title_hi: v.title_hi || v.title_en || "",
          duration: v.duration,
          start_seconds: v.start_seconds,
          sort_order: v.sort_order,
        };
      });
    });
  } catch (err) {
    console.error("acharya videos error:", err);
    videos = [];
  }

  return NextResponse.json({ videos }, { headers: CONTENT_CACHE_HEADERS });
}
