import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const commodity = url.searchParams.get("commodity") || "Paddy";
  const state = url.searchParams.get("state") || "";
  const apiKey = (process.env.DATA_GOV_API_KEY || "").trim();

  if (!apiKey) {
    return NextResponse.json({
      source: "manual",
      records: [],
      note: "Add DATA_GOV_API_KEY to .env.local for live Agmarknet/data.gov.in mandi prices.",
      query: { commodity, state },
    });
  }

  const qs = new URLSearchParams({
    "api-key": apiKey,
    format: "json",
    limit: "10",
    "filters[commodity]": commodity,
  });
  if (state) qs.set("filters[state]", state);

  try {
    const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${qs}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];
    return NextResponse.json({
      source: "data.gov.in",
      records,
      note: records.length === 0 ? "No mandi records found for this crop/state. Try another commodity spelling." : undefined,
      query: { commodity, state },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    console.error("mandi price error:", detail);
    return NextResponse.json({
      source: "error",
      records: [],
      note: "Could not load mandi prices right now. Check DATA_GOV_API_KEY and data.gov.in availability.",
    });
  }
}
