import { NextRequest, NextResponse } from "next/server";
import {dbForSlug, dbConfigured, getAcharyaSlugFromRequest, isMissingDbObject } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";
import { tableFor } from "@/lib/server/acharya-data";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

const MAX_EVENT_DATA_BYTES = 2048;

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { eventType, eventData } = body as {
    eventType?: string;
    eventData?: Record<string, unknown>;
  };

  if (!eventType || typeof eventType !== "string" || eventType.length > 60) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  let data: Record<string, unknown> | null = null;
  if (eventData && typeof eventData === "object") {
    const serialised = JSON.stringify(eventData);
    if (serialised.length > MAX_EVENT_DATA_BYTES) {
      return NextResponse.json({ error: "eventData too large" }, { status: 413 });
    }
    data = eventData;
  }

  const slug = getAcharyaSlugFromRequest(req);
  const { error } = await dbForSlug(slug).from(tableFor(slug, "events")).insert({
    learner_id: session.learnerId,
    event_type: eventType,
    event_data: data,
  });

  if (error) {
    // Table not yet created for this acharya — accept silently
    if (isMissingDbObject(error)) return NextResponse.json({ ok: true });
    console.error("event error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
