import { NextRequest, NextResponse } from "next/server";
import { dbForSlug, dbConfigured, SUPPORTED_ACHARYAS, publicAcharyaTable, isMissingDbObject, type AcharyaSlug } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/phone";
import { DEV_OTP, setLearnerCookie } from "@/lib/server/phone-auth";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

type UserRow = {
  id: string;
  phone?: string | null;
  name?: string | null;
  role?: string | null;
  preferred_lang?: string | null;
  is_admin?: boolean | null;
};

/**
 * POST /api/auth/phone/verify-otp
 * Body: { phone, otp, acharyaSlug? }
 *
 * If `acharyaSlug` is provided, checks only that acharya's users table.
 * Otherwise checks ALL acharya users tables. Pilot OTP is fixed at 123456.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(rateLimitKey(req.headers, null, "otp-verify"), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "Service not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as { phone?: string; otp?: string; acharyaSlug?: string };
  const phone = normalizeIndianPhone(String(b.phone || ""));
  const otp = String(b.otp || "").replace(/\D/g, "");

  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  }
  if (otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
  }
  if (otp !== DEV_OTP) {
    return NextResponse.json({ error: "Incorrect OTP. Try again." }, { status: 401 });
  }

  const phoneCandidates = [phone, phone.replace(/^\+91/, "")];

  // Determine which acharyas to check
  let acharyasToCheck: readonly AcharyaSlug[];
  if (b.acharyaSlug && (SUPPORTED_ACHARYAS as readonly string[]).includes(b.acharyaSlug)) {
    acharyasToCheck = [b.acharyaSlug as AcharyaSlug];
  } else {
    acharyasToCheck = SUPPORTED_ACHARYAS;
  }

  // Check acharya users tables, use first match
  let matchedSlug: AcharyaSlug | null = null;
  let matchedUser: UserRow | null = null;

  for (const a of acharyasToCheck) {
    const table = publicAcharyaTable(a, "users");
    const { data, error } = await dbForSlug(a)
      .from(table)
      .select("id, phone, name, role, preferred_lang, is_admin")
      .in("phone", phoneCandidates)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) {
      if (isMissingDbObject(error)) continue;
      console.error(`otp-verify lookup error for ${a}:`, error);
      continue;
    }
    if (data) {
      matchedSlug = a;
      matchedUser = data as UserRow;
      break;
    }
  }

  if (!matchedUser) {
    // Pilot mode — auto-create the user so any phone can log in.
    // Try creating in the first working acharya schema.
    for (const a of SUPPORTED_ACHARYAS) {
      const table = publicAcharyaTable(a, "users");
      const ins = await dbForSlug(a)
        .from(table)
        .insert({
          phone,
          name: `Pilot ${phone.slice(-4)}`,
          role: "learner",
          preferred_lang: "en",
          is_admin: false,
          is_active: true,
          is_deleted: false,
          last_seen_on: new Date().toISOString(),
        })
        .select("id, phone, name, role, preferred_lang, is_admin")
        .single();

      if (ins.error) {
        if (isMissingDbObject(ins.error)) continue;
        // Duplicate — might have been created by a concurrent request,
        // or exists but with is_deleted/is_active mismatch.
        if (ins.error.code === "23505" || /duplicate/i.test(ins.error.message || "")) {
          const existing = await dbForSlug(a)
            .from(table)
            .update({ is_active: true, is_deleted: false, last_seen_on: new Date().toISOString() })
            .eq("phone", phone)
            .select("id, phone, name, role, preferred_lang, is_admin")
            .single();
          if (!existing.error && existing.data) {
            matchedSlug = a;
            matchedUser = existing.data as UserRow;
            break;
          }
        }
        continue;
      }

      matchedSlug = a;
      matchedUser = ins.data as UserRow;
      break;
    }

    if (!matchedUser) {
      return NextResponse.json(
        { error: "Could not register. Ask admin to set up at least one acharya schema." },
        { status: 404 }
      );
    }
  }

  const user = matchedUser;
  const rawRole = (user.role || "learner").toLowerCase();
  const appRole: "user" | "admin" | "founder" =
    rawRole === "founder" ? "founder" : rawRole === "admin" ? "admin" : "user";
  const isAdmin = !!user.is_admin || appRole === "founder" || appRole === "admin";

  const matchedTable = publicAcharyaTable(matchedSlug!, "users");
  dbForSlug(matchedSlug!)
    .from(matchedTable)
    .update({ last_seen_on: new Date().toISOString() })
    .eq("id", user.id)
    .then(({ error: updateError }) => {
      if (updateError) console.warn("verify-otp last_seen update failed:", updateError.message);
    });

  const session = {
    learnerId: user.id,
    phone,
    name: user.name || "",
    roleSlug: rawRole,
    categorySlug: "",
    isAdmin,
  };

  const res = NextResponse.json({
    ok: true,
    learner: {
      id: session.learnerId,
      phone: session.phone,
      name: session.name,
      role: appRole,
      isAdmin,
      preferredLang: user.preferred_lang || "bn",
    },
  });
  await setLearnerCookie(res, session);
  return res;
}
