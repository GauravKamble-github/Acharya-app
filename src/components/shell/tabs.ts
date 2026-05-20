import type { IconName } from "@/components/ui/Icon";
import { featureEnabled } from "@/lib/acharya-client";

export type TabKey = "home" | "learn" | "quiz" | "video" | "ask" | "apply" | "tools" | "me";

export interface TabDef {
  key: TabKey;
  labelKey: "home" | "learn" | "quiz" | "video" | "ask" | "apply" | "tools" | "progress";
  icon: IconName;
  primary: string;
  routes: string[];
}

export const TABS: TabDef[] = [
  { key: "home",  labelKey: "home",     icon: "home",  primary: "/",         routes: ["/"] },
  { key: "learn", labelKey: "learn",    icon: "book",  primary: "/learn",    routes: ["/learn"] },
  { key: "video", labelKey: "video",    icon: "play",  primary: "/video",    routes: ["/video"] },
  { key: "quiz",  labelKey: "quiz",     icon: "quiz",  primary: "/quiz",     routes: ["/quiz"] },
  { key: "ask",   labelKey: "ask",      icon: "chat",  primary: "/ask",      routes: ["/ask"] },
  { key: "apply", labelKey: "apply",    icon: "hand",  primary: "/apply",    routes: ["/apply"] },
  { key: "tools", labelKey: "tools",    icon: "calendar", primary: "/tools", routes: ["/tools"] },
  { key: "me",    labelKey: "progress", icon: "chart", primary: "/progress", routes: ["/progress"] },
];

export function visibleTabs(): TabDef[] {
  return TABS.filter((tab) => tab.key !== "tools" || featureEnabled("tools"));
}

export function activeTabKey(pathname: string): TabKey {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && ["arjun", "farmer", "vajra", "taksha"].includes(parts[0])) {
    pathname = `/${parts.slice(1).join("/")}`;
    if (pathname === "/") pathname = "/";
  }
  if (pathname === "/") return "home";
  for (const tab of visibleTabs()) {
    if (tab.key === "home") continue;
    if (tab.routes.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return tab.key;
    }
  }
  return "home";
}
