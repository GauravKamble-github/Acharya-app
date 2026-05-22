import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { dbConfigured, usingServiceRole, effectiveKeyRole } from "@/lib/server/supabase";

/**
 * Admin-only diagnostics. Learner-facing UI must not expose env names,
 * table names, secret lengths, or provider configuration details.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  return NextResponse.json({
    supabase: {
      dbConfigured,
      usingServiceRole,
      role: effectiveKeyRole,
      hasUrlEnv: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleEnv: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonEnv: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    admin: {
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      usingDefaultSessionSecret: process.env.SESSION_SECRET === "arjun-dev-secret-change-me",
    },
    other: {
      nodeEnv: process.env.NODE_ENV,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasGeminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      hasGoogleTtsKey: !!process.env.GOOGLE_TTS_KEY,
    },
  });
}
