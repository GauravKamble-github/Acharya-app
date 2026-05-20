import { NextRequest, NextResponse } from "next/server";
import {dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

const PAGE_SIZE = 50;
const FETCH_CAP = 5000;

interface Conversation {
  key: string;
  learnerId: string | null;
  moduleId: string | null;
  lang: string | null;
  messageCount: number;
  firstAt: string;
  lastAt: string;
  latestUserMessage: string | null;
  latestAiResponse: string | null;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) {
    return NextResponse.json({ rows: [], totalCount: 0, page: 0, pageSize: PAGE_SIZE });
  }

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0);
  const learnerId = url.searchParams.get("learnerId") || "";
  const moduleId = url.searchParams.get("moduleId") || "";
  const slug = getAcharyaSlugFromRequest(req);

  let q = dbForSlug(slug)
    .from(tableFor(slug, "chat_logs"))
    .select("*")
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP);
  if (learnerId && learnerId.length <= 80) q = q.eq("learner_id", learnerId);
  if (moduleId && moduleId.length <= 80) q = q.eq("module_id", moduleId);

  const { data, error } = await q;
  if (error) {
    if (isMissingDbObject(error)) {
      return NextResponse.json({ rows: [], totalCount: 0, page, pageSize: PAGE_SIZE });
    }
    console.error("admin chat-logs error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 502 });
  }

  const rows = (data || []) as Array<{
    learner_id: string | null;
    module_id: string | null;
    lang: string | null;
    user_message: string | null;
    ai_response: string | null;
    created_at: string;
  }>;

  const map = new Map<string, Conversation>();
  for (const r of rows) {
    const key = `${r.learner_id ?? "anon"}|${r.module_id ?? "-"}|${r.lang ?? "-"}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        learnerId: r.learner_id,
        moduleId: r.module_id,
        lang: r.lang,
        messageCount: 1,
        firstAt: r.created_at,
        lastAt: r.created_at,
        latestUserMessage: r.user_message,
        latestAiResponse: r.ai_response,
      });
    } else {
      existing.messageCount++;
      if (r.created_at > existing.lastAt) {
        existing.lastAt = r.created_at;
        existing.latestUserMessage = r.user_message;
        existing.latestAiResponse = r.ai_response;
      }
      if (r.created_at < existing.firstAt) existing.firstAt = r.created_at;
    }
  }

  const all = Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const totalCount = all.length;
  const paged = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return NextResponse.json({ rows: paged, totalCount, page, pageSize: PAGE_SIZE });
}
