"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import LogoutButton from "@/components/auth/LogoutButton";
import AcharyaSwitcher from "./AcharyaSwitcher";
import { useStore } from "@/lib/store";
import { t } from "@/lib/i18n/labels";
import { activeTabKey, visibleTabs } from "./tabs";
import { useShellNavigation } from "./ShellNavigation";
import { ModuleSelector, LangSelector } from "./Selectors";
import { acharyaRoute, currentAcharyaBrand, stripAcharyaPrefix } from "@/lib/acharya-client";

interface Props {
  className?: string;
}

export default function TopNavBar({ className = "" }: Props) {
  const { activePath, navigateInShell } = useShellNavigation();
  const { lang } = useStore();
  const brand = currentAcharyaBrand();
  const cleanPath = stripAcharyaPrefix(activePath);

  if (cleanPath.startsWith("/admin")) return null;

  const active = activeTabKey(activePath);

  return (
    <header
      className={`sticky top-0 z-40 hidden border-b border-line bg-paper/95 backdrop-blur lg:block ${className}`}
    >
      <div className="w-full max-w-[96rem] mx-auto px-3 lg:px-4 2xl:px-6 py-2.5">
        <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 2xl:flex-nowrap 2xl:gap-3">
          {/* Left: brand */}
          <Link
            href={acharyaRoute("/")}
            className="order-1 flex min-w-0 shrink-0 items-center gap-2"
            aria-label="Home"
          >
            <Avatar size={28} useImage />
            <div className="hidden leading-tight 2xl:block">
              <div className="font-serif italic text-sm xl:text-base text-ink">{brand.name}</div>
              <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-muted">
                {brand.tagline}
              </div>
            </div>
          </Link>

          <AcharyaSwitcher className="order-2 shrink-0" />

          {/* Center: scrollable tabs */}
          <nav
            aria-label="Primary"
            className="order-4 min-w-0 flex-[1_1_100%] overflow-x-auto hide-scrollbar 2xl:order-3 2xl:flex-1"
          >
            <ul className="inline-flex min-w-max items-center gap-0.5 rounded-full border border-line bg-cream p-0.5">
              {visibleTabs().map((tab) => {
                const isActive = tab.key === active;
                return (
                  <li key={tab.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => navigateInShell(tab.primary)}
                      className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-full text-[12px] lg:text-[13px] font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? "bg-forest text-cream"
                          : "text-ink hover:bg-sage"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                      title={t(tab.labelKey, lang)}
                    >
                      <Icon name={tab.icon} size={14} strokeWidth={isActive ? 2 : 1.75} />
                      <span className="hidden lg:inline">{t(tab.labelKey, lang)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Right: controls */}
          <div className="order-3 ml-auto flex min-w-0 max-w-full shrink-0 items-center gap-1.5 lg:gap-2 2xl:order-4">
            <ModuleSelector />
            <LangSelector />
            <LogoutButton compact />
          </div>
        </div>
      </div>
    </header>
  );
}
