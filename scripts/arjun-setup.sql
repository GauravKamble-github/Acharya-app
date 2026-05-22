-- ============================================================================
-- Arjun Acharya — Complete Production Schema (matches vajra/taksha format)
-- Run in the DEFAULT Supabase project SQL editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.arjun_update_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.arjun_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_hi text,
  title_bn text,
  icon text NOT NULL DEFAULT 'book',
  theory_hours numeric NOT NULL DEFAULT 1,
  practical_hours numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  group_key text NOT NULL DEFAULT 'core',
  group_label_en text,
  group_label_hi text,
  group_label_bn text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER arjun_modules_updated_at BEFORE UPDATE ON public.arjun_modules FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE TABLE IF NOT EXISTS public.arjun_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.arjun_modules(id) ON DELETE CASCADE,
  slug text,
  title_en text NOT NULL,
  title_hi text,
  title_bn text,
  body_en text,
  body_hi text,
  body_bn text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published')),
  sort_order int NOT NULL DEFAULT 1,
  estimated_hours numeric NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER arjun_sections_updated_at BEFORE UPDATE ON public.arjun_sections FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE TABLE IF NOT EXISTS public.arjun_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.arjun_modules(id) ON DELETE CASCADE,
  youtube_id text NOT NULL,
  title_en text NOT NULL,
  title_hi text,
  title_bn text,
  duration text,
  start_seconds int,
  sort_order int NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER arjun_videos_updated_at BEFORE UPDATE ON public.arjun_videos FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE TABLE IF NOT EXISTS public.arjun_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text DEFAULT '',
  role text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin', 'founder')),
  is_admin boolean NOT NULL DEFAULT false,
  preferred_lang text NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en', 'hi', 'bn')),
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  last_seen_on timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER arjun_users_updated_at BEFORE UPDATE ON public.arjun_users FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE TABLE IF NOT EXISTS public.arjun_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.arjun_users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.arjun_modules(id) ON DELETE CASCADE,
  sections_completed text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, module_id)
);
CREATE TRIGGER arjun_progress_updated_at BEFORE UPDATE ON public.arjun_progress FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE TABLE IF NOT EXISTS public.arjun_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.arjun_users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.arjun_modules(id) ON DELETE SET NULL,
  score int NOT NULL,
  total int NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arjun_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.arjun_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.arjun_modules(id) ON DELETE SET NULL,
  lang text CHECK (lang IN ('en', 'hi', 'bn')),
  user_message text,
  ai_response text,
  response_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arjun_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.arjun_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arjun_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.arjun_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.arjun_modules(id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'self_assessment',
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arjun_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  service text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  duration_ms int,
  input_tokens int,
  output_tokens int,
  cached_input_tokens int,
  chars int,
  lang text,
  acharya_slug text NOT NULL DEFAULT 'arjun',
  has_image boolean NOT NULL DEFAULT false,
  cost_usd numeric NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arjun_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER arjun_config_updated_at BEFORE UPDATE ON public.arjun_config FOR EACH ROW EXECUTE FUNCTION public.arjun_update_updated_at();

CREATE INDEX IF NOT EXISTS arjun_modules_sort_idx ON public.arjun_modules(sort_order);
CREATE INDEX IF NOT EXISTS arjun_sections_module_sort_idx ON public.arjun_sections(module_id, sort_order);
CREATE INDEX IF NOT EXISTS arjun_progress_learner_idx ON public.arjun_progress(learner_id);
CREATE INDEX IF NOT EXISTS arjun_chat_logs_learner_created_idx ON public.arjun_chat_logs(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS arjun_events_learner_created_idx ON public.arjun_events(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS arjun_users_phone_idx ON public.arjun_users(phone);

ALTER TABLE public.arjun_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_apply_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arjun_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEED: 21 Arjun Modules
-- ============================================================================

INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M00-welcome', 'Welcome from MahAcharyaJi', 'MahAcharyaJi की ओर से स्वागत', 'MahAcharyaJi-র তরফে স্বাগতম', '🙏', 1, 1, 0, 'foundation', 'Foundation', 'आधार', 'মূল', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M01-north-star', 'The 3-Month North Star', '3 महीने के चार लक्ष्य', '৩ মাসের চারটি লক্ষ্য', '⭐', 1, 1, 1, 'foundation', 'foundation', 'foundation', 'foundation', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M02-who-we-are', 'Who We Are', 'हम कौन हैं', 'আমরা কারা', '🏛️', 1, 1, 2, 'foundation', 'foundation', 'foundation', 'foundation', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M03-what-we-sell', 'What We Sell — 16-Module Catalogue', 'हम क्या बेचते हैं', 'আমরা কী বিক্রি করি', '📦', 1, 1, 3, 'foundation', 'foundation', 'foundation', 'foundation', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M04-club-ecosystem', 'The Club Ecosystem', 'क्लब इकोसिस्टम', 'ক্লাব ইকোসিস্টেম', '🌿', 1, 1, 4, 'ecosystem', 'Ecosystem', 'इकोसिस्टम', 'ইকোসিস্টেম', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M05-pricing-playbook', 'Pricing Playbook', 'प्राइसिंग प्लेबुक', 'মূল্য নির্ধারণ প্লেবুক', '💰', 1, 1, 5, 'sales', 'Sales', 'सेल्स', 'বিক্রয়', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M06-vatika-ai', 'Vatika.AI', 'Vatika.AI', 'Vatika.AI', '🤖', 1, 1, 6, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M07-proposal-writing', 'Proposal Writing', 'प्रस्ताव लिखना', 'প্রস্তাব লেখা', '📝', 1, 1, 7, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M08-sales-cycle', 'The Sales Cycle', 'सेल्स साइकल', 'বিক্রয় চক্র', '🔁', 1, 1, 8, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M09-case-studies', 'Case Studies — 9 Exemplars', 'केस स्टडीज़ — 9 उदाहरण', 'কেস স্টাডি — ৯টি উদাহরণ', '📚', 1, 1, 9, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M10-maintenance', 'Maintenance Offering', 'रखरखाव ऑफरिंग', 'রক্ষণাবেক্ষণ পরিষেবা', '🔧', 1, 1, 10, 'operations', 'Operations', 'ऑपरेशंस', 'পরিষেবা', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M11-master-franchisee', 'Master Franchisee Opportunity', 'मास्टर फ्रेंचाइज़ी अवसर', 'মাস্টার ফ্র্যাঞ্চাইজি সুযোগ', '🏢', 1, 1, 11, 'ecosystem', 'ecosystem', 'ecosystem', 'ecosystem', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M12-behtar-life-shop', 'Behtar Life Shop Retail', 'Behtar Life Shop रिटेल', 'Behtar Life Shop খুচরা', '🛍️', 1, 1, 12, 'ecosystem', 'ecosystem', 'ecosystem', 'ecosystem', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M13-channel-partners', 'Channel Partners — Parichalak & Sanchalak', 'चैनल पार्टनर — परिचालक और संचालक', 'চ্যানেল পার্টনার — পরিচালক ও সঞ্চালক', '🤝', 1, 1, 13, 'ecosystem', 'ecosystem', 'ecosystem', 'ecosystem', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M14-objection-handling', 'Objection Handling', 'आपत्ति सँभालना', 'আপত্তি সামলানো', '🛡️', 1, 1, 14, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M15-video-library', 'Video Orientation Library', 'वीडियो लाइब्रेरी', 'ভিডিও লাইব্রেরি', '🎬', 1, 1, 15, 'resources', 'Resources', 'संसाधन', 'সংস্থান', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M16-ops-handover', 'Operations & Handover', 'ऑपरेशंस और हैंडओवर', 'অপারেশন ও হস্তান্তর', '📋', 1, 1, 16, 'operations', 'operations', 'operations', 'operations', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M17-faq', 'FAQ', 'अक्सर पूछे जाने वाले सवाल', 'প্রশ্নোত্তর', '❓', 1, 1, 17, 'resources', 'resources', 'resources', 'resources', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M18-pitch-sequence', 'The Pitch Sequence — 6 Steps', 'पिच सीक्वेंस — 6 कदम', 'পিচ সিকোয়েন্স — ৬ ধাপ', '🎯', 1, 1, 18, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M19-meeting-playbook', 'Meeting Playbook — Minute-by-Minute', 'मीटिंग प्लेबुक — मिनट-दर-मिनट', 'মিটিং প্লেবুক — মিনিটে মিনিটে', '💼', 1, 1, 19, 'sales', 'sales', 'sales', 'sales', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();
INSERT INTO public.arjun_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en, group_label_hi, group_label_bn, status) VALUES ('M20-first-week', 'First-Week Checklist', 'पहले हफ्ते की चेकलिस्ट', 'প্রথম সপ্তাহের চেকলিস্ট', '✅', 1, 1, 20, 'resources', 'resources', 'resources', 'resources', 'published') ON CONFLICT (slug) DO UPDATE SET title_en = EXCLUDED.title_en, sort_order = EXCLUDED.sort_order, updated_at = now();

-- ============================================================================
-- SEED: Arjun Sections
-- ============================================================================

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M00-welcome-s0', 'Welcome to the Vatika Family', 'Vatika परिवार में स्वागत', 'Vatika পরিবারে স্বাগতম', 'Welcome to the KarmYog Vatika Sales & Service team. You are joining a thirty-year practice — not a job, not a company, a practice. MahAcharyaJi has recorded a short welcome for you, which will appear here soon. Until then, this trainer — Arjun — will walk you through everything you need to know to start selling Vatikas and serving our clients.

A Vatika is not a garden we install. It is a sanctuary the neighbourhood comes together to learn, grow, and live better. Your job is to sell that sanctuary, then serve it every month.', 'KarmYog Vatika सेल्स और सर्विस टीम में स्वागत है। तुम नौकरी में नहीं, कंपनी में नहीं — तीस साल के एक अभ्यास में जुड़ रहे हो। MahAcharyaJi जल्द ही तुम्हारे लिए एक छोटा स्वागत संदेश रिकॉर्ड करेंगे, जो यहाँ दिखेगा। तब तक अर्जुन — तुम्हारा ट्रेनर — तुम्हें Vatika बेचने और हमारे ग्राहकों की सेवा करने के लिए सब कुछ समझाएगा।

Vatika वह बाग़ नहीं जो हम लगाते हैं। यह वह पवित्र स्थान है जहाँ पड़ोसी मिलकर सीखते, बढ़ते और बेहतर जीते हैं। तुम्हारा काम है वह स्थान बेचना, फिर हर महीने उसकी सेवा करना।', 'KarmYog Vatika বিক্রয় ও পরিষেবা দলে স্বাগতম। তুমি একটি চাকরি নয়, একটি কোম্পানি নয় — একটি তিন দশকের অনুশীলনে যোগ দিচ্ছো। MahAcharyaJi তোমার জন্য একটি সংক্ষিপ্ত স্বাগত বার্তা রেকর্ড করবেন, যা শীঘ্রই এখানে দেখা যাবে। ততক্ষণ পর্যন্ত, তোমার প্রশিক্ষক অর্জুন তোমাকে Vatika বিক্রি করতে এবং আমাদের ক্লায়েন্টদের পরিষেবা দিতে যা যা জানা দরকার, সবকিছু বলবে।

Vatika আমরা যে বাগান বানাই, সেটা নয়। এটা একটি অভয়ারণ্য যেখানে প্রতিবেশীরা একসাথে শেখে, বাড়ে এবং ভালোভাবে বাঁচে। তোমার কাজ হলো সেই অভয়ারণ্য বিক্রি করা, তারপর প্রতি মাসে পরিষেবা দেওয়া।', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M00-welcome'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M00-welcome-s1', 'Video from MahAcharyaJi (coming soon)', 'MahAcharyaJi का वीडियो (जल्द आएगा)', 'MahAcharyaJi-র ভিডিও (শীঘ্রই আসছে)', 'MahAcharyaJi will record a dedicated welcome video explaining our 3-month North Star, what it means to be part of KarmYog, and how you should think about your role as a Sales & Service team member. Until it is recorded, watch the 5 KarmYog Vatika orientation videos in M15 — Video Library.', 'MahAcharyaJi एक खास स्वागत वीडियो रिकॉर्ड करेंगे जिसमें वे हमारे 3-महीने के लक्ष्य, KarmYog का हिस्सा होने का क्या अर्थ है, और सेल्स और सर्विस टीम के सदस्य के रूप में तुम्हारी भूमिका के बारे में बताएँगे। जब तक वह रिकॉर्ड नहीं होता, M15 वीडियो लाइब्रेरी में पाँच KarmYog Vatika ओरिएंटेशन वीडियो देखो।', 'MahAcharyaJi একটি বিশেষ স্বাগত ভিডিও রেকর্ড করবেন যেখানে তিনি আমাদের ৩ মাসের উত্তরলক্ষ্য, KarmYog-এর অংশ হওয়া মানে কী, এবং একজন বিক্রয় ও পরিষেবা সদস্য হিসেবে তোমার ভূমিকা সম্পর্কে বলবেন। যতক্ষণ তা রেকর্ড না হয়, M15-এ ৫টি KarmYog Vatika ওরিয়েন্টেশন ভিডিও দেখো।', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M00-welcome'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M01-north-star-s0', 'The Binding Objective — ₹1.085 Crore in 3 Months', 'बाँधनेवाला लक्ष्य — 3 महीनों में ₹1.085 करोड़', 'বাঁধনের লক্ষ্য — ৩ মাসে ₹১.০৮৫ কোটি', 'Four phrases every member of the team must memorise. At any moment — woken from sleep, asked on a bus, quizzed by MahAcharyaJi — you must be able to recite them. These four targets are the ONE thing that ties the whole team''s work together.

1. 100 TMIL — 100 commercial maintenance contracts. ₹30 lakh.
2. 100 Balconies — 100 residential maintenance contracts. ₹6 lakh.
3. 10 Projects — one-time project bookings. ₹50 lakh.
4. ₹25,000/day daily sales — retail walk-ins. ₹22.5 lakh.

Total: ₹1.085 crore over three months. Every sales call, every site visit, every proposal you write must move at least one of these four numbers. If it does not, ask why you are doing it.', 'टीम के हर सदस्य को चार बातें याद करनी हैं। किसी भी पल — नींद से उठाकर, बस में किसी के पूछने पर, MahAcharyaJi की परीक्षा में — तुम बता पाओ। ये चार लक्ष्य पूरी टीम के काम को एक साथ बाँधते हैं।

1. 100 TMIL — 100 व्यावसायिक रखरखाव अनुबंध। ₹30 लाख।
2. 100 Balconies — 100 आवासीय रखरखाव अनुबंध। ₹6 लाख।
3. 10 Projects — एकमुश्त प्रोजेक्ट बुकिंग। ₹50 लाख।
4. रोज़ ₹25,000 बिक्री — रिटेल walk-in। ₹22.5 लाख।

कुल: 3 महीनों में ₹1.085 करोड़। तुम्हारी हर सेल्स कॉल, हर साइट विज़िट, हर प्रस्ताव — इन चार संख्याओं में से कम से कम एक को आगे बढ़ाना चाहिए। अगर नहीं, तो खुद से पूछो क्यों कर रहे हो।', 'দলের প্রত্যেক সদস্যকে মুখস্থ করতে হবে চারটি বাক্যাংশ। যে কোনো মুহূর্তে — ঘুম থেকে উঠে, বাসে কেউ জিজ্ঞেস করলে, MahAcharyaJi পরীক্ষা করলে — তুমি বলতে পারবে। এই চারটি লক্ষ্য পুরো দলের কাজকে একসাথে বাঁধে।

১. ১০০ TMIL — ১০০টি বাণিজ্যিক রক্ষণাবেক্ষণ চুক্তি। ₹৩০ লাখ।
২. ১০০ Balconies — ১০০টি আবাসিক রক্ষণাবেক্ষণ চুক্তি। ₹৬ লাখ।
৩. ১০ Projects — এককালীন প্রকল্প বুকিং। ₹৫০ লাখ।
৪. দৈনিক ₹২৫,০০০ বিক্রি — খুচরা walk-in। ₹২২.৫ লাখ।

মোট: ৩ মাসে ₹১.০৮৫ কোটি। তোমার প্রতিটি সেলস কল, প্রতিটি সাইট ভিজিট, প্রতিটি প্রস্তাব — এই চারটি সংখ্যার কমপক্ষে একটিকে এগিয়ে নিয়ে যেতে হবে। না হলে, কেন করছো তা নিজেকে জিজ্ঞেস করো।', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M01-north-star'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M01-north-star-s1', '1 — 100 TMIL (commercial maintenance)', '1 — 100 TMIL (व्यावसायिक रखरखाव)', '১ — ১০০ TMIL (বাণিজ্যিক রক্ষণাবেক্ষণ)', '100 commercial maintenance contracts in offices, shops, hospitals, schools — indoor, TMIL-pattern.

"TMIL" here is a PATTERN NAME, not a specific client. TMIL the client (Mumbai, 120 plants for ₹12,000/month across 19+ months) is the archetype. The gardener visits on a routine — daily, thrice-weekly, whatever the scope requires. Average contract size: ₹10,000/month.

100 contracts × ₹10,000/month = ₹10 lakh/month = ₹30 lakh in 3 months.', 'ऑफिस, दुकान, अस्पताल, स्कूल में 100 व्यावसायिक रखरखाव अनुबंध — इनडोर, TMIL-पैटर्न।

यहाँ "TMIL" एक पैटर्न नाम है, कोई विशिष्ट ग्राहक नहीं। TMIL ग्राहक (मुंबई, 120 पौधे 19+ महीनों से ₹12,000/माह) मूल उदाहरण है। माली एक नियमित रूटीन पर जाता है — रोज़, हफ्ते में तीन बार, स्कोप के अनुसार। औसत अनुबंध आकार: ₹10,000/माह।

100 अनुबंध × ₹10,000/माह = ₹10 लाख/माह = 3 महीनों में ₹30 लाख।', 'অফিস, দোকান, হাসপাতাল, স্কুলে ১০০টি বাণিজ্যিক রক্ষণাবেক্ষণ চুক্তি — ভিতরে, TMIL-ধাঁচের।

এখানে "TMIL" একটি প্যাটার্ন নাম, নির্দিষ্ট ক্লায়েন্ট নয়। TMIL ক্লায়েন্ট (মুম্বাই, ১২০ গাছ ১৯+ মাস ধরে ₹১২,০০০/মাসে) হলো মূল উদাহরণ। মালি একটি রুটিনে যায় — দৈনিক, সপ্তাহে তিনবার, যা স্কোপ অনুযায়ী। গড় চুক্তির আকার: ₹১০,০০০/মাস।

১০০ চুক্তি × ₹১০,০০০/মাস = ₹১০ লাখ/মাস = ৩ মাসে ₹৩০ লাখ।', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M01-north-star'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M01-north-star-s2', '2 — 100 Balconies (residential maintenance)', '2 — 100 Balconies (आवासीय रखरखाव)', '২ — ১০০ Balconies (আবাসিক রক্ষণাবেক্ষণ)', '100 residential maintenance contracts — balconies, living rooms, terraces, entrances, apartment-scale. The name is "Balconies" but it covers any residential space, not just balconies.

Average ticket: ₹2,000/month (the band is ₹1,500 floor for minimal sites like Dr Kochgaway, up to ₹26,000 ceiling for premium like Mishra Ji. Average sits at ₹2,000 across a diverse residential book).

100 contracts × ₹2,000/month = ₹2 lakh/month = ₹6 lakh in 3 months.', '100 आवासीय रखरखाव अनुबंध — बालकनी, बैठक, छत, प्रवेश, अपार्टमेंट-स्केल। नाम "Balconies" है पर कोई भी आवासीय जगह शामिल है।

औसत टिकट: ₹2,000/माह (बैंड ₹1,500 न्यूनतम से ₹26,000 प्रीमियम मिश्रा जी तक। औसत ₹2,000)।

100 अनुबंध × ₹2,000/माह = ₹2 लाख/माह = 3 महीनों में ₹6 लाख।', '১০০টি আবাসিক রক্ষণাবেক্ষণ চুক্তি — বারান্দা, বসার ঘর, ছাদ, প্রবেশদ্বার, অ্যাপার্টমেন্ট-স্কেল। নাম "Balconies" কিন্তু যেকোনো আবাসিক স্থান অন্তর্ভুক্ত।

গড় টিকিট: ₹২,০০০/মাস (ব্যান্ড ₹১,৫০০ নূন্যতম থেকে ₹২৬,০০০ প্রিমিয়াম মিশ্রা জি পর্যন্ত। গড় ₹২,০০০)।

১০০ চুক্তি × ₹২,০০০/মাস = ₹২ লাখ/মাস = ৩ মাসে ₹৬ লাখ।', 2, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M01-north-star'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 2);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M01-north-star-s3', '3 — 10 Projects (one-time)', '3 — 10 Projects (एकमुश्त)', '৩ — ১০ Projects (এককালীন)', '10 one-time project bookings at Anugrahita-scale or Jhunjhunwala-scale. Could be for a commercial client adding a biophilic feature on top of maintenance, could be a residential project like a duplex install, could be a new Vatika opening.

Average ticket: ₹5 lakh. (Range ₹79K Sourabh Thakur → ₹8L Jhunjhunwala. Arc of ₹5 lakh is what we book for typical sizable residential or commercial projects.)

10 projects × ₹5 lakh = ₹50 lakh in bookings over 3 months.', '10 एकमुश्त प्रोजेक्ट बुकिंग, अनुगृहिता-स्केल या झुनझुनवाला-स्केल। व्यावसायिक ग्राहक रखरखाव के ऊपर बायोफिलिक फ़ीचर जोड़ सकता है, आवासीय duplex इंस्टॉल, या नई Vatika खोलना।

औसत टिकट: ₹5 लाख। (रेंज ₹79K Sourabh Thakur → ₹8L Jhunjhunwala। हमारे सामान्य आवासीय/व्यावसायिक प्रोजेक्ट के लिए औसत ₹5 लाख।)

10 प्रोजेक्ट × ₹5 लाख = 3 महीनों में ₹50 लाख बुकिंग।', '১০টি এককালীন প্রকল্প বুকিং, অনুগৃহীতা-স্কেল বা ঝুনঝুনওয়ালা-স্কেল। বাণিজ্যিক ক্লায়েন্ট রক্ষণাবেক্ষণের উপরে বায়োফিলিক ফিচার যোগ করতে পারে, আবাসিক duplex ইনস্টল বা একটি নতুন Vatika খোলা।

গড় টিকিট: ₹৫ লাখ। (পরিসীমা ₹৭৯K Sourabh Thakur → ₹৮L Jhunjhunwala। গড় আমাদের সাধারণ আবাসিক/বাণিজ্যিক প্রকল্পের জন্য ₹৫ লাখ।)

১০ প্রকল্প × ₹৫ লাখ = ৩ মাসে ₹৫০ লাখ বুকিং।', 3, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M01-north-star'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 3);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M01-north-star-s4', '4 — ₹25,000/day daily sales (retail walk-ins from C2 + RD + DM)', '4 — रोज़ ₹25,000 रिटेल बिक्री (C2 + RD + DM)', '৪ — দৈনিক ₹২৫,০০০ খুচরা বিক্রি (C2 + RD + DM)', 'Daily retail walk-in sales from our three retail Vatikas. ₹25,000 per day average.

C2 = Cascade 2 Uniworld Vatika.
RD = Rosedale Vatika.
DM = Downtown Mall Vatika (new).
NV = Hazaratullah Nursery — backend feed only, NOT direct revenue. NV supplies plants to the three retail Vatikas.

₹25,000/day × 30 = ₹7.5 lakh/month = ₹22.5 lakh in 3 months.

For these to hit target, each retail Vatika needs three things — adequate inventory, trained sales staff, and the systems + collaterals to empower them.', 'हमारी तीन रिटेल Vatika-s की रोज़ की walk-in रिटेल बिक्री। औसत ₹25,000 रोज़।

C2 = Cascade 2 Uniworld Vatika।
RD = Rosedale Vatika।
DM = Downtown Mall Vatika (नई)।
NV = Hazaratullah Nursery — केवल बैकएंड फ़ीड, सीधी आय नहीं।

₹25,000/दिन × 30 = ₹7.5 लाख/माह = 3 महीनों में ₹22.5 लाख।

लक्ष्य हिट करने के लिए, हर रिटेल Vatika को तीन चीज़ें चाहिए — पर्याप्त इन्वेंटरी, प्रशिक्षित सेल्स स्टाफ, और उन्हें सशक्त करने के सिस्टम + कोलैटरल।', 'আমাদের তিনটি রিটেল Vatika-র দৈনিক খুচরা walk-in বিক্রি। গড়ে দিনে ₹২৫,০০০।

C2 = Cascade 2 Uniworld Vatika।
RD = Rosedale Vatika।
DM = Downtown Mall Vatika (নতুন)।
NV = Hazaratullah Nursery — শুধু ব্যাকএন্ড সরবরাহ, সরাসরি রাজস্ব নয়।

₹২৫,০০০/দিন × ৩০ = ₹৭.৫ লাখ/মাস = ৩ মাসে ₹২২.৫ লাখ।

লক্ষ্য পূরণের জন্য, প্রতিটি রিটেল Vatika-র তিনটি জিনিস লাগবে — পর্যাপ্ত ইনভেন্টরি, প্রশিক্ষিত সেলস স্টাফ, এবং তাদের ক্ষমতায়নের সিস্টেম + কোল্যাটেরাল।', 4, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M01-north-star'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 4);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M02-who-we-are-s0', 'Entity, team, and mission', 'कानूनी इकाई, टीम, और मिशन', 'সত্তা, দল এবং লক্ষ্য', 'KarmYog Vatika is the biophilic design business arm of KarmYog for the 21st Century (KY21C). Legal entity: NatureLink Education Network Private Limited (CIN U74999WB2011PTC167244). Website www.plantlibrary.net. Instagram @karmyogvatika.

Three decades of institutional backbone in Kolkata. A growing national network of Vatikas — Kolkata, Patna, Newtown, Rosedale, IIT Kharagpur, and the Million Vatikas franchise expansion into West Bengal.

The business has four layers: product (modular gardens), service (installations + maintenance), network (club membership + franchise), and platform (Vatika.AI digital demand engine).', '[Hindi translation pending Ram + Reena review] KarmYog Vatika is the biophilic design business arm of KarmYog for the 21st Century (KY21C). Legal entity: NatureLink Education Network Private Limited (CIN U74999WB2011PTC167244). Website www.plantlibrary.net. Instagram @karmyogvatika.

Three decades of institutional backbone in Kolkata. A growing national network of Vatikas — Kolkata, Patna, Newtown, Rosedale, IIT Kharagpur, and the Million Vatikas franchise expansion into West Bengal.

The business has four layers: product (modular gardens), service (installations + maintenance), network (club membership + franchise), and platform (Vatika.AI digital demand engine).', '[Bengali translation pending Ram + Reena review] KarmYog Vatika is the biophilic design business arm of KarmYog for the 21st Century (KY21C). Legal entity: NatureLink Education Network Private Limited (CIN U74999WB2011PTC167244). Website www.plantlibrary.net. Instagram @karmyogvatika.

Three decades of institutional backbone in Kolkata. A growing national network of Vatikas — Kolkata, Patna, Newtown, Rosedale, IIT Kharagpur, and the Million Vatikas franchise expansion into West Bengal.

The business has four layers: product (modular gardens), service (installations + maintenance), network (club membership + franchise), and platform (Vatika.AI digital demand engine).', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M02-who-we-are'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M02-who-we-are-s1', 'The team you hand off to', 'जिन्हें तुम हैंडओवर करोगे', 'তুমি যাদের কাছে হস্তান্তর করবে', 'MahAcharyaJi (Shri Sourabh J. Sarkar) — Founder. Mention in institutional pitches for credibility.
Shrimati Reena J. Sarkar — Co-Founder & Operations, +91 98300 24611, reenajs@ky21c.org. She signs service agreements.
Shri Ram Badrinathan — Co-Founder & Product/Tech, +91 91677 19898, ram@ky21c.org. Primary sales contact on large proposals.
Shri Koushik Sarkar — Chief Business Officer, ex-CEO Saint-Gobain. Joins institutional partner calls.
Smt. Panna Dhar — Head of Operations. Ops hand-off point.', '[Hindi translation pending Ram + Reena review] MahAcharyaJi (Shri Sourabh J. Sarkar) — Founder. Mention in institutional pitches for credibility.
Shrimati Reena J. Sarkar — Co-Founder & Operations, +91 98300 24611, reenajs@ky21c.org. She signs service agreements.
Shri Ram Badrinathan — Co-Founder & Product/Tech, +91 91677 19898, ram@ky21c.org. Primary sales contact on large proposals.
Shri Koushik Sarkar — Chief Business Officer, ex-CEO Saint-Gobain. Joins institutional partner calls.
Smt. Panna Dhar — Head of Operations. Ops hand-off point.', '[Bengali translation pending Ram + Reena review] MahAcharyaJi (Shri Sourabh J. Sarkar) — Founder. Mention in institutional pitches for credibility.
Shrimati Reena J. Sarkar — Co-Founder & Operations, +91 98300 24611, reenajs@ky21c.org. She signs service agreements.
Shri Ram Badrinathan — Co-Founder & Product/Tech, +91 91677 19898, ram@ky21c.org. Primary sales contact on large proposals.
Shri Koushik Sarkar — Chief Business Officer, ex-CEO Saint-Gobain. Joins institutional partner calls.
Smt. Panna Dhar — Head of Operations. Ops hand-off point.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M02-who-we-are'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M02-who-we-are-s2', 'Core values + four well-being pillars', 'मूल मूल्य + चार स्वास्थ्य स्तंभ', 'মূল মূল্যবোধ + চারটি স্বাস্থ্য স্তম্ভ', 'Sanskrit anchor — प्रज्ञा कौशल साधना (Wisdom Skill Practice).
Values: Nature (Prakriti), Learning (Shiksha), Community (Samudaya), Consciousness (Chetna), Service (Seva).
Four well-being pillars (memorise — institutional pitches): Health · Wealth · Nature · Culture.
A KarmYog Vatika is the single integrated place where urban communities access all four.', '[Hindi translation pending Ram + Reena review] Sanskrit anchor — प्रज्ञा कौशल साधना (Wisdom Skill Practice).
Values: Nature (Prakriti), Learning (Shiksha), Community (Samudaya), Consciousness (Chetna), Service (Seva).
Four well-being pillars (memorise — institutional pitches): Health · Wealth · Nature · Culture.
A KarmYog Vatika is the single integrated place where urban communities access all four.', '[Bengali translation pending Ram + Reena review] Sanskrit anchor — प्रज्ञा कौशल साधना (Wisdom Skill Practice).
Values: Nature (Prakriti), Learning (Shiksha), Community (Samudaya), Consciousness (Chetna), Service (Seva).
Four well-being pillars (memorise — institutional pitches): Health · Wealth · Nature · Culture.
A KarmYog Vatika is the single integrated place where urban communities access all four.', 2, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M02-who-we-are'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 2);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M03-what-we-sell-s0', 'The 16-module pricing catalogue (canonical)', '16-मॉड्यूल प्राइस कैटलॉग', '১৬-মডিউল মূল্য তালিকা', '16 proprietary SKUs. 4 tiers each: No Light · +Light · +Plants · +Plants & Light.
Sample flagships:
Vertical Z Module 12/9/6: ₹5,200 / 5,600 / 6,200 / 6,779 (18 plants)
Pine Box 6": ₹600 / 1,200 / 800 / 1,400 (3 plants)
Vertical Two Connector Z: ₹10,500 / 12,400 / 13,500 (33 plants)
Parapet 20 Bamboo (railing): ₹8,450 / 10,300 / 14,349 / 16,200 (38 plants)
Wall Vertical Pine Mat: ₹5,150 / 7,500 / 6,050 / 8,400 (9 plants)

Quoting rules: for proposals above ₹50K, quote TWO tiers (Silver/Gold). Default to +Plants. Lighting is the upsell — bundle inside Comfort/Gold, never as extra.', '[Hindi translation pending Ram + Reena review] 16 proprietary SKUs. 4 tiers each: No Light · +Light · +Plants · +Plants & Light.
Sample flagships:
Vertical Z Module 12/9/6: ₹5,200 / 5,600 / 6,200 / 6,779 (18 plants)
Pine Box 6": ₹600 / 1,200 / 800 / 1,400 (3 plants)
Vertical Two Connector Z: ₹10,500 / 12,400 / 13,500 (33 plants)
Parapet 20 Bamboo (railing): ₹8,450 / 10,300 / 14,349 / 16,200 (38 plants)
Wall Vertical Pine Mat: ₹5,150 / 7,500 / 6,050 / 8,400 (9 plants)

Quoting rules: for proposals above ₹50K, quote TWO tiers (Silver/Gold). Default to +Plants. Lighting is the upsell — bundle inside Comfort/Gold, never as extra.', '[Bengali translation pending Ram + Reena review] 16 proprietary SKUs. 4 tiers each: No Light · +Light · +Plants · +Plants & Light.
Sample flagships:
Vertical Z Module 12/9/6: ₹5,200 / 5,600 / 6,200 / 6,779 (18 plants)
Pine Box 6": ₹600 / 1,200 / 800 / 1,400 (3 plants)
Vertical Two Connector Z: ₹10,500 / 12,400 / 13,500 (33 plants)
Parapet 20 Bamboo (railing): ₹8,450 / 10,300 / 14,349 / 16,200 (38 plants)
Wall Vertical Pine Mat: ₹5,150 / 7,500 / 6,050 / 8,400 (9 plants)

Quoting rules: for proposals above ₹50K, quote TWO tiers (Silver/Gold). Default to +Plants. Lighting is the upsell — bundle inside Comfort/Gold, never as extra.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M03-what-we-sell'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M03-what-we-sell-s1', '6 formats Micro → Mega', '6 फ़ॉर्मेट Micro → Mega', '৬টি ফরম্যাট Micro → Mega', 'Micro 100 sqft (build ₹39K, monthly revenue ₹16K)
Mini 250 sqft (₹57K, ₹28K/mo)
Small 600 sqft (₹97K, ₹41K/mo)
Medium 1200 sqft (₹1.7L, ₹87K/mo)
Large 3000 sqft (₹3.5L, ₹1.46L/mo)
Mega 7000 sqft (₹6.4L, ₹2.5L/mo)', '[Hindi translation pending Ram + Reena review] Micro 100 sqft (build ₹39K, monthly revenue ₹16K)
Mini 250 sqft (₹57K, ₹28K/mo)
Small 600 sqft (₹97K, ₹41K/mo)
Medium 1200 sqft (₹1.7L, ₹87K/mo)
Large 3000 sqft (₹3.5L, ₹1.46L/mo)
Mega 7000 sqft (₹6.4L, ₹2.5L/mo)', '[Bengali translation pending Ram + Reena review] Micro 100 sqft (build ₹39K, monthly revenue ₹16K)
Mini 250 sqft (₹57K, ₹28K/mo)
Small 600 sqft (₹97K, ₹41K/mo)
Medium 1200 sqft (₹1.7L, ₹87K/mo)
Large 3000 sqft (₹3.5L, ₹1.46L/mo)
Mega 7000 sqft (₹6.4L, ₹2.5L/mo)', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M03-what-we-sell'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M03-what-we-sell-s2', 'Plant library + Greenri + Harshdeep', 'प्लांट लाइब्रेरी + Greenri + Harshdeep', 'প্ল্যান্ট লাইব্রেরি + Greenri + Harshdeep', '150+ species, Kolkata-climate-optimised. 15-day replacement guarantee + 30-day post-install care.

Greenri (premium): 158 units, 45% margin. Harshdeep Hortico (ISO, 25-year Public Ltd): Aura ₹16,319–₹63,496 · Urn ₹15,045–₹37,553 · Coral ₹7,705–₹23,356.', '[Hindi translation pending Ram + Reena review] 150+ species, Kolkata-climate-optimised. 15-day replacement guarantee + 30-day post-install care.

Greenri (premium): 158 units, 45% margin. Harshdeep Hortico (ISO, 25-year Public Ltd): Aura ₹16,319–₹63,496 · Urn ₹15,045–₹37,553 · Coral ₹7,705–₹23,356.', '[Bengali translation pending Ram + Reena review] 150+ species, Kolkata-climate-optimised. 15-day replacement guarantee + 30-day post-install care.

Greenri (premium): 158 units, 45% margin. Harshdeep Hortico (ISO, 25-year Public Ltd): Aura ₹16,319–₹63,496 · Urn ₹15,045–₹37,553 · Coral ₹7,705–₹23,356.', 2, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M03-what-we-sell'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 2);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M04-club-ecosystem-s0', 'Three membership tiers', 'तीन सदस्यता स्तर', 'তিনটি সদস্যপদ স্তর', 'Family Membership (households) — home transformation + Academy + Plant Library + Green Gifts.
Institutional Membership (schools, universities, corporates, societies, hospitals) — campus Vatika + stakeholder programming + CSR reporting + exhibit pavilions.
Business Membership (entrepreneurs) — Master Franchisee ₹69L + 5% royalty.', '[Hindi translation pending Ram + Reena review] Family Membership (households) — home transformation + Academy + Plant Library + Green Gifts.
Institutional Membership (schools, universities, corporates, societies, hospitals) — campus Vatika + stakeholder programming + CSR reporting + exhibit pavilions.
Business Membership (entrepreneurs) — Master Franchisee ₹69L + 5% royalty.', '[Bengali translation pending Ram + Reena review] Family Membership (households) — home transformation + Academy + Plant Library + Green Gifts.
Institutional Membership (schools, universities, corporates, societies, hospitals) — campus Vatika + stakeholder programming + CSR reporting + exhibit pavilions.
Business Membership (entrepreneurs) — Master Franchisee ₹69L + 5% royalty.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M04-club-ecosystem'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M04-club-ecosystem-s1', 'Adopt-a-Garden + GreenTelligence (Q.Rius + OmniDEL)', 'Adopt-a-Garden + GreenTelligence', 'Adopt-a-Garden + GreenTelligence', 'Adopt-a-Garden: KarmYog identifies unused spaces (rooftops, terraces, parks), runs fully-managed kitchen gardens, members sponsor seasonally, harvest-share. Pitch this at Month 3 of maintenance contracts — adds ₹25K–₹75K/season.

GreenTelligence: Q.Rius smart stickers + OmniDEL app. Point phone at planter → ML identifies plant + question + guide → fetches curated answer. Plants become digital libraries.

Plant Library: retail counter inside every Vatika (plants ₹150–800, Green Gifts, reference).
Behtar Life Academy: tech-enabled learning inside the Vatika. Funded by donations + product revenue, NOT course fees.', '[Hindi translation pending Ram + Reena review] Adopt-a-Garden: KarmYog identifies unused spaces (rooftops, terraces, parks), runs fully-managed kitchen gardens, members sponsor seasonally, harvest-share. Pitch this at Month 3 of maintenance contracts — adds ₹25K–₹75K/season.

GreenTelligence: Q.Rius smart stickers + OmniDEL app. Point phone at planter → ML identifies plant + question + guide → fetches curated answer. Plants become digital libraries.

Plant Library: retail counter inside every Vatika (plants ₹150–800, Green Gifts, reference).
Behtar Life Academy: tech-enabled learning inside the Vatika. Funded by donations + product revenue, NOT course fees.', '[Bengali translation pending Ram + Reena review] Adopt-a-Garden: KarmYog identifies unused spaces (rooftops, terraces, parks), runs fully-managed kitchen gardens, members sponsor seasonally, harvest-share. Pitch this at Month 3 of maintenance contracts — adds ₹25K–₹75K/season.

GreenTelligence: Q.Rius smart stickers + OmniDEL app. Point phone at planter → ML identifies plant + question + guide → fetches curated answer. Plants become digital libraries.

Plant Library: retail counter inside every Vatika (plants ₹150–800, Green Gifts, reference).
Behtar Life Academy: tech-enabled learning inside the Vatika. Funded by donations + product revenue, NOT course fees.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M04-club-ecosystem'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M05-pricing-playbook-s0', 'Installation pricing bands', 'इंस्टॉलेशन प्राइसिंग बैंड्स', 'ইনস্টলেশন মূল্যের ব্যান্ড', 'Small residential 50-300 sqft: ₹50-300/sqft.
Medium residential 300-1000 sqft: ₹150-600/sqft (Urvashi ₹2.61L at ₹340/sqft).
Duplex modular 1000+ sqft: ₹100-200/sqft (Dipika Heights ₹96K-1.35L tiered).
Flagship residential: ₹8L (Jhunjhunwala 17 zones).
Commercial entrance: ~₹2.6L (Manish Kochar).
Biophilic studio setup: ₹50L+ (SNU).
Recurring studio ops: ₹24-50L/year (SNU).
Biophilic cabin 3-tier (Walia): Economy ₹3.5L / Comfort ₹11L / Luxury ₹22L.
Franchise venture: ₹2Cr (Sumiran).', '[Hindi translation pending Ram + Reena review] Small residential 50-300 sqft: ₹50-300/sqft.
Medium residential 300-1000 sqft: ₹150-600/sqft (Urvashi ₹2.61L at ₹340/sqft).
Duplex modular 1000+ sqft: ₹100-200/sqft (Dipika Heights ₹96K-1.35L tiered).
Flagship residential: ₹8L (Jhunjhunwala 17 zones).
Commercial entrance: ~₹2.6L (Manish Kochar).
Biophilic studio setup: ₹50L+ (SNU).
Recurring studio ops: ₹24-50L/year (SNU).
Biophilic cabin 3-tier (Walia): Economy ₹3.5L / Comfort ₹11L / Luxury ₹22L.
Franchise venture: ₹2Cr (Sumiran).', '[Bengali translation pending Ram + Reena review] Small residential 50-300 sqft: ₹50-300/sqft.
Medium residential 300-1000 sqft: ₹150-600/sqft (Urvashi ₹2.61L at ₹340/sqft).
Duplex modular 1000+ sqft: ₹100-200/sqft (Dipika Heights ₹96K-1.35L tiered).
Flagship residential: ₹8L (Jhunjhunwala 17 zones).
Commercial entrance: ~₹2.6L (Manish Kochar).
Biophilic studio setup: ₹50L+ (SNU).
Recurring studio ops: ₹24-50L/year (SNU).
Biophilic cabin 3-tier (Walia): Economy ₹3.5L / Comfort ₹11L / Luxury ₹22L.
Franchise venture: ₹2Cr (Sumiran).', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M05-pricing-playbook'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M05-pricing-playbook-s1', 'Maintenance pricing rules (memorise)', 'रखरखाव के नियम', 'রক্ষণাবেক্ষণ মূল্যের নিয়ম', 'Office anchor: ₹100/plant/month (TMIL 120 plants × ₹100 = ₹12K/mo, 19+ months straight).
HNW residential: 1.5-2× office = ₹160-200/plant/month.
Premium ceiling: Mishra Ji ₹26,000/mo.
Institutional campus: ₹25,000+/mo (CII SNCEL 9 months flat).
Floor: Dr Kochgaway ₹1,500/mo.

Upsell: Month 3 quote biophilic arch (₹40-50K, CII SNCEL precedent ₹47,780). Month 6 quote landscaping (₹1.5-2L). Year 1 pitch Adopt-a-Garden.', '[Hindi translation pending Ram + Reena review] Office anchor: ₹100/plant/month (TMIL 120 plants × ₹100 = ₹12K/mo, 19+ months straight).
HNW residential: 1.5-2× office = ₹160-200/plant/month.
Premium ceiling: Mishra Ji ₹26,000/mo.
Institutional campus: ₹25,000+/mo (CII SNCEL 9 months flat).
Floor: Dr Kochgaway ₹1,500/mo.

Upsell: Month 3 quote biophilic arch (₹40-50K, CII SNCEL precedent ₹47,780). Month 6 quote landscaping (₹1.5-2L). Year 1 pitch Adopt-a-Garden.', '[Bengali translation pending Ram + Reena review] Office anchor: ₹100/plant/month (TMIL 120 plants × ₹100 = ₹12K/mo, 19+ months straight).
HNW residential: 1.5-2× office = ₹160-200/plant/month.
Premium ceiling: Mishra Ji ₹26,000/mo.
Institutional campus: ₹25,000+/mo (CII SNCEL 9 months flat).
Floor: Dr Kochgaway ₹1,500/mo.

Upsell: Month 3 quote biophilic arch (₹40-50K, CII SNCEL precedent ₹47,780). Month 6 quote landscaping (₹1.5-2L). Year 1 pitch Adopt-a-Garden.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M05-pricing-playbook'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M06-vatika-ai-s0', 'Three products, one platform', 'तीन प्रोडक्ट, एक प्लेटफ़ॉर्म', 'তিনটি পণ্য, একটি প্ল্যাটফর্ম', 'Vatika Studio (vatika-studio.vercel.app) — full AI design platform. Upload photo → pick budget → AI render with real products → quotation → WhatsApp order.
Vatika Ankita (vatika-ankita.vercel.app) — client-facing visualiser for Meta ad traffic, Kolkata-first.
Vatika Ankit (planned) — next iteration.

Stack: Next.js 16 + Gemini 2.0 Flash + Replicate Flux fallback + Supabase. 61 planters (15 KarmYog + 46 Ugaoo), 13 plant species, 3 budget tiers.', '[Hindi translation pending Ram + Reena review] Vatika Studio (vatika-studio.vercel.app) — full AI design platform. Upload photo → pick budget → AI render with real products → quotation → WhatsApp order.
Vatika Ankita (vatika-ankita.vercel.app) — client-facing visualiser for Meta ad traffic, Kolkata-first.
Vatika Ankit (planned) — next iteration.

Stack: Next.js 16 + Gemini 2.0 Flash + Replicate Flux fallback + Supabase. 61 planters (15 KarmYog + 46 Ugaoo), 13 plant species, 3 budget tiers.', '[Bengali translation pending Ram + Reena review] Vatika Studio (vatika-studio.vercel.app) — full AI design platform. Upload photo → pick budget → AI render with real products → quotation → WhatsApp order.
Vatika Ankita (vatika-ankita.vercel.app) — client-facing visualiser for Meta ad traffic, Kolkata-first.
Vatika Ankit (planned) — next iteration.

Stack: Next.js 16 + Gemini 2.0 Flash + Replicate Flux fallback + Supabase. 61 planters (15 KarmYog + 46 Ugaoo), 13 plant species, 3 budget tiers.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M06-vatika-ai'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M06-vatika-ai-s1', 'The delivery-timeline slider IS the business model', 'Delivery-timeline slider ही बिज़नेस मॉडल है', 'Delivery-timeline slider-ই ব্যবসার মডেল', 'Every day a customer waits eliminates one retail intermediary.
T1 Express 1-2d: 0% off, platform fee 36%. Traditional retail.
T4 Factory 30d: 30% off customer, platform fee 23%. Retailer+warehouse+distributor gone.
T5 Manufacturer Direct 45+d: 50% off customer, fee 9.1%. All 4 intermediaries eliminated.

The math: ₹50K MRP → manufacturer traditional ₹7,500 (15%). Vatika T4 ₹35K → manufacturer ₹12,000 (34%). Manufacturer earns 60% MORE at 30% discount to customer.

Seed round ₹4.5Cr at ₹22.5Cr post-money, 20% dilution. Kolkata thesis: 6.32% rental yield (highest in India), 40-60K target premium apartments.', '[Hindi translation pending Ram + Reena review] Every day a customer waits eliminates one retail intermediary.
T1 Express 1-2d: 0% off, platform fee 36%. Traditional retail.
T4 Factory 30d: 30% off customer, platform fee 23%. Retailer+warehouse+distributor gone.
T5 Manufacturer Direct 45+d: 50% off customer, fee 9.1%. All 4 intermediaries eliminated.

The math: ₹50K MRP → manufacturer traditional ₹7,500 (15%). Vatika T4 ₹35K → manufacturer ₹12,000 (34%). Manufacturer earns 60% MORE at 30% discount to customer.

Seed round ₹4.5Cr at ₹22.5Cr post-money, 20% dilution. Kolkata thesis: 6.32% rental yield (highest in India), 40-60K target premium apartments.', '[Bengali translation pending Ram + Reena review] Every day a customer waits eliminates one retail intermediary.
T1 Express 1-2d: 0% off, platform fee 36%. Traditional retail.
T4 Factory 30d: 30% off customer, platform fee 23%. Retailer+warehouse+distributor gone.
T5 Manufacturer Direct 45+d: 50% off customer, fee 9.1%. All 4 intermediaries eliminated.

The math: ₹50K MRP → manufacturer traditional ₹7,500 (15%). Vatika T4 ₹35K → manufacturer ₹12,000 (34%). Manufacturer earns 60% MORE at 30% discount to customer.

Seed round ₹4.5Cr at ₹22.5Cr post-money, 20% dilution. Kolkata thesis: 6.32% rental yield (highest in India), 40-60K target premium apartments.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M06-vatika-ai'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M07-proposal-writing-s0', 'Gamma + Canva workflow', 'Gamma + Canva वर्कफ़्लो', 'Gamma + Canva কর্মপ্রবাহ', '1. Brief PPT — locked text + placeholder images.
2. Upload to Gamma with master prompt → beautiful layout.
3. Export PDF.
4. Import to Canva.
5. Magic Grab — swap AI art for real product images (Brand Assets/, Plants/, Modules/).
6. Export final PDF + PPT.', '[Hindi translation pending Ram + Reena review] 1. Brief PPT — locked text + placeholder images.
2. Upload to Gamma with master prompt → beautiful layout.
3. Export PDF.
4. Import to Canva.
5. Magic Grab — swap AI art for real product images (Brand Assets/, Plants/, Modules/).
6. Export final PDF + PPT.', '[Bengali translation pending Ram + Reena review] 1. Brief PPT — locked text + placeholder images.
2. Upload to Gamma with master prompt → beautiful layout.
3. Export PDF.
4. Import to Canva.
5. Magic Grab — swap AI art for real product images (Brand Assets/, Plants/, Modules/).
6. Export final PDF + PPT.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M07-proposal-writing'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M07-proposal-writing-s1', 'PET + commercial terms (50/40/10)', 'PET + कमर्शियल शर्तें', 'PET + বাণিজ্যিক শর্তাবলী', 'Price Estimate Table (every proposal, every time):
1. Scope · 2. Bill of Materials · 3. Plant Schedule · 4. Planter Schedule · 5. Installation Plan · 6. Post-Installation Support (30-day) · 7. T&C.

50% advance on confirmation. 40% before dispatch. 10% on install. 30-day validity.
ICICI A/c 000605501516 · IFSC ICIC0000006.

Non-standard splits observed (both approved by Ram): Dipika 60/40, Urvashi 50/25/25. Check with Ram before agreeing.', '[Hindi translation pending Ram + Reena review] Price Estimate Table (every proposal, every time):
1. Scope · 2. Bill of Materials · 3. Plant Schedule · 4. Planter Schedule · 5. Installation Plan · 6. Post-Installation Support (30-day) · 7. T&C.

50% advance on confirmation. 40% before dispatch. 10% on install. 30-day validity.
ICICI A/c 000605501516 · IFSC ICIC0000006.

Non-standard splits observed (both approved by Ram): Dipika 60/40, Urvashi 50/25/25. Check with Ram before agreeing.', '[Bengali translation pending Ram + Reena review] Price Estimate Table (every proposal, every time):
1. Scope · 2. Bill of Materials · 3. Plant Schedule · 4. Planter Schedule · 5. Installation Plan · 6. Post-Installation Support (30-day) · 7. T&C.

50% advance on confirmation. 40% before dispatch. 10% on install. 30-day validity.
ICICI A/c 000605501516 · IFSC ICIC0000006.

Non-standard splits observed (both approved by Ram): Dipika 60/40, Urvashi 50/25/25. Check with Ram before agreeing.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M07-proposal-writing'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M08-sales-cycle-s0', 'Three cycles by channel', 'चैनल के अनुसार तीन साइकल', 'চ্যানেল অনুযায়ী তিনটি চক্র', 'Residential 2-3 months: lead → 7d site visit → 14d PET → Silver/Gold tier → 50% advance → install 3-7d small / 2-3 weeks duplex → 30-day support.

Institutional 4-6 months: lead → first meeting (MahAcharyaJi + Ram) → stakeholder mapping → concept + IIT KGP proof → 2-4 iterations → UNLOCK MOVE = visit IIT KGP Research Park → quotation.

Franchise 6-12 months: entrepreneur conversation → founder''s essay (Sumiran template) → mutual diligence → LLP + capital → PoC event → scaling.', '[Hindi translation pending Ram + Reena review] Residential 2-3 months: lead → 7d site visit → 14d PET → Silver/Gold tier → 50% advance → install 3-7d small / 2-3 weeks duplex → 30-day support.

Institutional 4-6 months: lead → first meeting (MahAcharyaJi + Ram) → stakeholder mapping → concept + IIT KGP proof → 2-4 iterations → UNLOCK MOVE = visit IIT KGP Research Park → quotation.

Franchise 6-12 months: entrepreneur conversation → founder''s essay (Sumiran template) → mutual diligence → LLP + capital → PoC event → scaling.', '[Bengali translation pending Ram + Reena review] Residential 2-3 months: lead → 7d site visit → 14d PET → Silver/Gold tier → 50% advance → install 3-7d small / 2-3 weeks duplex → 30-day support.

Institutional 4-6 months: lead → first meeting (MahAcharyaJi + Ram) → stakeholder mapping → concept + IIT KGP proof → 2-4 iterations → UNLOCK MOVE = visit IIT KGP Research Park → quotation.

Franchise 6-12 months: entrepreneur conversation → founder''s essay (Sumiran template) → mutual diligence → LLP + capital → PoC event → scaling.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M08-sales-cycle'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M08-sales-cycle-s1', 'The BharatBuild pattern (7 iterations)', 'BharatBuild पैटर्न', 'BharatBuild প্যাটার্ন', 'BharatBuild ran 7 proposal iterations over 3 months. Don''t panic on revision 3, 4, 5. Iteration = buying signal. Each version: preserve what they said yes to, surgically address the objection, show revision log, hold the price floor (pull a tier, never cut a rate).', '[Hindi translation pending Ram + Reena review] BharatBuild ran 7 proposal iterations over 3 months. Don''t panic on revision 3, 4, 5. Iteration = buying signal. Each version: preserve what they said yes to, surgically address the objection, show revision log, hold the price floor (pull a tier, never cut a rate).', '[Bengali translation pending Ram + Reena review] BharatBuild ran 7 proposal iterations over 3 months. Don''t panic on revision 3, 4, 5. Iteration = buying signal. Each version: preserve what they said yes to, surgically address the objection, show revision log, hold the price floor (pull a tier, never cut a rate).', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M08-sales-cycle'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M09-case-studies-s0', 'Nine exemplar deals', 'नौ उदाहरण सौदे', 'নয়টি উদাহরণ চুক্তি', '1. Jhunjhunwala ₹8L won — Atmosphere Topsia duplex, 63 planters × 17 zones. Flagship residential.
2. Urvashi Arora ₹2.61L won — Downtown 3, 768 sqft, 50/25/25 payment, 5-week close. Cleanest deal.
3. Dipika Heights ₹96K-1.35L won — Silver/Gold tiered template.
4. Sister Nivedita University ₹24-50L/yr pending — recurring institutional.
5. Sumiran Foundation MP ₹2Cr pending — franchise venture, 6 formats, 300 Phase-2.
6. IIT KGP Museum of the Future Pavilion — Sept 2025 Durga Puja pilot, 100,000+ visitors + 3M social impressions in ONE week. Oct 2025 proposal to make permanent.
7. Walia Ergo Tower — Biophilic River (Gangotri→Ganga Sagar narrative) + Cabin 3-tier ₹3.5L-22L + Trellis ₹4.85L.
8. Mishra Ji ₹26,000/month — premium maintenance ceiling, ongoing since Oct 2024.
9. Army Institute of Management Newtown — football field renovation multi-phase infrastructure project. Proves we do field-scale work.', '[Hindi translation pending Ram + Reena review] 1. Jhunjhunwala ₹8L won — Atmosphere Topsia duplex, 63 planters × 17 zones. Flagship residential.
2. Urvashi Arora ₹2.61L won — Downtown 3, 768 sqft, 50/25/25 payment, 5-week close. Cleanest deal.
3. Dipika Heights ₹96K-1.35L won — Silver/Gold tiered template.
4. Sister Nivedita University ₹24-50L/yr pending — recurring institutional.
5. Sumiran Foundation MP ₹2Cr pending — franchise venture, 6 formats, 300 Phase-2.
6. IIT KGP Museum of the Future Pavilion — Sept 2025 Durga Puja pilot, 100,000+ visitors + 3M social impressions in ONE week. Oct 2025 proposal to make permanent.
7. Walia Ergo Tower — Biophilic River (Gangotri→Ganga Sagar narrative) + Cabin 3-tier ₹3.5L-22L + Trellis ₹4.85L.
8. Mishra Ji ₹26,000/month — premium maintenance ceiling, ongoing since Oct 2024.
9. Army Institute of Management Newtown — football field renovation multi-phase infrastructure project. Proves we do field-scale work.', '[Bengali translation pending Ram + Reena review] 1. Jhunjhunwala ₹8L won — Atmosphere Topsia duplex, 63 planters × 17 zones. Flagship residential.
2. Urvashi Arora ₹2.61L won — Downtown 3, 768 sqft, 50/25/25 payment, 5-week close. Cleanest deal.
3. Dipika Heights ₹96K-1.35L won — Silver/Gold tiered template.
4. Sister Nivedita University ₹24-50L/yr pending — recurring institutional.
5. Sumiran Foundation MP ₹2Cr pending — franchise venture, 6 formats, 300 Phase-2.
6. IIT KGP Museum of the Future Pavilion — Sept 2025 Durga Puja pilot, 100,000+ visitors + 3M social impressions in ONE week. Oct 2025 proposal to make permanent.
7. Walia Ergo Tower — Biophilic River (Gangotri→Ganga Sagar narrative) + Cabin 3-tier ₹3.5L-22L + Trellis ₹4.85L.
8. Mishra Ji ₹26,000/month — premium maintenance ceiling, ongoing since Oct 2024.
9. Army Institute of Management Newtown — football field renovation multi-phase infrastructure project. Proves we do field-scale work.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M09-case-studies'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M10-maintenance-s0', 'The maintenance product (4 tiers)', 'रखरखाव प्रोडक्ट (4 स्तर)', 'রক্ষণাবেক্ষণ পণ্য (৪ স্তর)', 'Tier 1 Small <₹5K/mo: site upkeep, minimal plants, monthly visit (Dr Kochgaway ₹1,500).
Tier 2 Office ₹5-15K/mo: 100-150 plants, rotation, monthly visit (TMIL ₹12,000 = 120 plants at ₹100/plant/mo).
Tier 3 HNW Residential ₹15-26K/mo: weekly visits, styling, replacements (Karnani ₹16K, Mishra Ji ₹26K).
Tier 4 Institutional ₹25K+/mo: multi-zone campus (CII SNCEL ₹25K flat 9 months).', '[Hindi translation pending Ram + Reena review] Tier 1 Small <₹5K/mo: site upkeep, minimal plants, monthly visit (Dr Kochgaway ₹1,500).
Tier 2 Office ₹5-15K/mo: 100-150 plants, rotation, monthly visit (TMIL ₹12,000 = 120 plants at ₹100/plant/mo).
Tier 3 HNW Residential ₹15-26K/mo: weekly visits, styling, replacements (Karnani ₹16K, Mishra Ji ₹26K).
Tier 4 Institutional ₹25K+/mo: multi-zone campus (CII SNCEL ₹25K flat 9 months).', '[Bengali translation pending Ram + Reena review] Tier 1 Small <₹5K/mo: site upkeep, minimal plants, monthly visit (Dr Kochgaway ₹1,500).
Tier 2 Office ₹5-15K/mo: 100-150 plants, rotation, monthly visit (TMIL ₹12,000 = 120 plants at ₹100/plant/mo).
Tier 3 HNW Residential ₹15-26K/mo: weekly visits, styling, replacements (Karnani ₹16K, Mishra Ji ₹26K).
Tier 4 Institutional ₹25K+/mo: multi-zone campus (CII SNCEL ₹25K flat 9 months).', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M10-maintenance'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M10-maintenance-s1', 'Upsell playbook (every retainer is a lead)', 'अपसेल प्लेबुक', 'আপসেল প্লেবুক', 'Month 3: biophilic arch/feature install ₹40-50K one-time (CII SNCEL precedent ₹47,780 on top of ₹25K/mo retainer).
Month 6: landscaping project ₹1.5-2L (CII SNCEL 4-month project ₹1.8L, 50% advance).
Month 12: expand scope — add plants, zones, other buildings.
Year 1: pitch Adopt-a-Garden as next seasonal commitment.

Monthly billing, Net 15. Invoice format KYV_YYYY_SEQUENCE. 2 missed months → pause service, escalate to Panna.', '[Hindi translation pending Ram + Reena review] Month 3: biophilic arch/feature install ₹40-50K one-time (CII SNCEL precedent ₹47,780 on top of ₹25K/mo retainer).
Month 6: landscaping project ₹1.5-2L (CII SNCEL 4-month project ₹1.8L, 50% advance).
Month 12: expand scope — add plants, zones, other buildings.
Year 1: pitch Adopt-a-Garden as next seasonal commitment.

Monthly billing, Net 15. Invoice format KYV_YYYY_SEQUENCE. 2 missed months → pause service, escalate to Panna.', '[Bengali translation pending Ram + Reena review] Month 3: biophilic arch/feature install ₹40-50K one-time (CII SNCEL precedent ₹47,780 on top of ₹25K/mo retainer).
Month 6: landscaping project ₹1.5-2L (CII SNCEL 4-month project ₹1.8L, 50% advance).
Month 12: expand scope — add plants, zones, other buildings.
Year 1: pitch Adopt-a-Garden as next seasonal commitment.

Monthly billing, Net 15. Invoice format KYV_YYYY_SEQUENCE. 2 missed months → pause service, escalate to Panna.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M10-maintenance'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M11-master-franchisee-s0', '6-format unit ladder', '6-फ़ॉर्मेट यूनिट सीढ़ी', '৬-ফরম্যাট ইউনিট সিঁড়ি', 'Single-unit economics (from CashFlow9MthMasterFranchisee.xlsx):
Micro 100sqft: build ₹39,164 · monthly ops ₹12,744 · monthly revenue ₹16,433 · break-even 29mo.
Mini 250sqft: ₹56,968 · ₹20,652 · ₹28,650 · 24mo.
Small 600sqft: ₹96,599 · ₹31,728 · ₹41,356 · 28mo.
Medium 1,200sqft: ₹1.71L · ₹49,146 · ₹87,053 · 24mo.
Large 3,000sqft: ₹3.46L · ₹78,436 · ₹1.46L · 28mo.
Mega 7,000sqft: ₹6.44L · ₹1.28L · ₹2.53L · 1-2 years.', '[Hindi translation pending Ram + Reena review] Single-unit economics (from CashFlow9MthMasterFranchisee.xlsx):
Micro 100sqft: build ₹39,164 · monthly ops ₹12,744 · monthly revenue ₹16,433 · break-even 29mo.
Mini 250sqft: ₹56,968 · ₹20,652 · ₹28,650 · 24mo.
Small 600sqft: ₹96,599 · ₹31,728 · ₹41,356 · 28mo.
Medium 1,200sqft: ₹1.71L · ₹49,146 · ₹87,053 · 24mo.
Large 3,000sqft: ₹3.46L · ₹78,436 · ₹1.46L · 28mo.
Mega 7,000sqft: ₹6.44L · ₹1.28L · ₹2.53L · 1-2 years.', '[Bengali translation pending Ram + Reena review] Single-unit economics (from CashFlow9MthMasterFranchisee.xlsx):
Micro 100sqft: build ₹39,164 · monthly ops ₹12,744 · monthly revenue ₹16,433 · break-even 29mo.
Mini 250sqft: ₹56,968 · ₹20,652 · ₹28,650 · 24mo.
Small 600sqft: ₹96,599 · ₹31,728 · ₹41,356 · 28mo.
Medium 1,200sqft: ₹1.71L · ₹49,146 · ₹87,053 · 24mo.
Large 3,000sqft: ₹3.46L · ₹78,436 · ₹1.46L · 28mo.
Mega 7,000sqft: ₹6.44L · ₹1.28L · ₹2.53L · 1-2 years.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M11-master-franchisee'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M11-master-franchisee-s1', 'Master Franchisee economics (geography-level)', 'मास्टर फ्रेंचाइज़ी अर्थशास्त्र', 'মাস্টার ফ্র্যাঞ্চাইজি অর্থনীতি', '₹69 lakh one-time upfront per geography.
5% recurring royalty on franchisee unit sales + setup fees.
Geography-exclusive territory rights.
6-unit demo network cumulative ₹1.35Cr.
Y1 annual network revenue ₹1.85Cr.
5-year network target: 268 units per geography.
5-year MF cumulative profit ₹3.15+ Cr.
300+ livelihoods per geography.
Avg franchisee break-even 24-29 months.

Flagship precedent: Sumiran Ecological Foundation, Barkheda MP. Reena''s founder essay is the vision template.

MF calls go to Ram + MahAcharyaJi + Koushik.', '[Hindi translation pending Ram + Reena review] ₹69 lakh one-time upfront per geography.
5% recurring royalty on franchisee unit sales + setup fees.
Geography-exclusive territory rights.
6-unit demo network cumulative ₹1.35Cr.
Y1 annual network revenue ₹1.85Cr.
5-year network target: 268 units per geography.
5-year MF cumulative profit ₹3.15+ Cr.
300+ livelihoods per geography.
Avg franchisee break-even 24-29 months.

Flagship precedent: Sumiran Ecological Foundation, Barkheda MP. Reena''s founder essay is the vision template.

MF calls go to Ram + MahAcharyaJi + Koushik.', '[Bengali translation pending Ram + Reena review] ₹69 lakh one-time upfront per geography.
5% recurring royalty on franchisee unit sales + setup fees.
Geography-exclusive territory rights.
6-unit demo network cumulative ₹1.35Cr.
Y1 annual network revenue ₹1.85Cr.
5-year network target: 268 units per geography.
5-year MF cumulative profit ₹3.15+ Cr.
300+ livelihoods per geography.
Avg franchisee break-even 24-29 months.

Flagship precedent: Sumiran Ecological Foundation, Barkheda MP. Reena''s founder essay is the vision template.

MF calls go to Ram + MahAcharyaJi + Koushik.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M11-master-franchisee'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M12-behtar-life-shop-s0', 'Cowpathy — cow-based wellness', 'Cowpathy — गाय आधारित सेहत', 'Cowpathy — গো-ভিত্তিক সুস্থতা', 'Natural Ayurvedic personal care from cow-milk derivatives. Soaps (multi-variant), shampoos, face & body cosmetics, seasonal specials. Bundle ~₹3,000. Integration order ~₹9,103 baseline.', '[Hindi translation pending Ram + Reena review] Natural Ayurvedic personal care from cow-milk derivatives. Soaps (multi-variant), shampoos, face & body cosmetics, seasonal specials. Bundle ~₹3,000. Integration order ~₹9,103 baseline.', '[Bengali translation pending Ram + Reena review] Natural Ayurvedic personal care from cow-milk derivatives. Soaps (multi-variant), shampoos, face & body cosmetics, seasonal specials. Bundle ~₹3,000. Integration order ~₹9,103 baseline.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M12-behtar-life-shop'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M12-behtar-life-shop-s1', 'Deshaj — Bengal artisanal (22 SKUs)', 'Deshaj — बंगाल का हस्तशिल्प', 'Deshaj — বাংলার হস্তশিল্প', 'Honeys: Sundarban, Eucalyptus, Litchi, Mustard, Neem, Tulsi, Multi-Floral — 500g ₹419 / 250g ₹229. Ghee 350g ₹450 / 150g ₹180. Spices: Turmeric 200g ₹110 / 100g ₹45. Red Chilli 200g ₹190 / 100g ₹80. Cumin 200g ₹149. Coriander 200g ~₹140. Soaps (in production): Neem+Turmeric+Clove, Charcoal+Neem+Basil, Aloe+Moringa, Cucumber+Honey — 75g ₹130-145.', '[Hindi translation pending Ram + Reena review] Honeys: Sundarban, Eucalyptus, Litchi, Mustard, Neem, Tulsi, Multi-Floral — 500g ₹419 / 250g ₹229. Ghee 350g ₹450 / 150g ₹180. Spices: Turmeric 200g ₹110 / 100g ₹45. Red Chilli 200g ₹190 / 100g ₹80. Cumin 200g ₹149. Coriander 200g ~₹140. Soaps (in production): Neem+Turmeric+Clove, Charcoal+Neem+Basil, Aloe+Moringa, Cucumber+Honey — 75g ₹130-145.', '[Bengali translation pending Ram + Reena review] Honeys: Sundarban, Eucalyptus, Litchi, Mustard, Neem, Tulsi, Multi-Floral — 500g ₹419 / 250g ₹229. Ghee 350g ₹450 / 150g ₹180. Spices: Turmeric 200g ₹110 / 100g ₹45. Red Chilli 200g ₹190 / 100g ₹80. Cumin 200g ₹149. Coriander 200g ~₹140. Soaps (in production): Neem+Turmeric+Clove, Charcoal+Neem+Basil, Aloe+Moringa, Cucumber+Honey — 75g ₹130-145.', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M12-behtar-life-shop'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M12-behtar-life-shop-s2', 'The sales move inside Behtar Life Shop', 'दुकान में सेल्स की चाल', 'দোকানে বিক্রয়ের কৌশল', 'Every walk-in is a multi-product conversation:
Entry via plant or gift → upsell to module → nudge to membership → capture for Adopt-a-Garden.
A single family visit can touch ₹500 retail + ₹25,000 module + ₹5,000 annual membership = the Vatika compounding at scale.', '[Hindi translation pending Ram + Reena review] Every walk-in is a multi-product conversation:
Entry via plant or gift → upsell to module → nudge to membership → capture for Adopt-a-Garden.
A single family visit can touch ₹500 retail + ₹25,000 module + ₹5,000 annual membership = the Vatika compounding at scale.', '[Bengali translation pending Ram + Reena review] Every walk-in is a multi-product conversation:
Entry via plant or gift → upsell to module → nudge to membership → capture for Adopt-a-Garden.
A single family visit can touch ₹500 retail + ₹25,000 module + ₹5,000 annual membership = the Vatika compounding at scale.', 2, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M12-behtar-life-shop'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 2);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M13-channel-partners-s0', 'Parichalak & Sanchalak', 'परिचालक और संचालक', 'পরিচালক ও সঞ্চালক', 'Parichalak = lead partner (owns client relationship).
Sanchalak = sub-partner feeding leads into Parichalak (shares from Parichalak''s commission, negotiated privately).

Compensation: ₹8-12K fixed per sale + 1-1.5% variable.
₹1L sale → ~9% · ₹5L → ~3.4% · ₹25L → ~1.7% · ₹1Cr → ~1.5%.
Range: 5.29-15.50%.

Ideal recruits: architects, interior designers, landscape contractors, hospitality consultants, real-estate brokers, event managers.

Onboarding: NDA → playbook access → first lead with Ram co-pitching → first close → commission 30d after full client payment.', '[Hindi translation pending Ram + Reena review] Parichalak = lead partner (owns client relationship).
Sanchalak = sub-partner feeding leads into Parichalak (shares from Parichalak''s commission, negotiated privately).

Compensation: ₹8-12K fixed per sale + 1-1.5% variable.
₹1L sale → ~9% · ₹5L → ~3.4% · ₹25L → ~1.7% · ₹1Cr → ~1.5%.
Range: 5.29-15.50%.

Ideal recruits: architects, interior designers, landscape contractors, hospitality consultants, real-estate brokers, event managers.

Onboarding: NDA → playbook access → first lead with Ram co-pitching → first close → commission 30d after full client payment.', '[Bengali translation pending Ram + Reena review] Parichalak = lead partner (owns client relationship).
Sanchalak = sub-partner feeding leads into Parichalak (shares from Parichalak''s commission, negotiated privately).

Compensation: ₹8-12K fixed per sale + 1-1.5% variable.
₹1L sale → ~9% · ₹5L → ~3.4% · ₹25L → ~1.7% · ₹1Cr → ~1.5%.
Range: 5.29-15.50%.

Ideal recruits: architects, interior designers, landscape contractors, hospitality consultants, real-estate brokers, event managers.

Onboarding: NDA → playbook access → first lead with Ram co-pitching → first close → commission 30d after full client payment.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M13-channel-partners'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M14-objection-handling-s0', 'Top 8 objections + scripts', 'शीर्ष 8 आपत्तियाँ', 'শীর্ষ ৮টি আপত্তি', '"Too expensive" → pull out a lower tier. "Silver gives 70% sanctuary for 55% cost." (Dipika precedent.)
"Nursery is cheaper" → "You can. But no 15-day replacement, no 30-day support, no Harshdeep planters, no install team. We are not in the plant business. We are in the sanctuary business."
"Show me what you''ve built" → match scale. Residential → Jhunjhunwala or Dipika. Institutional → IIT KGP or AIM. Franchise → Sumiran.
"I need to think" → "Of course. PET + Silver/Gold in 10 min. Site visit next week."
"Spouse/board needs to approve" → ask who. Offer 20-min direct call or site visit.
"Plants will die" → "30-day support. Post that, ₹[tier from M10]. TMIL = 120 plants healthy 19 months straight."
"Timeline too long" → "Let me overlap phases. Revised schedule tomorrow."
"60/40 instead of 50/40/10" → "Dipika did 60/40. Let me confirm with Reena, 24 hours." NEVER on the spot.', '[Hindi translation pending Ram + Reena review] "Too expensive" → pull out a lower tier. "Silver gives 70% sanctuary for 55% cost." (Dipika precedent.)
"Nursery is cheaper" → "You can. But no 15-day replacement, no 30-day support, no Harshdeep planters, no install team. We are not in the plant business. We are in the sanctuary business."
"Show me what you''ve built" → match scale. Residential → Jhunjhunwala or Dipika. Institutional → IIT KGP or AIM. Franchise → Sumiran.
"I need to think" → "Of course. PET + Silver/Gold in 10 min. Site visit next week."
"Spouse/board needs to approve" → ask who. Offer 20-min direct call or site visit.
"Plants will die" → "30-day support. Post that, ₹[tier from M10]. TMIL = 120 plants healthy 19 months straight."
"Timeline too long" → "Let me overlap phases. Revised schedule tomorrow."
"60/40 instead of 50/40/10" → "Dipika did 60/40. Let me confirm with Reena, 24 hours." NEVER on the spot.', '[Bengali translation pending Ram + Reena review] "Too expensive" → pull out a lower tier. "Silver gives 70% sanctuary for 55% cost." (Dipika precedent.)
"Nursery is cheaper" → "You can. But no 15-day replacement, no 30-day support, no Harshdeep planters, no install team. We are not in the plant business. We are in the sanctuary business."
"Show me what you''ve built" → match scale. Residential → Jhunjhunwala or Dipika. Institutional → IIT KGP or AIM. Franchise → Sumiran.
"I need to think" → "Of course. PET + Silver/Gold in 10 min. Site visit next week."
"Spouse/board needs to approve" → ask who. Offer 20-min direct call or site visit.
"Plants will die" → "30-day support. Post that, ₹[tier from M10]. TMIL = 120 plants healthy 19 months straight."
"Timeline too long" → "Let me overlap phases. Revised schedule tomorrow."
"60/40 instead of 50/40/10" → "Dipika did 60/40. Let me confirm with Reena, 24 hours." NEVER on the spot.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M14-objection-handling'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M14-objection-handling-s1', 'Words that kill deals', 'डील खोने वाले शब्द', 'ডিল হারানোর শব্দ', '"Budget option" → say "Silver tier".
"Cheap" → say "entry-level".
"Luxury" → say "bespoke".
"Deal/discount" → say "seasonal offer".
"We''ll try" → say "we will".
"I think so" → say "I will confirm by [date]".', '[Hindi translation pending Ram + Reena review] "Budget option" → say "Silver tier".
"Cheap" → say "entry-level".
"Luxury" → say "bespoke".
"Deal/discount" → say "seasonal offer".
"We''ll try" → say "we will".
"I think so" → say "I will confirm by [date]".', '[Bengali translation pending Ram + Reena review] "Budget option" → say "Silver tier".
"Cheap" → say "entry-level".
"Luxury" → say "bespoke".
"Deal/discount" → say "seasonal offer".
"We''ll try" → say "we will".
"I think so" → say "I will confirm by [date]".', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M14-objection-handling'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M15-video-library-s0', 'How to use the 5 videos', '5 वीडियो का उपयोग', '৫টি ভিডিও কীভাবে ব্যবহার করবে', 'Week 1 Day 1: watch all 5 in order, one sitting (~45-60 min).
Before your first client pitch: re-watch Videos 1 and 2.
Before your first site visit: re-watch Video 3 (critical segment from 5:24).
Before your first PET: re-watch Video 5 (critical segment from 0:28).
Video 1 is also embedded in M00 Welcome for first-encounter context.', '[Hindi translation pending Ram + Reena review] Week 1 Day 1: watch all 5 in order, one sitting (~45-60 min).
Before your first client pitch: re-watch Videos 1 and 2.
Before your first site visit: re-watch Video 3 (critical segment from 5:24).
Before your first PET: re-watch Video 5 (critical segment from 0:28).
Video 1 is also embedded in M00 Welcome for first-encounter context.', '[Bengali translation pending Ram + Reena review] Week 1 Day 1: watch all 5 in order, one sitting (~45-60 min).
Before your first client pitch: re-watch Videos 1 and 2.
Before your first site visit: re-watch Video 3 (critical segment from 5:24).
Before your first PET: re-watch Video 5 (critical segment from 0:28).
Video 1 is also embedded in M00 Welcome for first-encounter context.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M16-ops-handover-s0', '8-phase install process (58-day residential)', '8-चरण इंस्टॉल प्रक्रिया', '৮-ধাপ ইনস্টল প্রক্রিয়া', 'Day 0 Site visit + measurement (Sales + designer).
Day 1-14 Concept + PET (Sales + Gamma/Canva). 50% advance trigger.
Day 14-21 Procurement (Panna + team). Greenri + Harshdeep + local orders.
Day 21-22 Site prep.
Day 23-28 Install (team 2-4 people). Residential 3-5d · Duplex 1 week · Institutional 2-3 weeks.
Day 28 Handover (Sales + Panna). 40% paid, walkthrough, care manual.
Day 29-58 30-day support. 2 visits, photo documentation.
Day 58 Final 10% + maintenance contract pitch.', '[Hindi translation pending Ram + Reena review] Day 0 Site visit + measurement (Sales + designer).
Day 1-14 Concept + PET (Sales + Gamma/Canva). 50% advance trigger.
Day 14-21 Procurement (Panna + team). Greenri + Harshdeep + local orders.
Day 21-22 Site prep.
Day 23-28 Install (team 2-4 people). Residential 3-5d · Duplex 1 week · Institutional 2-3 weeks.
Day 28 Handover (Sales + Panna). 40% paid, walkthrough, care manual.
Day 29-58 30-day support. 2 visits, photo documentation.
Day 58 Final 10% + maintenance contract pitch.', '[Bengali translation pending Ram + Reena review] Day 0 Site visit + measurement (Sales + designer).
Day 1-14 Concept + PET (Sales + Gamma/Canva). 50% advance trigger.
Day 14-21 Procurement (Panna + team). Greenri + Harshdeep + local orders.
Day 21-22 Site prep.
Day 23-28 Install (team 2-4 people). Residential 3-5d · Duplex 1 week · Institutional 2-3 weeks.
Day 28 Handover (Sales + Panna). 40% paid, walkthrough, care manual.
Day 29-58 30-day support. 2 visits, photo documentation.
Day 58 Final 10% + maintenance contract pitch.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M16-ops-handover'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M16-ops-handover-s1', 'Care manual + quality commitments', 'देखभाल गाइड', 'যত্ন নির্দেশিকা', 'Given to every client at handover:
- Plant schedule · watering schedule · light requirements
- Pest/disease early signs
- Panna''s 30-day contact
- Maintenance tier proposal
- QR to plantlibrary.net

Commitments: all plants certified nurseries · planters inspected before dispatch · trained team only · 15-day replacement guarantee · 30-day post-install care · photo documentation every time.

Escalation: Field issue → Maintenance lead → Panna (48h+) → Reena (client escalating) → Ram (commercial dispute ₹1L+).', '[Hindi translation pending Ram + Reena review] Given to every client at handover:
- Plant schedule · watering schedule · light requirements
- Pest/disease early signs
- Panna''s 30-day contact
- Maintenance tier proposal
- QR to plantlibrary.net

Commitments: all plants certified nurseries · planters inspected before dispatch · trained team only · 15-day replacement guarantee · 30-day post-install care · photo documentation every time.

Escalation: Field issue → Maintenance lead → Panna (48h+) → Reena (client escalating) → Ram (commercial dispute ₹1L+).', '[Bengali translation pending Ram + Reena review] Given to every client at handover:
- Plant schedule · watering schedule · light requirements
- Pest/disease early signs
- Panna''s 30-day contact
- Maintenance tier proposal
- QR to plantlibrary.net

Commitments: all plants certified nurseries · planters inspected before dispatch · trained team only · 15-day replacement guarantee · 30-day post-install care · photo documentation every time.

Escalation: Field issue → Maintenance lead → Panna (48h+) → Reena (client escalating) → Ram (commercial dispute ₹1L+).', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M16-ops-handover'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M17-faq-s0', 'Q1. What does KarmYog Vatika do?', 'सवाल 1: KarmYog Vatika क्या करती है?', 'প্র১: KarmYog Vatika কী করে?', 'We create biophilic living sanctuaries — modular gardens, green walls, planters, plants, complete installations — for homes, offices, institutions. We run the Vatika as a club with membership tiers, a retail counter (Behtar Life Shop), an Academy, and a smart-planter GreenTelligence layer. We also maintain installations monthly.', '[Hindi translation pending Ram + Reena review] We create biophilic living sanctuaries — modular gardens, green walls, planters, plants, complete installations — for homes, offices, institutions. We run the Vatika as a club with membership tiers, a retail counter (Behtar Life Shop), an Academy, and a smart-planter GreenTelligence layer. We also maintain installations monthly.', '[Bengali translation pending Ram + Reena review] We create biophilic living sanctuaries — modular gardens, green walls, planters, plants, complete installations — for homes, offices, institutions. We run the Vatika as a club with membership tiers, a retail counter (Behtar Life Shop), an Academy, and a smart-planter GreenTelligence layer. We also maintain installations monthly.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M17-faq'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M17-faq-s1', 'Q2-Q8 quick reference', 'Q2-Q8 क्विक रेफ़रेंस', 'Q2-Q8 দ্রুত রেফারেন্স', 'Q2 Legal entity? NatureLink Education Network Pvt Ltd, CIN U74999WB2011PTC167244, ICICI A/c 000605501516 IFSC ICIC0000006.
Q3 Install duration? Small residential 3-5d, duplex 1-2 weeks, institutional 2-4 weeks. End-to-end 3-4 weeks from 50% advance.
Q4 Plants die? 15-day replacement. 30-day post-install care. Then maintenance tier from M10.
Q5 Show me examples? Institutional: visit IIT KGP Research Park + AIM football field. Residential: Atmosphere Topsia / Heights 802 / Downtown 3.
Q6 vs nursery? Nurseries sell plants. We sell sanctuaries + ecosystems + clubs + Vatika.AI.
Q7 Payment? 50/40/10 standard. 30-day validity. Non-standard case-by-case.
Q8 Partner? Parichalak (5.29-15.50% commission, no upfront) or Master Franchisee (₹69L upfront + 5% royalty, whole geography).', '[Hindi translation pending Ram + Reena review] Q2 Legal entity? NatureLink Education Network Pvt Ltd, CIN U74999WB2011PTC167244, ICICI A/c 000605501516 IFSC ICIC0000006.
Q3 Install duration? Small residential 3-5d, duplex 1-2 weeks, institutional 2-4 weeks. End-to-end 3-4 weeks from 50% advance.
Q4 Plants die? 15-day replacement. 30-day post-install care. Then maintenance tier from M10.
Q5 Show me examples? Institutional: visit IIT KGP Research Park + AIM football field. Residential: Atmosphere Topsia / Heights 802 / Downtown 3.
Q6 vs nursery? Nurseries sell plants. We sell sanctuaries + ecosystems + clubs + Vatika.AI.
Q7 Payment? 50/40/10 standard. 30-day validity. Non-standard case-by-case.
Q8 Partner? Parichalak (5.29-15.50% commission, no upfront) or Master Franchisee (₹69L upfront + 5% royalty, whole geography).', '[Bengali translation pending Ram + Reena review] Q2 Legal entity? NatureLink Education Network Pvt Ltd, CIN U74999WB2011PTC167244, ICICI A/c 000605501516 IFSC ICIC0000006.
Q3 Install duration? Small residential 3-5d, duplex 1-2 weeks, institutional 2-4 weeks. End-to-end 3-4 weeks from 50% advance.
Q4 Plants die? 15-day replacement. 30-day post-install care. Then maintenance tier from M10.
Q5 Show me examples? Institutional: visit IIT KGP Research Park + AIM football field. Residential: Atmosphere Topsia / Heights 802 / Downtown 3.
Q6 vs nursery? Nurseries sell plants. We sell sanctuaries + ecosystems + clubs + Vatika.AI.
Q7 Payment? 50/40/10 standard. 30-day validity. Non-standard case-by-case.
Q8 Partner? Parichalak (5.29-15.50% commission, no upfront) or Master Franchisee (₹69L upfront + 5% royalty, whole geography).', 1, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M17-faq'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 1);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M18-pitch-sequence-s0', 'The 6 steps of any first client pitch', 'पहली क्लाइंट पिच के 6 कदम', 'প্রথম ক্লায়েন্ট পিচের ৬ ধাপ', '1. Who we are — KarmYog Vatika, biophilic arm of KY21C, NatureLink Education Network, 30 years of practice, 7 active Vatikas.
2. What we do for them specifically — tailor to THEIR space: duplex, office, campus. 16 SKUs, 150+ species, proprietary modules.
3. Show a precedent — match scale. Residential → Jhunjhunwala/Dipika. Institutional → IIT KGP/AIM. Franchise → Sumiran.
4. The numbers — quote the band, not the final price. "For your scope, ₹2-4L band. Silver + Gold in 10 days." Commit to a date.
5. The process — 50/40/10, 30-day validity, 3-4 week install, 15-day replacement, 30-day support.
6. Ask for the site visit — close on a CALENDAR commitment, never on the call. "Tuesday 11am, 45 minutes, no fee."', '[Hindi translation pending Ram + Reena review] 1. Who we are — KarmYog Vatika, biophilic arm of KY21C, NatureLink Education Network, 30 years of practice, 7 active Vatikas.
2. What we do for them specifically — tailor to THEIR space: duplex, office, campus. 16 SKUs, 150+ species, proprietary modules.
3. Show a precedent — match scale. Residential → Jhunjhunwala/Dipika. Institutional → IIT KGP/AIM. Franchise → Sumiran.
4. The numbers — quote the band, not the final price. "For your scope, ₹2-4L band. Silver + Gold in 10 days." Commit to a date.
5. The process — 50/40/10, 30-day validity, 3-4 week install, 15-day replacement, 30-day support.
6. Ask for the site visit — close on a CALENDAR commitment, never on the call. "Tuesday 11am, 45 minutes, no fee."', '[Bengali translation pending Ram + Reena review] 1. Who we are — KarmYog Vatika, biophilic arm of KY21C, NatureLink Education Network, 30 years of practice, 7 active Vatikas.
2. What we do for them specifically — tailor to THEIR space: duplex, office, campus. 16 SKUs, 150+ species, proprietary modules.
3. Show a precedent — match scale. Residential → Jhunjhunwala/Dipika. Institutional → IIT KGP/AIM. Franchise → Sumiran.
4. The numbers — quote the band, not the final price. "For your scope, ₹2-4L band. Silver + Gold in 10 days." Commit to a date.
5. The process — 50/40/10, 30-day validity, 3-4 week install, 15-day replacement, 30-day support.
6. Ask for the site visit — close on a CALENDAR commitment, never on the call. "Tuesday 11am, 45 minutes, no fee."', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M18-pitch-sequence'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M19-meeting-playbook-s0', 'Pre-call checklist + 30-minute flow', 'कॉल से पहले की चेकलिस्ट', 'কল-পূর্ব চেকলিস্ট', 'Pre-call: this app open. M05 Pricing + M09 Case Studies tabbed. Proposals Registry filtered to likely scope. Site photos if sent. Panna''s number on standby. Ram''s number on standby.

0-3 min Opening: "30 min. I walk you through what we do, show precedents, answer anything. By the end we schedule a site visit."
3-8 min Who we are.
8-14 min What we''d do for them — tailor.
14-20 min Show 1-2 precedents. Match scale.
20-25 min Numbers + process.
25-28 min Their questions — stop talking. Answer with number or fact.
28-30 min Close on calendar. Tuesday 11am.

After call (same day): calendar invite, playbook link if institutional/franchise, log conversation, alert Panna for site visit window.', '[Hindi translation pending Ram + Reena review] Pre-call: this app open. M05 Pricing + M09 Case Studies tabbed. Proposals Registry filtered to likely scope. Site photos if sent. Panna''s number on standby. Ram''s number on standby.

0-3 min Opening: "30 min. I walk you through what we do, show precedents, answer anything. By the end we schedule a site visit."
3-8 min Who we are.
8-14 min What we''d do for them — tailor.
14-20 min Show 1-2 precedents. Match scale.
20-25 min Numbers + process.
25-28 min Their questions — stop talking. Answer with number or fact.
28-30 min Close on calendar. Tuesday 11am.

After call (same day): calendar invite, playbook link if institutional/franchise, log conversation, alert Panna for site visit window.', '[Bengali translation pending Ram + Reena review] Pre-call: this app open. M05 Pricing + M09 Case Studies tabbed. Proposals Registry filtered to likely scope. Site photos if sent. Panna''s number on standby. Ram''s number on standby.

0-3 min Opening: "30 min. I walk you through what we do, show precedents, answer anything. By the end we schedule a site visit."
3-8 min Who we are.
8-14 min What we''d do for them — tailor.
14-20 min Show 1-2 precedents. Match scale.
20-25 min Numbers + process.
25-28 min Their questions — stop talking. Answer with number or fact.
28-30 min Close on calendar. Tuesday 11am.

After call (same day): calendar invite, playbook link if institutional/franchise, log conversation, alert Panna for site visit window.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M19-meeting-playbook'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

INSERT INTO public.arjun_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours, status)
SELECT m.id, 'M20-first-week-s0', 'Your first 7 days at KarmYog Vatika', 'KarmYog Vatika के पहले 7 दिन', 'KarmYog Vatika-র প্রথম ৭ দিন', '☐ Read every module on this app cover to cover (3-4 hours). Bookmark M05 Pricing, M09 Case Studies, M14 Objection Handling.
☐ Read vault pages: vatika-business-overview, vatika-product-catalog, brand-identity, proposal-standards, gamma-canva-workflow, vatika-studio, vatika-ai-investor, vatika-iitkgp-research-park.
☐ Watch all 5 videos in M15.
☐ Visit one live KarmYog Vatika — Atmosphere Topsia, Rosedale, IIT KGP Studio, or AIM campus.
☐ Shadow Panna on a site visit or install day.
☐ Sit in on one Ram sales call (listen only).
☐ Play with Vatika Ankita (vatika-ankita.vercel.app) — upload a photo, generate a render.
☐ Draft your first PET for a mock brief. Ram reviews.
☐ Walk the Harshdeep 2025-26 catalogue + Greenri inventory with Panna. Know the top 20 SKUs.
☐ Memorise: banking, commercial terms, 5 brand words (sanctuary, transform, nurture, bespoke, biophilic), 4 pillars (Health/Wealth/Nature/Culture), the 4 North Star numbers.

End-of-week-1 check-in with Ram + Reena. First 30-60-90 day goals set.', '[Hindi translation pending Ram + Reena review] ☐ Read every module on this app cover to cover (3-4 hours). Bookmark M05 Pricing, M09 Case Studies, M14 Objection Handling.
☐ Read vault pages: vatika-business-overview, vatika-product-catalog, brand-identity, proposal-standards, gamma-canva-workflow, vatika-studio, vatika-ai-investor, vatika-iitkgp-research-park.
☐ Watch all 5 videos in M15.
☐ Visit one live KarmYog Vatika — Atmosphere Topsia, Rosedale, IIT KGP Studio, or AIM campus.
☐ Shadow Panna on a site visit or install day.
☐ Sit in on one Ram sales call (listen only).
☐ Play with Vatika Ankita (vatika-ankita.vercel.app) — upload a photo, generate a render.
☐ Draft your first PET for a mock brief. Ram reviews.
☐ Walk the Harshdeep 2025-26 catalogue + Greenri inventory with Panna. Know the top 20 SKUs.
☐ Memorise: banking, commercial terms, 5 brand words (sanctuary, transform, nurture, bespoke, biophilic), 4 pillars (Health/Wealth/Nature/Culture), the 4 North Star numbers.

End-of-week-1 check-in with Ram + Reena. First 30-60-90 day goals set.', '[Bengali translation pending Ram + Reena review] ☐ Read every module on this app cover to cover (3-4 hours). Bookmark M05 Pricing, M09 Case Studies, M14 Objection Handling.
☐ Read vault pages: vatika-business-overview, vatika-product-catalog, brand-identity, proposal-standards, gamma-canva-workflow, vatika-studio, vatika-ai-investor, vatika-iitkgp-research-park.
☐ Watch all 5 videos in M15.
☐ Visit one live KarmYog Vatika — Atmosphere Topsia, Rosedale, IIT KGP Studio, or AIM campus.
☐ Shadow Panna on a site visit or install day.
☐ Sit in on one Ram sales call (listen only).
☐ Play with Vatika Ankita (vatika-ankita.vercel.app) — upload a photo, generate a render.
☐ Draft your first PET for a mock brief. Ram reviews.
☐ Walk the Harshdeep 2025-26 catalogue + Greenri inventory with Panna. Know the top 20 SKUs.
☐ Memorise: banking, commercial terms, 5 brand words (sanctuary, transform, nurture, bespoke, biophilic), 4 pillars (Health/Wealth/Nature/Culture), the 4 North Star numbers.

End-of-week-1 check-in with Ram + Reena. First 30-60-90 day goals set.', 0, 1, 'published'
FROM public.arjun_modules m WHERE m.slug = 'M20-first-week'
AND NOT EXISTS (SELECT 1 FROM public.arjun_sections s2 WHERE s2.module_id = m.id AND s2.sort_order = 0);

-- ============================================================================
-- SEED: Arjun Videos
-- ============================================================================

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, '6s7zI_W0sko', 'KarmYog Vatika Explainer 1', 'KarmYog Vatika परिचय 1', 'KarmYog Vatika ব্যাখ্যা ১', 0, 0
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = '6s7zI_W0sko');

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, 'VVheqkr97wI', 'KarmYog Vatika Explainer 2', 'KarmYog Vatika परिचय 2', 'KarmYog Vatika ব্যাখ্যা ২', 0, 1
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = 'VVheqkr97wI');

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, '-NHfMxGTd1c', 'KarmYog Vatika Explainer 3 (starts 5:24)', 'KarmYog Vatika परिचय 3 (5:24 से)', 'KarmYog Vatika ব্যাখ্যা ৩ (৫:২৪ থেকে)', 324, 2
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = '-NHfMxGTd1c');

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, 'R4JtntEFOjY', 'KarmYog Vatika Explainer 4', 'KarmYog Vatika परिचय 4', 'KarmYog Vatika ব্যাখ্যা ৪', 0, 3
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = 'R4JtntEFOjY');

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, 'YfX-aeVlKLA', 'KarmYog Vatika Explainer 5 (starts 0:28)', 'KarmYog Vatika परिचय 5 (0:28 से)', 'KarmYog Vatika ব্যাখ্যা ৫ (০:২৮ থেকে)', 28, 4
FROM public.arjun_modules m WHERE m.slug = 'M15-video-library'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = 'YfX-aeVlKLA');

INSERT INTO public.arjun_videos (module_id, youtube_id, title_en, title_hi, title_bn, start_seconds, sort_order)
SELECT m.id, '6s7zI_W0sko', 'Featured welcome video', 'स्वागत वीडियो', 'স্বাগত ভিডিও', 0, 5
FROM public.arjun_modules m WHERE m.slug = 'M00-welcome'
AND NOT EXISTS (SELECT 1 FROM public.arjun_videos v2 WHERE v2.module_id = m.id AND v2.youtube_id = '6s7zI_W0sko');

-- Done.