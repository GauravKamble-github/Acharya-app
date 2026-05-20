import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, dbForSlug, getCurrentAcharyaSlug } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ ok: true });

  const { id } = await ctx.params;
  if (!id || id.length > 80) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const record = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof record.sort_order === "number") patch.sort_order = record.sort_order;
  if (typeof record.estimated_hours === "number") patch.estimated_hours = record.estimated_hours;
  for (const field of ["title_en", "title_hi", "title_bn"] as const) {
    if (typeof record[field] === "string" && record[field].length <= 500) {
      patch[field] = record[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const slug = await getCurrentAcharyaSlug();
  const { error } = await dbForSlug(slug).from(tableFor(slug, "sections")).update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ ok: true });

  const { id } = await ctx.params;
  if (!id || id.length > 80) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const slug = await getCurrentAcharyaSlug();
  const { error } = await dbForSlug(slug)
    .from(tableFor(slug, "sections"))
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
