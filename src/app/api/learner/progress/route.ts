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

  const { moduleId, sectionsCompleted, completed } = body as {
    moduleId?: string;
    sectionsCompleted?: string[];
    completed?: boolean;
  };

  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (!Array.isArray(sectionsCompleted) || sectionsCompleted.length > 200) {
    return NextResponse.json({ error: "Invalid sectionsCompleted" }, { status: 400 });
  }

  const slug = getAcharyaSlugFromRequest(req);
  const moduleUuid = await resolveModuleId(slug, moduleId);
  if (!moduleUuid) return NextResponse.json({ error: "Unknown module" }, { status: 404 });

  const clean = sectionsCompleted.filter(
    (id) => typeof id === "string" && id.length > 0 && id.length <= 200
  );

  const { error } = await dbForSlug(slug)
    .from(tableFor(slug, "progress"))
    .upsert(
      {
        learner_id: session.learnerId,
        module_id: moduleUuid,
        sections_completed: clean,
        completed: !!completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "learner_id,module_id" }
    );

  if (error) {
    if (isMissingDbObject(error)) return NextResponse.json({ ok: true });
    console.error("progress upsert error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
