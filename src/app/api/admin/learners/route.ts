import { NextRequest, NextResponse } from "next/server";
import {dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) {
    return NextResponse.json({ learners: [], totalCount: 0, page: 0, pageSize: PAGE_SIZE });
  }

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0);
  const slug = getAcharyaSlugFromRequest(req);
  const empty = { learners: [], totalCount: 0, page, pageSize: PAGE_SIZE };

  const { count, error: countError } = await dbForSlug(slug)
    .from(tableFor(slug, "users"))
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false);
  if (countError) {
    if (isMissingDbObject(countError)) return NextResponse.json(empty);
    console.error("admin learners count error:", countError);
    return NextResponse.json({ error: "Failed to load" }, { status: 502 });
  }

  const { data: rows, error } = await dbForSlug(slug)
    .from(tableFor(slug, "users"))
    .select("*")
    .eq("is_deleted", false)
    .order("last_seen_on", { ascending: false, nullsFirst: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    if (isMissingDbObject(error)) {
      return NextResponse.json({ learners: [], totalCount: 0, page, pageSize: PAGE_SIZE });
    }
    console.error("admin learners error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 502 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ learners: [], totalCount: count || 0, page, pageSize: PAGE_SIZE });
  }

  const learnerIds = rows.map((r: { id: string }) => r.id);
  const [progressResult, quizResult] = await Promise.all([
    dbForSlug(slug).from(tableFor(slug, "progress")).select("learner_id, completed").in("learner_id", learnerIds),
    dbForSlug(slug).from(tableFor(slug, "quiz_attempts")).select("learner_id, score, total").in("learner_id", learnerIds),
  ]);
  if (progressResult.error && !isMissingDbObject(progressResult.error)) {
    console.error("admin learners progress error:", progressResult.error);
  }
  if (quizResult.error && !isMissingDbObject(quizResult.error)) {
    console.error("admin learners quiz error:", quizResult.error);
  }
  const progress = progressResult.error ? [] : progressResult.data;
  const quizzes = quizResult.error ? [] : quizResult.data;

  const progressCount: Record<string, number> = {};
  (progress || []).forEach((p: { learner_id: string; completed: boolean }) => {
    if (p.completed) progressCount[p.learner_id] = (progressCount[p.learner_id] || 0) + 1;
  });

  const quizStats: Record<string, { count: number; score: number; total: number }> = {};
  (quizzes || []).forEach((q: { learner_id: string; score: number; total: number }) => {
    if (!quizStats[q.learner_id]) quizStats[q.learner_id] = { count: 0, score: 0, total: 0 };
    quizStats[q.learner_id].count++;
    quizStats[q.learner_id].score += q.score;
    quizStats[q.learner_id].total += q.total;
  });

  const learners = rows.map((r: { id: string; [k: string]: unknown }) => ({
    ...r,
    device_id: r.device_id || `phone:${r.phone || r.id}`,
    last_seen: r.last_seen_on || r.updated_at || r.created_at,
    created_at: r.created_at,
    preferred_lang: r.preferred_lang || "bn",
    progressCount: progressCount[r.id] || 0,
    quizCount: quizStats[r.id]?.count || 0,
    avgScore: quizStats[r.id] && quizStats[r.id].total > 0
      ? Math.round((quizStats[r.id].score / quizStats[r.id].total) * 100)
      : 0,
  }));

  return NextResponse.json({ learners, totalCount: count || 0, page, pageSize: PAGE_SIZE });
}
