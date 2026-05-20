import { NextRequest, NextResponse } from "next/server";
import {dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";
import { tableFor } from "@/lib/server/acharya-data";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ learnerId: null });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ learnerId: null });

  const body = await req.json().catch(() => null) as { lang?: string } | null;
  const preferredLang = body && ["bn", "hi", "en"].includes(body.lang || "")
    ? body.lang
    : undefined;

  const update: Record<string, unknown> = { last_seen_on: new Date().toISOString() };
  if (preferredLang) update.preferred_lang = preferredLang;

  const slug = getAcharyaSlugFromRequest(req);
  const { error } = await dbForSlug(slug)
    .from(tableFor(slug, "users"))
    .update(update)
    .eq("id", session.learnerId);

  if (error && !isMissingDbObject(error)) {
    console.error("learner init last_seen update failed:", error);
  }

  return NextResponse.json({ learnerId: session.learnerId });
}
