'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { api, ApiError } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { formatIndianPhone, normalizeIndianPhone } from '@/lib/phone';
import type { Lang } from '@/lib/types';
import {
  ACHARYA_BRANDS,
  ACHARYA_COLORS,
  stripAcharyaPrefix,
} from '@/lib/acharya-client';

type Step = 'phone' | 'otp' | 'acharya';

export default function PhoneGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cleanPath = stripAcharyaPrefix(pathname);

  // Is there an acharya slug in the URL? (e.g., /farmer/learn → yes, / → no)
  const firstSeg = pathname.split("/").filter(Boolean)[0] || "";
  const hasSlug = firstSeg in ACHARYA_BRANDS;

  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    return <>{children}</>;
  }
  return <LearnerPhoneGate hasSlug={hasSlug}>{children}</LearnerPhoneGate>;
}

function LearnerPhoneGate({ children, hasSlug }: { children: React.ReactNode; hasSlug: boolean }) {
  const router = useRouter();
  const { learnerId, userPhone, setUser, clearUser, setLang, lang } = useStore();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('phone');

  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const wasAuthenticatedRef = useRef(Boolean(learnerId && userPhone));

  function resetLoginForm() {
    clearUser(); // fully sign out
    setStep('phone');
    setPhoneInput('');
    setNormalizedPhone('');
    setOtpDigits(['', '', '', '', '', '']);
    setErr('');
    setSubmitting(false);
    setTimeout(() => phoneInputRef.current?.focus(), 0);
  }

  function resetToPhone() {
    setStep('phone');
    setErr('');
    setTimeout(() => phoneInputRef.current?.focus(), 0);
  }

  function resetToSelection() {
    setStep('acharya');
    setPhoneInput('');
    setNormalizedPhone('');
    setOtpDigits(['', '', '', '', '', '']);
    setErr('');
    setSubmitting(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      // Always validate the session against the server on mount.
      // Stale Zustand data (from a different acharya slug or expired
      // session) would bypass auth otherwise.
      try {
        const me = await api.phoneAuth.me();
        if (cancelled) return;
        if (me) {
          setUser({
            learnerId: me.id,
            phone: me.phone,
            name: me.name,
            role: me.role,
            isAdmin: me.isAdmin,
          });
          if (me.preferredLang && ['bn', 'hi', 'en'].includes(me.preferredLang)) {
            setLang(me.preferredLang as Lang);
          }
        } else {
          clearUser();
        }
      } catch {
        clearUser();
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    probe();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const authenticated = Boolean(learnerId && userPhone);
    if (wasAuthenticatedRef.current && !authenticated) {
      // On root (no slug), go to selection; on slug pages, go to login
      if (hasSlug) { setTimeout(resetLoginForm, 0); }
      else { setTimeout(resetToSelection, 0); }
    }
    wasAuthenticatedRef.current = authenticated;
  }, [learnerId, userPhone]);

  // When on root / without a slug, always show selection if logged in
  useEffect(() => {
    if (!hasSlug && learnerId && userPhone && step !== 'acharya') {
      setStep('acharya');
    }
  }, [hasSlug, learnerId, userPhone, step]);

  if (checking) {
    return <div className="min-h-screen bg-paper" />;
  }

  if (learnerId && userPhone && hasSlug) return <>{children}</>;

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const normalized = normalizeIndianPhone(phoneInput);
    if (!normalized) {
      setErr('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone: normalized }),
      });
      if (!res.ok) {
        let msg = 'Something went wrong. Try again.';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new ApiError(res.status, msg);
      }
      setNormalizedPhone(normalized);
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 50);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) return;
    setSubmitting(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone: normalizedPhone, otp }),
      });
      if (!res.ok) {
        let msg = 'Could not verify. Try again.';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new ApiError(res.status, msg);
      }
      const data = await res.json();
      const me = data.learner;
      setUser({
        learnerId: me.id,
        phone: me.phone,
        name: me.name,
        role: me.role,
        isAdmin: me.isAdmin,
      });
      if (me.preferredLang && ['bn', 'hi', 'en'].includes(me.preferredLang)) {
        setLang(me.preferredLang as Lang);
      }
      setStep('acharya');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not verify. Try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  function setOtpDigitAt(idx: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 5) otpInputs.current[idx + 1]?.focus();
    if (v && idx === 5) {
      setTimeout(() => {
        const full = otpDigits.slice();
        full[idx] = v;
        if (full.every((d) => d.length === 1)) submitOtp();
      }, 0);
    }
  }

  function onOtpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpInputs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpInputs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) otpInputs.current[idx + 1]?.focus();
    if (e.key === 'Enter') submitOtp();
  }

  function onOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((c, i) => { next[i] = c; });
    setOtpDigits(next);
    otpInputs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) setTimeout(() => submitOtp(), 0);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-forest-deep p-6">
      <div className="w-full max-w-sm bg-paper rounded-[18px] p-7 border border-line shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <Avatar size={64} useImage />
          {step === 'acharya' ? (
            <>
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold mt-4">
                Select your learning track
              </p>
              <h1 className="font-serif italic text-3xl text-ink mt-1">Choose Acharya</h1>
              <p className="text-xs text-muted mt-1">Pick the acharya you want to learn with</p>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold mt-4">
                Acharya Learning Platform
              </p>
              <h1 className="font-serif italic text-3xl text-ink mt-1">Acharya</h1>
              <p className="text-xs text-muted mt-1">Sign in to continue</p>
            </>
          )}
        </div>

        {step === 'phone' ? (
          <form onSubmit={submitPhone}>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted text-center mb-3">
              Sign in with phone
            </p>

            <label className="block">
              <span className="sr-only">Mobile number</span>
              <div className="flex items-stretch bg-cream border border-line rounded-xl overflow-hidden focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
                <span className="px-3 flex items-center font-mono text-sm text-muted border-r border-line">
                  +91
                </span>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9 ]*"
                  maxLength={15}
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="90628 39387"
                  className="flex-1 bg-transparent px-3 py-3 font-mono text-[15px] text-ink placeholder:text-muted focus:outline-none"
                  aria-label="Mobile number"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting || !phoneInput.trim()}
              className="w-full mt-4 py-3 bg-forest text-cream font-semibold rounded-xl text-sm hover:bg-forest-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Sending…' : 'Send OTP'}
            </button>

            {err && (
              <p className="text-terra text-xs text-center mt-3 font-medium">{err}</p>
            )}

            <p className="mt-6 text-center font-mono text-[9px] tracking-[0.22em] uppercase text-muted">
              v1 · {lang.toUpperCase()} · April 2026
            </p>
          </form>
        ) : step === 'otp' ? (
          <form onSubmit={submitOtp}>
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted text-center mb-1">
              Enter OTP
            </p>
            <p className="text-xs text-ink text-center mb-4">
              Sent to <span className="font-mono">{formatIndianPhone(normalizedPhone)}</span>
            </p>

            <div className="flex justify-center gap-2 mb-3">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setOtpDigitAt(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  onPaste={onOtpPaste}
                  aria-label={`OTP digit ${i + 1}`}
                  className="w-11 h-12 lg:w-12 lg:h-14 bg-cream border border-line rounded-xl font-mono text-2xl text-ink text-center focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
              ))}
            </div>

            <p className="text-[11px] text-muted text-center mb-4">
              For the pilot, use OTP <span className="font-mono font-semibold text-forest">123456</span>
            </p>

            <button
              type="submit"
              disabled={submitting || otpDigits.some((d) => !d)}
              className="w-full py-3 bg-forest text-cream font-semibold rounded-xl text-sm hover:bg-forest-deep disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Verifying…' : 'Verify & enter'}
            </button>

            <button
              type="button"
              onClick={resetToPhone}
              className="w-full mt-2 py-2 text-muted hover:text-ink text-xs"
            >
              ← Use a different number
            </button>

            {err && (
              <p className="text-terra text-xs text-center mt-3 font-medium">{err}</p>
            )}
          </form>
        ) : (
          <div>
            <div className="grid gap-2.5">
              {Object.values(ACHARYA_BRANDS).map((item) => {
                const color = ACHARYA_COLORS[item.slug] || '#264E2E';
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => { router.push(`/${item.slug}/`); }}
                    className="w-full text-left border border-line bg-cream hover:bg-sage/70 rounded-xl transition-colors overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {item.initials}
                        </div>
                        <div className="min-w-0">
                          <span className="block font-serif text-lg text-ink leading-tight">{item.name}</span>
                          <span className="block text-xs text-muted mt-0.5">{item.description}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={resetLoginForm}
              className="w-full mt-4 py-2 text-muted hover:text-ink text-xs text-center"
            >
              Use a different number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
