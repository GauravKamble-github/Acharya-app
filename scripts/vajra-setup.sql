-- ============================================================================
-- Vajra Acharya — Complete Production Schema
-- Run at: https://supabase.com/dashboard/project/jxztbmckfsvjragbfcir/sql/new
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- HELPER: auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.vajra_update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLES
-- ============================================================================

-- USERS
CREATE TABLE IF NOT EXISTS public.vajra_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text DEFAULT '',
  role text NOT NULL DEFAULT 'learner'
    CHECK (role IN ('learner', 'admin', 'founder')),
  is_admin boolean NOT NULL DEFAULT false,
  preferred_lang text NOT NULL DEFAULT 'en'
    CHECK (preferred_lang IN ('en', 'hi', 'bn')),
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  last_seen_on timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vajra_users_updated_at
  BEFORE UPDATE ON public.vajra_users
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- MODULES
CREATE TABLE IF NOT EXISTS public.vajra_modules (
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
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'review', 'published')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vajra_modules_updated_at
  BEFORE UPDATE ON public.vajra_modules
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- SECTIONS
CREATE TABLE IF NOT EXISTS public.vajra_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.vajra_modules(id) ON DELETE CASCADE,
  slug text,
  title_en text NOT NULL,
  title_hi text,
  title_bn text,
  body_en text,
  body_hi text,
  body_bn text,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'review', 'published')),
  sort_order int NOT NULL DEFAULT 1,
  estimated_hours numeric NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vajra_sections_updated_at
  BEFORE UPDATE ON public.vajra_sections
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- VIDEOS
CREATE TABLE IF NOT EXISTS public.vajra_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.vajra_modules(id) ON DELETE CASCADE,
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

CREATE TRIGGER vajra_videos_updated_at
  BEFORE UPDATE ON public.vajra_videos
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- PROGRESS
CREATE TABLE IF NOT EXISTS public.vajra_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.vajra_users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.vajra_modules(id) ON DELETE CASCADE,
  sections_completed text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, module_id)
);

CREATE TRIGGER vajra_progress_updated_at
  BEFORE UPDATE ON public.vajra_progress
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- QUIZ ATTEMPTS
CREATE TABLE IF NOT EXISTS public.vajra_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.vajra_users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.vajra_modules(id) ON DELETE SET NULL,
  score int NOT NULL,
  total int NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CHAT LOGS
CREATE TABLE IF NOT EXISTS public.vajra_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.vajra_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.vajra_modules(id) ON DELETE SET NULL,
  lang text CHECK (lang IN ('en', 'hi', 'bn')),
  user_message text,
  ai_response text,
  response_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.vajra_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.vajra_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- APPLY LOGS
CREATE TABLE IF NOT EXISTS public.vajra_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.vajra_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.vajra_modules(id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'self_assessment',
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI USAGE
CREATE TABLE IF NOT EXISTS public.vajra_ai_usage (
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
  acharya_slug text NOT NULL DEFAULT 'vajra',
  has_image boolean NOT NULL DEFAULT false,
  cost_usd numeric NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CONFIG
CREATE TABLE IF NOT EXISTS public.vajra_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vajra_config_updated_at
  BEFORE UPDATE ON public.vajra_config
  FOR EACH ROW EXECUTE FUNCTION public.vajra_update_updated_at();

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS vajra_modules_sort_idx ON public.vajra_modules(sort_order);
CREATE INDEX IF NOT EXISTS vajra_sections_module_sort_idx ON public.vajra_sections(module_id, sort_order);
CREATE INDEX IF NOT EXISTS vajra_progress_learner_idx ON public.vajra_progress(learner_id);
CREATE INDEX IF NOT EXISTS vajra_chat_logs_learner_created_idx ON public.vajra_chat_logs(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vajra_events_learner_created_idx ON public.vajra_events(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vajra_users_phone_idx ON public.vajra_users(phone);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.vajra_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_apply_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vajra_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEED: 8 Electrician Modules with Sections
-- ============================================================================
INSERT INTO public.vajra_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en)
VALUES
  ('M01-safety', 'Electrical Safety Basics', 'विद्युत सुरक्षा की बुनियाद', 'ইলেকট্রিক্যাল নিরাপত্তার মৌলিক', 'sparkle', 1.0, 2.0, 1, 'foundation', 'Foundation'),
  ('M02-tools', 'Tools and Testers', 'उपकरण और टेस्टर', 'টুলস এবং টেস্টার', 'pencil', 1.0, 2.0, 2, 'foundation', 'Foundation'),
  ('M03-wires', 'Wires and Cable Sizing', 'तार और केबल आकार', 'তার এবং কেবল সাইজিং', 'wave', 2.0, 3.0, 3, 'wiring', 'Wiring'),
  ('M04-switchboards', 'Switches, Sockets and Boards', 'स्विच, सॉकेट और बोर्ड', 'সুইচ, সকেট এবং বোর্ড', 'stack', 2.0, 4.0, 4, 'wiring', 'Wiring'),
  ('M05-protection', 'MCB, RCCB and DB Basics', 'एमसीबी, आरसीसीबी और डीबी', 'MCB, RCCB এবং DB বেসিক', 'target', 2.0, 3.0, 5, 'protection', 'Protection'),
  ('M06-fault-finding', 'Fault Finding', 'दोष खोजना', 'ফল্ট ফাইন্ডিং', 'bell', 2.0, 4.0, 6, 'service', 'Service'),
  ('M07-earthing', 'Earthing and Testing', 'अर्थिंग और परीक्षण', 'আর্থিং এবং টেস্টিং', 'pin', 1.0, 3.0, 7, 'protection', 'Protection'),
  ('M08-load', 'Load Calculation', 'लोड गणना', 'লোড ক্যালকুলেশন', 'chart', 1.0, 2.0, 8, 'service', 'Service')
ON CONFLICT (slug) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.vajra_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours)
SELECT m.id, m.slug || '-core', m.title_en || ' - Core Lesson',
  COALESCE(m.title_hi, m.title_en) || ' - मुख्य पाठ',
  COALESCE(m.title_bn, m.title_en) || ' - মূল পাঠ',
  CASE m.slug
    WHEN 'M01-safety' THEN 'Before opening any board, switch off the main supply. Use a tester or multimeter to confirm there is no voltage. Never trust only the switch position. Use insulated tools, dry footwear, gloves where needed, and proper lighting. Stop work if you see sparking, smoke, burning smell, wet wiring, or damaged insulation.'
    WHEN 'M02-tools' THEN 'An electrician should know: screwdriver, combination plier, nose plier, wire stripper, insulation tape, tester, multimeter, clamp meter, drill, rawl plug, screw and ferrule. Maintain tools clean and dry. Test your tester before every use.'
    WHEN 'M03-wires' THEN 'Lighting circuits use smaller wire than power sockets. High-load appliances like AC or geyser need suitable wire size, proper MCB rating, and dedicated wiring. Always match wire gauge to load current.'
    WHEN 'M04-switchboards' THEN 'After isolating power, check for loose screws, black marks, melted plastic, wrong wire stripping, exposed copper, and overloaded sockets. Replace damaged components immediately.'
    WHEN 'M05-protection' THEN 'An MCB protects mainly against overload and short circuit. An RCCB helps protect against earth leakage. Both must be selected and installed correctly. Never bypass a protection device.'
    WHEN 'M06-fault-finding' THEN 'For no power: check supply, MCB position, voltage at input, voltage at output, loose neutral, and local switch/socket condition. Confirm each step before replacing parts.'
    WHEN 'M07-earthing' THEN 'Earthing gives leakage current a safer path and helps protective devices operate. Poor earthing can make metal appliance bodies dangerous. Test earth resistance regularly.'
    WHEN 'M08-load' THEN 'Do not run many high-load appliances from one socket or extension board. Estimate load, check wire size and MCB rating, and use dedicated circuits where required.'
  END,
  CASE m.slug
    WHEN 'M01-safety' THEN 'किसी भी बोर्ड को खोलने से पहले मुख्य सप्लाई बंद करें। टेस्टर या मल्टीमीटर से वोल्टेज न होने की पुष्टि करें। इंसुलेटेड टूल, सूखे जूते, जरूरत हो तो दस्ताने और सही रोशनी का इस्तेमाल करें।'
    WHEN 'M02-tools' THEN 'एक इलेक्ट्रीशियन को जानना चाहिए: स्क्रूड्राइवर, कॉम्बिनेशन प्लायर, नोज़ प्लायर, वायर स्ट्रिपर, इंसुलेशन टेप, टेस्टर, मल्टीमीटर, क्लैंप मीटर, ड्रिल, रॉल प्लग, स्क्रू और फेरूल।'
    WHEN 'M03-wires' THEN 'लाइटिंग सर्किट में पावर सॉकेट से छोटी वायर होती है। एसी या गीजर जैसे हाई-लोड उपकरणों को उपयुक्त वायर साइज, सही एमसीबी रेटिंग और समर्पित वायरिंग की जरूरत होती है।'
    WHEN 'M04-switchboards' THEN 'पावर अलग करने के बाद, ढीले स्क्रू, काले निशान, पिघला प्लास्टिक, गलत वायर स्ट्रिपिंग और ओवरलोडेड सॉकेट की जांच करें। क्षतिग्रस्त कंपोनेंट तुरंत बदलें।'
    WHEN 'M05-protection' THEN 'एमसीबी मुख्य रूप से ओवरलोड और शॉर्ट सर्किट से बचाता है। आरसीसीबी अर्थ लीकेज से बचाता है। दोनों को सही तरीके से चुनकर लगाना जरूरी है। प्रोटेक्शन डिवाइस को कभी बायपास न करें।'
    WHEN 'M06-fault-finding' THEN 'पावर न आने पर: सप्लाई, एमसीबी पोजीशन, इनपुट वोल्टेज, आउटपुट वोल्टेज, ढीला न्यूट्रल और स्थानीय स्विच/सॉकेट की जांच करें। हर कदम की पुष्टि करें।'
    WHEN 'M07-earthing' THEN 'अर्थिंग लीकेज करंट को सुरक्षित रास्ता देती है और प्रोटेक्टिव डिवाइस को काम करने में मदद करती है। खराब अर्थिंग से मेटल उपकरण खतरनाक बन सकते हैं।'
    WHEN 'M08-load' THEN 'एक सॉकेट या एक्सटेंशन बोर्ड से कई हाई-लोड उपकरण न चलाएं। लोड का अनुमान लगाएं, वायर साइज और एमसीबी रेटिंग जांचें, और जहां जरूरत हो डेडिकेटेड सर्किट का इस्तेमाल करें।'
  END,
  CASE m.slug
    WHEN 'M01-safety' THEN 'কোনো বোর্ড খোলার আগে মেইন সাপ্লাই বন্ধ করুন। টেস্টার বা মাল্টিমিটার দিয়ে ভোল্টেজ নেই তা নিশ্চিত করুন। ইনসুলেটেড টুল, শুকনো জুতা, প্রয়োজনে গ্লাভস এবং সঠিক আলো ব্যবহার করুন।'
    WHEN 'M02-tools' THEN 'একজন ইলেকট্রিশিয়ানের জানা উচিত: স্ক্রু ড্রাইভার, কম্বিনেশন প্লায়ার, নোজ প্লায়ার, ওয়্যার স্ট্রিপার, ইনসুলেশন টেপ, টেস্টার, মাল্টিমিটার, ক্ল্যাম্প মিটার, ড্রিল, রল প্লাগ, স্ক্রু এবং ফেরুল।'
    WHEN 'M03-wires' THEN 'লাইটিং সার্কিটে পাওয়ার সকেটের চেয়ে ছোট তার ব্যবহৃত হয়। এসি বা গিজারের মতো হাই-লোড অ্যাপ্লায়েন্সের জন্য উপযুক্ত তারের সাইজ, সঠিক MCB রেটিং এবং ডেডিকেটেড ওয়্যারিং প্রয়োজন।'
    WHEN 'M04-switchboards' THEN 'পাওয়ার আলাদা করার পর, ঢিলা স্ক্রু, কালো দাগ, গলা প্লাস্টিক, ভুল তার স্ট্রিপিং এবং ওভারলোডেড সকেট চেক করুন। ক্ষতিগ্রস্ত কম্পোনেন্ট তৎক্ষণাৎ বদলান।'
    WHEN 'M05-protection' THEN 'MCB মূলত ওভারলোড ও শর্ট সার্কিট থেকে রক্ষা করে। RCCB আর্থ লিকেজ থেকে রক্ষায় সাহায্য করে। দুটোই সঠিকভাবে নির্বাচন ও ইনস্টল করতে হবে। প্রটেকশন ডিভাইস কখনই বাইপাস করবেন না।'
    WHEN 'M06-fault-finding' THEN 'পাওয়ার না থাকলে: সাপ্লাই, MCB পজিশন, ইনপুট ভোল্টেজ, আউটপুট ভোল্টেজ, ঢিলা নিউট্রাল এবং স্থানীয় সুইচ/সকেট পরীক্ষা করুন। প্রতিটি ধাপ নিশ্চিত করে এগোন।'
    WHEN 'M07-earthing' THEN 'আর্থিং লিকেজ কারেন্টকে নিরাপদ পথ দেয় এবং প্রটেক্টিভ ডিভাইসকে কাজ করতে সাহায্য করে। খারাপ আর্থিং মেটাল অ্যাপ্লায়েন্স বডিকে বিপজ্জনক করতে পারে।'
    WHEN 'M08-load' THEN 'একটি সকেট বা এক্সটেনশন বোর্ড থেকে অনেক হাই-লোড অ্যাপ্লায়েন্স চালাবেন না। লোড অনুমান করুন, তারের সাইজ ও MCB রেটিং পরীক্ষা করুন, এবং যেখানে প্রয়োজন ডেডিকেটেড সার্কিট ব্যবহার করুন।'
  END,
  1, 1
FROM public.vajra_modules m
WHERE NOT EXISTS (
  SELECT 1 FROM public.vajra_sections s WHERE s.module_id = m.id
);
