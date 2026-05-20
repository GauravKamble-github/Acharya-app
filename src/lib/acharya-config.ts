// ============================================================================
// CENTRAL ACHARYA REGISTRY — single source of truth for all acharyas.
//
// To add a new acharya, just add ONE entry to ACHARYAS below.
// Everything else (branding, colors, routing, database) reads from here.
// ============================================================================

export interface AcharyaDef {
  /** URL slug used in routing: /farmer/, /vajra/, etc. */
  slug: string;
  /** Full name shown on cards and headers */
  name: string;
  /** Short name for tight spaces */
  shortName: string;
  /** Tagline shown below the name */
  tagline: string;
  /** Description for selection cards */
  description: string;
  /** 1-2 letter initials for avatars */
  initials: string;
  /** Primary theme color (hex) for sidebar, avatar, accents */
  themeColor: string;
  /** Accent/gold color (hex) */
  accentColor: string;
  /**
   * Whether this acharya has its own Supabase project.
   * If false, content/user data falls back to the default project.
   * Set the env vars: {SLUG_UC}_SUPABASE_URL and {SLUG_UC}_SUPABASE_SERVICE_ROLE_KEY
   */
  hasOwnDatabase: boolean;
}

// ============================================================================
// Add new acharyas here — just one object each.
// ============================================================================
export const ACHARYAS: readonly AcharyaDef[] = [
  {
    slug: "farmer",
    name: "Farmer Acharya",
    shortName: "Farmer",
    tagline: "Practical Farming Mentor",
    description: "Field-ready farming learning, quizzes, tools, and progress.",
    initials: "F",
    themeColor: "#2F5D36",
    accentColor: "#B5903A",
    hasOwnDatabase: true,
  },
  {
    slug: "arjun",
    name: "Arjun Acharya",
    shortName: "Arjun",
    tagline: "KarmYog Vatika Training",
    description: "Sales and service training playbook.",
    initials: "A",
    themeColor: "#264E2E",
    accentColor: "#B5903A",
    hasOwnDatabase: false, // shares farmer's database
  },
  {
    slug: "vajra",
    name: "Vajra Acharya",
    shortName: "Vajra",
    tagline: "Skill Training Mentor",
    description: "Electrician skill learning and assessment.",
    initials: "V",
    themeColor: "#253A5A",
    accentColor: "#C7A24A",
    hasOwnDatabase: true,
  },
  {
    slug: "taksha",
    name: "Taksha Acharya",
    shortName: "Taksha",
    tagline: "Workshop Skill Training",
    description: "Carpentry and workshop skill learning.",
    initials: "T",
    themeColor: "#4B3A2A",
    accentColor: "#B5903A",
    hasOwnDatabase: true,
  },
];

// ============================================================================
// Derived helpers — no need to edit below this line when adding acharyas.
// ============================================================================

export const SUPPORTED_SLUGS = ACHARYAS.map((a) => a.slug) as readonly string[];
export type AcharyaSlug = typeof SUPPORTED_SLUGS[number];

export const ACHARYA_BY_SLUG: Record<string, AcharyaDef> = {};
export const ACHARYA_COLORS: Record<string, string> = {};
for (const a of ACHARYAS) {
  ACHARYA_BY_SLUG[a.slug] = a;
  ACHARYA_COLORS[a.slug] = a.themeColor;
}

export function getAcharya(slug: string): AcharyaDef | undefined {
  return ACHARYA_BY_SLUG[slug?.toLowerCase()];
}

export function getDefaultAcharya(): AcharyaDef {
  return ACHARYAS[0]; // first entry is default (farmer)
}
