import { NextRequest, NextResponse } from "next/server";
import {dbConfigured, dbForSlug, getAcharyaSlugFromRequest } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { memoCache } from "@/lib/server/cache";
import { tableFor } from "@/lib/server/acharya-data";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) {
    return NextResponse.json({
      modules: 0, sections: 0, contentRows: 0, videos: 0, learners: 0, quizAttempts: 0,
    });
  }

  const slug = getAcharyaSlugFromRequest(req);
  const stats = await memoCache(`admin:${slug}:stats`, 30, async () => {
    const [modules, sections, videos, learners, quizzes] = await Promise.all([
      dbForSlug(slug).from(tableFor(slug, "modules")).select("id", { count: "exact", head: true }),
      dbForSlug(slug).from(tableFor(slug, "sections")).select("id", { count: "exact", head: true }),
      dbForSlug(slug).from(tableFor(slug, "videos")).select("id", { count: "exact", head: true }),
      dbForSlug(slug).from(tableFor(slug, "users")).select("id", { count: "exact", head: true }).eq("is_deleted", false),
      dbForSlug(slug).from(tableFor(slug, "quiz_attempts")).select("id", { count: "exact", head: true }),
    ]);
    return {
      modules: modules.count || 0,
      sections: sections.count || 0,
      contentRows: sections.count || 0,
      videos: videos.count || 0,
      learners: learners.count || 0,
      quizAttempts: quizzes.count || 0,
    };
  });

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
