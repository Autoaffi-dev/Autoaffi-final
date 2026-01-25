export type BusinessSource = "places" | "registry";

export type LeadStatus = "HOT" | "WARM" | "COLD";

export type ContactStrategy =
  | "safe_contact"
  | "decision_maker"
  | "light_multithread";

export type BusinessSearchMode = "local" | "company";

/**
 * Email Enrichment (V1.1)
 * - FOUND = extracted from public website HTML (mailto/regex)
 * - GUESSED = generated from domain (info@, hello@ etc)
 * - NONE = no website/no emails
 * - ERROR = fetch/timeout/not html/etc (we may still include guessed)
 */
export type EmailEnrichmentStatus = "FOUND" | "GUESSED" | "NONE" | "ERROR";

export type EmailEnrichmentBadge = {
  status: EmailEnrichmentStatus;

  // Best single email for 1-click copy
  best?: string;

  // Found directly on website
  found: string[];

  // Guessed from domain (info@ etc)
  guessed: string[];

  // Best contact page we discovered / guessed
  contactUrl?: string;

  // Optional: for debugging/admin later
  checkedUrls?: string[];
  error?: string;
  checkedAt?: string;
};

export type BusinessSearchParams = {
  mode: BusinessSearchMode;

  // Geo (local)
  country?: string; // ISO2 or name (we normalize later)
  city?: string;
  radiusKm?: number;

  // General
  keyword: string;
  limit?: number; // 20–100

  // Filters (V1 basic)
  requireWebsite?: boolean;
  requirePhone?: boolean;
  requireContactForm?: boolean; // used later when we do enrichment

  // ✅ Enrichment toggles (V1.1) - optional, safe defaults in service
  enrichEmails?: boolean; // default true in code
  emailConcurrency?: number; // default 4
  emailTimeoutMs?: number; // default 6000
};

export type NormalizedBusinessTarget = {
  source: BusinessSource;
  sourceId: string;

  name: string;

  country?: string;
  city?: string;
  category?: string;

  website?: string;
  domain?: string;
  phone?: string;

  rating?: number;
  sizeHint?: "SMALL" | "MID" | "LARGE"; // optional; can come from registry/enrichment later

  // ✅ Optional future: allow storing discovered contact form url
  contactUrl?: string;
};

export type ScoreResult = {
  status: LeadStatus;
  score: number; // 0–15
  why: string[]; // max 3 bullets
};

/**
 * UI helper: which contact methods exist for this item
 * (so the card can show the right buttons instantly)
 */
export type ContactMethods = {
  hasWebsite: boolean;
  hasPhone: boolean;
  hasEmail: boolean; // true if FOUND or GUESSED has "best"
  hasContactUrl: boolean;
};

export type BusinessSearchResultItem = {
  target: NormalizedBusinessTarget;

  status: LeadStatus;
  score: number;
  why: string[];

  contactStrategy: ContactStrategy;

  // Availability (V1 stub - later backed by DB suppression/claims)
  availability: "available" | "claimed" | "suppressed";

  // ✅ V1.1 Email enrichment badge (optional to not break V1)
  email?: EmailEnrichmentBadge;

  // ✅ Convenience for UI (optional)
  contactMethods?: ContactMethods;
};

export type BusinessSearchResponse = {
  ok: true;
  mode: "local" | "company";
  params: BusinessSearchParams;
  results: BusinessSearchResultItem[];

  meta?: {
    returned: number;
    emailEnrichment?: {
      enabled: boolean;
      enriched: number;
    };

    // ✅ NEW (optional)
    comingSoon?: boolean;
    note?: string;
  };
};