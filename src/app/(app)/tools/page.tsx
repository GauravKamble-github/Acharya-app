'use client';

import { useEffect, useMemo, useState } from 'react';
import { withAcharyaPath } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const copy = {
  en: {
    title: 'Farm tools',
    weather: 'Weather',
    mandi: 'Mandi prices',
    calendar: 'Crop calendar',
    fertilizer: 'Fertilizer calculator',
    diary: 'Farm diary',
    crop: 'Crop',
    area: 'Area',
    acres: 'acres',
    activity: 'Activity',
    expense: 'Expense',
    notes: 'Notes',
    save: 'Save entry',
    saved: 'Saved',
    check: 'Check',
    useLocation: 'Use my location',
    rain: 'Rain',
    noWeather: 'Weather is loading. If it stays blank, check your internet connection.',
    noMandi: 'Live mandi prices are temporarily unavailable. Use this tab as a price-check reminder and verify locally.',
    fertilizerNote: 'Use this for planning only. Final dose should follow soil test, crop stage, label, and local officer/KVK guidance.',
    steps: [
      ['Seed/Nursery', 'Prepare seed and field records.'],
      ['Sowing', 'Sow at recommended spacing.'],
      ['Irrigation + nutrients', 'Track water, weeds, pests.'],
      ['Harvest + selling', 'Grade, store, compare markets.'],
    ],
  },
  hi: {
    title: 'खेती के औजार',
    weather: 'मौसम',
    mandi: 'मंडी भाव',
    calendar: 'फसल कैलेंडर',
    fertilizer: 'उर्वरक कैलकुलेटर',
    diary: 'खेत डायरी',
    crop: 'फसल',
    area: 'क्षेत्र',
    acres: 'एकड़',
    activity: 'काम',
    expense: 'खर्च',
    notes: 'नोट्स',
    save: 'एंट्री सेव करें',
    saved: 'सेव हो गया',
    check: 'जांचें',
    useLocation: 'मेरी लोकेशन',
    rain: 'बारिश',
    noWeather: 'मौसम लोड हो रहा है। अगर खाली रहे तो इंटरनेट जांचें।',
    noMandi: 'लाइव मंडी भाव अभी उपलब्ध नहीं हैं। भाव-जांच की याद के लिए इस टैब का उपयोग करें और स्थानीय मंडी से पुष्टि करें।',
    fertilizerNote: 'यह सिर्फ योजना के लिए है। अंतिम मात्रा मिट्टी जांच, फसल अवस्था, लेबल और स्थानीय कृषि अधिकारी/KVK की सलाह से तय करें।',
    steps: [
      ['बीज/नर्सरी', 'बीज और खेत का रिकॉर्ड तैयार करें।'],
      ['बुवाई', 'सही दूरी पर बुवाई करें।'],
      ['सिंचाई + पोषण', 'पानी, खरपतवार और कीट देखते रहें।'],
      ['कटाई + बिक्री', 'ग्रेडिंग, भंडारण और बाजार तुलना करें।'],
    ],
  },
  bn: {
    title: 'খামারের সরঞ্জাম',
    weather: 'আবহাওয়া',
    mandi: 'মণ্ডির দাম',
    calendar: 'ফসল ক্যালেন্ডার',
    fertilizer: 'সার ক্যালকুলেটর',
    diary: 'খামার ডায়েরি',
    crop: 'ফসল',
    area: 'জমি',
    acres: 'একর',
    activity: 'কাজ',
    expense: 'খরচ',
    notes: 'নোট',
    save: 'এন্ট্রি সেভ করুন',
    saved: 'সেভ হয়েছে',
    check: 'দেখুন',
    useLocation: 'আমার লোকেশন',
    rain: 'বৃষ্টি',
    noWeather: 'আবহাওয়া লোড হচ্ছে। খালি থাকলে ইন্টারনেট দেখুন।',
    noMandi: 'লাইভ মণ্ডির দাম এখন উপলব্ধ নয়। দাম যাচাইয়ের মনে করিয়ে দেওয়ার জন্য এই ট্যাব ব্যবহার করুন এবং স্থানীয় মণ্ডিতে নিশ্চিত করুন।',
    fertilizerNote: 'এটি শুধু পরিকল্পনার জন্য। চূড়ান্ত মাত্রা মাটি পরীক্ষা, ফসলের অবস্থা, লেবেল এবং স্থানীয় কৃষি আধিকারিক/KVK পরামর্শ অনুযায়ী ঠিক করুন।',
    steps: [
      ['বীজ/নার্সারি', 'বীজ এবং মাঠের রেকর্ড প্রস্তুত করুন।'],
      ['বপন', 'সঠিক দূরত্বে বপন করুন।'],
      ['সেচ + পুষ্টি', 'জল, আগাছা এবং পোকা নজরে রাখুন।'],
      ['কাটাই + বিক্রি', 'গ্রেডিং, সংরক্ষণ এবং বাজার তুলনা করুন।'],
    ],
  },
} as const;

type ToolKey = 'weather' | 'mandi' | 'calendar' | 'fertilizer' | 'diary';

interface WeatherDaily {
  time?: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
}

interface DiaryEntry {
  id: string;
  entry_date: string;
  crop: string;
  activity: string;
  expense: number;
  notes: string;
}

export default function ToolsPage() {
  const { lang } = useStore();
  const c = copy[lang];
  const [tool, setTool] = useState<ToolKey>('weather');
  const [weather, setWeather] = useState<WeatherDaily | null>(null);
  const [mandiRecords, setMandiRecords] = useState<Array<Record<string, string>>>([]);
  const [mandiNote, setMandiNote] = useState('');
  const [crop, setCrop] = useState('Paddy');
  const [area, setArea] = useState(1);
  const [n, setN] = useState(40);
  const [p, setP] = useState(20);
  const [k, setK] = useState(20);
  const [activity, setActivity] = useState('');
  const [expense, setExpense] = useState(0);
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(withAcharyaPath('/api/tools/weather?lat=22.5726&lon=88.3639'))
      .then((r) => r.json())
      .then((r) => setWeather(r.daily || null))
      .catch(() => setWeather(null));
    fetch(withAcharyaPath('/api/learner/diary'))
      .then((r) => r.ok ? r.json() : { entries: [] })
      .then((r) => setEntries(r.entries || []))
      .catch(() => setEntries([]));
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      fetch(withAcharyaPath(`/api/tools/weather?lat=${latitude}&lon=${longitude}`))
        .then((r) => r.json())
        .then((r) => setWeather(r.daily || null))
        .catch(() => setWeather(null));
    });
  }

  async function loadMandi() {
    const qs = new URLSearchParams({ commodity: crop });
    setMandiNote('Loading...');
    try {
      const r = await fetch(withAcharyaPath(`/api/tools/mandi?${qs}`));
      const j = await r.json();
      const records = Array.isArray(j.records) ? j.records : [];
      setMandiRecords(records);
      setMandiNote(j.note || (records.length > 0 ? `Showing ${records.length} live record${records.length === 1 ? '' : 's'} from data.gov.in.` : ''));
    } catch {
      setMandiRecords([]);
      setMandiNote('Could not load mandi prices right now.');
    }
  }

  const fertilizer = useMemo(() => {
    const urea = (n * area) / 0.46;
    const dap = (p * area) / 0.46;
    const mop = (k * area) / 0.60;
    return { urea, dap, mop };
  }, [area, n, p, k]);

  async function saveDiary() {
    setStatus('');
    const r = await fetch(withAcharyaPath('/api/learner/diary'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop, activity, expense, notes }),
    });
    if (r.ok) {
      setStatus(c.saved);
      setActivity('');
      setExpense(0);
      setNotes('');
      const list = await fetch(withAcharyaPath('/api/learner/diary')).then((x) => x.json());
      setEntries(list.entries || []);
    }
  }

  const tools: Array<{ key: ToolKey; label: string; icon: 'wave' | 'rupee' | 'calendar' | 'stack' | 'pencil' }> = [
    { key: 'weather', label: c.weather, icon: 'wave' },
    { key: 'mandi', label: c.mandi, icon: 'rupee' },
    { key: 'calendar', label: c.calendar, icon: 'calendar' },
    { key: 'fertilizer', label: c.fertilizer, icon: 'stack' },
    { key: 'diary', label: c.diary, icon: 'pencil' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">
      <div className="mb-5">
        <Tag tone="muted">{c.title}</Tag>
        <h1 className="font-serif italic text-4xl text-forest mt-2">{c.title}</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5">
        {tools.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
              tool === t.key ? 'bg-forest text-cream border-forest' : 'bg-cream text-ink border-line'
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tool === 'weather' && (
        <Card tone="surface" padding="lg">
          <Tag tone="forest" filled>{c.weather}</Tag>
          <button
            type="button"
            onClick={useMyLocation}
            className="ml-2 rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-semibold text-forest hover:bg-sage"
          >
            {c.useLocation}
          </button>
          <div className="grid sm:grid-cols-5 gap-3 mt-4">
            {(weather?.time || []).map((day, i) => (
              <div key={day} className="rounded-lg bg-cream border border-line p-3">
                <p className="font-mono text-[10px] text-muted">{day}</p>
                <p className="font-serif italic text-2xl text-forest mt-1">{weather?.temperature_2m_max?.[i] ?? '-'}°</p>
                <p className="text-xs text-muted">{c.rain} {weather?.precipitation_sum?.[i] ?? 0} mm</p>
              </div>
            ))}
          </div>
          {(!weather?.time || weather.time.length === 0) && (
            <p className="text-xs text-muted mt-3">{c.noWeather}</p>
          )}
        </Card>
      )}

      {tool === 'mandi' && (
        <Card tone="surface" padding="lg">
          <Tag tone="gold" filled>{c.mandi}</Tag>
          <div className="flex gap-2 mt-4">
            <input value={crop} onChange={(e) => setCrop(e.target.value)} className="flex-1 rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
            <Button onClick={loadMandi} icon="rupee">{c.check}</Button>
          </div>
          <p className="text-xs text-muted mt-3">{mandiNote || (mandiRecords.length === 0 ? c.noMandi : '')}</p>
          <div className="mt-4 space-y-2">
            {mandiRecords.map((r, i) => (
              <div key={i} className="rounded-lg border border-line bg-cream px-3 py-2 text-xs">
                <b>{r.market || r.market_name || '-'}</b> {r.modal_price ? `- ₹${r.modal_price}` : ''}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tool === 'calendar' && (
        <Card tone="surface" padding="lg">
          <Tag tone="forest" filled>{c.calendar}</Tag>
          <div className="grid sm:grid-cols-4 gap-3 mt-4">
            {c.steps.map((step, i) => (
              <div key={step[0]} className="rounded-lg bg-cream border border-line p-3">
                <p className="font-mono text-[10px] text-gold">{i + 1}</p>
                <p className="text-sm font-semibold text-forest mt-1">{step[0]}</p>
                <p className="text-xs text-muted mt-1">{step[1]}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tool === 'fertilizer' && (
        <Card tone="surface" padding="lg">
          <Tag tone="forest" filled>{c.fertilizer}</Tag>
          <div className="grid sm:grid-cols-4 gap-3 mt-4">
            <NumberBox label={`${c.area} (${c.acres})`} value={area} setValue={setArea} />
            <NumberBox label="N kg/ac" value={n} setValue={setN} />
            <NumberBox label="P2O5 kg/ac" value={p} setValue={setP} />
            <NumberBox label="K2O kg/ac" value={k} setValue={setK} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <Result label="Urea" value={fertilizer.urea} />
            <Result label="DAP" value={fertilizer.dap} />
            <Result label="MOP" value={fertilizer.mop} />
          </div>
          <p className="text-xs text-muted mt-3">{c.fertilizerNote}</p>
        </Card>
      )}

      {tool === 'diary' && (
        <Card tone="surface" padding="lg">
          <Tag tone="forest" filled>{c.diary}</Tag>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder={c.crop} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
            <input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder={c.activity} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
            <input type="number" value={expense} onChange={(e) => setExpense(Number(e.target.value))} placeholder={c.expense} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={c.notes} className="rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
          </div>
          <Button className="mt-3" onClick={saveDiary} disabled={!activity.trim()}>{c.save}</Button>
          {status && <span className="ml-3 text-sm text-forest">{status}</span>}
          <div className="mt-5 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-line bg-cream px-3 py-2 text-sm">
                <b>{e.crop || c.crop}</b> - {e.activity}
                <span className="float-right font-mono text-xs text-muted">₹{e.expense || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function NumberBox({ label, value, setValue }: { label: string; value: number; setValue: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm" />
    </label>
  );
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-cream border border-line p-3">
      <p className="font-mono text-[10px] text-muted">{label}</p>
      <p className="font-serif italic text-3xl text-forest">{Math.round(value)} kg</p>
    </div>
  );
}
