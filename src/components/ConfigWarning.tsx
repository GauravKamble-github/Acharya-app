'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export default function ConfigWarning() {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.content.modules()
      .then(() => {
        if (!cancelled) setWarning(false);
      })
      .catch(() => {
        if (!cancelled) setWarning(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (!warning) return null;

  return (
    <div className="bg-terra/10 border border-terra/30 text-terra rounded-lg mx-3 mt-3 px-4 py-3 text-xs leading-relaxed">
      <strong>Learning content could not be loaded.</strong> Please refresh once. If it still fails, try again after a short while.
    </div>
  );
}
