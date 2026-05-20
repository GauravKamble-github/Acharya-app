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

  const { moduleId, lang, userMessage, aiResponse, responseTimeMs } = body as {
    moduleId?: string;
    lang?: string;
    userMessage?: string;
    aiResponse?: string;
    responseTimeMs?: number;
  };

  if (!["bn", "hi", "en"].includes(lang || "")) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }
  if (typeof userMessage !== "string" || userMessage.length > 4000) {
    return NextResponse.json({ error: "Invalid userMessage" }, { status: 400 });
  }
  if (typeof aiResponse !== "string" || aiResponse.length > 8000) {
    return NextResponse.json({ error: "Invalid aiResponse" }, { status: 400 });
  }

  const rt = typeof responseTimeMs === "number" && Number.isFinite(responseTimeMs)
    ? Math.max(0, Math.min(120000, Math.round(responseTimeMs)))
    : null;

  const slug = getAcharyaSlugFromRequest(req);
  const moduleUuid = moduleId && moduleId.length <= 120
    ? await resolveModuleId(slug, moduleId)
    : null;

  const { error } = await dbForSlug(slug).from(tableFor(slug, "chat_logs")).insert({
    learner_id: session.learnerId,
    module_id: moduleUuid,
    lang,
    user_message: userMessage,
    ai_response: aiResponse,
    response_time_ms: rt,
  });

  if (error) {
    if (isMissingDbObject(error)) return NextResponse.json({ ok: true });
    console.error("chat log error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
