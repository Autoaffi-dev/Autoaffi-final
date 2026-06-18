"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

type BusinessAvailability =
  | "available"
  | "claimed"
  | "claimed_by_me"
  | "won_by_me"
  | "suppressed";

type SearchResult = {
  target: {
    source: "places" | "registry";
    sourceId: string;
    name: string;
    country?: string;
    city?: string;
    category?: string;
    website?: string;
    domain?: string;
    phone?: string;
    rating?: number;
    sizeHint?: "SMALL" | "MID" | "LARGE";
  };
  status: "HOT" | "WARM" | "COLD";
  score: number;
  why: string[];
  contactStrategy: "safe_contact" | "decision_maker" | "light_multithread";
  availability: BusinessAvailability;
  email?: {
    status: "FOUND" | "GUESSED" | "NONE" | "ERROR";
    best?: string;
    found: string[];
    guessed: string[];
    contactUrl?: string;
  };
  contactMethods?: {
    hasWebsite: boolean;
    hasPhone: boolean;
    hasEmail: boolean;
    hasContactUrl: boolean;
  };
};

type SummaryResponse = {
  ok: true;
  mode: "live";
  summary: {
    stats: {
      totalPipeline: number;
      claimed: number;
      won: number;
      suppressed: number;
      cooldown: number;
      hot: number;
      warm: number;
      cold: number;
      newLeadsToday: number;
    };
    activity: {
      lastEventType: string | null;
      lastEventAt: string | null;
    };
    focus: {
      needsFollowUp: number;
      needsReplyHandling: number;
      recentWins: number;
    };
    recentPipeline: Array<{
      pipelineId: string;
      targetId: string | null;
      status: string | null;
      score: number;
      why: string[];
      contactStrategy: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      target: {
        id: string;
        source: string | null;
        sourceId: string | null;
        name: string | null;
        country: string | null;
        city: string | null;
        category: string | null;
        website: string | null;
        phone: string | null;
        rating: number | null;
        domain: string | null;
        sizeHint: string | null;
      } | null;
    }>;
    actionItems: Array<{
      type: "needs_follow_up" | "needs_reply_handling" | "recent_win";
      priority: "high" | "medium" | "low";
      targetId: string | null;
      pipelineId: string | null;
      title: string;
      description: string;
      status: string | null;
      eventType: string | null;
      eventAt: string | null;
    }>;
  };
};

type PipelineItem = {
  id: string;
  status: string | null;
  score: number | null;
  why: string[] | null;
  contact_strategy: string | null;
  created_at: string | null;
  updated_at: string | null;
  business_targets: {
    id: string;
    source: string | null;
    source_id: string | null;
    name: string | null;
    country: string | null;
    city: string | null;
    category: string | null;
    website: string | null;
    phone: string | null;
    rating: number | null;
    domain: string | null;
    size_hint: string | null;
  } | null;
};

type GuidanceResponse = {
  ok: true;
  mode: "live";
  guidance: {
    found: boolean;
    summary?: {
      whyThisBusiness?: string;
      personalizationCue?: string;
      personalizationPlaceholder?: string;
    };
    messages?: {
      readyToSend?: string;
      followUp1?: string;
      followUp2?: string;
      positiveReply?: string;
      vagueReply?: string;
      hardNoReply?: string;
    };
  };
};

type EmailStatusResponse = {
  ok: boolean;
  connected: boolean;
  provider?: "gmail" | "outlook" | "other";
  email?: string | null;
  mode?: "live" | "dev";
};

type RightPanelTab = "summary" | "wins" | "pipeline";

type TemplateKey =
  | "staff_income"
  | "simple_question"
  | "referral_angle"
  | "marketing_person"
  | "creator_inside_team"
  | "growth_curious_person";

type DropdownOption = {
  value: string;
  label: string;
  helper?: string;
};

type DropdownSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
};

type SenderProfile = {
  senderName: string;
  senderRole: string;
  senderInstagram: string;
  senderTikTok: string;
  senderYouTube: string;
  senderFacebook: string;
};

const DEFAULT_LIMIT = 10;

const PRIMARY_MARKETS = [
  "USA",
  "Canada",
  "UK",
  "Australia",
  "New Zealand",
];

const GROWTH_MARKETS = [
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Poland",
  "Brazil",
  "Mexico",
];

const INDUSTRY_OPTIONS: DropdownOption[] = [
  "Restaurants",
  "Agencies",
  "E-commerce",
  "Clinics",
  "Gyms",
  "Coaches",
  "Beauty salons",
  "Dental clinics",
  "Law firms",
  "Real estate",
  "Hotels",
  "Cafés",
  "Retail stores",
  "Construction",
  "Accounting firms",
  "Marketing companies",
  "Fitness studios",
  "Travel businesses",
  "Education",
  "Wellness",
  "Chiropractors",
  "Physiotherapy clinics",
  "Car dealerships",
  "Auto repair shops",
  "Cleaning companies",
  "Roofing companies",
  "Landscaping businesses",
  "Solar companies",
  "Insurance agencies",
  "Mortgage brokers",
  "Interior design studios",
  "Pet stores",
  "Veterinary clinics",
  "Spas",
  "Tattoo studios",
  "Event companies",
  "Photographers",
  "Wedding businesses",
  "Accounting services",
  "Consulting firms",
  "Recruitment agencies",
  "IT companies",
  "Software companies",
  "Home services",
  "Furniture stores",
  "Jewelry stores",
  "Fashion boutiques",
  "Bakeries",
  "Coffee shops",
  "Bars",
  "Nightclubs",
  "Medical clinics",
  "Private schools",
  "Language schools",
  "Tutoring businesses",
  "Plastic surgery clinics",
  "Hair salons",
  "Barbershops",
  "Skin clinics",
  "Nail salons",
  "Yoga studios",
  "Pilates studios",
  "CrossFit gyms",
  "Personal trainers",
  "Accounting software firms",
  "Web design agencies",
  "SEO agencies",
  "Paid ads agencies",
  "Video production companies",
  "Printing companies",
  "Signage companies",
  "Furniture showrooms",
  "Kitchen companies",
  "Bathroom companies",
  "Moving companies",
  "Plumbing companies",
  "Electrical companies",
  "HVAC companies",
  "Pool companies",
  "Window companies",
  "Dentists",
  "Orthodontists",
  "Private healthcare clinics",
  "Mental health clinics",
  "Rehab clinics",
  "Veterinary hospitals",
  "Pet grooming businesses",
  "Childcare centers",
  "Music schools",
  "Driving schools",
  "Sports clubs",
  "Martial arts studios",
  "Business consultants",
  "B2B services",
  "Local services",
].map((item) => ({ value: item, label: item }));

const MARKET_COUNTRY_OPTIONS: DropdownOption[] = [
  { label: "United States", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "United Kingdom", value: "GB" },
  { label: "Australia", value: "AU" },
  { label: "New Zealand", value: "NZ" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
  { label: "Netherlands", value: "NL" },
  { label: "Poland", value: "PL" },
  { label: "Brazil", value: "BR" },
  { label: "Mexico", value: "MX" },
  { label: "Sweden", value: "SE" },
  { label: "Norway", value: "NO" },
  { label: "Denmark", value: "DK" },
  { label: "Finland", value: "FI" },
  { label: "Ireland", value: "IE" },
  { label: "Austria", value: "AT" },
  { label: "Belgium", value: "BE" },
  { label: "Switzerland", value: "CH" },
  { label: "Portugal", value: "PT" },
  { label: "Czech Republic", value: "CZ" },
  { label: "Romania", value: "RO" },
  { label: "Hungary", value: "HU" },
  { label: "United Arab Emirates", value: "AE" },
  { label: "Singapore", value: "SG" },
  { label: "South Africa", value: "ZA" },
  { label: "Japan", value: "JP" },
  { label: "South Korea", value: "KR" },
  { label: "India", value: "IN" },
  { label: "Turkey", value: "TR" },
  { label: "Greece", value: "GR" },
  { label: "Croatia", value: "HR" },
  { label: "Slovakia", value: "SK" },
  { label: "Slovenia", value: "SI" },
  { label: "Estonia", value: "EE" },
  { label: "Latvia", value: "LV" },
  { label: "Lithuania", value: "LT" },
  { label: "Argentina", value: "AR" },
  { label: "Chile", value: "CL" },
  { label: "Colombia", value: "CO" },
  { label: "Luxembourg", value: "LU" },
  { label: "Malta", value: "MT" },
  { label: "Cyprus", value: "CY" },
  { label: "Saudi Arabia", value: "SA" },
  { label: "Qatar", value: "QA" },
  { label: "Israel", value: "IL" },
  { label: "Thailand", value: "TH" },
  { label: "Malaysia", value: "MY" },
  { label: "Indonesia", value: "ID" },
  { label: "Philippines", value: "PH" },
  { label: "Vietnam", value: "VN" },
  { label: "Hong Kong", value: "HK" },
  { label: "Taiwan", value: "TW" },
  { label: "Peru", value: "PE" },
  { label: "Uruguay", value: "UY" },
];

const CITY_OPTIONS_BY_COUNTRY: Record<string, string[]> = {
  US: [
    "New York",
    "Los Angeles",
    "Miami",
    "Chicago",
    "Austin",
    "Dallas",
    "Houston",
    "Phoenix",
    "San Diego",
    "San Francisco",
    "Las Vegas",
    "Orlando",
    "Atlanta",
    "Seattle",
    "Boston",
    "Denver",
    "Nashville",
    "Charlotte",
    "Tampa",
    "Philadelphia",
    "Detroit",
    "Minneapolis",
    "Portland",
    "Salt Lake City",
    "Kansas City",
    "New Orleans",
  ],
  CA: [
    "Toronto",
    "Vancouver",
    "Montreal",
    "Calgary",
    "Ottawa",
    "Edmonton",
    "Quebec City",
    "Winnipeg",
    "Halifax",
    "Victoria",
  ],
  GB: [
    "London",
    "Manchester",
    "Birmingham",
    "Liverpool",
    "Leeds",
    "Bristol",
    "Glasgow",
    "Edinburgh",
    "Nottingham",
    "Leicester",
    "Sheffield",
    "Cardiff",
  ],
  AU: [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Canberra",
    "Newcastle",
  ],
  NZ: [
    "Auckland",
    "Wellington",
    "Christchurch",
    "Hamilton",
    "Queenstown",
    "Tauranga",
    "Dunedin",
  ],
  DE: [
    "Berlin",
    "Munich",
    "Hamburg",
    "Frankfurt",
    "Cologne",
    "Stuttgart",
    "Düsseldorf",
    "Leipzig",
    "Dortmund",
    "Bremen",
  ],
  FR: [
    "Paris",
    "Lyon",
    "Marseille",
    "Nice",
    "Toulouse",
    "Bordeaux",
    "Lille",
    "Nantes",
    "Montpellier",
  ],
  ES: [
    "Madrid",
    "Barcelona",
    "Valencia",
    "Seville",
    "Malaga",
    "Bilbao",
    "Alicante",
    "Palma",
    "Zaragoza",
  ],
  IT: [
    "Milan",
    "Rome",
    "Naples",
    "Turin",
    "Florence",
    "Bologna",
    "Venice",
    "Verona",
    "Palermo",
  ],
  NL: [
    "Amsterdam",
    "Rotterdam",
    "The Hague",
    "Utrecht",
    "Eindhoven",
    "Groningen",
    "Tilburg",
  ],
  PL: [
    "Warsaw",
    "Krakow",
    "Gdansk",
    "Wroclaw",
    "Poznan",
    "Lodz",
    "Katowice",
    "Szczecin",
  ],
  BR: [
    "São Paulo",
    "Rio de Janeiro",
    "Brasília",
    "Curitiba",
    "Belo Horizonte",
    "Salvador",
    "Fortaleza",
    "Recife",
  ],
  MX: [
    "Mexico City",
    "Guadalajara",
    "Monterrey",
    "Cancún",
    "Tijuana",
    "Puebla",
    "Mérida",
    "León",
  ],
  SE: [
    "Stockholm",
    "Gothenburg",
    "Malmö",
    "Uppsala",
    "Helsingborg",
    "Lund",
    "Västerås",
    "Örebro",
    "Jönköping",
  ],
  NO: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen"],
  DK: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg"],
  FI: ["Helsinki", "Tampere", "Turku", "Espoo", "Vantaa"],
  IE: ["Dublin", "Cork", "Galway", "Limerick", "Waterford"],
  AT: ["Vienna", "Graz", "Salzburg", "Linz", "Innsbruck"],
  BE: ["Brussels", "Antwerp", "Ghent", "Bruges", "Leuven", "Liège"],
  CH: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Lugano"],
  PT: ["Lisbon", "Porto", "Faro", "Braga", "Coimbra"],
  CZ: ["Prague", "Brno", "Ostrava", "Plzen"],
  RO: ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Brașov"],
  HU: ["Budapest", "Debrecen", "Szeged", "Pécs"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  SG: ["Singapore"],
  ZA: ["Cape Town", "Johannesburg", "Durban", "Pretoria"],
  JP: ["Tokyo", "Osaka", "Kyoto", "Nagoya", "Fukuoka", "Yokohama", "Sapporo"],
  KR: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"],
  IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Ahmedabad"],
  TR: ["Istanbul", "Ankara", "Izmir", "Antalya", "Bursa"],
  GR: ["Athens", "Thessaloniki", "Patras"],
  HR: ["Zagreb", "Split", "Rijeka"],
  SK: ["Bratislava", "Košice"],
  SI: ["Ljubljana", "Maribor"],
  EE: ["Tallinn", "Tartu"],
  LV: ["Riga", "Daugavpils"],
  LT: ["Vilnius", "Kaunas"],
  AR: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
  CL: ["Santiago", "Valparaíso", "Viña del Mar"],
  CO: ["Bogotá", "Medellín", "Cartagena", "Cali"],
  LU: ["Luxembourg"],
  MT: ["Valletta", "Sliema", "St. Julian’s"],
  CY: ["Nicosia", "Limassol", "Larnaca"],
  SA: ["Riyadh", "Jeddah", "Dammam"],
  QA: ["Doha"],
  IL: ["Tel Aviv", "Jerusalem", "Haifa"],
  TH: ["Bangkok", "Phuket", "Chiang Mai", "Pattaya"],
  MY: ["Kuala Lumpur", "Penang", "Johor Bahru"],
  ID: ["Jakarta", "Bali", "Surabaya", "Bandung"],
  PH: ["Manila", "Cebu", "Davao"],
  VN: ["Ho Chi Minh City", "Hanoi", "Da Nang"],
  HK: ["Hong Kong"],
  TW: ["Taipei", "Kaohsiung", "Taichung"],
  PE: ["Lima", "Cusco", "Arequipa"],
  UY: ["Montevideo"],
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function shuffleArray<T>(items: T[]) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID?.trim();
  if (devUserId) {
    headers["x-autoaffi-user-id"] = devUserId;
  }

  return headers;
}

function getTargetKey(result: SearchResult | null | undefined) {
  if (!result) return "";
  return `${result.target.source}:${result.target.sourceId}`;
}

function humanizeSendError(message: string) {
  const raw = String(message ?? "").trim();
  if (!raw) return "Autoaffi could not send the email right now. Please try again.";

  if (raw.includes("TO_REQUIRED")) {
    return "This company does not have a valid email address yet.";
  }

  if (raw.includes("SUBJECT_REQUIRED")) {
    return "Please add a subject before sending.";
  }

  if (raw.includes("BODY_REQUIRED")) {
    return "Please write a message before sending.";
  }

  if (raw.includes("INVALID_REPLY_TO")) {
    return "The reply-to email address is invalid.";
  }

  if (raw.includes("NO_ACTIVE_CONNECTED_INBOX")) {
    return "Connect your Gmail inbox before sending tracked outreach.";
  }

  if (raw.includes("NO_ACTIVE_PROVIDER_TOKEN")) {
    return "Your Gmail connection needs to be refreshed before sending.";
  }

  if (raw.includes("CONNECTED_INBOX_EMAIL_INVALID")) {
    return "Your connected inbox email looks invalid. Please reconnect Gmail.";
  }

  if (raw.includes("PROVIDER_NOT_SUPPORTED_YET")) {
    return "Only Gmail sending is active right now.";
  }

  if (raw.includes("TOKEN_REFRESH_FAILED")) {
    return "Autoaffi could not refresh your Gmail connection. Please reconnect Gmail.";
  }

  if (raw.includes("TOKEN_REFRESH_SAVE_FAILED")) {
    return "Gmail refreshed, but Autoaffi could not save the new token state.";
  }

  if (raw.includes("GMAIL_SEND_FAILED")) {
    return "Autoaffi could not send the email through Gmail right now. Please try again.";
  }

  if (raw.includes("Failed to claim target before tracked outreach")) {
    return "This company could not be locked for outreach right now.";
  }

  if (raw.includes("already claimed by another user")) {
    return "This company has already been claimed by another Autoaffi user.";
  }

  if (raw.includes("Could not resolve target for tracked outreach")) {
    return "Autoaffi could not resolve this company correctly for tracked outreach.";
  }

  if (raw.includes("Email was sent, but Autoaffi failed to log the outreach event")) {
    return "The email was sent, but Autoaffi could not finish logging the outreach. Please check Contact Manager.";
  }

  return raw;
}


function formatRelativeDate(value?: string | null) {
  if (!value) return "—";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "—";

  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function scoreTone(score: number) {
  if (score >= 10) return "HOT";
  if (score >= 6) return "WARM";
  return "COLD";
}

function explainScore(score: number) {
  if (score >= 12) {
    return "Very high match based on overall fit, signals, and business relevance.";
  }
  if (score >= 10) {
    return "High match with strong relevance and better outreach potential.";
  }
  if (score >= 6) {
    return "Moderate match with some positive signals worth testing.";
  }
  return "Lower match with weaker signals or less obvious fit.";
}

function normalizeHandle(value: string) {
  return value.trim().replace(/^@+/, "");
}

function buildSenderIdentityLine(profile: SenderProfile) {
  const items: string[] = [];

  if (profile.senderInstagram.trim()) {
    items.push(`Instagram @${normalizeHandle(profile.senderInstagram)}`);
  }
  if (profile.senderTikTok.trim()) {
    items.push(`TikTok @${normalizeHandle(profile.senderTikTok)}`);
  }
  if (profile.senderYouTube.trim()) {
    items.push(`YouTube ${profile.senderYouTube.trim()}`);
  }
  if (profile.senderFacebook.trim()) {
    items.push(`Facebook ${profile.senderFacebook.trim()}`);
  }

  if (!items.length) return "";

  return `You can also verify who I am here: ${items.join(" • ")}.`;
}

function buildSenderSignature(profile: SenderProfile) {
  if (!profile.senderName.trim()) return "";
  return `\n\nBest regards,\n${profile.senderName.trim()}`;
}

function buildFallbackMessage(result: SearchResult, profile: SenderProfile) {
  const name = result.target.name;
  const identityLine = buildSenderIdentityLine(profile);
  const signature = buildSenderSignature(profile);

  return `Hi,

I came across ${name} and wanted to reach out because I think there may be one or two people in the business who would be a strong fit for a side-income model like ours.

We help individuals build an additional income stream alongside their normal work by using a simpler affiliate workflow, ready-made content support, and a much more structured system than most people expect.

I am not trying to send a long sales pitch here — I just wanted to ask whether someone on your team handles new growth ideas, partnerships, or side-income opportunities.

If yes, I can send 2 short ideas and keep it very simple.${identityLine ? `\n\n${identityLine}` : ""}${signature}`;
}

function buildTemplateSet(
  result: SearchResult,
  guidance: GuidanceResponse["guidance"] | null | undefined,
  profile: SenderProfile
) {
  const name = result.target.name;
  const category = result.target.category || "business";
  const city = result.target.city ? ` in ${result.target.city}` : "";
  const cue =
    guidance?.summary?.personalizationPlaceholder ||
    guidance?.summary?.personalizationCue ||
    "one specific detail you noticed about them";

  const identityLine = buildSenderIdentityLine(profile);
  const signature = buildSenderSignature(profile);
  const credibilityBlock = identityLine ? `\n\n${identityLine}` : "";

  const templates: Record<
    TemplateKey,
    { subject: string; body: string; title: string; description: string }
  > = {
    staff_income: {
      title: "Staff income angle",
      description:
        "Targets one or two people in the business who may want an extra income stream.",
      subject: `Quick idea for someone on the ${name} team`,
      body: `Hi,

I came across ${name}${city} and wanted to reach out because I think there may be one or two people on your team who would be a strong fit for an additional income stream beside their normal work.

What caught my attention was ${cue}.

We help individuals build side income in a more structured way through affiliate workflows, ready-made content support, and a system that is much easier to follow than most people expect.

This is not really a pitch to the whole company — it is more a question about whether there is one person internally who is growth-minded, curious, and open to a simple extra-income model.

If that sounds relevant, I can send 2 short ideas and keep it brief.${credibilityBlock}${signature}`,
    },
    simple_question: {
      title: "Short question",
      description:
        "Lower-friction message designed to get a quick yes/no or the right person.",
      subject: `Small question about ${name}`,
      body: `Hi,

I found ${name} and wanted to ask a very simple question.

Is there someone in the business who is open to looking at an extra income opportunity beside their main role, especially if it is built around content, affiliate workflows, and a more guided system?

I am asking because businesses like ${name} often already have one person internally who is naturally more curious about growth, digital income, or new opportunities.

If yes, I can send 2 short ideas and leave it there.${credibilityBlock}${signature}`,
    },
    referral_angle: {
      title: "Referral / intro angle",
      description:
        "Asks for the right internal person instead of pitching the whole company directly.",
      subject: `Who would be the right person at ${name}?`,
      body: `Hi,

I hope this is okay to ask.

I came across ${name}, which seems like the kind of ${category.toLowerCase()} where there may already be someone internally who is interested in growth, content, marketing, or digital side opportunities.

Rather than pitching the company as a whole, I wanted to ask whether there is a specific person on the team who would be the best fit for a short message about an additional income model we help individuals get started with.

If there is, I can send something short and relevant — no long pitch.${credibilityBlock}${signature}`,
    },
    marketing_person: {
      title: "Marketing person angle",
      description:
        "Aimed at the person who already handles marketing, content, or visibility work.",
      subject: `Question for the person handling growth at ${name}`,
      body: `Hi,

I came across ${name}${city} and wanted to ask whether there is someone on the team who handles visibility, content, or marketing-related work.

The reason I ask is that people in that kind of role are often the fastest to understand the type of side-income model we help individuals get started with through guided affiliate workflows and ready-made support.

This is not really a pitch to the whole company — more a question about whether the right person exists internally.

If yes, I can send 2 short ideas and keep it simple.${credibilityBlock}${signature}`,
    },
    creator_inside_team: {
      title: "Content / creator angle",
      description:
        "Targets the person in the business who enjoys posting, content, or social media.",
      subject: `Possible fit for someone at ${name}`,
      body: `Hi,

I came across ${name} and got the feeling there may be someone on the team who already enjoys content, social media, or digital growth.

That kind of person is often a very strong fit for the model we help individuals get started with — especially when they want a more structured path to building income beside their normal work.

I am not trying to send a long pitch here.

If there is someone like that inside ${name}, I can send 2 short ideas and let you decide whether it is worth passing on.${credibilityBlock}${signature}`,
    },
    growth_curious_person: {
      title: "Growth-curious person angle",
      description:
        "A softer message for teams where one ambitious person may be interested in something new.",
      subject: `One small question about someone at ${name}`,
      body: `Hi,

I wanted to ask a quick question.

In businesses like ${name}, there is often one person who is naturally curious about growth, new ideas, digital income, or building something on the side.

That is the type of person we usually help most.

So rather than pitching the company as a whole, I wanted to ask whether someone like that exists on your team.

If yes, I can send a very short follow-up with 2 simple ideas.${credibilityBlock}${signature}`,
    },
  };

  return templates;
}

function DropdownSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function updatePosition() {
      if (!open || !wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const availableHeight = Math.max(220, window.innerHeight - rect.bottom - 18);

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: rect.bottom + 8,
        maxHeight: Math.min(360, availableHeight),
        zIndex: 99999,
      });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  return (
    <div ref={wrapperRef} className="relative z-[60]">
      <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative flex w-full items-center justify-between rounded-xl border bg-slate-900 px-4 py-3 text-left text-sm text-white outline-none transition",
          disabled
            ? "cursor-not-allowed border-slate-800 opacity-60"
            : "border-slate-700 hover:border-yellow-400/40 focus:border-yellow-400/40"
        )}
      >
        <span className={cn(!selectedOption && "text-slate-500")}>
          {selectedOption?.label || placeholder}
        </span>

        <span className="ml-3 flex items-center gap-2">
          <span className="h-5 w-px bg-gradient-to-b from-transparent via-yellow-300/70 to-transparent" />
          <span className="flex flex-col items-center justify-center text-yellow-300">
            <ChevronUp className="h-3.5 w-3.5 -mb-1" />
            <ChevronDown className="h-3.5 w-3.5 -mt-1" />
          </span>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()}
            className="overflow-hidden rounded-2xl border border-yellow-400/25 bg-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
          >
            <div className="pointer-events-none absolute right-2 top-2 bottom-2 z-10 flex w-5 flex-col items-center justify-between py-1">
              <ChevronUp className="h-3.5 w-3.5 text-yellow-300/90" />
              <div className="w-px flex-1 bg-gradient-to-b from-yellow-300/20 via-yellow-300/80 to-yellow-300/20" />
              <ChevronDown className="h-3.5 w-3.5 text-yellow-300/90" />
            </div>

            <div
              className="autoaffi-dropdown-scroll overflow-y-auto pr-6"
              style={{ maxHeight: menuStyle.maxHeight as number }}
            >
              {options.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-400">
                  No options available
                </div>
              ) : (
                options.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "block w-full border-b border-slate-800/80 px-4 py-3 text-left transition last:border-b-0",
                        active
                          ? "bg-yellow-400/10 text-yellow-200"
                          : "text-slate-200 hover:bg-slate-900/90 hover:text-white"
                      )}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      {option.helper && (
                        <div className="mt-1 text-xs leading-5 text-slate-400">
                          {option.helper}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function GlobeHero() {
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-3xl bg-[#07101f]">
      <Image
        src="/images/business-finder/business-finder-hero-globe-v4.png"
        alt="Business Finder global network"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10" />
    </div>
  );
}

export default function BusinessFinderPage() {
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("summary");

  const [emailStatus, setEmailStatus] = useState<EmailStatusResponse | null>(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);

  const [summary, setSummary] = useState<SummaryResponse["summary"] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("US");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [limit] = useState(DEFAULT_LIMIT);

  const [advancedMode, setAdvancedMode] = useState(false);
  const [customCountry, setCustomCountry] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResponse["guidance"] | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("staff_income");
  const [useOwnEmail, setUseOwnEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [senderName, setSenderName] = useState("");
  const [senderRole, setSenderRole] = useState("");
  const [senderInstagram, setSenderInstagram] = useState("");
  const [senderTikTok, setSenderTikTok] = useState("");
  const [senderYouTube, setSenderYouTube] = useState("");
  const [senderFacebook, setSenderFacebook] = useState("");

  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
const [lastSentTargetKey, setLastSentTargetKey] = useState<string | null>(null);
const [lastSentAtMs, setLastSentAtMs] = useState<number | null>(null);



  const emailConnected = !!emailStatus?.connected;

  const senderProfile = useMemo<SenderProfile>(
    () => ({
      senderName,
      senderRole,
      senderInstagram,
      senderTikTok,
      senderYouTube,
      senderFacebook,
    }),
    [
      senderName,
      senderRole,
      senderInstagram,
      senderTikTok,
      senderYouTube,
      senderFacebook,
    ]
  );

  const cityOptions = useMemo<DropdownOption[]>(() => {
    const cities = CITY_OPTIONS_BY_COUNTRY[country] ?? [];
    return cities.map((item) => ({ value: item, label: item }));
  }, [country]);

  useEffect(() => {
    if (city && !(CITY_OPTIONS_BY_COUNTRY[country] ?? []).includes(city)) {
      setCity("");
    }
  }, [country, city]);

  async function loadEmailStatus() {
    setEmailStatusLoading(true);
    try {
      const res = await fetch("/api/business/email/status", {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        setEmailStatus({
          ok: false,
          connected: false,
        });
        return;
      }

      const data = (await res.json()) as EmailStatusResponse;
      setEmailStatus(data);
    } catch {
      setEmailStatus({
        ok: false,
        connected: false,
      });
    } finally {
      setEmailStatusLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/business/summary", {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        setSummary(null);
        return;
      }

      const data = (await res.json()) as SummaryResponse;
      setSummary(data.summary);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadPipeline() {
    setPipelineLoading(true);
    try {
      const res = await fetch("/api/business/pipeline/list?limit=50", {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        setPipelineItems([]);
        return;
      }

      const data = await res.json();
      setPipelineItems((data?.items ?? []) as PipelineItem[]);
    } catch {
      setPipelineItems([]);
    } finally {
      setPipelineLoading(false);
    }
  }

  useEffect(() => {
    loadEmailStatus();
    loadSummary();
    loadPipeline();
  }, []);

  const winsView = useMemo(
    () => pipelineItems.filter((item) => item.status === "WON"),
    [pipelineItems]
  );

  const pipelineView = useMemo(
    () => pipelineItems.filter((item) => item.status !== "WON"),
    [pipelineItems]
  );

  const templateSet = useMemo(() => {
    if (!selectedResult) return null;
    return buildTemplateSet(selectedResult, guidance, senderProfile);
  }, [selectedResult, guidance, senderProfile]);

  useEffect(() => {
    if (!selectedResult || !templateSet) return;
    if (useOwnEmail) return;

    const picked = templateSet[selectedTemplate];
    if (!picked) return;

    setEmailSubject(picked.subject);
    setEmailBody(picked.body);
  }, [selectedTemplate, selectedResult, templateSet, useOwnEmail]);

  async function runSearch() {
    setSearchLoading(true);
    setSendSuccess(false);
    setSendMessage(null);
    setSearchMessage(null);

    try {
      const effectiveKeyword =
        keyword.trim() ||
        industry.trim() ||
        customIndustry.trim() ||
        "agency";

      const payload = {
        mode: "local",
        keyword: effectiveKeyword,
        country: advancedMode ? customCountry || country : country || undefined,
        city: advancedMode ? customCity || city : city || undefined,
        limit,
        requireWebsite: true,
        requirePhone: false,
        requireContactForm: false,
        enrichEmails: true,
      };

      const res = await fetch("/api/business/search", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setResults([]);
        setSearchMessage(data?.error || "Search failed.");
        return;
      }

      const nextResults = shuffleArray((data.results ?? []) as SearchResult[]);
      setResults(nextResults);
      setSelectedResult(null);
      setGuidance(null);
      setSelectedTemplate("staff_income");
      setEmailSubject("");
      setEmailBody("");

      if (!nextResults.length) {
        setSearchMessage(
          "No companies found for this search. Try another country, city, or industry."
        );
      }
    } catch {
      setResults([]);
      setSearchMessage("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSelectCompany(result: SearchResult) {
    setSelectedResult(result);
    setGuidance(null);
    setGuidanceLoading(true);
    setSendSuccess(false);
setSendMessage(null);
setLastSentTargetKey(null);
setLastSentAtMs(null);
setUseOwnEmail(false);
setSelectedTemplate("staff_income");

    try {
      const res = await fetch("/api/business/outreach-guidance", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          source: result.target.source,
          sourceId: result.target.sourceId,
        }),
      });

      if (!res.ok) {
        setGuidance(null);
        const fallback = buildFallbackMessage(result, senderProfile);
        setEmailSubject(`Quick idea for someone at ${result.target.name}`);
        setEmailBody(fallback);
        return;
      }

      const data = (await res.json()) as GuidanceResponse;
      setGuidance(data.guidance ?? null);

      const nextTemplateSet = buildTemplateSet(
        result,
        data.guidance ?? null,
        senderProfile
      );
      setEmailSubject(nextTemplateSet.staff_income.subject);
      setEmailBody(nextTemplateSet.staff_income.body);
    } catch {
      setGuidance(null);
      setEmailSubject(`Quick idea for someone at ${result.target.name}`);
      setEmailBody(buildFallbackMessage(result, senderProfile));
    } finally {
      setGuidanceLoading(false);
    }
  }

  async function handleSendMessage() {
  if (!selectedResult) return;

  const targetKey = getTargetKey(selectedResult);
  const nowMs = Date.now();

  if (sending) {
    return;
  }

  if (
    lastSentTargetKey &&
    lastSentAtMs &&
    lastSentTargetKey === targetKey &&
    nowMs - lastSentAtMs < 90_000
  ) {
    setSendSuccess(false);
    setSendMessage(
      "A tracked message was already sent to this company recently. Wait a moment before sending again."
    );
    return;
  }

  if (!emailConnected) {
    setSendSuccess(false);
    setSendMessage("Connect your Gmail inbox before using tracked outreach.");
    return;
  }

  const recipientEmail =
    typeof selectedResult.email?.best === "string"
      ? selectedResult.email.best.trim().toLowerCase()
      : "";

  if (!recipientEmail) {
    setSendSuccess(false);
    setSendMessage(
      "No email was found for this company. Direct sending only works when Business Finder has a valid email address."
    );
    return;
  }

  if (!emailSubject.trim()) {
    setSendSuccess(false);
    setSendMessage("Please add a subject before sending.");
    return;
  }

  if (!emailBody.trim()) {
    setSendSuccess(false);
    setSendMessage("Please choose or write a message before sending.");
    return;
  }

  setSending(true);
  setSendSuccess(false);
  setSendMessage(null);

  try {
    const claimRes = await fetch("/api/business/pipeline/claim", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        source: selectedResult.target.source,
        sourceId: selectedResult.target.sourceId,
        name: selectedResult.target.name,
        website: selectedResult.target.website,
        domain: selectedResult.target.domain,
        phone: selectedResult.target.phone,
        country: selectedResult.target.country,
        city: selectedResult.target.city,
        category: selectedResult.target.category,
        rating: selectedResult.target.rating,
        sizeHint: selectedResult.target.sizeHint,
      }),
    });

    const claimData = await claimRes.json().catch(() => null);

    if (!claimRes.ok || !claimData?.ok) {
      throw new Error(
        claimData?.details ||
          claimData?.error ||
          "Failed to claim target before tracked outreach."
      );
    }

    const detailsRes = await fetch("/api/business/details", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        source: selectedResult.target.source,
        sourceId: selectedResult.target.sourceId,
      }),
    });

    const detailsData = await detailsRes.json().catch(() => null);
    const targetId = detailsData?.targetId as string | undefined;

    if (!detailsRes.ok || !detailsData?.ok || !targetId) {
      throw new Error(
        detailsData?.details ||
          detailsData?.error ||
          "Could not resolve target for tracked outreach."
      );
    }

    const sendRes = await fetch("/api/business/email/send", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        to: recipientEmail,
        subject: emailSubject.trim(),
        text: emailBody.trim(),
      }),
    });

    const sendData = await sendRes.json().catch(() => null);

    if (!sendRes.ok || !sendData?.ok) {
      throw new Error(
        sendData?.details ||
          sendData?.error ||
          "Failed to send email through the connected inbox."
      );
    }

    const eventRes = await fetch("/api/business/events/log", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        targetId,
        eventType: "sent",
        channel: "email",
        meta: {
          to: recipientEmail,
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          companyName: selectedResult.target.name,
          source: "business_finder",
          templateMode: useOwnEmail ? "custom" : selectedTemplate,

          senderName,
          senderRole,
          senderInstagram,
          senderTikTok,
          senderYouTube,
          senderFacebook,

          provider: sendData?.provider ?? "gmail",
          connectedInboxEmail: sendData?.inbox?.email ?? null,
          providerMessageId: sendData?.sent?.providerMessageId ?? null,
          providerThreadId: sendData?.sent?.providerThreadId ?? null,
          sentAt: sendData?.sent?.at ?? null,
        },
      }),
    });

    const eventData = await eventRes.json().catch(() => null);

    if (!eventRes.ok || !eventData?.ok) {
      throw new Error(
        eventData?.details ||
          eventData?.error ||
          "Email was sent, but Autoaffi failed to log the outreach event."
      );
    }

    setLastSentTargetKey(targetKey);
    setLastSentAtMs(Date.now());
    setSendSuccess(true);
    setSendMessage(
      `Tracked outreach sent successfully to ${recipientEmail}. The email was sent through your connected Gmail inbox and logged inside Autoaffi.`
    );

    await Promise.all([loadSummary(), loadPipeline(), loadEmailStatus()]);
  } catch (err: any) {
    setSendMessage(
      humanizeSendError(err?.message || "Failed to continue tracked outreach.")
    );
    setSendSuccess(false);
  } finally {
    setSending(false);
  }
}

async function handleRefreshSearch() {
  setKeyword("");
  setCountry("US");
  setCity("");
  setIndustry("");
  setAdvancedMode(false);
  setCustomCountry("");
  setCustomCity("");
  setCustomIndustry("");

  setResults([]);
  setSelectedResult(null);
  setGuidance(null);
  setGuidanceLoading(false);
  setSelectedTemplate("staff_income");
  setUseOwnEmail(false);
  setEmailSubject("");
  setEmailBody("");
  setSendSuccess(false);
setSendMessage(null);
setLastSentTargetKey(null);
setLastSentAtMs(null);
setSearchMessage(null);
}

  const step2Open = !!selectedResult;
  const step3Open = !!selectedResult && !!emailBody.trim();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.22)]">
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/30 bg-slate-950/80 shadow-[0_0_24px_rgba(250,204,21,0.08)]">
                <Globe className="h-8 w-8 text-yellow-300" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
                    Business Finder
                  </h1>
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                </div>

                <p className="mt-4 max-w-3xl text-[15px] font-medium leading-8 text-yellow-50/95 md:text-base">
                  Find real companies worldwide, identify the right person inside the
                  business, and move qualified outreach forward from one structured
                  place.
                </p>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  The objective is not to sell the whole company. The objective is to
                  reach the one person inside the business who is most likely to become
                  an Autoaffi user.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-yellow-400/25 bg-slate-950/40 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/30 bg-slate-950">
                  <Mail className="h-6 w-6 text-yellow-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-base font-semibold text-white">
                      Connected Inbox
                    </div>

                    {emailStatusLoading ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking status
                      </span>
                    ) : emailConnected ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Tracked outreach enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                        <AlertCircle className="h-3.5 w-3.5" />
                        No tracked outreach
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {emailConnected
                      ? "Email activated and tracked outreach enabled."
                      : "Not activated, no tracked outreach enabled."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                      href="/login/dashboard/settings/email"
                      className="inline-flex items-center rounded-xl border border-yellow-400/35 px-4 py-2.5 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10"
                    >
                      {emailConnected ? "Manage connected inbox" : "Activate email"}
                    </Link>

                    <div className="text-sm text-slate-500">
                      {emailConnected
                        ? `Connected${emailStatus?.email ? ` as ${emailStatus.email}` : ""}`
                        : "Tracking stays locked until inbox is activated."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <GlobeHero />
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-5">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold text-white">3-step workflow</div>
          <Sparkles className="h-5 w-5 text-yellow-300" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Search companies", icon: Search },
            { step: "2", title: "Choose the right message", icon: Briefcase },
            { step: "3", title: "Contact company", icon: Send },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="rounded-2xl border border-slate-700/70 bg-slate-950/30 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-400/30 text-sm font-semibold text-yellow-300">
                    {item.step}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-400/20 bg-slate-950">
                    <Icon className="h-5 w-5 text-yellow-300" />
                  </div>
                  <div className="text-sm font-medium text-white">{item.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 text-xl font-semibold text-yellow-300">
                1
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Search companies
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Search for companies and keep the search flow clean. Wins and
                  pipeline stay in the right panel.
                </p>
              </div>
            </div>

            <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-yellow-300" />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                Search keyword
              </label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="agency, restaurant, clinic, e-commerce, fitness..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-yellow-400/35"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <DropdownSelect
                label="Country"
                value={country}
                onChange={setCountry}
                options={MARKET_COUNTRY_OPTIONS}
                placeholder="Select country"
              />

              <DropdownSelect
                label="City"
                value={city}
                onChange={setCity}
                options={cityOptions}
                placeholder="All cities"
              />

              <DropdownSelect
                label="Industry"
                value={industry}
                onChange={setIndustry}
                options={INDUSTRY_OPTIONS}
                placeholder="All industries"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
              <button
                type="button"
                onClick={() => setAdvancedMode((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-medium text-yellow-300"
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition", advancedMode && "rotate-180")}
                />
                Advanced custom search
              </button>

              {advancedMode && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    placeholder="Custom country"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                  />
                  <input
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Custom city"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                  />
                  <input
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                    placeholder="Custom industry"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => runSearch()}
                disabled={searchLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-5 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search {limit} companies
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRefreshSearch}
                disabled={searchLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 px-4 py-3 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
Reset
              </button>

              <div className="text-sm text-slate-500">
                Default result size: {limit} companies
              </div>

              <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs leading-5 text-slate-400">
                <span className="font-semibold text-emerald-300">Hot</span> = strongest
                fit,
                <span className="ml-2 font-semibold text-amber-300">Warm</span> = possible
                fit,
                <span className="ml-2 font-semibold text-slate-300">Cold</span> = weaker
                fit.
              </div>

              <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs leading-5 text-slate-400">
  <span className="font-semibold text-yellow-300">Score</span> = internal fit score based on business relevance, visible signals, and outreach potential.
  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
    <span className="font-semibold text-yellow-300">12+</span>
    <span className="text-slate-500">= very high</span>
    <span className="font-semibold text-yellow-300">10–11</span>
    <span className="text-slate-500">= high</span>
    <span className="font-semibold text-yellow-300">6–9</span>
    <span className="text-slate-500">= moderate</span>
    <span className="font-semibold text-yellow-300">0–5</span>
    <span className="text-slate-500">= lower</span>
  </div>
</div>
            </div>

            {searchMessage && (
              <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {searchMessage}
              </div>
            )}

            {!!results.length && (
              <div className="mt-5 space-y-3">
                {results.map((result) => {
                  const selected =
                    selectedResult?.target.sourceId === result.target.sourceId &&
                    selectedResult?.target.source === result.target.source;

                  return (
                    <button
                      key={`${result.target.source}:${result.target.sourceId}`}
                      type="button"
                      onClick={() => handleSelectCompany(result)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-4 text-left transition",
                        selected
                          ? "border-yellow-400/40 bg-yellow-400/10"
                          : "border-slate-700/70 bg-slate-950/30 hover:border-yellow-400/25"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-white">
                              {result.target.name}
                            </div>

                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                result.status === "HOT"
                                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                                  : result.status === "WARM"
                                  ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                                  : "border-slate-700 bg-slate-900 text-slate-300"
                              )}
                            >
                              {scoreTone(result.score)}
                            </span>

                            <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2.5 py-1 text-xs font-medium text-yellow-300">
                              Score {result.score}
                            </span>

                            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400">
                              {result.availability}
                            </span>
                          </div>

                          <div className="mt-2 text-xs leading-5 text-slate-500">
                            {explainScore(result.score)}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                            {result.target.category && <span>{result.target.category}</span>}
                            {result.target.city && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {result.target.city}
                              </span>
                            )}
                            {result.email?.best && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {result.email.best}
                              </span>
                            )}
                          </div>

                          {!!result.why?.length && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {result.why.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                          {selected ? "Selected for step 2" : "Use this company"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-yellow-400/20 bg-slate-900/70 p-5">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "summary", label: "Summary" },
                { key: "wins", label: "Wins" },
                { key: "pipeline", label: "Pipeline" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRightPanelTab(tab.key as RightPanelTab)}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                    rightPanelTab === tab.key
                      ? "border-yellow-400/35 bg-yellow-400/10 text-yellow-300"
                      : "border-slate-700 bg-slate-950/30 text-slate-300 hover:border-yellow-400/25 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {rightPanelTab === "summary" && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.15em] text-yellow-300">
                    Pipeline summary
                  </div>
                  {summaryLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Pipeline",
                      value: summary?.stats.totalPipeline ?? 0,
                      helper: "Companies currently being worked on or followed up.",
                    },
                    {
                      label: "Won",
                      value: summary?.stats.won ?? 0,
                      helper: "Companies that converted into a confirmed win.",
                    },
                    {
                      label: "Suppressed",
                      value: summary?.stats.suppressed ?? 0,
                      helper: "Companies removed from outreach due to stop, no, or suppression rules.",
                    },
                    {
                      label: "Recent wins",
                      value: summary?.focus.recentWins ?? 0,
                      helper: "New wins recorded recently in your pipeline.",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/30 px-4 py-4"
                    >
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {item.value}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">
                        {item.helper}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/30 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Last activity
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {summary?.activity.lastEventType
                      ? `${summary.activity.lastEventType} • ${formatRelativeDate(
                          summary.activity.lastEventAt
                        )}`
                      : "No recent activity"}
                  </div>
                </div>
              </div>
            )}

            {rightPanelTab === "wins" && (
              <div className="mt-4 space-y-3">
                {pipelineLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading wins
                  </div>
                ) : !winsView.length ? (
                  <div className="text-sm text-slate-400">No wins yet.</div>
                ) : (
                  winsView.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/30 px-4 py-4"
                    >
                      <div className="text-base font-semibold text-white">
                        {item.business_targets?.name ?? "Unnamed company"}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        Won • Updated {formatRelativeDate(item.updated_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {rightPanelTab === "pipeline" && (
              <div className="mt-4 space-y-3">
                {pipelineLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading pipeline
                  </div>
                ) : !pipelineView.length ? (
                  <div className="text-sm text-slate-400">No active pipeline items yet.</div>
                ) : (
                  pipelineView.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/30 px-4 py-4"
                    >
                      <div className="text-base font-semibold text-white">
                        {item.business_targets?.name ?? "Unnamed company"}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {item.status ?? "Unknown"} • Updated {formatRelativeDate(item.updated_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-yellow-400/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.92))] p-4 shadow-[0_0_20px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/90">
              Primary markets
            </div>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-200">
            {PRIMARY_MARKETS.join(", ")}
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-400">
            Stronger affiliate familiarity and better first-outreach potential.
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-400/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.92))] p-4 shadow-[0_0_20px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/90">
              Growth markets
            </div>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-200">
            {GROWTH_MARKETS.join(", ")}
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-400">
            Good expansion markets for broader tests and new pipeline angles.
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-400/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.92))] p-4 shadow-[0_0_20px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/90">
              Why this matters
            </div>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-200">
            Start in stronger affiliate-active markets to reduce wasted searches and
            improve the chance of better-fit outreach.
          </div>
        </div>
      </section>

      <section
        className={cn(
          "rounded-3xl border p-5",
          step2Open
            ? "border-yellow-400/20 bg-slate-900/70"
            : "border-slate-700/70 bg-slate-900/40"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 text-xl font-semibold text-yellow-300">
              2
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Choose the outreach message that fits the person you want to reach
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Use a short, relevant message with clear credibility so the person
                reading it feels they are hearing from a real individual, not a
                random spam sender.
              </p>

              {step2Open && (
                <div className="mt-3 max-w-3xl text-sm font-medium leading-6 text-yellow-300">
                  {guidanceLoading
                    ? "Loading suggested angle..."
                    : guidance?.summary?.whyThisBusiness ||
                      "Start with a short and relevant message aimed at the person in the business who is most likely to care about growth, content, or side-income opportunities."}
                </div>
              )}
            </div>
          </div>

          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-yellow-300" />
        </div>

        {!step2Open ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/20 px-5 py-6 text-sm text-slate-400">
            Choose a company in step 1 to unlock message options.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/30 p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.14em] text-yellow-300">
                  Selected company
                </div>

                <div className="mt-4">
                  <div className="text-xl font-semibold text-white">
                    {selectedResult?.target.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-400">
                    {selectedResult?.target.category && (
                      <span>{selectedResult.target.category}</span>
                    )}
                    {selectedResult?.target.city && (
                      <span>{selectedResult.target.city}</span>
                    )}
                    {selectedResult?.target.country && (
                      <span>{selectedResult.target.country}</span>
                    )}
                  </div>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={useOwnEmail}
                    onChange={(e) => setUseOwnEmail(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-transparent text-yellow-400 focus:ring-yellow-400"
                  />
                  <div>
                    <div className="font-medium text-white">I will write my own email</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">
                      Use your own wording if you want more control. Tracking still
                      stays inside Autoaffi when you continue from this card.
                    </div>
                  </div>
                </label>

                {!useOwnEmail && templateSet && (
                  <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <DropdownSelect
                      label="Template option"
                      value={selectedTemplate}
                      onChange={(value) => setSelectedTemplate(value as TemplateKey)}
                      options={Object.entries(templateSet).map(([key, item]) => ({
                        value: key,
                        label: item.title,
                        helper: item.description,
                      }))}
                      placeholder="Choose template"
                    />

                    <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                      {Object.entries(templateSet).map(([key, item]) => {
                        const active = selectedTemplate === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedTemplate(key as TemplateKey)}
                            className={cn(
                              "mb-2 block w-full rounded-xl border px-3 py-3 text-left transition last:mb-0",
                              active
                                ? "border-yellow-400/35 bg-yellow-400/10"
                                : "border-slate-700/70 bg-slate-900/60 hover:border-yellow-400/20"
                            )}
                          >
                            <div className="text-sm font-semibold text-white">
                              {item.title}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-400">
                              {item.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-yellow-400/15 bg-yellow-400/5 px-4 py-3 text-sm leading-6 text-slate-300">
                  Beast-mode rule: keep the message short, relevant, human, and easy
                  to forward internally.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/30 p-4">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                    Your sender identity
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                      <input
                        value={senderRole}
                        onChange={(e) => setSenderRole(e.target.value)}
                        placeholder="Your role or title"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={senderInstagram}
                        onChange={(e) => setSenderInstagram(e.target.value)}
                        placeholder="Instagram handle"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                      <input
                        value={senderTikTok}
                        onChange={(e) => setSenderTikTok(e.target.value)}
                        placeholder="TikTok handle"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={senderYouTube}
                        onChange={(e) => setSenderYouTube(e.target.value)}
                        placeholder="YouTube name"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                      <input
                        value={senderFacebook}
                        onChange={(e) => setSenderFacebook(e.target.value)}
                        placeholder="Facebook name"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-yellow-400/35"
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs leading-5 text-slate-400">
                    Add your own real identity details so the company can see you are
                    a legitimate person and not a phishing-style sender.
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                    Subject
                  </label>
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={!useOwnEmail && guidanceLoading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400/35 disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                    Message
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={14}
                    disabled={!useOwnEmail && guidanceLoading}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-sm leading-7 text-white outline-none transition focus:border-yellow-400/35 disabled:opacity-70"
                  />
                </div>

                {guidance?.summary?.personalizationPlaceholder && !useOwnEmail && (
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-4 text-sm leading-6 text-yellow-100/90">
                    Personalization tip: replace{" "}
                    <span className="font-semibold">
                      {guidance.summary.personalizationPlaceholder}
                    </span>{" "}
                    with one real detail you noticed about the business or team.
                  </div>
                )}

                {step3Open && (
                  <div className="rounded-2xl border border-yellow-400/20 bg-slate-900/70 px-4 py-4">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 text-sm font-semibold text-yellow-300">
                        3
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Finish the outreach flow
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-400">
                          When you have chosen your template or written your own
                          message, finish by clicking <span className="font-medium text-yellow-300">Send tracked message</span>.
                          If you want to start over, click <span className="font-medium text-yellow-300">Refresh search</span>.
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={sending || !emailConnected}
                        className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-5 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send tracked message
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleRefreshSearch}
                        disabled={searchLoading}
                        className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 px-4 py-3 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh search
                      </button>

                      {sendSuccess && (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Outreach logged
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-sm leading-6 text-slate-400">
                      If you get a response from a company, continue the conversation
                      and finish the reply flow inside Contact Manager.
                    </div>

                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Remember: depending on which plan you have chosen, you may be
                      able to contact fewer or more companies.
                    </div>

                    {sendMessage && (
                      <div
                        className={cn(
                          "mt-4 rounded-2xl border px-4 py-4 text-sm leading-6",
                          sendSuccess
                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-400/25 bg-amber-500/10 text-amber-200"
                        )}
                      >
                        {sendMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-yellow-400/20 bg-slate-900/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/25 bg-slate-950">
            <Sparkles className="h-5 w-5 text-yellow-300" />
          </div>
          <div>
            <div className="text-base font-medium text-white">
              Search, choose the right message, continue outreach, and keep moving.
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-400">
              Use Contact Manager for outreach history, replies, and finishing the
              conversation flow after a company responds.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/login/dashboard/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 px-4 py-3 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10"
          >
            Open Contact Manager
            <ChevronRight className="h-4 w-4" />
          </Link>

          <Link
            href="/login/dashboard/leads"
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/30 px-4 py-3 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10"
          >
            Open Leads Hub
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <style jsx global>{`
        .autoaffi-dropdown-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(250, 204, 21, 0.95) rgba(15, 23, 42, 0.88);
        }

        .autoaffi-dropdown-scroll::-webkit-scrollbar {
          width: 12px;
        }

        .autoaffi-dropdown-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.9);
          border-left: 1px solid rgba(250, 204, 21, 0.12);
        }

        .autoaffi-dropdown-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(253, 224, 71, 0.95),
            rgba(250, 204, 21, 0.95),
            rgba(217, 119, 6, 0.95)
          );
          border-radius: 9999px;
          border: 2px solid rgba(15, 23, 42, 0.95);
        }

        .autoaffi-dropdown-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            180deg,
            rgba(254, 240, 138, 1),
            rgba(253, 224, 71, 1),
            rgba(245, 158, 11, 1)
          );
        }
      `}</style>
    </div>
  );
}