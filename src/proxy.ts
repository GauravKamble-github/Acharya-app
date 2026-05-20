import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_SLUGS, getDefaultAcharya } from "@/lib/acharya-config";

const ACHARYA_SET = new Set(SUPPORTED_SLUGS);
const DEFAULT_ACHARYA = process.env.NEXT_PUBLIC_DEFAULT_ACHARYA || getDefaultAcharya().slug;

function slugFromPath(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return first && ACHARYA_SET.has(first) ? first : null;
}

function slugFromReferer(req: NextRequest): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    return slugFromPath(new URL(ref).pathname);
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (req.headers.get("x-acharya-slug")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/brand/")
  ) {
    return NextResponse.next();
  }

  const apiSlug = pathname.match(/^\/api\/([^/]+)(\/.*)?$/)?.[1];
  if (apiSlug && ACHARYA_SET.has(apiSlug)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-acharya-slug", apiSlug);
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/api${pathname.replace(`/api/${apiSlug}`, "") || "/"}`;
    return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  }

  const pageSlug = slugFromPath(pathname);
  if (pageSlug) {
    const pathWithoutSlug = pathname.replace(`/${pageSlug}`, "") || "/";
    if (pathWithoutSlug === "/admin" || pathWithoutSlug.startsWith("/admin/")) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = pathWithoutSlug;
      if (pageSlug !== DEFAULT_ACHARYA && !redirectUrl.searchParams.has("acharya")) {
        redirectUrl.searchParams.set("acharya", pageSlug);
      }
      return NextResponse.redirect(redirectUrl);
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-acharya-slug", pageSlug);
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = pathWithoutSlug;
    return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  }

  const sectionRoutes = [
    "/start",
    "/learn",
    "/video",
    "/quiz",
    "/ask",
    "/apply",
    "/progress",
    "/tools",
    "/tech",
  ];
  if (sectionRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const slug = slugFromReferer(req) || DEFAULT_ACHARYA;
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = `/${slug}${pathname}`;
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
