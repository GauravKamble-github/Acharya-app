import { NextResponse } from "next/server";
import { dbConfigured, dbForSlug, getCurrentAcharyaSlug } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ module: null, sections: [] });

  const { id } = await ctx.params;
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const slug = await getCurrentAcharyaSlug();
  const { data: mod, error: mErr } = await dbForSlug(slug)
    .from(tableFor(slug, "modules"))
    .select(`
      id, slug, sort_order, theory_hours, practical_hours, icon,
      group_key, group_label_en, group_label_bn, group_label_hi,
      title_en, title_bn, title_hi, status
    `)
    .eq("id", id)
    .single();
  if (mErr || !mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sections, error: sErr } = await dbForSlug(slug)
    .from(tableFor(slug, "sections"))
    .select(`
      id, slug, module_id, sort_order, estimated_hours,
      title_en, title_bn, title_hi, body_en, body_bn, body_hi, status
    `)
    .eq("module_id", id)
    .eq("is_deleted", false)
    .order("sort_order");
  if (sErr) return NextResponse.json({ error: "Failed to load sections" }, { status: 502 });

  const mappedSections = (sections || []).map((s) => ({
    ...s,
    title_en: s.title_en || "",
    title_bn: s.title_bn || s.title_en || "",
    title_hi: s.title_hi || s.title_en || "",
    content: {
      en: s.body_en != null ? { id: `${s.id}:en`, lang: "en", body: s.body_en, status: s.status || "published" } : null,
      bn: s.body_bn != null ? { id: `${s.id}:bn`, lang: "bn", body: s.body_bn, status: s.status || "published" } : null,
      hi: s.body_hi != null ? { id: `${s.id}:hi`, lang: "hi", body: s.body_hi, status: s.status || "published" } : null,
    },
  }));

  return NextResponse.json({
    module: {
      ...mod,
      title_en: mod.title_en || "",
      title_bn: mod.title_bn || mod.title_en || "",
      title_hi: mod.title_hi || mod.title_en || "",
    },
    sections: mappedSections,
  });
}
