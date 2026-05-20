import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAcharyaSlug, type AcharyaSlug } from "./supabase";

const COOKIE_NAME = "acharya-learner-session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "arjun-dev-secret-change-me"; // prod MUST override

// OTP for the pilot: always 123456. Per-Acharya `dev_otp` on gurukul.acharya_config
// can override this later; reading it adds a round-trip, so we keep a constant
// fallback for now.
export const DEV_OTP = "123456";

export interface LearnerSession {
  learnerId: string;
  phone: string;
  name: string;
  roleSlug: string;       // founder | admin | instructor | learner
  categorySlug: string;   // internal_staff | field_worker | gardener | …
  isAdmin: boolean;       // role in {founder, admin}
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createToken(session: Omit<LearnerSession, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ ...session, exp }), "utf8").toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function parseToken(token: string): LearnerSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof decoded.exp !== "number" || decoded.exp * 1000 < Date.now()) return null;
    if (typeof decoded.learnerId !== "string" || typeof decoded.phone !== "string") return null;
    return decoded as LearnerSession;
  } catch {
    return null;
  }
}

function learnerCookieName(slug: AcharyaSlug): string {
  return `${slug}-learner-session`;
}

export async function getLearnerSession(): Promise<LearnerSession | null> {
  const slug = await getCurrentAcharyaSlug();
  const store = await cookies();
  const c = store.get(learnerCookieName(slug)) || store.get(COOKIE_NAME);
  if (!c) return null;
  return parseToken(c.value);
}

export async function setLearnerCookie(res: NextResponse, session: Omit<LearnerSession, "exp">) {
  const slug = await getCurrentAcharyaSlug();
  const token = createToken(session);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  } as const;
  res.cookies.set(learnerCookieName(slug), token, cookieOptions);
  res.cookies.set(COOKIE_NAME, token, cookieOptions);
}

export async function clearLearnerCookie(res: NextResponse) {
  const slug = await getCurrentAcharyaSlug();
  for (const name of [learnerCookieName(slug), COOKIE_NAME]) {
    res.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  }
}

export { COOKIE_NAME as LEARNER_COOKIE_NAME };
