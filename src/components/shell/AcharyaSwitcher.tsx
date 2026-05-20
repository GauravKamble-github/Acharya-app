"use client";

import { useState, useRef, useEffect } from "react";
import {
  ACHARYA_BRANDS,
  ACHARYA_COLORS,
  acharyaRouteFor,
  currentAcharyaBrand,
  stripAcharyaPrefix,
} from "@/lib/acharya-client";
import { Icon } from "@/components/ui/Icon";

interface Props {
  className?: string;
  fullWidth?: boolean;
}

export default function AcharyaSwitcher({ className = "", fullWidth = false }: Props) {
  const brand = currentAcharyaBrand();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className={`relative min-w-0 ${fullWidth ? "w-full" : "w-fit"} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-cream px-3 py-1.5 text-left transition-colors hover:bg-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 ${
          fullWidth ? "w-full justify-between" : "w-[8.25rem] xl:w-[9rem] 2xl:w-[10rem]"
        }`}
        aria-label="Switch acharya"
        aria-expanded={open}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: ACHARYA_COLORS[brand.slug] || "#264E2E" }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-ink">
          {brand.shortName}
        </span>
        <Icon name="chevD" size={12} className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg"
          style={{
            minWidth: fullWidth ? btnRef.current?.offsetWidth ?? 0 : 272,
            right: 0,
            width: fullWidth ? "100%" : "min(20rem, calc(100vw - 2rem))",
          }}
        >
          {Object.values(ACHARYA_BRANDS).map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => {
                setOpen(false);
                if (item.slug === brand.slug) return;
                const currentPath = stripAcharyaPrefix(window.location.pathname) || "/";
                window.location.href = `${acharyaRouteFor(item.slug, currentPath)}${window.location.search}`;
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-sage ${
                item.slug === brand.slug ? "bg-cream" : ""
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: ACHARYA_COLORS[item.slug] || "#264E2E" }}
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-serif text-sm leading-tight text-ink">{item.name}</span>
                <span className="block truncate text-[10px] text-muted">{item.description}</span>
              </div>
              {item.slug === brand.slug && (
                <Icon name="check" size={14} className="text-forest ml-auto shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
