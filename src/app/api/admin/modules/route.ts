import { NextResponse } from "next/server";
import {dbConfigured, dbForSlug, dbPublic, getCurrentAcharyaSlug, isMissingDbObject } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { tableFor } from "@/lib/server/acharya-data";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ modules: [] });

  const slug = await getCurrentAcharyaSlug();
  const { data: mods, error } = await dbPublic
    .from(tableFor(slug, "modules"))
    .select(`
      id, slug, sort_order, theory_hours, practical_hours, icon,
      group_key, group_label_en, group_label_bn, group_label_hi,
      title_en, title_bn, title_hi, status
    `)
    .eq("is_deleted", false)
    .order("sort_order");

  if (error) {
    if (isMissingDbObject(error)) return NextResponse.json({ modules: [] });
    return NextResponse.json({ error: "Failed to load modules" }, { status: 502 });
  }
  if (!mods) return NextResponse.json({ modules: [] });

  const moduleIds = mods.map((m) => m.id as string);
  const [{ data: sections }, { data: videos }] = await Promise.all([
    moduleIds.length
      ? dbPublic.from(tableFor(slug, "sections")).select("id,module_id,body_en,body_bn,body_hi").eq("is_deleted", false).in("module_id", moduleIds)
      : Promise.resolve({ data: [] }),
    moduleIds.length
      ? dbPublic.from(tableFor(slug, "videos")).select("id,module_id").eq("is_deleted", false).in("module_id", moduleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sectionCount: Record<string, number> = {};
  const contentCount: Record<string, number> = {};
  (sections || []).forEach((s: Record<string, unknown>) => {
    const mid = String(s.module_id || "");
    sectionCount[mid] = (sectionCount[mid] || 0) + 1;
    if (s.body_en || s.body_bn || s.body_hi) contentCount[mid] = (contentCount[mid] || 0) + 1;
  });

  const videoCount: Record<string, number> = {};
  (videos || []).forEach((v: Record<string, unknown>) => {
    const mid = String(v.module_id || "");
    videoCount[mid] = (videoCount[mid] || 0) + 1;
  });

  const enriched = mods.map((m) => ({
    ...m,
    title_en: m.title_en || "",
    title_bn: m.title_bn || m.title_en || "",
    title_hi: m.title_hi || m.title_en || "",
    sectionCount: sectionCount[m.id] || 0,
    contentCount: contentCount[m.id] || 0,
    videoCount: videoCount[m.id] || 0,
  }));

  return NextResponse.json({ modules: enriched });
}
