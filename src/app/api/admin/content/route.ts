import { NextRequest, NextResponse } from "next/server";
import {dbConfigured, dbForSlug, getCurrentAcharyaSlug } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { sectionId, lang, body: text } = body as {
    sectionId?: string;
    lang?: string;
    body?: string;
  };

  if (!sectionId || typeof sectionId !== "string" || sectionId.length > 80) {
    return NextResponse.json({ error: "Invalid sectionId" }, { status: 400 });
  }
  if (!["bn", "hi", "en"].includes(lang || "")) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }
  if (typeof text !== "string" || text.length > 50000) {
    return NextResponse.json({ error: "Invalid body text" }, { status: 400 });
  }

  const slug = await getCurrentAcharyaSlug();
  const { error } = await dbForSlug(slug)
    .from(tableFor(slug, "sections"))
    .update({ [`body_${lang}`]: text, status: "published", updated_at: new Date().toISOString() })
    .eq("id", sectionId);

  if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
