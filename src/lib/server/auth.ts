import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAcharyaSlug, type AcharyaSlug } from "./supabase";

const COOKIE_NAME = "acharya-admin-session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@arjun.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  // Dev fallback — a deploy MUST set SESSION_SECRET, otherwise cookies are invalid across restarts.
  "arjun-dev-secret-change-me";

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

/** Check credentials against env vars. Returns true on success. */
export function verifyAdminCredentials(email: string, password: string): boolean {
  if (!email || !password || !ADMIN_PASSWORD) return false;
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()) return false;
  // constant-time compare
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createToken(email: string): string {
  // Encode the email as base64url so it can't contain the '.' separator.
  // Using encodeURIComponent was wrong because `.` isn't percent-encoded,
  // and any email like "user@example.com" produced a 4-piece token that
  // parseToken rejected.
  const emailEnc = Buffer.from(email, "utf8").toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${emailEnc}.${exp}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

interface Session {
  email: string;
  exp: number;
}

function parseToken(token: string): Session | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailEnc, expStr, sig] = parts;
  const expected = sign(`${emailEnc}.${expStr}`);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  let email: string;
  try {
    email = Buffer.from(emailEnc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return { email, exp };
}

export async function getAdminSession(): Promise<Session | null> {
  const slug = await getCurrentAcharyaSlug();
  const store = await cookies();
  const c = store.get(adminCookieName(slug)) || store.get(COOKIE_NAME);
  if (!c) return null;
  const session = parseToken(c.value);
  if (!session) return null;
  if (session.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;
  return session;
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const s = await getAdminSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

function adminCookieName(slug: AcharyaSlug): string {
  return `${slug}-admin-session`;
}

export async function setAdminCookie(res: NextResponse, email: string) {
  const slug = await getCurrentAcharyaSlug();
  const token = createToken(email);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  } as const;
  res.cookies.set(adminCookieName(slug), token, cookieOptions);
  res.cookies.set(COOKIE_NAME, token, cookieOptions);
}

export async function clearAdminCookie(res: NextResponse) {
  const slug = await getCurrentAcharyaSlug();
  for (const name of [adminCookieName(slug), COOKIE_NAME]) {
    res.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  }
}

export { COOKIE_NAME };
