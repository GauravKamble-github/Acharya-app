'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api, currentAcharyaSlug } from '@/lib/api-client';

/**
 * Loads module list into zustand store on first mount via
 * GET /api/content/modules. No direct Supabase in the client bundle.
 */
export default function ModuleLoader() {
  const pathname = usePathname();
  const { setModules, setAcharyaContext } = useStore();
  const loadSeq = useRef(0);

  useEffect(() => {
    const slug = currentAcharyaSlug();
    const seq = ++loadSeq.current;
    let cancelled = false;

    setAcharyaContext(slug);

    api.content.modules()
      .then((mods) => {
        if (!cancelled && seq === loadSeq.current) setModules(mods || []);
      })
      .catch((err) => {
        console.error('Failed to load modules:', err);
        if (!cancelled && seq === loadSeq.current) setModules([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, setAcharyaContext, setModules]);

  return null;
}
