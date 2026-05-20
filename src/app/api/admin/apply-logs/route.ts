import { NextRequest, NextResponse } from "next/server";
import {dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

const PAGE_SIZE = 50;

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
  const empty = { rows: [], totalCount: 0, page, pageSize: PAGE_SIZE };

  let countQ = dbForSlug(slug).from(tableFor(slug, "apply_logs")).select("*", { count: "exact", head: true });
  let rowsQ = dbForSlug(slug).from(tableFor(slug, "apply_logs")).select("*").order("created_at", { ascending: false });

  if (learnerId && learnerId.length <= 80) {
    countQ = countQ.eq("learner_id", learnerId);
    rowsQ = rowsQ.eq("learner_id", learnerId);
  }
  if (moduleId && moduleId.length <= 80) {
    countQ = countQ.eq("module_id", moduleId);
    rowsQ = rowsQ.eq("module_id", moduleId);
  }

  const { count, error: countError } = await countQ;
  if (countError) {
    if (isMissingDbObject(countError)) return NextResponse.json(empty);
    console.error("admin apply-logs count error:", countError);
    return NextResponse.json({ error: "Failed to load" }, { status: 502 });
  }

  const { data: rows, error } = await rowsQ.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    if (isMissingDbObject(error)) {
      return NextResponse.json(empty);
    }
    console.error("admin apply-logs error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 502 });
  }

  return NextResponse.json({ rows: rows || [], totalCount: count || 0, page, pageSize: PAGE_SIZE });
}
