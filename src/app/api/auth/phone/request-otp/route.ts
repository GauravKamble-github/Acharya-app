import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/phone";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * POST /api/auth/phone/request-otp
 * Body: { phone }
 *
 * Pilot mode: accepts any valid phone number. No SMS is sent.
 * Verification uses the fixed OTP 123456.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(rateLimitKey(req.headers, null, "otp-request"), 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const phone = normalizeIndianPhone(String((body as { phone?: string }).phone || ""));
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit Indian mobile number." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, phone });
}
