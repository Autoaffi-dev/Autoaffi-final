"use client";

import { useEffect, useMemo, useState } from "react";

type ContactTemperature = "cold" | "warm" | "hot";

type ContactStatus =
  | "new"
  | "saved"
  | "contacted"
  | "replied"
  | "interested"
  | "follow_up"
  | "no_answer"
  | "stop_contact"
  | "successful"
  | "won"
  | "lost"
  | "archived";

type ContactTab =
  | "new_leads"
  | "contacted"
  | "follow_up"
  | "replied_interested"
  | "no_answer"
  | "successful"
  | "stop_contact";

type UserPlan = "basic" | "pro" | "elite";

type ContactManagerProps = {
  plan?: UserPlan;
};

type EmailConnectionStatus = {
  ok: boolean;
  connected: boolean;
  provider?: "gmail" | "outlook" | "other";
  email?: string | null;
  connectedAt?: string | null;
  error?: string;
};

type DailyBriefPlanItem = {
  type: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
};

type DailyBriefMessageSuggestions = {
  firstContact?: string;
  followUp?: string;
  noAnswer?: string;
  successful?: string;
};

type ContactManagerDailyBrief = {
  id: string;
  user_id: string;
  brief_date: string;
  title: string;
  summary: string | null;
  priority_focus: string | null;
  manual_lead_task: string | null;
  warning: string | null;
  success_task: string | null;
  hot_lead_ids: string[];
  warm_lead_ids: string[];
  follow_up_lead_ids: string[];
  no_answer_lead_ids: string[];
  successful_lead_ids: string[];
  plan_items: DailyBriefPlanItem[];
  message_suggestions: DailyBriefMessageSuggestions;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type ContactManagerDailyBriefResponse = {
  ok: boolean;
  mode?: string;
  userId?: string;
  briefDate?: string;
  brief?: ContactManagerDailyBrief | null;
  error?: string;
  details?: string;
};

type ContactManagerSendEmailResponse = {
  ok: boolean;
  mode?: string;
  provider?: "gmail";
  item?: ContactManagerItem;
  activity?: ContactManagerActivity;
  sent?: {
    to: string;
    subject: string;
    providerMessageId: string | null;
    providerThreadId: string | null;
    at: string;
  };
  error?: string;
  details?: string;
};

interface ContactManagerActivity {
  id: string;
  user_id: string;
  contact_manager_item_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  previous_status: string | null;
  new_status: string | null;
  message_snapshot: string | null;
  notes_snapshot: string | null;
  next_follow_up_at: string | null;
  meta: Record<string, any>;
  created_at: string;
}

interface ContactManagerItem {
  id: string;
  user_id: string;

  source_type: string;
  source_record_id: string;
  source_label: string | null;
  source_url: string | null;

  name: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;

  temperature: ContactTemperature;
  status: ContactStatus;

  next_step: string | null;
  suggested_opener: string | null;
  notes: string | null;

  last_touch_at: string | null;
  next_follow_up_at: string | null;

  is_archived: boolean;
  is_won: boolean;
  is_lost: boolean;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;

  meta: Record<string, any>;

  created_at: string;
  updated_at: string;

  activities: ContactManagerActivity[];
}

interface ContactManagerOverviewResponse {
  ok: boolean;
  mode?: string;
  userId?: string;
  count?: number;
  counts?: {
    all: number;
    new: number;
    saved: number;
    contacted: number;
    replied?: number;
    interested: number;
    follow_up: number;
    no_answer?: number;
    stop_contact?: number;
    successful?: number;
    won: number;
    lost: number;
    archived: number;
    hot: number;
    warm: number;
    cold: number;
    active: number;
    doNotContact: number;
    needsFollowUp: number;
  };
  tabCounts?: Record<string, number>;
  bySource?: Array<{
    sourceType: string;
    sourceLabel: string;
    count: number;
    hot: number;
    warm: number;
    cold: number;
  }>;
  items?: ContactManagerItem[];
  error?: string;
  details?: string;
}

const AUTOAFFI_GPT_STORE_URL =
  process.env.NEXT_PUBLIC_AUTOAFFI_GPT_STORE_URL || "";

const EMAIL_SETTINGS_HREF = "/login/dashboard/settings";

const PLAN_CONFIG: Record<
  UserPlan,
  {
    label: string;
    canSendEmail: boolean;
    canUseDailyBrief: boolean;
    canUseDraftVariants: boolean;
    canUseEliteBlueprint: boolean;
  }
> = {
  basic: {
    label: "Basic",
    canSendEmail: true,
    canUseDailyBrief: true,
    canUseDraftVariants: true,
    canUseEliteBlueprint: false,
  },
  pro: {
    label: "Pro",
    canSendEmail: true,
    canUseDailyBrief: true,
    canUseDraftVariants: true,
    canUseEliteBlueprint: false,
  },
  elite: {
    label: "Elite",
    canSendEmail: true,
    canUseDailyBrief: true,
    canUseDraftVariants: true,
    canUseEliteBlueprint: true,
  },
};

const TABS: Array<{
  id: ContactTab;
  label: string;
  description: string;
}> = [
  {
    id: "new_leads",
    label: "New leads",
    description: "Not contacted yet.",
  },
  {
    id: "contacted",
    label: "Contacted",
    description: "First message saved or sent.",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    description: "Manual reminder tasks.",
  },
  {
    id: "replied_interested",
    label: "Replied / Interested",
    description: "Leads showing activity.",
  },
  {
    id: "no_answer",
    label: "No answer",
    description: "No reply after contact.",
  },
  {
    id: "successful",
    label: "Successful",
    description: "Converted leads.",
  },
  {
    id: "stop_contact",
    label: "Stop contact",
    description: "Do not contact again.",
  },
];

function temperatureColor(status: ContactTemperature) {
  if (status === "hot") {
    return "border-emerald-400/40 bg-emerald-500/20 text-emerald-300";
  }

  if (status === "warm") {
    return "border-yellow-400/40 bg-yellow-500/20 text-yellow-300";
  }

  return "border-slate-600/60 bg-slate-700/40 text-slate-200";
}

function statusBadgeClass(status: ContactStatus) {
  if (status === "successful" || status === "won") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "stop_contact" || status === "lost") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  if (
    status === "follow_up" ||
    status === "replied" ||
    status === "interested"
  ) {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  }

  if (status === "contacted") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }

  return "border-white/10 bg-white/[0.04] text-white/60";
}

function priorityBadgeClass(priority: DailyBriefPlanItem["priority"]) {
  if (priority === "high") {
    return "border-red-400/30 bg-red-400/10 text-red-100";
  }

  if (priority === "medium") {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  }

  return "border-white/10 bg-white/[0.04] text-white/55";
}

function statusLabel(status: ContactStatus) {
  switch (status) {
    case "new":
      return "New";
    case "saved":
      return "Saved";
    case "contacted":
      return "Contacted";
    case "replied":
      return "Replied";
    case "interested":
      return "Interested";
    case "follow_up":
      return "Follow-up";
    case "no_answer":
      return "No answer";
    case "stop_contact":
      return "Stop contact";
    case "successful":
      return "Successful";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "archived":
      return "Archived";
    default:
      return "New";
  }
}

function temperatureLabel(temperature: ContactTemperature) {
  switch (temperature) {
    case "hot":
      return "Hot";
    case "warm":
      return "Warm";
    case "cold":
    default:
      return "Cold";
  }
}

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not set";
  }
}

function formatBriefDate(value: string | null | undefined) {
  if (!value) return "Today";

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return "Today";
  }
}

function normalizeStatus(value: unknown): ContactStatus {
  const raw = String(value || "").toLowerCase();

  if (
    raw === "new" ||
    raw === "saved" ||
    raw === "contacted" ||
    raw === "replied" ||
    raw === "interested" ||
    raw === "follow_up" ||
    raw === "no_answer" ||
    raw === "stop_contact" ||
    raw === "successful" ||
    raw === "won" ||
    raw === "lost" ||
    raw === "archived"
  ) {
    return raw;
  }

  return "new";
}

function normalizeActivity(row: any): ContactManagerActivity {
  return {
    id: String(row.id || crypto.randomUUID()),
    user_id: String(row.user_id || ""),
    contact_manager_item_id: String(row.contact_manager_item_id || ""),
    activity_type: String(row.activity_type || "system"),
    title: String(row.title || "Activity"),
    description: row.description || null,
    previous_status: row.previous_status || null,
    new_status: row.new_status || null,
    message_snapshot: row.message_snapshot || null,
    notes_snapshot: row.notes_snapshot || null,
    next_follow_up_at: row.next_follow_up_at || null,
    meta: row.meta || {},
    created_at: row.created_at || new Date().toISOString(),
  };
}

function normalizeDailyBrief(value: unknown): ContactManagerDailyBrief | null {
  if (!value || typeof value !== "object") return null;

  const row = value as any;

  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    brief_date: String(row.brief_date || ""),
    title: safeText(row.title, "Today’s Contact Manager Plan"),
    summary: row.summary || null,
    priority_focus: row.priority_focus || null,
    manual_lead_task: row.manual_lead_task || null,
    warning: row.warning || null,
    success_task: row.success_task || null,
    hot_lead_ids: Array.isArray(row.hot_lead_ids) ? row.hot_lead_ids : [],
    warm_lead_ids: Array.isArray(row.warm_lead_ids) ? row.warm_lead_ids : [],
    follow_up_lead_ids: Array.isArray(row.follow_up_lead_ids)
      ? row.follow_up_lead_ids
      : [],
    no_answer_lead_ids: Array.isArray(row.no_answer_lead_ids)
      ? row.no_answer_lead_ids
      : [],
    successful_lead_ids: Array.isArray(row.successful_lead_ids)
      ? row.successful_lead_ids
      : [],
    plan_items: Array.isArray(row.plan_items)
      ? row.plan_items.map((item: any) => ({
          type: String(item.type || "task"),
          title: safeText(item.title, "Contact Manager task"),
          description: safeText(item.description, "Review this task today."),
          priority:
            item.priority === "high" ||
            item.priority === "medium" ||
            item.priority === "low"
              ? item.priority
              : "medium",
        }))
      : [],
    message_suggestions:
      row.message_suggestions && typeof row.message_suggestions === "object"
        ? row.message_suggestions
        : {},
    meta: row.meta || {},
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function normalizeItems(items: unknown): ContactManagerItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item: any): ContactManagerItem | null => {
      if (!item?.id) return null;

      return {
        id: String(item.id),
        user_id: String(item.user_id || ""),

        source_type: String(item.source_type || "manual"),
        source_record_id: String(item.source_record_id || ""),
        source_label: item.source_label || "Contact Manager",
        source_url: item.source_url || null,

        name: item.name || null,
        title:
          safeText(item.title) ||
          safeText(item.name) ||
          safeText(item.email) ||
          "Untitled contact",
        description:
          safeText(item.description) ||
          safeText(item.next_step) ||
          "No extra context yet.",
        email: item.email || null,
        phone: item.phone || null,

        temperature:
          item.temperature === "hot" || item.temperature === "warm"
            ? item.temperature
            : "cold",
        status: normalizeStatus(item.status),

        next_step: item.next_step || null,
        suggested_opener: item.suggested_opener || null,
        notes: item.notes || null,

        last_touch_at: item.last_touch_at || null,
        next_follow_up_at: item.next_follow_up_at || null,

        is_archived: Boolean(item.is_archived),
        is_won: Boolean(item.is_won),
        is_lost: Boolean(item.is_lost),
        do_not_contact: Boolean(item.do_not_contact),
        do_not_contact_reason: item.do_not_contact_reason || null,

        meta: item.meta || {},

        created_at: item.created_at || new Date().toISOString(),
        updated_at:
          item.updated_at || item.created_at || new Date().toISOString(),

        activities: Array.isArray(item.activities)
          ? item.activities.map(normalizeActivity)
          : [],
      };
    })
    .filter(Boolean) as ContactManagerItem[];
}

function getOriginalContext(item: ContactManagerItem) {
  return (
    safeText(item.meta?.text) ||
    safeText(item.meta?.title) ||
    safeText(item.description) ||
    safeText(item.suggested_opener) ||
    "No original context available."
  );
}

function getCleanLeadIntent(item: ContactManagerItem) {
  const raw = `${item.title || ""} ${item.description || ""} ${
    item.meta?.text || ""
  } ${item.meta?.title || ""}`.toLowerCase();

  if (raw.includes("pinterest")) {
    return "getting started with affiliate marketing and traffic through Pinterest";
  }

  if (raw.includes("amazon")) {
    return "affiliate marketing and choosing the right affiliate setup";
  }

  if (raw.includes("lead") || raw.includes("traffic")) {
    return "getting more leads, traffic or attention online";
  }

  if (
    raw.includes("reel") ||
    raw.includes("tiktok") ||
    raw.includes("content")
  ) {
    return "creating content consistently and turning attention into leads";
  }

  if (raw.includes("business") || raw.includes("customer")) {
    return "getting more customers and handling follow-up more clearly";
  }

  if (item.source_type === "gpt-store") {
    return "understanding if Autoaffi is the right system for their situation";
  }

  if (item.source_type === "qr-leads") {
    return "learning more after showing direct interest through an Autoaffi flow";
  }

  return "building a clearer system for content, offers, leads and follow-up";
}

function getSourceOrigin(item: ContactManagerItem) {
  const platform =
    safeText(item.meta?.source_platform) ||
    safeText(item.meta?.platform) ||
    safeText(item.meta?.source) ||
    "";

  if (item.source_type === "social-lead-engine") {
    if (platform) return `Social Lead Engine · ${platform}`;
    if (item.source_url?.includes("reddit")) {
      return "Social Lead Engine · Reddit signal";
    }

    return "Social Lead Engine · Social signal";
  }

  if (item.source_type === "gpt-store") {
    return "GPT Store · Elite-only high-intent lead";
  }

  if (item.source_type === "qr-leads") {
    return "QR Leads · Direct opt-in";
  }

  if (item.source_type === "business-finder") {
    return "Business Finder · Business lead";
  }

  if (item.source_type === "mlgs") {
    return "MLGS · External lead source";
  }

  return item.source_label || item.source_type || "Contact Manager";
}

function getSourceAngle(item: ContactManagerItem) {
  if (item.source_type === "gpt-store") {
    return "High-intent Autoaffi lead. Do not send the GPT Store link again. Use a personal coach-style follow-up.";
  }

  if (item.source_type === "qr-leads") {
    return "Direct opt-in lead. Keep the message helpful, clear and fast.";
  }

  if (item.source_type === "social-lead-engine") {
    return "Social signal lead. Use the topic as context, but do not paste the original post into the message.";
  }

  if (item.source_type === "business-finder") {
    return "Business lead. Keep it professional and focus on leads, automation and follow-up.";
  }

  if (item.source_type === "mlgs") {
    return "External lead source. Keep it short, simple and benefit-driven.";
  }

  return "Use a personal message connected to why this lead was saved.";
}

function getLeadContactLine(item: ContactManagerItem) {
  const parts = [
    item.name ? `Name: ${item.name}` : null,
    item.email ? `Email: ${item.email}` : null,
    item.phone ? `Phone: ${item.phone}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "No direct contact details yet.";
}

function hasDirectEmail(item: ContactManagerItem) {
  return Boolean(safeText(item.email));
}

function getManualContactUrl(item: ContactManagerItem) {
  return (
    safeText(item.source_url) ||
    safeText(item.meta?.url) ||
    safeText(item.meta?.permalink) ||
    safeText(item.meta?.source_url) ||
    safeText(item.meta?.post_url) ||
    safeText(item.meta?.comment_url) ||
    safeText(item.meta?.thread_url) ||
    safeText(item.meta?.profile_url) ||
    safeText(item.meta?.video_url) ||
    safeText(item.meta?.channel_url) ||
    safeText(item.meta?.external_url) ||
    safeText(item.meta?.lead_url) ||
    safeText(item.meta?.origin_url) ||
    ""
  );
}

function getManualContactLabel(item: ContactManagerItem) {
  const url = getManualContactUrl(item).toLowerCase();
  const platform =
    safeText(item.meta?.source_platform) ||
    safeText(item.meta?.platform) ||
    safeText(item.meta?.source) ||
    "";

  const raw = `${url} ${platform} ${item.source_label || ""} ${
    item.source_type || ""
  }`.toLowerCase();

  if (raw.includes("reddit.com") || raw.includes("reddit")) {
    return "Open Reddit lead";
  }

  if (raw.includes("youtube.com") || raw.includes("youtu.be") || raw.includes("youtube")) {
    return "Open YouTube lead";
  }

  if (raw.includes("bsky.app") || raw.includes("bluesky") || raw.includes("bsky")) {
    return "Open Bluesky lead";
  }

  if (raw.includes("tiktok.com") || raw.includes("tiktok")) {
    return "Open TikTok lead";
  }

  if (raw.includes("instagram.com") || raw.includes("instagram")) {
    return "Open Instagram lead";
  }

  if (raw.includes("facebook.com") || raw.includes("facebook")) {
    return "Open Facebook lead";
  }

  if (raw.includes("linkedin.com") || raw.includes("linkedin")) {
    return "Open LinkedIn lead";
  }

  if (
    raw.includes("twitter.com") ||
    raw.includes("x.com") ||
    raw.includes("twitter") ||
    raw.includes("x / twitter")
  ) {
    return "Open X/Twitter lead";
  }

  if (raw.includes("threads.net") || raw.includes("threads")) {
    return "Open Threads lead";
  }

  if (raw.includes("pinterest.com") || raw.includes("pinterest")) {
    return "Open Pinterest lead";
  }

  if (raw.includes("quora.com") || raw.includes("quora")) {
    return "Open Quora lead";
  }

  if (raw.includes("medium.com") || raw.includes("medium")) {
    return "Open Medium lead";
  }

  if (item.source_type === "social-lead-engine") {
    return "Open original social lead";
  }

  return "Open original lead source";
}

function matchesTab(item: ContactManagerItem, tab: ContactTab) {
  if (tab === "new_leads") {
    return item.status === "new" || item.status === "saved";
  }

  if (tab === "contacted") return item.status === "contacted";
  if (tab === "follow_up") return item.status === "follow_up";

  if (tab === "replied_interested") {
    return item.status === "replied" || item.status === "interested";
  }

  if (tab === "no_answer") return item.status === "no_answer";

  if (tab === "successful") {
    return item.status === "successful" || item.status === "won";
  }

  if (tab === "stop_contact") {
    return item.status === "stop_contact" || item.do_not_contact;
  }

  return false;
}

function tabLabel(tab: ContactTab) {
  return TABS.find((item) => item.id === tab)?.label || "New leads";
}

function buildCustomerProfileLine(profileLink: string) {
  const clean = safeText(profileLink);

  if (!clean) return "";

  return (
    `\n\n` +
    `If you want to see who I am before replying, here is my profile:\n` +
    `${clean}`
  );
}

function getDailySuggestionForTab(
  dailyBrief: ContactManagerDailyBrief | null,
  tab: ContactTab,
  item?: ContactManagerItem | null
) {
  if (!dailyBrief?.message_suggestions) return "";

  const status = item?.status;

  if (tab === "follow_up" || status === "follow_up") {
    return dailyBrief.message_suggestions.followUp || "";
  }

  if (tab === "no_answer" || status === "no_answer") {
    return dailyBrief.message_suggestions.noAnswer || "";
  }

  if (
    tab === "successful" ||
    status === "successful" ||
    status === "won" ||
    item?.is_won
  ) {
    return dailyBrief.message_suggestions.successful || "";
  }

  return dailyBrief.message_suggestions.firstContact || "";
}

function personalizeSuggestion(
  suggestion: string,
  item: ContactManagerItem,
  customerProfileLink = ""
) {
  const name = item.name || "there";
  const intent = getCleanLeadIntent(item);
  const profileLine = buildCustomerProfileLine(customerProfileLink);

  const personalized = suggestion
    .replaceAll("[name]", name)
    .replaceAll("[lead situation]", intent)
    .replaceAll("[intent]", intent)
    .replaceAll("[topic]", intent);

  return personalized + profileLine;
}

function buildVariantIntro(variant: number, tab: ContactTab) {
  const index = variant % 4;

  if (tab === "follow_up") {
    return [
      "Just wanted to follow up on my last message.",
      "I wanted to check if this is still relevant for you.",
      "Quick follow-up — no pressure at all.",
      "I thought I’d circle back once, in case this is still useful.",
    ][index];
  }

  if (tab === "no_answer") {
    return [
      "Just checking in one last time.",
      "I’ll leave this with you after this message.",
      "One final quick note from me.",
      "No worries if this is not relevant right now.",
    ][index];
  }

  if (tab === "successful") {
    return [
      "Great to see you getting started.",
      "Happy to see you taking the next step.",
      "Nice — now the important part is getting momentum.",
      "Great, let’s make sure you get value from this.",
    ][index];
  }

  if (tab === "replied_interested") {
    return [
      "Thanks for getting back to me.",
      "Appreciate your reply.",
      "Great question — happy to help.",
      "That makes sense, and I think the next step is to keep it simple.",
    ][index];
  }

  return [
    "I noticed you were looking into this.",
    "I came across this and thought it could be relevant.",
    "I saw this topic and wanted to reach out personally.",
    "This looked like something Autoaffi may be able to help with.",
  ][index];
}

function buildMessage(
  item: ContactManagerItem,
  tab: ContactTab,
  customerProfileLink = "",
  variant = 0,
  dailySuggestion = ""
) {
  const name = item.name || "there";
  const intent = getCleanLeadIntent(item);
  const profileLine = buildCustomerProfileLine(customerProfileLink);
  const intro = buildVariantIntro(variant, tab);

  if (dailySuggestion && variant % 3 === 1) {
    return personalizeSuggestion(dailySuggestion, item, customerProfileLink);
  }

  if (tab === "follow_up") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `I thought Autoaffi could be relevant because it helps with ${intent} in a more structured way.\n\n` +
      `No stress at all — if you want, I can help you understand the best starting point.` +
      profileLine
    );
  }

  if (tab === "no_answer") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `If Autoaffi is not relevant right now, no worries at all. But if you still want help with ${intent}, I can point you in the right direction.\n\n` +
      `Either way, wishing you the best.` +
      profileLine
    );
  }

  if (tab === "replied_interested") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `Based on what you are interested in, I think the best way to look at Autoaffi is as a system for content, offers, leads and follow-up — not just another random affiliate tool.\n\n` +
      `Tell me what your main goal is right now and I can guide you toward the best starting point.` +
      profileLine
    );
  }

  if (tab === "successful") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `If you have any questions or want help choosing your next step inside Autoaffi, just reply here and I’ll guide you.\n\n` +
      `The goal is not just to sign up — it is to actually use the system consistently and get momentum.` +
      profileLine
    );
  }

  if (item.source_type === "gpt-store") {
    return (
      `Hi ${name},\n\n` +
      `I saw that you showed interest in Autoaffi and wanted to reach out personally.\n\n` +
      `Since you already looked into Autoaffi, I think the most useful next step is to understand what part fits your situation best: content, offers, leads, follow-up or recurring opportunities.\n\n` +
      `I can be your guide and help you choose the best starting point.` +
      profileLine
    );
  }

  if (item.source_type === "business-finder") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `Autoaffi could be relevant if you want a simpler way to create content, capture leads and follow up with potential customers.\n\n` +
      `Autoaffi is built to help turn scattered opportunities into a clearer system for content, leads and follow-up.\n\n` +
      `Would you like me to send a quick overview of how it could work for your situation?` +
      profileLine
    );
  }

  if (item.source_type === "qr-leads") {
    return (
      `Hi ${name},\n\n` +
      `Thanks for showing interest through Autoaffi.\n\n` +
      `Autoaffi helps you create content, find opportunities, track leads and follow up in a more structured way.\n\n` +
      `If you want, I can help you understand the best starting point based on what you are trying to achieve.` +
      profileLine
    );
  }

  if (item.source_type === "social-lead-engine") {
    return (
      `Hi ${name},\n\n` +
      `${intro}\n\n` +
      `That is exactly the kind of problem Autoaffi is built around: helping you go from scattered ideas and random links to a clearer system for content, offers, leads and follow-up.\n\n` +
      (AUTOAFFI_GPT_STORE_URL
        ? `You can also ask questions about Autoaffi here:\n${AUTOAFFI_GPT_STORE_URL}\n\n`
        : "") +
      `If it feels relevant, I can also guide you personally.` +
      profileLine
    );
  }

  return (
    `Hi ${name},\n\n` +
    `${intro}\n\n` +
    `Autoaffi helps people create content, find opportunities, track leads and follow up from one dashboard.\n\n` +
    (AUTOAFFI_GPT_STORE_URL
      ? `You can ask questions about Autoaffi here:\n${AUTOAFFI_GPT_STORE_URL}\n\n`
      : "") +
    `If you want, I can help you understand if it fits your situation.` +
    profileLine
  );
}

function getDefaultNextStep(item: ContactManagerItem, tab: ContactTab) {
  if (tab === "new_leads") {
    return item.source_type === "gpt-store"
      ? "Contact personally and offer coach-style guidance."
      : "Send or save the first personal message.";
  }

  if (tab === "contacted") {
    return "Wait for reply or set a follow-up reminder.";
  }

  if (tab === "follow_up") {
    return "Send a short follow-up and update the lead after handling it.";
  }

  if (tab === "no_answer") {
    return "Send one soft final follow-up or leave the lead inactive.";
  }

  if (tab === "successful") {
    return "Send a helpful support message and offer guidance.";
  }

  if (tab === "stop_contact") {
    return "Do not contact this lead again.";
  }

  return "Review the lead and choose the next best action.";
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildEliteBlueprintPrompt() {
  return `I use Autoaffi Contact Manager to manage leads, outreach messages, follow-ups and customer conversations.

Act as my personal Autoaffi Contact Manager coach.

Your role:
Help me turn saved leads into real conversations, interested replies and successful customers without sounding spammy, pushy or generic.

Important:
This is my reusable Elite Blueprint. Treat it as my stable outreach operating system. Do not assume you have live access to my Autoaffi dashboard. When I paste a lead, a message draft, a follow-up situation or my current Contact Manager status, help me choose the best next action.

Core principles:
- Be personal, clear and human.
- Never write spammy, aggressive or fake-scarcity messages.
- Keep outreach short enough to be easy to reply to.
- Focus on the lead's situation, problem, interest or intent.
- Never overpromise earnings or results.
- Never pressure someone who is not interested.
- Respect stop-contact situations immediately.
- Prefer quality conversations over mass outreach.
- Help me sound trustworthy, useful and calm.

Lead stages:
1. New lead:
Help me decide if the lead is worth contacting. If yes, write a soft first-contact message.

2. Contacted:
Help me decide whether to wait, follow up or improve the next message.

3. Follow-up:
Write a short follow-up that reminds the person why the message is relevant without sounding annoying.

4. Replied / interested:
Help me answer personally, understand their goal and guide them toward the best next Autoaffi step.

5. No answer:
Help me decide if I should send one final soft message or leave the lead alone.

6. Successful lead:
Help me support the person after conversion so they understand how to start, stay consistent and get value from Autoaffi.

7. Stop contact:
Do not write any more outreach. Help me close the lead respectfully and avoid future contact.

Message rules:
- Use simple language.
- Start with the reason I am reaching out.
- Connect the message to the lead's situation.
- Ask one clear question when possible.
- Avoid long pitches.
- Avoid sounding like a bot.
- Avoid too many links.
- Do not paste raw social media text unless I specifically ask.
- If I provide my own social/profile link, include it naturally so the person can verify who is contacting them.

Autoaffi positioning:
Autoaffi helps users create content, organize offers, manage leads, follow up and build a clearer affiliate/business growth system from one dashboard.

Use this positioning naturally, but do not make every message sound like a sales pitch.

GPT Store rule:
If a lead came from the Autoaffi GPT Store, do not send the GPT Store link again. Treat them as already aware of Autoaffi and focus on personal guidance.

For non-GPT Store leads, the GPT Store link can be used only if it helps the person ask questions or understand Autoaffi better. Do not force the link into every message.

Manual lead-finding help:
When I ask for lead-finding ideas, help me find places where people are already asking about:
- affiliate marketing
- side income
- content creation
- AI tools
- getting traffic
- finding leads
- online business
- social media growth
- automation
- small business customer follow-up

Give me ethical, non-spammy ways to find and approach those people.

Daily routine:
When I ask for a daily Contact Manager plan, give me:
1. Who to contact first.
2. Who to follow up with.
3. Who to leave alone.
4. What message to send.
5. What manual lead-finding task to do.
6. What to avoid today.

Output style:
When I paste a lead or situation, respond with:
1. Lead priority: Hot, Warm or Low priority.
2. Best next action.
3. Suggested message.
4. Why this message works.
5. Follow-up timing.
6. What not to do.
7. Optional improved version if I want it shorter or more personal.

Before writing a message, ask for missing details only if they are truly needed. Otherwise, make a smart, safe draft based on what I gave you.

Always protect trust. The goal is not just to contact more people. The goal is to create better conversations.`;
}

export default function ContactManager({ plan = "basic" }: ContactManagerProps) {
  const [items, setItems] = useState<ContactManagerItem[]>([]);
  const [overview, setOverview] =
    useState<ContactManagerOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [emailStatus, setEmailStatus] = useState<EmailConnectionStatus | null>(
    null
  );
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);

  const [dailyBrief, setDailyBrief] = useState<ContactManagerDailyBrief | null>(
    null
  );
  const [dailyBriefLoading, setDailyBriefLoading] = useState(true);
  const [dailyBriefError, setDailyBriefError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ContactTab>("new_leads");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [expandedContext, setExpandedContext] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [blueprintCopied, setBlueprintCopied] = useState(false);
  const [customerProfileLink, setCustomerProfileLink] = useState("");
  const [draftVariant, setDraftVariant] = useState(0);

  const planConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.basic;
  const emailConnected = emailStatus?.connected === true;
  const connectedEmail = emailStatus?.email || null;
  const connectedProvider = emailStatus?.provider || null;
  const isElite = planConfig.canUseEliteBlueprint;

  useEffect(() => {
    let isMounted = true;

    async function loadContactManager() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const res = await fetch("/api/contact-manager/overview?limit=300", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as ContactManagerOverviewResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load Contact Manager.");
        }

        if (!isMounted) return;

        const normalized = normalizeItems(json.items);

        setOverview(json);
        setItems(normalized);

        const firstPriority =
          normalized.find(
            (item) =>
              !item.is_archived &&
              item.temperature === "hot" &&
              matchesTab(item, "new_leads")
          ) ||
          normalized.find(
            (item) =>
              !item.is_archived &&
              item.temperature === "warm" &&
              matchesTab(item, "new_leads")
          ) ||
          normalized.find((item) => !item.is_archived) ||
          null;

        if (firstPriority) {
          setSelectedItemId(firstPriority.id);
          setMessageText(buildMessage(firstPriority, "new_leads", "", 0, ""));
          setNotesText(firstPriority.notes || "");
        }
      } catch (err: any) {
        if (!isMounted) return;

        setLoadError(err?.message || "Failed to load Contact Manager.");
        setOverview(null);
        setItems([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContactManager();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEmailStatus() {
      try {
        setEmailStatusLoading(true);

        const res = await fetch("/api/business/email/status", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as EmailConnectionStatus;

        if (!isMounted) return;

        if (!res.ok || !json.ok) {
          setEmailStatus({
            ok: false,
            connected: false,
            error: json.error || "EMAIL_STATUS_FAILED",
          });
          return;
        }

        setEmailStatus(json);
      } catch {
        if (!isMounted) return;

        setEmailStatus({
          ok: false,
          connected: false,
          error: "EMAIL_STATUS_FAILED",
        });
      } finally {
        if (isMounted) {
          setEmailStatusLoading(false);
        }
      }
    }

    loadEmailStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDailyBrief() {
      try {
        setDailyBriefLoading(true);
        setDailyBriefError(null);

        const res = await fetch("/api/contact-manager/daily-brief", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as ContactManagerDailyBriefResponse;

        if (!isMounted) return;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load daily brief.");
        }

        setDailyBrief(normalizeDailyBrief(json.brief));
      } catch (err: any) {
        if (!isMounted) return;

        setDailyBrief(null);
        setDailyBriefError(err?.message || "Failed to load daily brief.");
      } finally {
        if (isMounted) {
          setDailyBriefLoading(false);
        }
      }
    }

    loadDailyBrief();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    return items.filter((item) => !item.is_archived);
  }, [items]);

  const tabItems = useMemo(() => {
    return visibleItems
      .filter((item) => matchesTab(item, activeTab))
      .sort((a, b) => {
        const tempScore: Record<ContactTemperature, number> = {
          hot: 3,
          warm: 2,
          cold: 1,
        };

        return (
          tempScore[b.temperature] - tempScore[a.temperature] ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
  }, [activeTab, visibleItems]);

  const selectedItem = useMemo(() => {
    return visibleItems.find((item) => item.id === selectedItemId) || null;
  }, [selectedItemId, visibleItems]);

  const counts = useMemo(() => {
    return {
      all: visibleItems.length,
      hot: visibleItems.filter((item) => item.temperature === "hot").length,
      warm: visibleItems.filter((item) => item.temperature === "warm").length,
      contacted: visibleItems.filter((item) => item.status === "contacted")
        .length,
      followUp: visibleItems.filter((item) => item.status === "follow_up")
        .length,
      noAnswer: visibleItems.filter((item) => item.status === "no_answer")
        .length,
      stopContact: visibleItems.filter(
        (item) => item.status === "stop_contact" || item.do_not_contact
      ).length,
      successful: visibleItems.filter(
        (item) => item.status === "successful" || item.status === "won"
      ).length,
      needsFollowUp: visibleItems.filter(
        (item) =>
          item.next_follow_up_at &&
          new Date(item.next_follow_up_at).getTime() <= Date.now()
      ).length,
    };
  }, [visibleItems]);

  const tabCounts = useMemo(() => {
    return {
      new_leads: visibleItems.filter((item) => matchesTab(item, "new_leads"))
        .length,
      contacted: visibleItems.filter((item) => matchesTab(item, "contacted"))
        .length,
      follow_up: visibleItems.filter((item) => matchesTab(item, "follow_up"))
        .length,
      replied_interested: visibleItems.filter((item) =>
        matchesTab(item, "replied_interested")
      ).length,
      no_answer: visibleItems.filter((item) => matchesTab(item, "no_answer"))
        .length,
      successful: visibleItems.filter((item) => matchesTab(item, "successful"))
        .length,
      stop_contact: visibleItems.filter((item) =>
        matchesTab(item, "stop_contact")
      ).length,
    };
  }, [visibleItems]);

  function selectItem(item: ContactManagerItem, tab: ContactTab = activeTab) {
    const suggestion = getDailySuggestionForTab(dailyBrief, tab, item);

    setSelectedItemId(item.id);
    setDraftVariant(0);
    setMessageText(buildMessage(item, tab, customerProfileLink, 0, suggestion));
    setNotesText(item.notes || "");
    setExpandedContext(false);
    setUpdateError(null);
    setSendError(null);
    setSendSuccess(null);
  }

  function handleTabChange(tab: ContactTab) {
    setActiveTab(tab);

    const firstItem = visibleItems.find((item) => matchesTab(item, tab));

    if (firstItem) {
      selectItem(firstItem, tab);
    } else {
      setSelectedItemId(null);
      setMessageText("");
      setNotesText("");
    }
  }

  function handleRegenerateDraft(item: ContactManagerItem) {
    const nextVariant = draftVariant + 1;
    const suggestion = getDailySuggestionForTab(dailyBrief, activeTab, item);

    setDraftVariant(nextVariant);
    setMessageText(
      buildMessage(
        item,
        activeTab,
        customerProfileLink,
        nextVariant,
        suggestion
      )
    );
  }

  function handleUseTodaySuggestion(item: ContactManagerItem) {
    const suggestion = getDailySuggestionForTab(dailyBrief, activeTab, item);

    if (!suggestion) return;

    setMessageText(personalizeSuggestion(suggestion, item, customerProfileLink));
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(messageText);
      setSendError(null);
      setSendSuccess("Message copied. Open the original source and paste it manually.");

      window.setTimeout(() => {
        setSendSuccess(null);
      }, 2500);
    } catch {
      setSendSuccess(null);
      setSendError("Could not copy message.");
    }
  }

  async function updateItem(
    item: ContactManagerItem,
    payload: Partial<{
      status: ContactStatus;
      notes: string | null;
      next_step: string | null;
      suggested_opener: string | null;
      next_follow_up_at: string | null;
      do_not_contact_reason: string | null;
    }>
  ) {
    try {
      setIsUpdatingId(item.id);
      setUpdateError(null);

      const res = await fetch("/api/contact-manager/update-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          ...payload,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update contact.");
      }

      const updated = normalizeItems([
        {
          ...json.item,
          activities: json.activity
            ? [json.activity, ...(item.activities || [])]
            : item.activities || [],
        },
      ])[0];

      setItems((current) =>
        current.map((existing) =>
          existing.id === updated.id ? updated : existing
        )
      );

      setSelectedItemId(updated.id);
      setNotesText(updated.notes || "");

      return updated;
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update contact.");
      return null;
    } finally {
      setIsUpdatingId(null);
    }
  }

  async function handleSaveAsContacted(item: ContactManagerItem) {
    await updateItem(item, {
      status: "contacted",
      notes: notesText || item.notes || null,
      suggested_opener: messageText,
      next_step: hasDirectEmail(item)
        ? "Wait for reply or set a follow-up reminder."
        : "Manual reply handled. Wait for reply or set a follow-up reminder.",
    });

    setActiveTab("contacted");
  }

  async function handleSendEmail(item: ContactManagerItem) {
    try {
      setIsUpdatingId(item.id);
      setUpdateError(null);
      setSendError(null);
      setSendSuccess(null);

      if (!emailConnected) {
        setSendError("Connect Gmail before sending emails.");
        return;
      }

      if (!item.email) {
        setSendError("This lead has no email address.");
        return;
      }

      if (item.do_not_contact || item.status === "stop_contact") {
        setSendError("This lead is marked as stop-contact.");
        return;
      }

      const res = await fetch("/api/contact-manager/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: item.id,
          message: messageText,
        }),
      });

      const json = (await res.json()) as ContactManagerSendEmailResponse;

      if (!res.ok || !json.ok || !json.item) {
        throw new Error(json.error || "Failed to send email.");
      }

      const updated = normalizeItems([
        {
          ...json.item,
          activities: json.activity
            ? [json.activity, ...(item.activities || [])]
            : item.activities || [],
        },
      ])[0];

      setItems((current) =>
        current.map((existing) =>
          existing.id === updated.id ? updated : existing
        )
      );

      setSelectedItemId(updated.id);
      setNotesText(updated.notes || "");
      setActiveTab("contacted");

      setSendSuccess(
        json.sent?.to
          ? `Email sent to ${json.sent.to}.`
          : "Email sent successfully."
      );

      window.setTimeout(() => {
        setSendSuccess(null);
      }, 2500);
    } catch (err: any) {
      setSendError(err?.message || "Failed to send email.");
    } finally {
      setIsUpdatingId(null);
    }
  }

  async function handleFollowUp(item: ContactManagerItem, days: number) {
    await updateItem(item, {
      status: "follow_up",
      notes: notesText || item.notes || null,
      suggested_opener: messageText,
      next_step: `Follow up in ${days} day(s).`,
      next_follow_up_at: addDays(days),
    });

    setActiveTab("follow_up");
  }

  async function handleSuccessful(item: ContactManagerItem) {
    await updateItem(item, {
      status: "successful",
      notes: notesText || item.notes || null,
      suggested_opener: messageText,
      next_step:
        "Send a helpful support message and offer guidance if they have questions.",
    });

    setActiveTab("successful");
  }

  async function handleCopyBlueprint() {
    if (!isElite) return;

    const prompt = buildEliteBlueprintPrompt();

    try {
      await navigator.clipboard.writeText(prompt);
      setBlueprintCopied(true);

      window.setTimeout(() => {
        setBlueprintCopied(false);
      }, 1800);
    } catch {
      setBlueprintCopied(false);
    }
  }

  const hasTodaySuggestion =
    selectedItem &&
    Boolean(getDailySuggestionForTab(dailyBrief, activeTab, selectedItem));

  const selectedManualContactUrl = selectedItem
    ? getManualContactUrl(selectedItem)
    : "";

  const selectedHasDirectEmail = selectedItem
    ? hasDirectEmail(selectedItem)
    : false;

  const selectedHasManualSource =
    Boolean(selectedItem) && !selectedHasDirectEmail && Boolean(selectedManualContactUrl);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#080607] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.11),transparent_36%)]" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-yellow-300/80">
              Leads · CRM · Outreach Coach
            </p>

            <h1 className="mt-4 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
              Contact Manager
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68">
              Contact Manager helps you turn Autoaffi leads into real
              conversations, follow-ups and successful customers. Review the
              lead, understand where it came from, use a source-aware message,
              save activity history and follow up with the right person at the
              right time.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={EMAIL_SETTINGS_HREF}
                className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
              >
                Open email settings
              </a>

              <span
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  emailConnected
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/25 bg-red-400/10 text-red-100"
                }`}
              >
                {emailStatusLoading
                  ? "Checking email..."
                  : emailConnected
                    ? `${
                        connectedProvider === "gmail" ? "Gmail" : "Email"
                      } connected${connectedEmail ? ` · ${connectedEmail}` : ""}`
                    : "Gmail not connected"}
              </span>

              <span className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/60">
                Plan · {planConfig.label}
              </span>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
              How this card works
            </p>

            <div className="mt-4 grid gap-3">
              {[
                "Hot leads should be handled first, then Warm leads.",
                "Tabs show exactly what needs action right now.",
                "Messages adapt to source, stage and today’s plan.",
                "If no email exists, open the original source and reply manually.",
              ].map((text) => (
                <div
                  key={text}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-white/65"
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {loadError ? (
        <section className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          Contact Manager could not load live data: {loadError}
        </section>
      ) : null}

      {updateError ? (
        <section className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          Contact update failed: {updateError}
        </section>
      ) : null}

      {sendError ? (
        <section className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          Email send failed: {sendError}
        </section>
      ) : null}

      {sendSuccess ? (
        <section className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {sendSuccess}
        </section>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          { label: "All", value: counts.all },
          { label: "Hot", value: counts.hot },
          { label: "Warm", value: counts.warm },
          { label: "Contacted", value: counts.contacted },
          { label: "Follow-up", value: counts.followUp },
          { label: "No answer", value: counts.noAnswer },
          { label: "Successful", value: counts.successful },
        ].map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {isLoading ? "..." : stat.value}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#080607] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/75">
                Today’s Contact Manager Plan
              </p>

              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                {dailyBriefLoading
                  ? "Loading"
                  : dailyBrief
                    ? `Generated ${formatBriefDate(dailyBrief.brief_date)}`
                    : "Not generated"}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-extrabold text-white">
              {dailyBrief?.title || "Daily outreach plan"}
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              {dailyBriefLoading
                ? "Loading today’s plan..."
                : dailyBrief?.summary ||
                  "Your daily plan will appear here after the Contact Manager cron has generated today’s brief."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:max-w-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Priority focus
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {dailyBrief?.priority_focus ||
                "No priority focus available yet. Generate today’s brief or add more leads."}
            </p>
          </div>
        </div>

        {dailyBriefError ? (
          <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
            Daily brief could not load: {dailyBriefError}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {dailyBrief?.plan_items && dailyBrief.plan_items.length > 0 ? (
            dailyBrief.plan_items.map((item) => (
              <article
                key={`${item.type}-${item.title}`}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${priorityBadgeClass(
                      item.priority
                    )}`}
                  >
                    {item.priority}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/55">
                  {item.description}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/45 lg:col-span-3">
              {dailyBriefLoading
                ? "Loading daily tasks..."
                : "No daily plan items yet. Run the daily brief cron to generate today’s tasks."}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Manual lead task
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {dailyBrief?.manual_lead_task ||
                "Find 2–3 relevant leads from comments, groups or niche communities."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Warning
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {dailyBrief?.warning ||
                "Keep outreach personal. Do not send too many links or push too hard."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Successful lead task
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {dailyBrief?.success_task ||
                "When someone converts, follow up with support so they get value from Autoaffi."}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
              Lead action tabs
            </p>
            <h2 className="mt-2 text-lg font-bold text-white">
              Work leads by stage, not by cluttered pipeline
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/50">
              Choose a tab and the lead list, message draft and next actions
              adapt automatically.
            </p>
          </div>

          <span className="w-fit rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
            {isLoading ? "Loading" : "Live"}
          </span>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {TABS.map((tab) => {
            const count = tabCounts[tab.id] || 0;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`min-w-fit rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-yellow-300/45 bg-yellow-400/10 text-yellow-100"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]"
                }`}
              >
                <span className="block text-xs font-bold">{tab.label}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] opacity-70">
                  {count} lead{count === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
            {tabLabel(activeTab)}
          </p>
          <h2 className="mt-2 text-lg font-bold text-white">
            Leads in this stage
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/50">
            Select a lead to view context, message draft, notes and activity.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {tabItems.length > 0 ? (
            tabItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const manualUrl = getManualContactUrl(item);
              const noEmailHasSource = !hasDirectEmail(item) && Boolean(manualUrl);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-yellow-300/45 bg-yellow-400/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${temperatureColor(
                        item.temperature
                      )}`}
                    >
                      {temperatureLabel(item.temperature)}
                    </span>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${statusBadgeClass(
                        item.status
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>

                    {noEmailHasSource ? (
                      <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-sky-100">
                        Manual source
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm font-bold text-white">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-yellow-100/70">
                    {getSourceOrigin(item)}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-white/55">
                    Intent: {getCleanLeadIntent(item)}
                  </p>

                  {noEmailHasSource ? (
                    <p className="mt-2 text-xs leading-5 text-sky-100/60">
                      No email · reply through original source.
                    </p>
                  ) : null}

                  <p className="mt-2 text-[11px] text-white/35">
                    Last touch: {formatDate(item.last_touch_at)}
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center lg:col-span-3">
              <p className="text-sm font-bold text-white">
                {isLoading ? "Loading leads..." : "No leads in this tab"}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Leads will appear here when they match this stage.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-yellow-400/15 bg-[#09080a] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] md:p-6">
        {selectedItem ? (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/75">
                  Selected lead workspace
                </p>

                <h2 className="mt-2 max-w-4xl text-2xl font-extrabold text-white">
                  {selectedItem.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  {getLeadContactLine(selectedItem)}
                </p>

                <p className="mt-1 text-sm leading-6 text-yellow-100/70">
                  {getSourceOrigin(selectedItem)}
                </p>

                {selectedManualContactUrl ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={selectedManualContactUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-400/15"
                    >
                      {getManualContactLabel(selectedItem)}
                    </a>

                    {!selectedHasDirectEmail ? (
                      <span className="rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100">
                        No email · use manual reply
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] ${temperatureColor(
                    selectedItem.temperature
                  )}`}
                >
                  {temperatureLabel(selectedItem.temperature)}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] ${statusBadgeClass(
                    selectedItem.status
                  )}`}
                >
                  {statusLabel(selectedItem.status)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  Why this lead matters
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {getCleanLeadIntent(selectedItem)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  Source angle
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {getSourceAngle(selectedItem)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  Next step
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {selectedItem.next_step ||
                    getDefaultNextStep(selectedItem, activeTab)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
                    Original lead context
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-white">
                    Used for understanding, not copied into the message
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedContext((value) => !value)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.07]"
                >
                  {expandedContext ? "Hide" : "Expand"}
                </button>
              </div>

              {expandedContext ? (
                <p className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-white/55">
                  {getOriginalContext(selectedItem)}
                </p>
              ) : (
                <p className="mt-3 line-clamp-2 text-xs leading-6 text-white/45">
                  {getOriginalContext(selectedItem)}
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
                      Message draft
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      {tabLabel(activeTab)} message
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-white/40">
                      Drafts vary by lead, source, stage and today’s daily
                      suggestions. Nothing is sent automatically.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRegenerateDraft(selectedItem)}
                      className="w-fit rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]"
                    >
                      Regenerate variant
                    </button>

                    {hasTodaySuggestion ? (
                      <button
                        type="button"
                        onClick={() => handleUseTodaySuggestion(selectedItem)}
                        className="w-fit rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
                      >
                        Use today’s suggestion
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                    Your social / profile link
                  </p>

                  <input
                    value={customerProfileLink}
                    onChange={(e) => setCustomerProfileLink(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-yellow-400/35"
                    placeholder="Instagram, TikTok, LinkedIn, Facebook, website or personal profile..."
                  />

                  <p className="mt-2 text-xs leading-5 text-white/40">
                    Optional. Add your own profile so the lead can see who is
                    contacting them. Regenerate the draft after adding it.
                  </p>
                </div>

                {selectedHasManualSource ? (
                  <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/70">
                      Manual reply source
                    </p>

                    <h4 className="mt-1 text-sm font-bold text-white">
                      This lead has no email address
                    </h4>

                    <p className="mt-2 text-xs leading-6 text-white/55">
                      Copy the message below, open the original lead source and
                      paste your reply manually. After that, save the lead as
                      contacted so Contact Manager can track follow-up.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMessage}
                        className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-bold text-yellow-100 transition hover:bg-yellow-400/15"
                      >
                        Copy message
                      </button>

                      <a
                        href={selectedManualContactUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-400/15"
                      >
                        {getManualContactLabel(selectedItem)}
                      </a>
                    </div>
                  </div>
                ) : null}

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={8}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-yellow-400/35"
                  placeholder="Write or edit your message..."
                />

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                    Private notes
                  </p>

                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-yellow-400/35"
                    placeholder="Add private notes about this lead..."
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(activeTab === "new_leads" ||
                    selectedItem.status === "new" ||
                    selectedItem.status === "saved") && (
                    <button
                      type="button"
                      onClick={() =>
                        emailConnected && selectedHasDirectEmail
                          ? handleSendEmail(selectedItem)
                          : handleSaveAsContacted(selectedItem)
                      }
                      disabled={isUpdatingId === selectedItem.id}
                      className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdatingId === selectedItem.id
                        ? "Working..."
                        : emailConnected && selectedHasDirectEmail
                          ? "Send via Gmail"
                          : selectedHasManualSource
                            ? "Save after manual reply"
                            : "Save as contacted"}
                    </button>
                  )}

                  {(activeTab === "contacted" ||
                    activeTab === "follow_up" ||
                    selectedItem.status === "contacted" ||
                    selectedItem.status === "follow_up") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFollowUp(selectedItem, 1)}
                        disabled={isUpdatingId === selectedItem.id}
                        className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Follow-up tomorrow
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFollowUp(selectedItem, 3)}
                        disabled={isUpdatingId === selectedItem.id}
                        className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Follow-up in 3 days
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateItem(selectedItem, {
                            status: "no_answer",
                            notes: notesText || selectedItem.notes || null,
                            suggested_opener: messageText,
                            next_step:
                              "No answer. Consider one soft final follow-up later.",
                          })
                        }
                        disabled={isUpdatingId === selectedItem.id}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        No answer
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      updateItem(selectedItem, {
                        status: "replied",
                        notes: notesText || selectedItem.notes || null,
                        suggested_opener: messageText,
                        next_step:
                          "Reply personally and guide the lead based on their interest.",
                      })
                    }
                    disabled={isUpdatingId === selectedItem.id}
                    className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark replied
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSuccessful(selectedItem)}
                    disabled={isUpdatingId === selectedItem.id}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Successful lead
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateItem(selectedItem, {
                        status: "stop_contact",
                        notes: notesText || selectedItem.notes || null,
                        suggested_opener: messageText,
                        do_not_contact_reason:
                          "Lead is not interested or requested no further contact.",
                      })
                    }
                    disabled={isUpdatingId === selectedItem.id}
                    className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Stop contact
                  </button>
                </div>

                {selectedHasManualSource ? (
                  <p className="mt-3 text-xs leading-5 text-sky-100/60">
                    This lead has no email address, but the original source link
                    is available. Copy the message, open the source and reply
                    manually. Then save the lead as contacted.
                  </p>
                ) : !emailConnected ? (
                  <p className="mt-3 text-xs leading-5 text-white/40">
                    Gmail is not connected yet. For now, this stores the message
                    and logs the activity. Connect Gmail from Settings to send
                    real emails.
                  </p>
                ) : selectedHasDirectEmail ? (
                  <p className="mt-3 text-xs leading-5 text-emerald-100/60">
                    Gmail sending is active for this plan. Clicking Send via
                    Gmail will send the email and log it in this lead’s activity
                    timeline.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-yellow-100/60">
                    This lead has no email address and no original source link.
                    You can still save the message as contacted or use another
                    channel manually.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
                  Activity log
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  Lead timeline
                </h3>

                <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {selectedItem.activities.length > 0 ? (
                    selectedItem.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <p className="text-sm font-bold text-white">
                            {activity.title}
                          </p>
                          <p className="text-xs text-white/35">
                            {formatDate(activity.created_at)}
                          </p>
                        </div>

                        {activity.description ? (
                          <p className="mt-2 text-xs leading-5 text-white/50">
                            {activity.description}
                          </p>
                        ) : null}

                        {activity.previous_status || activity.new_status ? (
                          <p className="mt-2 text-[11px] uppercase tracking-[0.13em] text-white/35">
                            {activity.previous_status || "none"} →{" "}
                            {activity.new_status || "updated"}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/45">
                      No activity yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
            <p className="text-sm font-bold text-white">No lead selected</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/45">
              Select a lead from the active tab to write a message, update
              status and view activity history.
            </p>
          </div>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#080607] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.24em] text-yellow-300/75">
                Contact Manager Blueprint
              </p>
              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-100">
                Elite feature
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-extrabold text-white">
              Own your personal outreach coach
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              Copy your Elite Blueprint into ChatGPT and use it whenever you
              want help with outreach, follow-ups, interested leads, no-answer
              leads, successful customers or manual lead finding. This is your
              reusable Contact Manager coach — stable, premium and built to help
              you work smarter without sounding spammy.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={isElite ? handleCopyBlueprint : undefined}
              disabled={!isElite}
              className={`w-fit rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                isElite
                  ? "border-yellow-400/35 bg-yellow-400/10 text-yellow-100 hover:bg-yellow-400/15"
                  : "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35"
              }`}
            >
              {!isElite
                ? "Locked for Elite"
                : blueprintCopied
                  ? "Elite Blueprint copied"
                  : "Copy Elite Blueprint"}
            </button>

            {!isElite ? (
              <p className="max-w-xs text-xs leading-5 text-white/40">
                Upgrade to Elite to unlock your personal outreach coach.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            What your Elite Blueprint helps with
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Turn ChatGPT into your reusable Contact Manager coach.",
              "Write better first-contact, follow-up and no-answer messages.",
              "Handle interested leads without sounding pushy or generic.",
              "Support successful customers after they convert.",
              "Find more high-quality manual leads ethically.",
              "Build a simple daily outreach routine you can repeat.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-white/60"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="mt-4 text-[12px] text-slate-500">
        Contact Manager now stores activity history, supports manual follow-up
        reminders, reads global Gmail status, separates original lead context
        from outreach messages, uses today’s daily brief for smarter draft
        variation, supports real Gmail sending for all plans and includes manual
        source replies for social leads without email. Elite unlocks the reusable
        Blueprint.
      </p>
    </main>
  );
}