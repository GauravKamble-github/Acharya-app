"use client";

import { ACHARYAS, SUPPORTED_SLUGS, ACHARYA_BY_SLUG, ACHARYA_COLORS, getDefaultAcharya, type AcharyaDef } from "./acharya-config";

export type ClientAcharyaSlug = typeof SUPPORTED_SLUGS[number];

export interface ClientAcharyaBrand {
  slug: ClientAcharyaSlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  initials: string;
  themeColor: string;
}

function toClientBrand(a: AcharyaDef): ClientAcharyaBrand {
  return { slug: a.slug, name: a.name, shortName: a.shortName, tagline: a.tagline, description: a.description, initials: a.initials, themeColor: a.themeColor };
}

// Keep the old export for backward compatibility
export const ACHARYA_BRANDS: Record<string, ClientAcharyaBrand> = {};
for (const a of ACHARYAS) ACHARYA_BRANDS[a.slug] = toClientBrand(a);

export function currentAcharyaSlug(): ClientAcharyaSlug {
  if (typeof window === "undefined") return getDefaultAcharya().slug as ClientAcharyaSlug;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const first = parts[0] || "";
  if ((SUPPORTED_SLUGS as readonly string[]).includes(first)) {
    return first as ClientAcharyaSlug;
  }

  const adminSlug = first === "admin"
    ? new URLSearchParams(window.location.search).get("acharya") || ""
    : "";
  if ((SUPPORTED_SLUGS as readonly string[]).includes(adminSlug)) {
    return adminSlug as ClientAcharyaSlug;
  }

  return getDefaultAcharya().slug as ClientAcharyaSlug;
}

export function currentAcharyaBrand(): ClientAcharyaBrand {
  const slug = currentAcharyaSlug();
  return ACHARYA_BRANDS[slug] || toClientBrand(getDefaultAcharya());
}

export function stripAcharyaPrefix(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && ACHARYA_BY_SLUG[parts[0]]) {
    return `/${parts.slice(1).join("/")}` || "/";
  }
  return pathname || "/";
}

function normalizeAcharyaPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return stripAcharyaPrefix(clean);
}

export function acharyaRoute(path: string): string {
  const slug = currentAcharyaSlug();
  const clean = normalizeAcharyaPath(path);
  return `/${slug}${clean === "/" ? "" : clean}`;
}

export function acharyaRouteFor(slug: string, path: string): string {
  const clean = normalizeAcharyaPath(path);
  return `/${slug}${clean === "/" ? "" : clean}`;
}

export function adminRoute(path: string, slug = currentAcharyaSlug()): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!clean.startsWith("/admin")) return acharyaRouteFor(slug, clean);
  if (typeof window === "undefined") return clean;

  const url = new URL(clean, window.location.origin);
  const defaultSlug = getDefaultAcharya().slug;
  if (slug && slug !== defaultSlug) url.searchParams.set("acharya", slug);
  else url.searchParams.delete("acharya");

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function featureEnabled(feature: "tools" | "weather" | "mandi" | "telegram" | "imageQuestions"): boolean {
  const slug = currentAcharyaSlug();
  if (slug !== "farmer") return false;
  return ["tools", "weather", "mandi", "telegram", "imageQuestions"].includes(feature);
}

export { ACHARYA_COLORS };
