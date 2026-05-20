"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api-client";
import { useStore } from "@/lib/store";

interface Props {
  className?: string;
  fullWidth?: boolean;
  compact?: boolean;
  onLoggedOut?: () => void;
}

export default function LogoutButton({
  className = "",
  fullWidth = false,
  compact = false,
  onLoggedOut,
}: Props) {
  const router = useRouter();
  const clearUser = useStore((state) => state.clearUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      await api.phoneAuth.logout();
      clearUser();
      onLoggedOut?.();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setLoggingOut(false);
    }
  }

  const label = loggingOut ? "Signing out..." : "Sign out";

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title="Sign out"
        aria-label={label}
        className={`inline-flex items-center justify-center gap-2 border border-line bg-cream text-ink font-semibold transition-colors hover:bg-sage active:bg-sage-deep disabled:opacity-60 ${
          fullWidth ? "w-full px-4 py-3 rounded-xl text-sm justify-between" : "px-3 py-1.5 rounded-full text-[13px]"
        } ${className}`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="logOut" size={compact ? 15 : 17} strokeWidth={2} />
          {!compact && <span>{label}</span>}
        </span>
        {fullWidth && <Icon name="arrowR" size={16} />}
      </button>
      {error && (
        <p className="mt-1.5 text-[11px] font-medium text-terra">{error}</p>
      )}
    </div>
  );
}
