-- ============================================================================
-- Taksha Acharya — Complete Production Schema
-- Run at: https://supabase.com/dashboard/project/hkesrvdyknnxnordotfm/sql/new
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- HELPER: auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.taksha_update_updated_at()
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
CREATE TABLE IF NOT EXISTS public.taksha_users (
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

CREATE TRIGGER taksha_users_updated_at
  BEFORE UPDATE ON public.taksha_users
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- MODULES
CREATE TABLE IF NOT EXISTS public.taksha_modules (
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

CREATE TRIGGER taksha_modules_updated_at
  BEFORE UPDATE ON public.taksha_modules
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- SECTIONS
CREATE TABLE IF NOT EXISTS public.taksha_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.taksha_modules(id) ON DELETE CASCADE,
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

CREATE TRIGGER taksha_sections_updated_at
  BEFORE UPDATE ON public.taksha_sections
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- VIDEOS
CREATE TABLE IF NOT EXISTS public.taksha_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.taksha_modules(id) ON DELETE CASCADE,
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

CREATE TRIGGER taksha_videos_updated_at
  BEFORE UPDATE ON public.taksha_videos
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- PROGRESS
CREATE TABLE IF NOT EXISTS public.taksha_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.taksha_users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.taksha_modules(id) ON DELETE CASCADE,
  sections_completed text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, module_id)
);

CREATE TRIGGER taksha_progress_updated_at
  BEFORE UPDATE ON public.taksha_progress
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- QUIZ ATTEMPTS
CREATE TABLE IF NOT EXISTS public.taksha_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.taksha_users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.taksha_modules(id) ON DELETE SET NULL,
  score int NOT NULL,
  total int NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CHAT LOGS
CREATE TABLE IF NOT EXISTS public.taksha_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.taksha_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.taksha_modules(id) ON DELETE SET NULL,
  lang text CHECK (lang IN ('en', 'hi', 'bn')),
  user_message text,
  ai_response text,
  response_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.taksha_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.taksha_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- APPLY LOGS
CREATE TABLE IF NOT EXISTS public.taksha_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES public.taksha_users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.taksha_modules(id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'self_assessment',
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI USAGE
CREATE TABLE IF NOT EXISTS public.taksha_ai_usage (
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
  acharya_slug text NOT NULL DEFAULT 'taksha',
  has_image boolean NOT NULL DEFAULT false,
  cost_usd numeric NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CONFIG
CREATE TABLE IF NOT EXISTS public.taksha_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER taksha_config_updated_at
  BEFORE UPDATE ON public.taksha_config
  FOR EACH ROW EXECUTE FUNCTION public.taksha_update_updated_at();

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS taksha_modules_sort_idx ON public.taksha_modules(sort_order);
CREATE INDEX IF NOT EXISTS taksha_sections_module_sort_idx ON public.taksha_sections(module_id, sort_order);
CREATE INDEX IF NOT EXISTS taksha_progress_learner_idx ON public.taksha_progress(learner_id);
CREATE INDEX IF NOT EXISTS taksha_chat_logs_learner_created_idx ON public.taksha_chat_logs(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taksha_events_learner_created_idx ON public.taksha_events(learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taksha_users_phone_idx ON public.taksha_users(phone);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.taksha_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_apply_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taksha_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SEED: 10 Carpentry Modules with Sections
-- ============================================================================
INSERT INTO public.taksha_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en)
VALUES
  ('M01-workshop-safety', 'Workshop Safety and Work Discipline', 'वर्कशॉप सुरक्षा और काम का अनुशासन', 'ওয়ার্কশপ নিরাপত্তা ও কাজের শৃঙ্খলা', '🛡️', 3, 5, 1, 'foundation', 'Foundation'),
  ('M02-tools', 'Hand Tools, Power Tools, and Maintenance', 'हैंड टूल, पावर टूल और रखरखाव', 'হাতের টুল, পাওয়ার টুল ও রক্ষণাবেক্ষণ', '🧰', 4, 8, 2, 'foundation', 'Foundation'),
  ('M03-measure-mark', 'Measurement, Marking, and Layout', 'माप, मार्किंग और लेआउट', 'মাপ নেওয়া, মার্কিং ও লেআউট', '📏', 4, 8, 3, 'foundation', 'Foundation'),
  ('M04-wood-materials', 'Wood Types, Boards, Hardware, and Adhesives', 'लकड़ी, बोर्ड, हार्डवेयर और गोंद', 'কাঠ, বোর্ড, হার্ডওয়্যার ও আঠা', '🪵', 5, 6, 4, 'materials', 'Materials'),
  ('M05-cutting-joining', 'Cutting, Shaping, and Joinery', 'कटिंग, आकार और जोड़ाई', 'কাটা, আকার দেওয়া ও জয়নারি', '🪚', 5, 12, 5, 'core_skills', 'Core Skills'),
  ('M06-furniture-basics', 'Furniture Frames, Cabinets, and Drawers', 'फर्नीचर फ्रेम, कैबिनेट और दराज', 'ফার্নিচার ফ্রেম, ক্যাবিনেট ও ড্রয়ার', '🪑', 5, 14, 6, 'core_skills', 'Core Skills'),
  ('M07-finishing', 'Sanding, Finishing, Polishing, and Protection', 'सैंडिंग, फिनिशिंग, पॉलिशिंग और सुरक्षा', 'স্যান্ডিং, ফিনিশিং, পলিশিং ও সুরক্ষা', '🎨', 4, 10, 7, 'finishing', 'Finishing'),
  ('M08-site-installation', 'Site Work, Installation, and Client Handover', 'साइट वर्क, इंस्टॉलेशन और हैंडओवर', 'সাইটের কাজ, ইনস্টলেশন ও ক্লায়েন্ট হ্যান্ডওভার', '🏗️', 4, 10, 8, 'field_work', 'Field Work'),
  ('M09-repair', 'Repair, Restoration, and Problem Solving', 'मरम्मत, बहाली और समस्या समाधान', 'মেরামত, পুনরুদ্ধার ও সমস্যা সমাধান', '🔧', 4, 10, 9, 'field_work', 'Field Work'),
  ('M10-advanced-craft', 'Advanced Craftsmanship and Professional Practice', 'उन्नत कारीगरी और पेशेवर अभ्यास', 'উন্নত কারিগরি ও পেশাদার কাজ', '🏆', 5, 16, 10, 'professional', 'Professional')
ON CONFLICT (slug) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.taksha_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours)
SELECT m.id, m.slug || '-core', m.title_en || ' - Core Lesson',
  COALESCE(m.title_hi, m.title_en) || ' - मुख्य पाठ',
  COALESCE(m.title_bn, m.title_en) || ' - মূল পাঠ',
  CASE m.slug
    WHEN 'M01-workshop-safety' THEN 'Learn safe workshop habits before touching any tool: PPE, dust control, machine guards, cable discipline, sharp-tool handling, fire safety, first aid, and clean work zones. Inspect a workbench, list five hazards, correct them, and explain the safety reason for each correction.'
    WHEN 'M02-tools' THEN 'Understand what each carpentry tool is for and how to keep it accurate. Covers measuring tools, saws, chisels, planes, drills, routers, clamps, sanders, and basic maintenance. Practical: sharpen a chisel, square a blade, test a drill bit, and create a daily tool checklist.'
    WHEN 'M03-measure-mark' THEN 'Good carpentry begins with accurate layout. Practice reading drawings, using tape and square correctly, marking reference faces, allowing tolerances, and checking diagonals. Practical: mark and cut four pieces for a square frame within 2 mm tolerance.'
    WHEN 'M04-wood-materials' THEN 'Study solid wood, plywood, MDF, particle board, laminates, veneers, screws, hinges, channels, adhesives, and how moisture affects material movement. Practical: compare three board samples, choose hardware for a cabinet, and explain why the choice fits the job.'
    WHEN 'M05-cutting-joining' THEN 'Build core cutting and joining skill: rip cuts, cross cuts, mitres, curves, dados, rabbets, dowels, pocket screws, mortise and tenon, and basic jigs. Practical: make a small joined frame using two joinery methods and test it for square and strength.'
    WHEN 'M06-furniture-basics' THEN 'Move from parts to furniture. Learn frame construction, carcass building, shelves, shutters, drawers, edge banding, alignment, and simple ergonomic dimensions. Practical: build a small wall cabinet or stool with a measured drawing and cutting list.'
    WHEN 'M07-finishing' THEN 'Learn surface preparation and finish selection: sanding sequence, filling, staining, sealing, polishing, varnish, PU, oil, wax, and protection during transport. Practical: prepare three sample boards with different finishes and compare appearance, touch, and durability.'
    WHEN 'M08-site-installation' THEN 'Practice real site work: measurement verification, wall/floor checks, anchoring, leveling, scribing, client communication, snag lists, and handover. Practical: install a shelf or cabinet mock-up on an uneven wall and create a handover checklist.'
    WHEN 'M09-repair' THEN 'Learn diagnosis and repair: loose joints, swollen shutters, scratches, broken hardware, water damage, laminate peeling, and restoration planning. Practical: inspect a damaged furniture piece, diagnose the cause, and prepare a repair estimate with steps.'
    WHEN 'M10-advanced-craft' THEN 'Develop professional judgment: complex joinery, templates, curved work, built-ins, quality inspection, costing, time planning, workshop leadership, and client-ready craftsmanship. Practical: plan and build a capstone piece with drawing, cutting list, finish schedule, quality checklist, and final presentation.'
  END,
  CASE m.slug
    WHEN 'M01-workshop-safety' THEN 'किसी भी टूल को छूने से पहले सुरक्षित वर्कशॉप आदतें सीखो: पीपीई, धूल नियंत्रण, मशीन गार्ड, केबल अनुशासन, धारदार टूल संभालना, आग से सुरक्षा, प्राथमिक उपचार और साफ काम की जगह। वर्कबेंच जांचो, पांच खतरे लिखो, ठीक करो।'
    WHEN 'M02-tools' THEN 'हर कारपेंट्री टूल किस काम आता है और उसे सही व सटीक कैसे रखना है, यह समझो। मापने के टूल, आरी, छेनी, प्लेन, ड्रिल, राउटर, क्लैंप, सैंडर शामिल। प्रैक्टिकल: छेनी तेज करो, ब्लेड स्क्वायर करो, ड्रिल बिट जांचो।'
    WHEN 'M03-measure-mark' THEN 'अच्छी कारपेंट्री सही लेआउट से शुरू होती है। ड्रॉइंग पढ़ना, टेप और स्क्वायर सही तरह इस्तेमाल, रेफरेंस फेस मार्क करना, टॉलरेंस रखना। प्रैक्टिकल: 2 मिमी टॉलरेंस में स्क्वायर फ्रेम बनाओ।'
    WHEN 'M04-wood-materials' THEN 'सॉलिड वुड, प्लाइवुड, एमडीएफ, पार्टिकल बोर्ड, लैमिनेट, विनियर, स्क्रू, हिंग, चैनल, गोंद और नमी का असर सीखो। प्रैक्टिकल: तीन बोर्ड सैंपल की तुलना करो, कैबिनेट के लिए हार्डवेयर चुनो।'
    WHEN 'M05-cutting-joining' THEN 'कटिंग और जोड़ाई की मुख्य कौशल: रिप कट, क्रॉस कट, माइटर, कर्व, डैडो, रैबेट, डॉवेल, पॉकेट स्क्रू, मॉर्टिस-टेनन और बेसिक जिग। प्रैक्टिकल: दो जोड़ाई विधियों से छोटा फ्रेम बनाओ।'
    WHEN 'M06-furniture-basics' THEN 'पार्ट्स से फर्नीचर तक बढ़ो: फ्रेम बनाना, कारकस बिल्डिंग, शेल्फ, शटर, दराज, एज बैंडिंग, अलाइनमेंट। प्रैक्टिकल: मापसह ड्रॉइंग और कटिंग लिस्ट से छोटा वॉल कैबिनेट या स्टूल बनाओ।'
    WHEN 'M07-finishing' THEN 'सतह तैयारी और फिनिश चयन: सैंडिंग क्रम, फिलिंग, स्टेनिंग, सीलिंग, पॉलिशिंग, वार्निश, पीयू, तेल, वैक्स। प्रैक्टिकल: तीन सैंपल बोर्ड पर अलग फिनिश करके तुलना करो।'
    WHEN 'M08-site-installation' THEN 'वास्तविक साइट काम: माप सत्यापन, दीवार/फर्श जांच, एंकरिंग, लेवलिंग, स्क्राइबिंग, क्लाइंट संवाद, स्नैग लिस्ट। प्रैक्टिकल: असमान दीवार पर शेल्फ लगाकर हैंडओवर चेकलिस्ट बनाओ।'
    WHEN 'M09-repair' THEN 'डायग्नोसिस और मरम्मत: ढीले जोड़, फूले शटर, खरोंच, टूटा हार्डवेयर, पानी की क्षति, लैमिनेट छूटना। प्रैक्टिकल: खराब फर्नीचर पीस जांचो, कारण पहचानो, मरम्मत अनुमान बनाओ।'
    WHEN 'M10-advanced-craft' THEN 'पेशेवर निर्णय क्षमता: जटिल जोड़ाई, टेम्पलेट, कर्व्ड काम, बिल्ट-इन, क्वालिटी जांच, लागत, समय योजना। प्रैक्टिकल: ड्रॉइंग, कटिंग लिस्ट, क्वालिटी चेकलिस्ट के साथ कैपस्टोन पीस बनाओ।'
  END,
  CASE m.slug
    WHEN 'M01-workshop-safety' THEN 'কোনো টুল ধরার আগে নিরাপদ ওয়ার্কশপ অভ্যাস: পিপিই, ধুলো নিয়ন্ত্রণ, মেশিন গার্ড, কেবল গুছিয়ে রাখা, ধারালো টুল ধরা, আগুনের নিরাপত্তা, প্রাথমিক চিকিৎসা এবং পরিষ্কার কাজের জায়গা। ওয়ার্কবেঞ্চ পরীক্ষা করে পাঁচটি ঝুঁকি লিখে ঠিক করো।'
    WHEN 'M02-tools' THEN 'প্রতিটি কার্পেন্ট্রি টুল কী কাজে লাগে এবং কীভাবে ঠিক রাখা যায় বোঝো: মাপের টুল, করাত, ছেনি, প্লেন, ড্রিল, রাউটার, ক্ল্যাম্প, স্যান্ডার। প্র্যাকটিক্যাল: ছেনি ধার দাও, ব্লেড স্কোয়ার করো, ড্রিল বিট পরীক্ষা করো।'
    WHEN 'M03-measure-mark' THEN 'ভালো কার্পেন্ট্রি শুরু সঠিক লেআউট দিয়ে। ড্রইং পড়া, টেপ ও স্কোয়ার ব্যবহার, রেফারেন্স মার্ক করা, টলারেন্স রাখা। প্র্যাকটিক্যাল: ২ মিমি টলারেন্সে স্কোয়ার ফ্রেমের চার পিস মার্ক করে কাটো।'
    WHEN 'M04-wood-materials' THEN 'সলিড উড, প্লাইউড, এমডিএফ, পার্টিকল বোর্ড, ল্যামিনেট, ভিনিয়ার, স্ক্রু, হিঞ্জ, চ্যানেল, আঠা ও আর্দ্রতার প্রভাব শিখো। প্র্যাকটিক্যাল: তিনটি বোর্ড স্যাম্পল তুলনা করে ক্যাবিনেটের হার্ডওয়্যার বেছে নাও।'
    WHEN 'M05-cutting-joining' THEN 'কাটিং ও জয়নারির মূল দক্ষতা: রিপ কাট, ক্রস কাট, মাইটার, কার্ভ, ড্যাডো, র্যাবেট, ডাওয়েল, পকেট স্ক্রু, মর্টিস-টেনন। প্র্যাকটিক্যাল: দুই ধরনের জয়নারিতে ছোট ফ্রেম বানিয়ে স্কোয়ার ও শক্তি পরীক্ষা করো।'
    WHEN 'M06-furniture-basics' THEN 'পার্ট থেকে ফার্নিচারে যাও: ফ্রেম বানানো, কারকাস বিল্ডিং, শেলফ, শাটার, ড্রয়ার, এজ ব্যান্ডিং, অ্যালাইনমেন্ট। প্র্যাকটিক্যাল: মাপসহ ড্রইং ও কাটিং লিস্ট দিয়ে ছোট ওয়াল ক্যাবিনেট বা স্টুল বানাও।'
    WHEN 'M07-finishing' THEN 'সারফেস প্রস্তুতি ও ফিনিশ নির্বাচন: স্যান্ডিং সিকোয়েন্স, ফিলিং, স্টেইনিং, সিলিং, পলিশিং, ভার্নিশ, পিইউ, তেল, মোম। প্র্যাকটিক্যাল: তিনটি স্যাম্পল বোর্ডে আলাদা ফিনিশ করে তুলনা করো।'
    WHEN 'M08-site-installation' THEN 'বাস্তব সাইটের কাজ: মাপ যাচাই, দেয়াল/মেঝে চেক, অ্যাঙ্করিং, লেভেলিং, স্ক্রাইবিং, ক্লায়েন্টের সাথে কথা, স্ন্যাগ লিস্ট। প্র্যাকটিক্যাল: অসম দেয়ালে শেলফ ইনস্টল করে হ্যান্ডওভার চেকলিস্ট বানাও।'
    WHEN 'M09-repair' THEN 'ডায়াগনসিস ও মেরামত: ঢিলা জয়েন্ট, ফোলা শাটার, স্ক্র্যাচ, ভাঙা হার্ডওয়্যার, পানির ক্ষতি, ল্যামিনেট ওঠা। প্র্যাকটিক্যাল: ক্ষতিগ্রস্ত ফার্নিচার পরীক্ষা করে কারণ নির্ণয় ও মেরামতের অনুমান বানাও।'
    WHEN 'M10-advanced-craft' THEN 'পেশাদার বিচারশক্তি: জটিল জয়নারি, টেমপ্লেট, কার্ভড কাজ, বিল্ট-ইন, কোয়ালিটি পরীক্ষা, খরচ হিসাব, সময় পরিকল্পনা। প্র্যাকটিক্যাল: ড্রইং, কাটিং লিস্ট, কোয়ালিটি চেকলিস্টসহ ক্যাপস্টোন পিস বানাও।'
  END,
  1, m.theory_hours + m.practical_hours
FROM public.taksha_modules m
WHERE NOT EXISTS (
  SELECT 1 FROM public.taksha_sections s WHERE s.module_id = m.id
);
