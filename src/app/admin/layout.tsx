'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, getSessionEmail } from '@/lib/admin-auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon, type IconName } from '@/components/ui/Icon';
import {
  ACHARYA_BRANDS,
  ACHARYA_COLORS,
  adminRoute,
  acharyaRouteFor,
  stripAcharyaPrefix,
} from '@/lib/acharya-client';
import { AdminAcharyaProvider, useAdminAcharya } from '@/lib/admin-acharya-context';
import type { ClientAcharyaSlug } from '@/lib/api-client';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { href: '/admin',            label: 'Dashboard', icon: 'chart' },
  { href: '/admin/modules',    label: 'Modules',   icon: 'book' },
  { href: '/admin/learners',   label: 'Learners',  icon: 'hand' },
  { href: '/admin/chat-logs',  label: 'Chat logs', icon: 'chat' },
  { href: '/admin/apply-logs', label: 'Apply logs', icon: 'hand' },
  { href: '/admin/events',     label: 'Events',    icon: 'wave' },
  { href: '/admin/usage',      label: 'AI Usage',  icon: 'sparkle' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionEmail().then((e) => {
      if (cancelled) return;
      setEmail(e);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setSubmitting(true);
    try {
      const r = await signIn(loginEmail, loginPassword);
      setEmail(r.email);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await signOut();
    setEmail(null);
  }

  // ============= LOADING =============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-paper">
        <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============= LOGIN =============
  if (!email) {
    return (
      <div className="min-h-screen bg-forest-deep flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-paper rounded-[18px] p-7 border border-line shadow-2xl"
        >
          <div className="flex flex-col items-center mb-6">
            <Avatar size={56} useImage />
            <Tag tone="gold" className="mt-4">KarmYog Vatika · Admin</Tag>
            <h1 className="font-serif italic text-3xl text-ink mt-2 leading-tight">Sign in</h1>
            <p className="text-xs text-muted mt-1 text-center">
              One admin console for all Acharyas.
            </p>
          </div>

          {loginError && (
            <div className="bg-terra/10 border border-terra/30 text-terra text-xs rounded-lg px-3 py-2 mb-4">
              {loginError}
            </div>
          )}

          <label className="block mb-3">
            <Tag tone="muted" className="block mb-1.5">Email</Tag>
            <input
              type="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full bg-cream border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest placeholder:text-muted"
              required
              autoFocus
            />
          </label>
          <label className="block mb-5">
            <Tag tone="muted" className="block mb-1.5">Password</Tag>
            <input
              type="password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full bg-cream border border-line rounded-xl px-3 py-2.5 text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest placeholder:text-muted"
              required
            />
          </label>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            iconRight="arrowR"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Signing in…' : 'Enter dashboard'}
          </Button>

          <p className="mt-6 text-center font-mono text-[9px] tracking-[0.22em] uppercase text-muted">
            v1 · April 2026
          </p>
        </form>
      </div>
    );
  }

  // ============= AUTHENTICATED SHELL =============
  return (
    <AdminAcharyaProvider>
      <AdminShell
        email={email}
        onLogout={handleLogout}
      >
        {children}
      </AdminShell>
    </AdminAcharyaProvider>
  );
}

function AdminShell({
  children,
  email,
  onLogout,
}: {
  children: React.ReactNode;
  email: string;
  onLogout: () => void;
}) {
  const [acharyaMenuOpen, setAcharyaMenuOpen] = useState(false);
  const acharyaMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const cleanPath = stripAcharyaPrefix(pathname);
  const { activeSlug, activeBrand: brand, setActiveSlug } = useAdminAcharya();

  function switchAcharya(nextSlug: ClientAcharyaSlug) {
    setAcharyaMenuOpen(false);
    if (nextSlug === activeSlug) return;
    setActiveSlug(nextSlug);
    const nextUrl = adminRoute(`${cleanPath || '/admin'}${window.location.search}`, nextSlug);
    window.history.replaceState(null, '', nextUrl);
  }

  return (
    <div className="flex h-screen bg-paper">
      {/* Sidebar */}
      <aside className="w-60 bg-forest-deep text-cream flex flex-col shrink-0 border-r border-forest-deep">
        <div className="px-5 py-5 border-b border-cream/10">
          <div className="flex items-center gap-2.5">
            <Avatar size={34} useImage />
            <div className="min-w-0">
              <div className="font-serif italic text-lg leading-tight">{brand.shortName}</div>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-gold">
                Admin Console
              </div>
            </div>
          </div>
          <p className="text-[10.5px] text-cream/60 mt-3 truncate" title={email}>
            {email}
          </p>
          <div ref={acharyaMenuRef} className="relative mt-3">
            <button
              type="button"
              onClick={() => setAcharyaMenuOpen((open) => !open)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
                acharyaMenuOpen
                  ? 'bg-cream/15 border-gold/45'
                  : 'bg-cream/10 border-cream/15 hover:bg-cream/15'
              }`}
              aria-label="Switch Acharya"
              aria-haspopup="listbox"
              aria-expanded={acharyaMenuOpen}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ACHARYA_COLORS[brand.slug] || '#B5903A' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold leading-tight text-cream">
                  {brand.name}
                </span>
                <span className="block truncate text-[9.5px] leading-tight text-cream/45 mt-0.5">
                  Switch Acharya
                </span>
              </span>
              <Icon
                name="chevD"
                size={13}
                className={`text-gold shrink-0 transition-transform ${acharyaMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {acharyaMenuOpen && (
              <div
                role="listbox"
                aria-label="Switch Acharya"
                className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-2xl"
              >
                {Object.values(ACHARYA_BRANDS).map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    role="option"
                    aria-selected={item.slug === brand.slug}
                    onClick={() => switchAcharya(item.slug)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-sage ${
                      item.slug === brand.slug ? 'bg-cream' : ''
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: ACHARYA_COLORS[item.slug] || '#264E2E' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-sm leading-tight text-ink">
                        {item.name}
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-muted mt-0.5">
                        {item.tagline}
                      </span>
                    </span>
                    {item.slug === brand.slug && (
                      <Icon name="check" size={14} className="text-forest shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-3 px-2">
          <Tag tone="muted" className="!text-cream/40 px-3 mb-2 block">Navigate</Tag>
          <ul className="space-y-1">
            {navItems.map(({ href, label, icon }) => {
              const active = cleanPath === href || (href !== '/admin' && cleanPath.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={adminRoute(href, activeSlug)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-cream text-forest font-semibold'
                        : 'text-cream/80 hover:bg-cream/10 hover:text-cream'
                    }`}
                  >
                    <Icon name={icon} size={16} strokeWidth={active ? 2 : 1.75} />
                    <span className="flex-1">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 py-3 border-t border-cream/10 space-y-1">
          <Link
            href={acharyaRouteFor(activeSlug, "/")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] text-cream/70 hover:text-cream hover:bg-cream/10 transition-colors"
          >
            <Icon name="arrowL" size={14} />
            View Learner App
          </Link>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] text-cream/70 hover:text-terra hover:bg-cream/10 transition-colors"
          >
            <Icon name="close" size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-paper">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
