import type { CSSProperties } from "react";
import { currentAcharyaBrand } from "@/lib/acharya-client";

interface AvatarProps {
  size?: number;
  ring?: boolean;
  useImage?: boolean;
  className?: string;
}

export function Avatar({ size = 48, ring = true, className = "" }: AvatarProps) {
  const brand = currentAcharyaBrand();
  const ringPx = Math.max(1.5, size / 28);
  const style: CSSProperties = {
    width: size,
    height: size,
    background: "radial-gradient(circle at 35% 30%, #3d6f48, var(--color-forest-deep) 75%)",
    border: ring ? `${ringPx}px solid var(--color-gold)` : "none",
    color: "var(--color-cream)",
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: brand.initials.length > 1 ? size * 0.38 : size * 0.55,
    fontWeight: 500,
    lineHeight: 1,
    boxShadow:
      size > 60
        ? "0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 24px rgba(24,51,33,0.25)"
        : undefined,
  };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={style}
      aria-label={brand.name}
    >
      <span style={{ transform: "translateY(-2%)" }}>{brand.initials}</span>
    </div>
  );
}
