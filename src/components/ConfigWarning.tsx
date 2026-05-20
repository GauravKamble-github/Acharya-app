'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

type WarningKind = 'env' | 'data';

export default function ConfigWarning() {
  const [warning, setWarning] = useState<WarningKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.content.modules()
      .then(() => {
        if (!cancelled) setWarning(null);
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const res = await fetch('/api/debug/env', { credentials: 'same-origin' });
          const diag = await res.json();
          const configured = !!diag?.supabase?.dbConfigured;
          if (!cancelled) setWarning(configured ? 'data' : 'env');
        } catch {
          if (!cancelled) setWarning('data');
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (!warning) return null;

  return (
    <div className="bg-terra/10 border border-terra/30 text-terra rounded-lg mx-3 mt-3 px-4 py-3 text-xs leading-relaxed">
      {warning === 'env' ? (
        <>
          <strong>Supabase not configured.</strong> Set{' '}
          <code className="bg-cream px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="bg-cream px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in{' '}
          <code className="bg-cream px-1 rounded">.env.local</code> and restart.
        </>
      ) : (
        <>
          <strong>Content could not be loaded.</strong> Check that this Acharya has public tables like{' '}
          <code className="bg-cream px-1 rounded">farmer_modules</code>,{' '}
          <code className="bg-cream px-1 rounded">farmer_sections</code>, and{' '}
          <code className="bg-cream px-1 rounded">farmer_users</code>.
        </>
      )}
    </div>
  );
}
