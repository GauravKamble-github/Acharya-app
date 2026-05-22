"use client";

import { createContext, useContext } from "react";

interface ShellNavigationValue {
  activePath: string;
  navigateInShell: (path: string) => void;
}

export const SHELL_NAV_PATHS = new Set([
  "/",
  "/learn",
  "/video",
  "/quiz",
  "/ask",
  "/apply",
  "/tools",
  "/progress",
]);

export function normalizeShellPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const withoutQuery = clean.split("?")[0].split("#")[0] || "/";
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/$/, "") : withoutQuery;
  return SHELL_NAV_PATHS.has(trimmed) ? trimmed : "/";
}

const ShellNavigationContext = createContext<ShellNavigationValue | null>(null);

export function ShellNavigationProvider({
  value,
  children,
}: {
  value: ShellNavigationValue;
  children: React.ReactNode;
}) {
  return (
    <ShellNavigationContext.Provider value={value}>
      {children}
    </ShellNavigationContext.Provider>
  );
}

export function useShellNavigation() {
  const ctx = useContext(ShellNavigationContext);
  if (!ctx) throw new Error("useShellNavigation must be used inside ShellNavigationProvider");
  return ctx;
}
