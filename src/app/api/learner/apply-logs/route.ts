import { NextRequest, NextResponse } from "next/server";
import { dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";
import { resolveModuleId, tableFor } from "@/lib/server/acharya-data";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { moduleId, input, score, feedback, nextStep, hasPhoto } = body as {
    moduleId?: string;
    input?: string;
    score?: number;
    feedback?: string;
    nextStep?: string;
    hasPhoto?: boolean;
  };

  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (typeof input !== "string" || input.length > 5000) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }
  if (typeof feedback !== "string" || feedback.length > 4000) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }
  if (typeof nextStep !== "string" || nextStep.length > 1000) {
    return NextResponse.json({ error: "Invalid nextStep" }, { status: 400 });
  }

  const slug = getAcharyaSlugFromRequest(req);
  const moduleUuid = await resolveModuleId(slug, moduleId);

  const { error } = await dbForSlug(slug).from(tableFor(slug, "apply_logs")).insert({
    learner_id: session.learnerId,
    module_id: moduleUuid,
    log_type: "self_assessment",
    data: { input, score, feedback, nextStep, hasPhoto: !!hasPhoto },
  });

  if (error) {
    if (isMissingDbObject(error)) return NextResponse.json({ ok: true });
    console.error("apply log error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
