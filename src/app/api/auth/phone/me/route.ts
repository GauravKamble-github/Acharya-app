import { NextResponse } from "next/server";
import { clearLearnerCookie, getLearnerSession, setLearnerCookie } from "@/lib/server/phone-auth";
import { dbForSlug, dbConfigured, getCurrentAcharyaSlug, isMissingDbObject } from "@/lib/server/supabase";
import { tableFor } from "@/lib/server/acharya-data";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

function appRole(roleSlug: string): "user" | "admin" | "founder" {
  if (roleSlug === "founder") return "founder";
  if (roleSlug === "admin") return "admin";
  return "user";
}

export async function GET() {
  const s = await getLearnerSession();
  if (!s) {
    return NextResponse.json({ learner: null });
  }

  const fallbackLearner = {
    id: s.learnerId,
    phone: s.phone,
    name: s.name,
    role: appRole(s.roleSlug),
    isAdmin: s.isAdmin,
  };

  if (!dbConfigured) {
    return NextResponse.json({ learner: fallbackLearner });
  }

  const slug = await getCurrentAcharyaSlug();
  const usersTable = tableFor(slug, "users");
  const { data, error } = await dbForSlug(slug)
    .from(usersTable)
    .select("id, phone, name, role, preferred_lang, is_admin")
    .eq("id", s.learnerId)
    .eq("is_deleted", false)
    .eq("is_active", true)
    .maybeSingle();

  interface UserRow {
    id: string;
    phone?: string | null;
    name?: string | null;
    role?: string | null;
    preferred_lang?: string | null;
    is_admin?: boolean | null;
  }

  let active: UserRow | null = data as UserRow | null;

  if (!active && !error) {
    const phoneCandidates = [s.phone, s.phone.replace(/^\+91/, "")];
    const byPhone = await dbForSlug(slug)
      .from(usersTable)
      .select("id, phone, name, role, preferred_lang, is_admin")
      .in("phone", phoneCandidates)
      .eq("is_deleted", false)
      .eq("is_active", true)
      .maybeSingle();
    if (byPhone.error) {
      console.error("[auth/me] learner phone lookup error:", byPhone.error);
    } else {
      active = byPhone.data as UserRow | null;
    }
  }

  if (error) {
    if (isMissingDbObject(error)) {
      // Schema not yet created for this acharya.
      // Don't clear the session — fall through to auto-create below.
      console.warn(`[auth/me] ${usersTable} missing — schema not set up for ${slug}. Will attempt auto-create.`);
    } else {
      console.error("[auth/me] learner lookup error:", error);
      return NextResponse.json({ learner: fallbackLearner });
    }
  }

  if (!active) {
    // Auto-create the user in this acharya's users table so cross-acharya
    // navigation (login → select → enter) works seamlessly.
    const ins = await dbForSlug(slug)
      .from(usersTable)
      .insert({
        phone: s.phone,
        name: s.name || `Pilot ${slug}`,
        role: s.roleSlug || "learner",
        preferred_lang: "en",
        is_admin: s.isAdmin,
        is_active: true,
        is_deleted: false,
        last_seen_on: new Date().toISOString(),
      })
      .select("id, phone, name, role, preferred_lang, is_admin")
      .single();

    if (ins.error) {
      // If duplicate phone, the user already exists — re-activate and fetch
      if (ins.error.code === "23505" || /duplicate/i.test(ins.error.message || "")) {
        const existing = await dbForSlug(slug)
          .from(usersTable)
          .update({ is_active: true, is_deleted: false, last_seen_on: new Date().toISOString() })
          .eq("phone", s.phone)
          .select("id, phone, name, role, preferred_lang, is_admin")
          .single();
        if (!existing.error && existing.data) {
          active = existing.data as unknown as UserRow;
        }
      }
      if (!active) {
        // If schema doesn't exist yet, let the user in with fallback data
        // so they aren't stuck in a login loop.
        if (isMissingDbObject(ins.error)) {
          console.warn(`[auth/me] cannot auto-create — ${usersTable} schema not set up for ${slug}`);
          const res = NextResponse.json({ learner: fallbackLearner });
          await setLearnerCookie(res, {
            learnerId: s.learnerId,
            phone: s.phone,
            name: s.name,
            roleSlug: s.roleSlug || "learner",
            categorySlug: "",
            isAdmin: s.isAdmin,
          });
          return res;
        }
        console.error(`[auth/me] auto-create failed for ${slug}:`, ins.error.message);
        const res = NextResponse.json({ learner: fallbackLearner });
        await clearLearnerCookie(res);
        return res;
      }
    } else {
      active = ins.data as unknown as UserRow;
    }
  }

  const rawRole = (active.role || s.roleSlug || "learner").toLowerCase();
  const learner = {
    id: active.id,
    phone: s.phone,
    name: active.name || s.name,
    role: appRole(rawRole),
    isAdmin: !!active.is_admin || rawRole === "admin" || rawRole === "founder",
    preferredLang: active.preferred_lang || undefined,
  };

  const res = NextResponse.json({ learner });
  if (active.id !== s.learnerId) {
    await setLearnerCookie(res, {
      learnerId: active.id,
      phone: s.phone,
      name: learner.name,
      roleSlug: rawRole,
      categorySlug: "",
      isAdmin: learner.isAdmin,
    });
  }
  return res;
}
