'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ACHARYA_COLORS } from '@/lib/acharya-client';
import { useAdminAcharya } from '@/lib/admin-acharya-context';

interface AcharyaStats {
  modules: number;
  sections: number;
  contentRows: number;
  videos: number;
  learners: number;
  quizAttempts: number;
}

interface LearnerSummary {
  id: string;
  phone: string | null;
  name: string | null;
  role?: string | null;
  preferred_lang: string;
  created_at: string;
  last_seen: string;
  progressCount: number;
  quizCount: number;
}

const STAT_DEFS: { key: keyof AcharyaStats; label: string; icon: IconName }[] = [
  { key: 'learners', label: 'Learners', icon: 'hand' },
  { key: 'modules', label: 'Modules', icon: 'book' },
  { key: 'quizAttempts', label: 'Quizzes', icon: 'quiz' },
];

async function fetchStats(slug: string): Promise<AcharyaStats | null> {
  try {
    const res = await fetch(`/api/${slug}/admin/stats`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchLearners(
  slug: string
): Promise<{ totalCount: number; learners: LearnerSummary[] } | null> {
  try {
    const res = await fetch(`/api/${slug}/admin/learners?page=0`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function AdminDashboard() {
  const { activeSlug, activeBrand } = useAdminAcharya();
  const [stats, setStats] = useState<AcharyaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'learners'>('overview');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const nextStats = await fetchStats(activeSlug);
      if (!cancelled) {
        setStats(nextStats);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Tag tone="muted">Admin Dashboard</Tag>
        <h1 className="font-serif italic text-3xl lg:text-4xl text-forest mt-2">{activeBrand.name}</h1>
        <p className="text-sm text-muted mt-1">Live data fetched through the selected Acharya API.</p>
      </div>

      <div className="flex gap-1 bg-cream border border-line rounded-full p-0.5 w-fit mb-6">
        {(['overview', 'learners'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedTab === tab ? 'bg-forest text-cream' : 'text-ink hover:bg-sage'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'Learners'}
          </button>
        ))}
      </div>

      {selectedTab === 'overview' ? (
        <OverviewTab slug={activeSlug} brandName={activeBrand.name} stats={stats} />
      ) : (
        <LearnersTab slug={activeSlug} brandName={activeBrand.name} />
      )}
    </div>
  );
}

function OverviewTab({
  slug,
  brandName,
  stats,
}: {
  slug: string;
  brandName: string;
  stats: AcharyaStats | null;
}) {
  const color = ACHARYA_COLORS[slug] || '#264E2E';

  return (
    <div className="space-y-4">
      <Card tone="surface" padding="lg">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <h2 className="font-serif italic text-xl text-ink">{brandName}</h2>
          <Tag tone="muted">{slug}</Tag>
          {!stats && <Tag tone="muted" className="text-terra">No data</Tag>}
        </div>

        {stats ? (
          <div className="grid grid-cols-3 gap-3">
            {STAT_DEFS.map((s) => (
              <div key={s.key} className="text-center bg-cream rounded-xl p-3">
                <Icon name={s.icon} size={18} className="text-forest mx-auto mb-1" />
                <div className="font-serif italic text-2xl text-ink">{stats[s.key]}</div>
                <div className="text-[10px] text-muted uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted italic">Schema not set up yet.</p>
        )}
      </Card>
    </div>
  );
}

function LearnersTab({ slug, brandName }: { slug: string; brandName: string }) {
  const [learners, setLearners] = useState<LearnerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchLearners(slug);
      if (!cancelled) {
        setLearners(data?.learners || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card tone="surface" padding="lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ACHARYA_COLORS[slug] || '#264E2E' }} />
          <h2 className="font-serif italic text-lg text-ink">{brandName}</h2>
          <Tag tone="muted">{learners.length} learners</Tag>
        </div>

        {learners.length === 0 ? (
          <p className="text-xs text-muted italic">No learners yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted uppercase tracking-wider">
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Lang</th>
                  <th className="py-2 pr-4 font-medium">Progress</th>
                  <th className="py-2 font-medium">Quizzes</th>
                </tr>
              </thead>
              <tbody>
                {learners.slice(0, 20).map((learner) => {
                  const role = learner.role || 'user';

                  return (
                    <tr key={learner.id} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-mono text-xs">{learner.phone || 'N/A'}</td>
                      <td className="py-2 pr-4">{learner.name || 'N/A'}</td>
                      <td className="py-2 pr-4">
                        <Tag tone={role === 'founder' ? 'forest' : role === 'admin' ? 'gold' : 'muted'}>
                          {role}
                        </Tag>
                      </td>
                      <td className="py-2 pr-4 text-xs">{learner.preferred_lang}</td>
                      <td className="py-2 pr-4 text-xs">{learner.progressCount || 0}</td>
                      <td className="py-2 text-xs">{learner.quizCount || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
