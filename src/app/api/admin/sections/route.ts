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

  const { moduleId, sortOrder } = body as { moduleId?: string; sortOrder?: number };
  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 80) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }

  const slug = await getCurrentAcharyaSlug();
  const { data: section, error } = await dbForSlug(slug)
    .from(tableFor(slug, "sections"))
    .insert({
      module_id: moduleId,
      slug: `section-${Date.now()}`,
      title_en: "New Section",
      title_hi: "New Section",
      title_bn: "New Section",
      body_en: "",
      body_hi: "",
      body_bn: "",
      status: "draft",
      sort_order: typeof sortOrder === "number" ? sortOrder : 1,
      estimated_hours: 1,
      is_deleted: false,
    })
    .select("id")
    .single();

  if (error || !section) {
    console.error("add section:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
