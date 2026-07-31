"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LEADS_HUB_HERO_IMAGE = "/images/leads-hub/leads-hub-hero.png";

type SourceStatus =
  | "connected"
  | "setup_required"
  | "coming_soon"
  | "status_only"
  | "no_activity";

type SourceCategory =
  | "all"
  | "social"
  | "opt_in"
  | "business"
  | "tracking"
  | "community"
  | "external";

type LeadTemperature = "cold" | "warm" | "hot";
type LeadFilter = "all" | LeadTemperature;

interface LeadsHubSource {
  id: string;
  title: string;
  shortTitle: string;
  category: Exclude<SourceCategory, "all">;
  status: SourceStatus;
  badge: string;
  description: string;
  whatShowsHere: string;
  nextAction: string;
  routingRule: string;
  actionLabel?: string;
  actionHref?: string;
}

interface LeadsHubLead {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  temperature: LeadTemperature;
  status: string;
  createdAt?: string | null;
  sourceLabel?: string;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  score?: number | null;
  suggestedOpener?: string | null;
  meta?: Record<string, any>;
}

interface MlgsTemplate {
  id: string;
  title: string;
  description: string;
  body: string;
}

interface LeadSnapshotItem {
  sourceId: string;
  sourceTitle: string;
  count: number;
}

interface LeadsHubOverviewResponse {
  ok: boolean;
  mode?: string;
  userId?: string;
  count?: number;
  counts?: {
    all: number;
    hot: number;
    warm: number;
    cold: number;
  };
  bySource?: {
    socialLeadEngine?: number;
    businessFinder?: number;
    qrLeads?: number;
    trackingIdEngine?: number;
  };
  sourceSettings?: {
    mlgs?: {
      isActivated?: boolean;
      row?: any;
    };
    communityBoost?: {
      isActivated?: boolean;
      row?: any;
    };
  };
  leads?: LeadsHubLead[];
  error?: string;
  details?: string;
}

const MLGS_AFFILIATE_URL =
  process.env.NEXT_PUBLIC_MLGS_AFFILIATE_URL || "";

const MLGS_OUTREACH_TEMPLATES: MlgsTemplate[] = [
  {
    id: "first-message",
    title: "First message",
    description: "Use this for your first contact with an MLGS lead.",
    body:
      "Hi [Name], I saw you might be interested in [topic/benefit].\n\n" +
      "I’m sharing a simple resource that can help with [result].\n\n" +
      "You can check it here:\n" +
      "[your Autoaffi link]\n\n" +
      "Hope it helps — and if it’s not relevant, no worries.",
  },
  {
    id: "follow-up",
    title: "Follow-up",
    description: "Use this if the person has not replied yet.",
    body:
      "Hi [Name], just wanted to follow up in case you missed my last message.\n\n" +
      "The resource is for people who want help with [benefit/result].\n\n" +
      "Here it is again:\n" +
      "[your Autoaffi link]\n\n" +
      "No pressure — just wanted to make sure you got it.",
  },
  {
    id: "soft-close",
    title: "Soft close",
    description: "Use this as a final light follow-up.",
    body:
      "Totally understand if now isn’t the right time.\n\n" +
      "If you ever want help with [problem/result], this is a good starting point:\n" +
      "[your Autoaffi link]\n\n" +
      "Have a great day.",
  },
];

const BASE_SOURCE_REGISTRY: LeadsHubSource[] = [
  {
    id: "social-lead-engine",
    title: "Social Lead Engine",
    shortTitle: "Social Lead Engine",
    category: "social",
    status: "connected",
    badge: "YouTube · Reddit · Bluesky",
    description:
      "Find social lead candidates from YouTube, Reddit and Bluesky without turning Leads Hub into a spam tool.",
    whatShowsHere:
      "Saved, contacted or blocked social candidates from Social Lead Engine will appear here with their original platform status.",
    nextAction:
      "Save the right person, post or profile, then follow up manually on the original platform.",
    routingRule:
      "Only reviewed Warm or Hot social candidates should move to Contact Manager. Cold noise stays in Leads Hub.",
    actionLabel: "Open Social Lead Engine",
  },
  {
    id: "viral-heads-up",
    title: "Viral Heads-Up",
    shortTitle: "Viral Heads-Up",
    category: "social",
    status: "coming_soon",
    badge: "Viral opportunities",
    description:
      "Spot people, posts or profiles gaining fast traction so the customer can act while the opportunity is fresh.",
    whatShowsHere:
      "Viral posts, fast-growing profiles and urgent engagement opportunities will appear here when this card is built.",
    nextAction:
      "Engage only when the post, profile or trend is relevant to the customer’s niche.",
    routingRule:
      "A specific person/profile/post can become a lead opportunity. General trends remain signals.",
  },
  {
    id: "qr-leads",
    title: "QR Leads",
    shortTitle: "QR Leads",
    category: "opt_in",
    status: "connected",
    badge: "QR · Opt-in",
    description:
      "Collect real opt-in leads from QR flows where people actively scan and submit interest.",
    whatShowsHere:
      "Real QR leads appear here as lead activity when people submit their details through an Autoaffi QR flow.",
    nextAction:
      "Review new QR leads and follow up through Contact Manager when appropriate.",
    routingRule:
      "A submitted QR lead is usually Warm or Hot depending on intent, message and context.",
  },
  {
    id: "gpt-store",
    title: "GPT Store / Autoaffi GPT",
    shortTitle: "GPT Store",
    category: "opt_in",
    status: "coming_soon",
    badge: "Landing page",
    description:
      "Turn Autoaffi GPT interest into real leads through a dedicated landing page or request-access flow.",
    whatShowsHere:
      "GPT Store leads and landing page submissions will appear here once connected.",
    nextAction:
      "Send interested users to the Autoaffi landing page and collect opt-in details.",
    routingRule:
      "Form submissions can move to Contact Manager. Anonymous visits remain tracking signals.",
  },
  {
    id: "campaigns",
    title: "Campaigns",
    shortTitle: "Campaigns",
    category: "opt_in",
    status: "no_activity",
    badge: "CTA · Campaigns",
    description:
      "Track campaign CTA activity from Autoaffi campaign flows once links and lead capture are connected.",
    whatShowsHere:
      "Campaign clicks, opt-in submissions and CTA activity will appear here when real data exists.",
    nextAction:
      "Use Autoaffi-generated CTA links in campaigns once Profile Setup provides the default destination.",
    routingRule:
      "Opt-in campaign leads can move to Contact Manager. Anonymous clicks stay as signals.",
  },
  {
    id: "posts-reels",
    title: "Posts & Reels CTA",
    shortTitle: "Posts & Reels",
    category: "opt_in",
    status: "setup_required",
    badge: "Posts · Reels",
    description:
      "Use generated CTA text and customer-owned Autoaffi links inside posts, reels, captions or platform auto-replies.",
    whatShowsHere:
      "CTA link activity from generated posts and reels will appear here after Profile Setup provides the default lead link.",
    nextAction:
      "Set the default CTA destination in Profile Setup, then let Posts and Reels include the right link.",
    routingRule:
      "Known opt-in leads can move to Contact Manager. Anonymous clicks stay as signals.",
  },
  {
    id: "business-finder",
    title: "Business Finder",
    shortTitle: "Business Finder",
    category: "business",
    status: "connected",
    badge: "B2B",
    description:
      "Find and save relevant businesses for controlled B2B outreach without needing lead links in the first version.",
    whatShowsHere:
      "Saved or claimed businesses from Business Finder will appear here with their actual lead temperature.",
    nextAction:
      "Review Hot or Warm business matches before sending them to Contact Manager.",
    routingRule:
      "Cold businesses should not move to Contact Manager. Warm/Hot businesses can be routed.",
    actionLabel: "Open Business Finder",
    actionHref: "/login/dashboard/business-finder",
  },
  {
    id: "tracking-id-engine",
    title: "Tracking ID Engine",
    shortTitle: "Tracking",
    category: "tracking",
    status: "no_activity",
    badge: "Clicks · Attribution",
    description:
      "Separate anonymous click signals from known lead activity so Autoaffi never pretends to know who clicked.",
    whatShowsHere:
      "Known clicks, anonymous clicks and campaign signals from Autoaffi-owned links will appear here when real tracking data exists.",
    nextAction:
      "Use click signals to understand interest, but only follow up when the click is tied to a known lead or opt-in.",
    routingRule:
      "Anonymous clicks never move to Contact Manager. Known lead clicks can become follow-up opportunities.",
  },
  {
    id: "smart-suggestions",
    title: "Smart Suggestions",
    shortTitle: "Smart Suggestions",
    category: "community",
    status: "coming_soon",
    badge: "Communities",
    description:
      "Get suggestions for communities, groups and places where your audience may already be active.",
    whatShowsHere:
      "Recommended communities and places to explore. These are not leads until you save a specific person, post or thread.",
    nextAction:
      "Join or monitor the right communities. Save a specific opportunity only when it becomes actionable.",
    routingRule:
      "Smart Suggestions do not move directly to Contact Manager.",
  },
  {
    id: "community-boost",
    title: "Community Boost",
    shortTitle: "Community Boost",
    category: "community",
    status: "status_only",
    badge: "Activation status",
    description: "See whether Community Boost is activated for your account.",
    whatShowsHere:
      "Only your Community Boost activation status appears here. Community Boost does not create leads.",
    nextAction:
      "Activate Community Boost only if you want to take part in quality-first community support.",
    routingRule:
      "Community Boost never routes to Contact Manager.",
  },
  {
    id: "mlgs",
    title: "MLGS",
    shortTitle: "MLGS",
    category: "external",
    status: "setup_required",
    badge: "External · $1/day · 100 leads/day",
    description:
      "MLGS is an external lead service outside Autoaffi. Create your own MLGS account to receive up to 100 leads per day. MLGS costs $1/day and is paid directly to MLGS.",
    whatShowsHere:
      "MLGS setup status, ready-to-use messages and manual result tracking.",
    nextAction:
      "Create your MLGS account, then use the copy-ready messages below.",
    routingRule: "Track contacted leads and deals manually in Autoaffi.",
  },
];

const CATEGORIES: Array<{
  id: SourceCategory;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "All",
    description: "Overview of every lead source and signal type.",
  },
  {
    id: "social",
    label: "Social",
    description: "YouTube, Reddit, Bluesky and viral social opportunities.",
  },
  {
    id: "opt_in",
    label: "Opt-in",
    description: "QR, GPT, campaigns, posts and reels with lead capture.",
  },
  {
    id: "business",
    label: "Business",
    description: "B2B opportunities from Business Finder.",
  },
  {
    id: "tracking",
    label: "Tracking",
    description: "Known and anonymous click signals from Autoaffi links.",
  },
  {
    id: "community",
    label: "Community",
    description:
      "Smart Suggestions and Community Boost status. These do not create leads directly.",
  },
  {
    id: "external",
    label: "External",
    description:
      "MLGS as an external lead source with customer-owned account setup.",
  },
];

const TEMPERATURE_RULES = [
  {
    label: "Cold",
    title: "Signal only",
    text: "Cold items stay in Leads Hub. They are useful for monitoring, but should not move to Contact Manager automatically.",
  },
  {
    label: "Warm",
    title: "Review first",
    text: "Warm items may be worth follow-up, but the customer should review the context before routing them.",
  },
  {
    label: "Hot",
    title: "Ready to follow up",
    text: "Hot leads are opt-in, clearly interested or strongly matched. These can be routed to Contact Manager manually.",
  },
];

function getStatusLabel(status: SourceStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "setup_required":
      return "Setup required";
    case "coming_soon":
      return "Coming soon";
    case "status_only":
      return "Status only";
    case "no_activity":
    default:
      return "No activity yet";
  }
}

function getStatusClass(status: SourceStatus) {
  switch (status) {
    case "connected":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "setup_required":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "coming_soon":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "status_only":
      return "border-violet-400/30 bg-violet-400/10 text-violet-200";
    case "no_activity":
    default:
      return "border-white/10 bg-white/5 text-white/60";
  }
}

function getLeadTemperatureClass(temperature: LeadTemperature) {
  switch (temperature) {
    case "hot":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    case "warm":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "cold":
    default:
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }
}

function getLeadActionLabel(temperature: LeadTemperature) {
  switch (temperature) {
    case "hot":
      return "Send to Contact Manager now";
    case "warm":
      return "Send to Contact Manager";
    case "cold":
    default:
      return "Monitor only";
  }
}

function shouldShowLeadCounts(sourceId: string) {
  return sourceId !== "smart-suggestions" && sourceId !== "community-boost";
}

function getTemperatureLabel(temperature: LeadTemperature) {
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

function normalizeLeadTemperature(value: unknown): LeadTemperature {
  const raw = String(value || "").toLowerCase();

  if (raw === "hot") return "hot";
  if (raw === "warm") return "warm";
  return "cold";
}

function normalizeApiLeads(leads: unknown): LeadsHubLead[] {
  if (!Array.isArray(leads)) return [];

  return leads
    .map((lead: any): LeadsHubLead | null => {
      if (!lead?.id || !lead?.sourceId) return null;

      return {
        id: String(lead.id),
        sourceId: String(lead.sourceId),
        title: String(lead.title || "Untitled lead"),
        description: String(lead.description || "No extra context yet."),
        temperature: normalizeLeadTemperature(lead.temperature),
        status: String(lead.status || "new"),
        createdAt: lead.createdAt || null,
        sourceLabel: lead.sourceLabel || null,
        sourcePlatform: lead.sourcePlatform || null,
        sourceUrl: lead.sourceUrl || null,
        score:
          typeof lead.score === "number"
            ? lead.score
            : lead.score
              ? Number(lead.score)
              : null,
        suggestedOpener: lead.suggestedOpener || null,
        meta: lead.meta || {},
      };
    })
    .filter(Boolean) as LeadsHubLead[];
}

function getLeadSnapshotForTemperature(
  leads: LeadsHubLead[],
  temperature: LeadTemperature,
  sources: LeadsHubSource[]
): LeadSnapshotItem[] {
  const counts = new Map<string, number>();

  leads
    .filter((lead) => lead.temperature === temperature)
    .forEach((lead) => {
      counts.set(lead.sourceId, (counts.get(lead.sourceId) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .map(([sourceId, count]) => {
      const source = sources.find((item) => item.id === sourceId);

      return {
        sourceId,
        sourceTitle: source?.shortTitle ?? sourceId,
        count,
      };
    })
    .filter((item) => shouldShowLeadCounts(item.sourceId))
    .sort((a, b) => b.count - a.count);
}

export default function LeadsHub() {
  const [activeCategory, setActiveCategory] = useState<SourceCategory>("all");
  const [activeSourceId, setActiveSourceId] = useState<string>(
    BASE_SOURCE_REGISTRY[0]?.id ?? ""
  );
  const [activeLeadFilter, setActiveLeadFilter] = useState<LeadFilter>("all");
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  const [liveLeads, setLiveLeads] = useState<LeadsHubLead[]>([]);
  const [overview, setOverview] = useState<LeadsHubOverviewResponse | null>(
    null
  );
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        setIsLoadingOverview(true);
        setOverviewError(null);

        const res = await fetch("/api/leads-hub/overview?limit=200", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as LeadsHubOverviewResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load Leads Hub overview.");
        }

        if (!isMounted) return;

        setOverview(json);
        setLiveLeads(normalizeApiLeads(json.leads));
      } catch (err: any) {
        if (!isMounted) return;

        setOverviewError(err?.message || "Failed to load Leads Hub overview.");
        setOverview(null);
        setLiveLeads([]);
      } finally {
        if (isMounted) {
          setIsLoadingOverview(false);
        }
      }
    }

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const sourceRegistry = useMemo(() => {
    const mlgsActivated = overview?.sourceSettings?.mlgs?.isActivated ?? false;
    const communityBoostActivated =
      overview?.sourceSettings?.communityBoost?.isActivated ?? false;

    return BASE_SOURCE_REGISTRY.map((source) => {
      if (source.id === "mlgs") {
        return {
          ...source,
          status: mlgsActivated ? "connected" : "setup_required",
          badge: mlgsActivated
            ? "External · Activated"
            : "External · $1/day · 100 leads/day",
        } satisfies LeadsHubSource;
      }

      if (source.id === "community-boost") {
        return {
          ...source,
          status: communityBoostActivated ? "connected" : "status_only",
          badge: communityBoostActivated ? "Activated" : "Not activated",
        } satisfies LeadsHubSource;
      }

      if (source.id === "tracking-id-engine") {
        const hasTrackingActivity = liveLeads.some(
          (lead) => lead.sourceId === "tracking-id-engine"
        );

        return {
          ...source,
          status: hasTrackingActivity ? "connected" : "no_activity",
        } satisfies LeadsHubSource;
      }

      if (source.id === "campaigns") {
        const hasCampaignActivity = liveLeads.some(
          (lead) =>
            lead.sourceId === "tracking-id-engine" &&
            String(lead.meta?.source || "").toLowerCase().includes("campaign")
        );

        return {
          ...source,
          status: hasCampaignActivity ? "connected" : "no_activity",
        } satisfies LeadsHubSource;
      }

      return source;
    });
  }, [liveLeads, overview]);

  const visibleSources = useMemo(() => {
    if (activeCategory === "all") return sourceRegistry;
    return sourceRegistry.filter((source) => source.category === activeCategory);
  }, [activeCategory, sourceRegistry]);

  const activeSource =
    sourceRegistry.find((source) => source.id === activeSourceId) ??
    visibleSources[0] ??
    sourceRegistry[0];

  const showLeadCounts = shouldShowLeadCounts(activeSource.id);

  const leadSnapshot = useMemo(() => {
    return {
      hot: getLeadSnapshotForTemperature(liveLeads, "hot", sourceRegistry),
      warm: getLeadSnapshotForTemperature(liveLeads, "warm", sourceRegistry),
      cold: getLeadSnapshotForTemperature(liveLeads, "cold", sourceRegistry),
    };
  }, [liveLeads, sourceRegistry]);

  const leadSnapshotTotals = useMemo(() => {
    return {
      hot: leadSnapshot.hot.reduce((sum, item) => sum + item.count, 0),
      warm: leadSnapshot.warm.reduce((sum, item) => sum + item.count, 0),
      cold: leadSnapshot.cold.reduce((sum, item) => sum + item.count, 0),
    };
  }, [leadSnapshot]);

  const hasLeadSnapshotActivity =
    leadSnapshotTotals.hot > 0 ||
    leadSnapshotTotals.warm > 0 ||
    leadSnapshotTotals.cold > 0;

  const sourceLeads = useMemo(() => {
    return liveLeads.filter((lead) => lead.sourceId === activeSource.id);
  }, [activeSource.id, liveLeads]);

  const leadCounts = useMemo(() => {
    return {
      all: sourceLeads.length,
      hot: sourceLeads.filter((lead) => lead.temperature === "hot").length,
      warm: sourceLeads.filter((lead) => lead.temperature === "warm").length,
      cold: sourceLeads.filter((lead) => lead.temperature === "cold").length,
    };
  }, [sourceLeads]);

  const filteredLeads = useMemo(() => {
    if (activeLeadFilter === "all") return sourceLeads;
    return sourceLeads.filter((lead) => lead.temperature === activeLeadFilter);
  }, [activeLeadFilter, sourceLeads]);

  function handleCategoryChange(category: SourceCategory) {
    setActiveCategory(category);
    setActiveLeadFilter("all");

    const firstSource =
      category === "all"
        ? sourceRegistry[0]
        : sourceRegistry.find((source) => source.category === category);

    if (firstSource) setActiveSourceId(firstSource.id);
  }

  function handleSourceChange(sourceId: string) {
    setActiveSourceId(sourceId);
    setActiveLeadFilter("all");
  }

  function handleSnapshotClick(sourceId: string, temperature: LeadTemperature) {
    const source = sourceRegistry.find((item) => item.id === sourceId);

    if (!source) return;

    setActiveCategory(source.category);
    setActiveSourceId(sourceId);
    setActiveLeadFilter(temperature);
  }

  async function copyTemplate(template: MlgsTemplate) {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedTemplateId(template.id);

      window.setTimeout(() => {
        setCopiedTemplateId((current) =>
          current === template.id ? null : current
        );
      }, 1800);
    } catch {
      setCopiedTemplateId(null);
    }
  }

  async function sendLeadToContactManager(lead: LeadsHubLead) {
    if (lead.temperature === "cold") return;

    try {
      setSendingLeadId(lead.id);
      setSendError(null);

      const res = await fetch("/api/leads-hub/send-to-contact-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: lead.id,
          sourceId: lead.sourceId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to send lead.");
      }

      setSentLeadIds((current) => {
        const next = new Set(current);
        next.add(lead.id);
        return next;
      });
    } catch (err: any) {
      setSendError(err?.message || "Failed to send lead.");
    } finally {
      setSendingLeadId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-400/20 bg-[#080607] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.12),transparent_36%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-yellow-300/80">
              Data · Leads · Opportunities
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 md:text-5xl">
              Leads Hub
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68">
              Leads Hub shows potential leads from Autoaffi’s different sources
              in one place. Review your opportunities, identify the right Warm
              and Hot leads, and send selected leads to Contact Manager when
              you’re ready to take action.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/login/dashboard/contact-manager"
                className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
              >
                Open Contact Manager
              </Link>

              <Link
                href="/login/dashboard/business-finder"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07]"
              >
                Business Finder
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.65rem] border border-yellow-400/20 bg-black/35 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
            <Image
              src={LEADS_HUB_HERO_IMAGE}
              alt="Leads Hub visual overview"
              width={900}
              height={675}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      {overviewError ? (
        <section className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          Leads Hub could not load live data: {overviewError}
        </section>
      ) : null}

      {sendError ? (
        <section className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          Could not send lead to Contact Manager: {sendError}
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {TEMPERATURE_RULES.map((rule) => (
          <article
            key={rule.label}
            className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
          >
            <div className="inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-100">
              {rule.label}
            </div>

            <h3 className="mt-3 text-base font-bold text-white">
              {rule.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/55">{rule.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-[2rem] border border-yellow-400/15 bg-slate-950/55 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/75">
              Lead snapshot
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Current leads by source
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              See where your current Cold, Warm and Hot leads are coming from
              before you open a source. Click a source count to review those
              leads directly.
            </p>
          </div>

          {isLoadingOverview ? (
            <span className="w-fit rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-yellow-100">
              Loading live data
            </span>
          ) : (
            <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">
              Live data
            </span>
          )}
        </div>

        {hasLeadSnapshotActivity ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {(["hot", "warm", "cold"] as LeadTemperature[]).map(
              (temperature) => {
                const items = leadSnapshot[temperature];
                const total = leadSnapshotTotals[temperature];

                return (
                  <article
                    key={temperature}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${getLeadTemperatureClass(
                            temperature
                          )}`}
                        >
                          {getTemperatureLabel(temperature)}
                        </p>

                        <h3 className="mt-3 text-lg font-bold text-white">
                          {total} {total === 1 ? "lead" : "leads"}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {items.map((item) => (
                        <button
                          key={`${temperature}-${item.sourceId}`}
                          type="button"
                          onClick={() =>
                            handleSnapshotClick(item.sourceId, temperature)
                          }
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm transition hover:bg-white/[0.07]"
                        >
                          <span className="font-semibold text-white/75">
                            {item.sourceTitle}
                          </span>

                          <span className="font-bold text-yellow-100">
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <p className="text-sm font-bold text-white">
              {isLoadingOverview
                ? "Loading live lead activity..."
                : "No live lead activity yet"}
            </p>

            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/45">
              When real leads are connected, this area will show counts like QR
              Leads — 4, Social Lead Engine — 3, or Business Finder — 2,
              grouped by Hot, Warm and Cold.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/75">
          Lead sources
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Choose what you want to review
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          Pick a category to see what belongs in Leads Hub and what can later
          move to Contact Manager.
        </p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryChange(category.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-yellow-300/50 bg-yellow-400/15 text-yellow-100"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-white/60">
            {
              CATEGORIES.find((category) => category.id === activeCategory)
                ?.description
            }
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-4">
          <h2 className="text-lg font-bold text-white">Available sources</h2>

          <p className="mt-1 text-sm text-white/50">
            These are lead source slots. Lead temperature appears on actual
            leads, not on the source itself.
          </p>

          <div className="mt-4 space-y-2">
            {visibleSources.map((source) => {
              const isActive = activeSource.id === source.id;

              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => handleSourceChange(source.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-yellow-300/40 bg-yellow-400/10"
                      : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {source.shortTitle}
                      </p>

                      <p className="mt-1 text-xs text-white/45">
                        {source.badge}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${getStatusClass(
                        source.status
                      )}`}
                    >
                      {getStatusLabel(source.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-yellow-400/15 bg-[#09080a] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/75">
                Selected source
              </p>

              <h2 className="mt-2 text-2xl font-extrabold text-white">
                {activeSource.title}
              </h2>
            </div>

            <span
              className={`w-fit rounded-full border px-3 py-1 text-[11px] font-bold ${getStatusClass(
                activeSource.status
              )}`}
            >
              {getStatusLabel(activeSource.status)}
            </span>
          </div>

          <p className="mt-4 text-sm leading-7 text-white/65">
            {activeSource.description}
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                What appears here
              </p>

              <p className="mt-2 text-sm leading-6 text-white/65">
                {activeSource.whatShowsHere}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Next action
              </p>

              <p className="mt-2 text-sm leading-6 text-white/65">
                {activeSource.nextAction}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Follow-up rule
              </p>

              <p className="mt-2 text-sm leading-6 text-white/65">
                {activeSource.routingRule}
              </p>
            </div>
          </div>

          {activeSource.id === "mlgs" ? (
            <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-200/80">
                External service · Outside Autoaffi
              </p>

              <h3 className="mt-2 text-lg font-bold text-white">
                Activate MLGS support in Autoaffi
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                MLGS gives you leads. Autoaffi helps you use them smarter. If
                you choose to activate MLGS, Autoaffi will give you messages you
                can copy and send to your MLGS leads.
              </p>

              <div className="mt-4 grid gap-2 text-sm text-white/65 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  1. Create your MLGS account
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  2. Pay MLGS $1/day
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  3. Get up to 100 leads/day
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  4. Copy Autoaffi messages
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  What Autoaffi does
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Autoaffi does not import or store all MLGS leads in V1.
                  Instead, Autoaffi gives you outreach messages, follow-up text
                  and simple manual tracking for contacted leads and deals.
                  These messages can later be updated daily through Autoaffi’s
                  content system.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {MLGS_AFFILIATE_URL ? (
                  <a
                    href={MLGS_AFFILIATE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-yellow-400/30 bg-yellow-400/15 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/20"
                  >
                    Create MLGS account →
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/35"
                  >
                    MLGS affiliate link coming soon
                  </button>
                )}

                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/35"
                >
                  MLGS status:{" "}
                  {overview?.sourceSettings?.mlgs?.isActivated
                    ? "Activated"
                    : "Not activated"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
                  Ready-to-use messages
                </p>

                <h3 className="mt-2 text-lg font-bold text-white">
                  Copy and send to your MLGS leads
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  Start with these default messages. Later, Autoaffi can refresh
                  them daily so your outreach does not feel repetitive.
                </p>

                <div className="mt-4 grid gap-3">
                  {MLGS_OUTREACH_TEMPLATES.map((template) => (
                    <article
                      key={template.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {template.title}
                          </h4>

                          <p className="mt-1 text-xs leading-5 text-white/45">
                            {template.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyTemplate(template)}
                          className="w-fit rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
                        >
                          {copiedTemplateId === template.id
                            ? "Copied"
                            : "Copy text"}
                        </button>
                      </div>

                      <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/60">
                        {template.body}
                      </pre>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeSource.id === "smart-suggestions" ? (
            <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/80">
                Recommendation source · Not a lead list
              </p>

              <h3 className="mt-2 text-lg font-bold text-white">
                Community suggestions will appear here
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Smart Suggestions helps you find communities, groups and places
                where your audience may already be active. These suggestions do
                not count as leads by themselves.
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                  How it becomes a lead
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  A suggestion only becomes a lead opportunity when you save a
                  specific person, post, profile or thread from that community.
                  Until then, it stays as a place to explore.
                </p>
              </div>
            </div>
          ) : null}

          {activeSource.id === "community-boost" ? (
            <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/80">
                Activation status · Not a lead source
              </p>

              <h3 className="mt-2 text-lg font-bold text-white">
                Community Boost status
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Community Boost does not create leads and does not send anything
                to Contact Manager. It only shows whether you have opted in to
                quality-first community support with other activated Autoaffi
                users.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/35"
                >
                  Community Boost:{" "}
                  {overview?.sourceSettings?.communityBoost?.isActivated
                    ? "Activated"
                    : "Not activated"}
                </button>

                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/35"
                >
                  Status sync connected
                </button>
              </div>
            </div>
          ) : null}

          {showLeadCounts ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/70">
                    Leads from this source
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-white">
                    Cold, Warm and Hot leads
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-white/50">
                    Lead temperature appears on actual leads and signals. Cold
                    stays here. Warm and Hot can be sent to Contact Manager
                    manually.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {[
                  {
                    id: "all" as LeadFilter,
                    label: "All",
                    count: leadCounts.all,
                  },
                  {
                    id: "hot" as LeadFilter,
                    label: "Hot",
                    count: leadCounts.hot,
                  },
                  {
                    id: "warm" as LeadFilter,
                    label: "Warm",
                    count: leadCounts.warm,
                  },
                  {
                    id: "cold" as LeadFilter,
                    label: "Cold",
                    count: leadCounts.cold,
                  },
                ].map((filter) => {
                  const isActive = activeLeadFilter === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveLeadFilter(filter.id)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        isActive
                          ? "border-yellow-300/50 bg-yellow-400/15"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        {filter.label}
                      </p>

                      <p className="mt-1 text-2xl font-extrabold text-white">
                        {filter.count}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                {filteredLeads.length > 0 ? (
                  <div className="space-y-3">
                    {filteredLeads.map((lead) => {
                      const isSending = sendingLeadId === lead.id;
                      const isSent = sentLeadIds.has(lead.id);

                      return (
                        <article
                          key={lead.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${getLeadTemperatureClass(
                                    lead.temperature
                                  )}`}
                                >
                                  {lead.temperature}
                                </span>

                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/45">
                                  {lead.status}
                                </span>

                                {isSent ? (
                                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-100">
                                    Sent
                                  </span>
                                ) : null}
                              </div>

                              <h4 className="mt-3 text-sm font-bold text-white">
                                {lead.title}
                              </h4>

                              <p className="mt-1 text-sm leading-6 text-white/55">
                                {lead.description}
                              </p>

                              {lead.suggestedOpener ? (
                                <div className="mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/10 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-100/75">
                                    Suggested opener
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-white/60">
                                    {lead.suggestedOpener}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            {lead.temperature === "cold" ? (
                              <button
                                type="button"
                                disabled
                                className="w-fit cursor-not-allowed rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-semibold text-cyan-200/60"
                              >
                                {getLeadActionLabel(lead.temperature)}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => sendLeadToContactManager(lead)}
                                disabled={isSending || isSent}
                                className="w-fit rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSent
                                  ? "Sent to Contact Manager"
                                  : isSending
                                    ? "Sending..."
                                    : getLeadActionLabel(lead.temperature)}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                    <p className="text-sm font-bold text-white">
                      {isLoadingOverview
                        ? "Loading leads..."
                        : `No ${
                            activeLeadFilter === "all" ? "" : activeLeadFilter
                          } leads yet`}
                    </p>

                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/45">
                      Real leads and signals from {activeSource.title} will
                      appear here when connected data exists. Autoaffi will not
                      show fake leads or demo activity.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeSource.actionHref ? (
            <div className="mt-5">
              <Link
                href={activeSource.actionHref}
                className="inline-flex rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
              >
                {activeSource.actionLabel ?? "Open source"} →
              </Link>
            </div>
          ) : activeSource.actionLabel ? (
            <div className="mt-5">
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/35"
              >
                {activeSource.actionLabel}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}