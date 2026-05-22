"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  ACHARYA_BRANDS,
  currentAcharyaSlug,
  type ClientAcharyaBrand,
  type ClientAcharyaSlug,
} from "./acharya-client";

interface AdminAcharyaContextValue {
  activeSlug: ClientAcharyaSlug;
  activeBrand: ClientAcharyaBrand;
  setActiveSlug: (slug: ClientAcharyaSlug) => void;
}

const AdminAcharyaContext = createContext<AdminAcharyaContextValue | null>(null);

export function AdminAcharyaProvider({ children }: { children: React.ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<ClientAcharyaSlug>(() => currentAcharyaSlug());

  const value = useMemo<AdminAcharyaContextValue>(() => {
    return {
      activeSlug,
      activeBrand: ACHARYA_BRANDS[activeSlug],
      setActiveSlug,
    };
  }, [activeSlug]);

  return (
    <AdminAcharyaContext.Provider value={value}>
      {children}
    </AdminAcharyaContext.Provider>
  );
}

export function useAdminAcharya() {
  const ctx = useContext(AdminAcharyaContext);
  if (!ctx) throw new Error("useAdminAcharya must be used inside AdminAcharyaProvider");
  return ctx;
}
