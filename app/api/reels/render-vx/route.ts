import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type MediaType = "mixed" | "video" | "stills";
type OfferMode = "product" | "recurring" | "funnel";
type WorkerRole = "hook" | "problem" | "solution" | "payoff" | "proof" | "generic";
type RenderJobStatus = "queued" | "processing" | "completed" | "failed";

type LooseRecord = Record<string, unknown>;

type MediaItem = {
  source?: string;
  url?: string;
  src?: string;
  link?: string;
  thumb?: string;
  duration?: number;
  type?: string;
  title?: string;
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  filesize?: number;
  fileSize?: number;
  size?: number;
  mimeType?: string;
  mime_type?: string;
  contentType?: string;
  content_type?: string;
  format?: string;
  kind?: string;
  assetType?: string;
  asset_type?: string;
  fileUrl?: string;
  file_url?: string;
  videoUrl?: string;
  video_url?: string;
  imageUrl?: string;
  image_url?: string;
  directUrl?: string;
  direct_url?: string;
  downloadUrl?: string;
  download_url?: string;
  path?: string;
  file?: {
    url?: string;
    src?: string;
    width?: number;
    height?: number;
    size?: number;
    mimeType?: string;
    mime_type?: string;
    contentType?: string;
    content_type?: string;
    [key: string]: unknown;
  };
  video?: {
    url?: string;
    src?: string;
    width?: number;
    height?: number;
    mimeType?: string;
    mime_type?: string;
    contentType?: string;
    content_type?: string;
    [key: string]: unknown;
  };
  image?: {
    url?: string;
    src?: string;
    width?: number;
    height?: number;
    mimeType?: string;
    mime_type?: string;
    contentType?: string;
    content_type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type MediaFetchResponse = {
  results?: MediaItem[];
  combined?: MediaItem[];
  items?: MediaItem[];
};

type OfferMeta = {
  name: string;
  mode: OfferMode;
  category: string;
  commissionRate: string;
  affiliateUrl: string;
  epc?: number;
};

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  let out = n;
  if (typeof min === "number") out = Math.max(min, out);
  if (typeof max === "number") out = Math.min(max, out);
  return out;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function normalizeMediaType(value: unknown): MediaType {
  const v = normalizeText(value, "mixed").toLowerCase();
  if (v === "video") return "video";
  if (v === "stills") return "stills";
  return "mixed";
}

function getSafeOfferMode(mode?: unknown): OfferMode {
  const m = normalizeText(mode, "recurring").toLowerCase();
  if (m === "product" || m === "funnel") return m;
  return "recurring";
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return "";
  }
}

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function createRenderJobId(): string {
  return `vx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function resolveJobId(body: LooseRecord): string {
  const renderHints = asRecord(body.renderHints);

  return (
    normalizeText(body.jobId, "") ||
    normalizeText(body.jobID, "") ||
    normalizeText(body.renderJobId, "") ||
    normalizeText(renderHints.jobId, "") ||
    normalizeText(renderHints.jobID, "") ||
    normalizeText(renderHints.renderJobId, "") ||
    createRenderJobId()
  );
}

async function upsertRenderJob(params: {
  jobId: string;
  status: RenderJobStatus;
  progress?: number;
  errorMessage?: string | null;
  videoUrl?: string | null;
  offerMode?: string | null;
  offerName?: string | null;
  offerCategory?: string | null;
  renderPayload?: unknown;
  workerResponse?: unknown;
}) {
  try {
    const db = supabaseAdmin();

    const payload: Record<string, unknown> = {
      job_id: params.jobId,
      status: params.status,
      progress:
        typeof params.progress === "number"
          ? Math.max(0, Math.min(100, Math.round(params.progress)))
          : params.status === "completed"
          ? 100
          : params.status === "processing"
          ? 10
          : 0,
      error_message: params.errorMessage ?? null,
      video_url: params.videoUrl ?? null,
      offer_mode: params.offerMode ?? null,
      offer_name: params.offerName ?? null,
      offer_category: params.offerCategory ?? null,
      render_payload: params.renderPayload ?? null,
      worker_response: params.workerResponse ?? null,
      completed_at: params.status === "completed" ? new Date().toISOString() : null,
    };

    const { error } = await db
      .from("render_jobs")
      .upsert(payload, { onConflict: "job_id" });

    if (error) {
      console.error("[RENDER-VX ROUTE] upsertRenderJob error:", error);
    }
  } catch (error) {
    console.error("[RENDER-VX ROUTE] upsertRenderJob crash:", error);
  }
}

function normalizeWorkerRole(value: unknown): WorkerRole | null {
  const v = normalizeText(value, "").toLowerCase();
  if (
    v === "hook" ||
    v === "problem" ||
    v === "solution" ||
    v === "payoff" ||
    v === "proof" ||
    v === "generic"
  ) {
    return v;
  }
  return null;
}

function resolveOfferMeta(body: LooseRecord): OfferMeta {
  const raw = asRecord(body.offerMeta ?? body.selectedOffer ?? null);

  const epcRaw = raw.epc;
  const epc =
    typeof epcRaw === "number"
      ? epcRaw
      : Number.isFinite(Number(epcRaw))
      ? Number(epcRaw)
      : undefined;

  return {
    name: normalizeText(raw.name, ""),
    mode: getSafeOfferMode(raw.mode),
    category: normalizeText(raw.category, ""),
    commissionRate: normalizeText(raw.commissionRate, ""),
    affiliateUrl: normalizeText(raw.affiliateUrl, ""),
    epc,
  };
}

function isFreedomStyleGenre(
  genre: string,
  storyText: string,
  offerName: string,
  category: string
): boolean {
  const blob = `${genre} ${storyText} ${offerName} ${category}`.toLowerCase();

  return [
    "freedom",
    "financial freedom",
    "passive income",
    "income",
    "recurring",
    "lifestyle",
    "luxury",
    "travel",
    "motivation",
    "mindset",
    "success",
    "remote",
    "remote work",
    "work from anywhere",
    "entrepreneur",
    "digital freedom",
    "creator",
    "online business",
    "make money",
    "money online",
    "escape",
    "leave your job",
    "digital nomad",
  ].some((term) => blob.includes(term));
}

function isFreedomRecurringStory(params: {
  genre: string;
  storyText: string;
  offerMeta: OfferMeta;
}): boolean {
  return (
    params.offerMeta.mode === "recurring" &&
    isFreedomStyleGenre(
      params.genre,
      params.storyText,
      params.offerMeta.name,
      params.offerMeta.category
    )
  );
}

function isFreedomRecurringStoryFromContext(params: {
  offerMode: OfferMode;
  storyText: string;
  offerName?: string;
  offerCategory?: string;
  genre?: string;
}): boolean {
  return (
    params.offerMode === "recurring" &&
    isFreedomStyleGenre(
      normalizeText(params.genre, ""),
      normalizeText(params.storyText, ""),
      normalizeText(params.offerName, ""),
      normalizeText(params.offerCategory, "")
    )
  );
}

function buildMediaQuery(params: {
  genre: string;
  title: string;
  caption: string;
  storyText: string;
  offerMeta: OfferMeta;
}): string {
  const genre = normalizeText(params.genre, "motivation");
  const title = normalizeText(params.title, "");
  const caption = normalizeText(params.caption, "");
  const storyText = normalizeText(params.storyText, "");
  const offerName = normalizeText(params.offerMeta?.name, "");
  const category = normalizeText(params.offerMeta?.category, "");
  const mode = getSafeOfferMode(params.offerMeta?.mode);

  const freedomStyle = isFreedomStyleGenre(genre, storyText, offerName, category);

  if (mode === "product") {
    return (
      `${offerName} ${category} product demo commercial ugc lifestyle creator hands use case result transformation before after review showcase modern premium closeup customer experience social media`
        .replace(/\s+/g, " ")
        .trim() ||
      `${genre} product demo lifestyle creator`
    );
  }

  if (mode === "funnel") {
    return (
      `${offerName} landing page sales funnel conversion lead generation email marketing checkout ads creator workspace marketing dashboard business growth analytics crm campaign performance premium laptop founder strategy`
        .replace(/\s+/g, " ")
        .trim() ||
      "landing page sales funnel conversion marketing dashboard creator workspace premium"
    );
  }

  if (freedomStyle) {
    return (
      `beach ocean sunset sunrise mountain forest tropical island coast scenic nature travel luxury lifestyle digital nomad remote entrepreneur work from anywhere freedom premium laptop lifestyle`
        .replace(/\s+/g, " ")
        .trim() ||
      `${genre} beach ocean sunset sunrise mountain nature travel luxury lifestyle digital nomad`
    );
  }

  return (
    `${offerName} saas dashboard automation business marketing creator digital growth premium laptop office workspace analytics remote work`
      .replace(/\s+/g, " ")
      .trim() ||
    title ||
    caption ||
    storyText ||
    genre
  );
}

function buildFreedomNatureQuery(params: {
  genre: string;
  storyText: string;
  offerMeta: OfferMeta;
}): string {
  const genre = normalizeText(params.genre, "motivation");

  return (
    `beach ocean sunset sunrise mountain forest tropical island coast scenic nature travel luxury lifestyle digital nomad remote entrepreneur work from anywhere freedom premium laptop lifestyle`
      .replace(/\s+/g, " ")
      .trim() || `${genre} beach ocean sunset sunrise mountain scenic nature travel luxury lifestyle`
  );
}

function buildProductWowQuery(params: {
  genre: string;
  storyText: string;
  offerMeta: OfferMeta;
}): string {
  const genre = normalizeText(params.genre, "motivation");
  const offerName = normalizeText(params.offerMeta?.name, "");
  const category = normalizeText(params.offerMeta?.category, "");

  return (
    `${offerName} ${category} product demo hands holding showcase closeup review use case creator ugc lifestyle premium commercial results transformation before after customer testimonial`
      .replace(/\s+/g, " ")
      .trim() || `${genre} product demo creator lifestyle`
  );
}

function buildFunnelWowQuery(params: {
  genre: string;
  storyText: string;
  offerMeta: OfferMeta;
}): string {
  const genre = normalizeText(params.genre, "motivation");
  const offerName = normalizeText(params.offerMeta?.name, "");
  const category = normalizeText(params.offerMeta?.category, "");

  return (
    `${offerName} ${category} landing page sales funnel conversion lead generation dashboard analytics marketing campaign workspace founder strategy premium crm email marketing checkout`
      .replace(/\s+/g, " ")
      .trim() || `${genre} landing page sales funnel conversion dashboard`
  );
}

function resolveMediaUrl(item: MediaItem | null | undefined): string | null {
  if (!item || typeof item !== "object") return null;

  const candidates = [
    item.url,
    item.src,
    item.link,
    item.fileUrl,
    item.file_url,
    item.videoUrl,
    item.video_url,
    item.imageUrl,
    item.image_url,
    item.directUrl,
    item.direct_url,
    item.downloadUrl,
    item.download_url,
    item.path,
    item.file?.url,
    item.file?.src,
    item.video?.url,
    item.video?.src,
    item.image?.url,
    item.image?.src,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.trim();
  }
}

function dedupeMedia(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const out: MediaItem[] = [];

  for (const item of items) {
    const url = resolveMediaUrl(item);
    if (!url) continue;

    const key = canonicalizeUrl(url);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

function hashString(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed || 1;

  const nextRand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function buildRenderVariantSeed(
  body: LooseRecord,
  offerMeta: OfferMeta,
  storyText: string
): number {
  const seedBlob = [
    Date.now(),
    Math.random(),
    normalizeText(body.storySeed, ""),
    normalizeText(body.title, ""),
    normalizeText(body.caption, ""),
    normalizeText(body.genre, ""),
    offerMeta.name,
    offerMeta.mode,
    offerMeta.category,
    storyText.slice(0, 300),
  ].join("|");

  return hashString(seedBlob);
}

function seededScoreJitter(item: MediaItem, seed: number): number {
  const url = resolveMediaUrl(item) || safeJsonStringify(item);
  const source = normalizeText(item.source, "");
  const h = hashString(`${seed}|${source}|${url}`);
  return (h % 1000) / 100000;
}

function getMediaMetaBlob(item: MediaItem): string {
  const parts = [
    item.type,
    item.kind,
    item.format,
    item.assetType,
    item.asset_type,
    item.mimeType,
    item.mime_type,
    item.contentType,
    item.content_type,
    item.file?.mimeType,
    item.file?.mime_type,
    item.file?.contentType,
    item.file?.content_type,
    item.video?.mimeType,
    item.video?.mime_type,
    item.video?.contentType,
    item.video?.content_type,
    item.image?.mimeType,
    item.image?.mime_type,
    item.image?.contentType,
    item.image?.content_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return `${parts} ${safeJsonStringify(item).toLowerCase()}`;
}

function classifyMediaType(item: MediaItem): "video" | "image" | "unknown" {
  const url = (resolveMediaUrl(item) || "").toLowerCase();
  const explicitType = String(item.type || "").toLowerCase();
  const meta = getMediaMetaBlob(item);

  const hasVideoNode = !!(item.video?.url || item.video?.src);
  const hasImageNode = !!(item.image?.url || item.image?.src);

  if (
    explicitType === "video" ||
    hasVideoNode ||
    meta.includes("video/mp4") ||
    meta.includes("video/quicktime") ||
    meta.includes("video/webm") ||
    meta.includes("video/") ||
    meta.includes('"type":"video"') ||
    meta.includes('"kind":"video"') ||
    meta.includes('"assettype":"video"') ||
    meta.includes('"asset_type":"video"') ||
    url.includes(".mp4") ||
    url.includes(".mov") ||
    url.includes(".webm") ||
    url.includes(".mkv") ||
    url.includes(".m4v")
  ) {
    return "video";
  }

  if (
    explicitType === "image" ||
    hasImageNode ||
    meta.includes("image/jpeg") ||
    meta.includes("image/jpg") ||
    meta.includes("image/png") ||
    meta.includes("image/webp") ||
    meta.includes("image/") ||
    meta.includes('"type":"image"') ||
    meta.includes('"kind":"image"') ||
    meta.includes('"assettype":"image"') ||
    meta.includes('"asset_type":"image"') ||
    url.includes(".jpg") ||
    url.includes(".jpeg") ||
    url.includes(".png") ||
    url.includes(".webp") ||
    url.includes(".gif")
  ) {
    return "image";
  }

  return "unknown";
}

function isReasonableForWorker(item: MediaItem): boolean {
  const width = Number(
    item.width ?? item.video?.width ?? item.file?.width ?? item.image?.width ?? 0
  );
  const height = Number(
    item.height ?? item.video?.height ?? item.file?.height ?? item.image?.height ?? 0
  );
  const fileSize = Number(item.filesize ?? item.fileSize ?? item.size ?? item.file?.size ?? 0);
  const duration = Number(item.duration ?? 0);
  const url = resolveMediaUrl(item);
  const mediaType = classifyMediaType(item);

  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (width > 0 && width < 200) return false;
  if (height > 0 && height < 200) return false;
  if (width >= 9000 || height >= 9000) return false;
  if (fileSize >= 250 * 1024 * 1024) return false;

  if (mediaType === "video") {
    if (duration > 0 && duration < 2) return false;
    if (duration > 120) return false;
  }

  return true;
}

function extractUrlHints(item: MediaItem): string {
  const candidates = [
    resolveMediaUrl(item),
    item.thumb,
    item.file?.url,
    item.video?.url,
    item.image?.url,
  ].filter(Boolean) as string[];

  const parts: string[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const pathname = parsed.pathname
        .toLowerCase()
        .replace(/[^a-z0-9/_-]/g, " ")
        .replace(/[_/.-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (pathname) parts.push(pathname);
    } catch {
      continue;
    }
  }

  return parts.join(" ");
}

function buildMediaBlob(item: MediaItem): string {
  const title = normalizeText(item.title, "").toLowerCase();
  const description = normalizeText(item.description, "").toLowerCase();
  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => normalizeText(t, "").toLowerCase()).join(" ")
    : "";
  const source = normalizeText(item.source, "").toLowerCase();
  const explicitType = normalizeText(item.type, "").toLowerCase();
  const kind = normalizeText(item.kind, "").toLowerCase();
  const format = normalizeText(item.format, "").toLowerCase();
  const assetType = normalizeText(item.assetType ?? item.asset_type, "").toLowerCase();
  const autoaffiHints = Array.isArray((item as LooseRecord).autoaffiHints)
    ? ((item as LooseRecord).autoaffiHints as unknown[])
        .map((v) => normalizeText(v, "").toLowerCase())
        .join(" ")
    : "";
  const semanticTags = Array.isArray((item as LooseRecord).semanticTags)
    ? ((item as LooseRecord).semanticTags as unknown[])
        .map((v) => normalizeText(v, "").toLowerCase())
        .join(" ")
    : "";
  const semanticText = normalizeText((item as LooseRecord).semanticText, "").toLowerCase();
  const autoaffiRole = normalizeText((item as LooseRecord).autoaffiRole, "").toLowerCase();
  const urlHints = extractUrlHints(item);

  return [
    title,
    description,
    tags,
    source,
    explicitType,
    kind,
    format,
    assetType,
    autoaffiHints,
    semanticTags,
    semanticText,
    autoaffiRole,
    urlHints,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasStrongNatureScene(text: string): boolean {
  return [
    "beach",
    "ocean",
    "sea",
    "sunrise",
    "sunset",
    "mountain",
    "forest",
    "travel",
    "road trip",
    "outdoor",
    "scenic",
    "island",
    "coast",
    "waves",
    "skyline",
    "sky",
    "palm",
    "cliff",
    "lake",
    "river",
    "waterfall",
    "shore",
    "tropical",
    "horizon",
    "nature",
    "shoreline",
    "seaside",
    "coastal",
  ].some((term) => text.includes(term));
}

function hasFreedomLifestyleSignal(text: string): boolean {
  return [
    "freedom",
    "financial freedom",
    "remote work",
    "work from anywhere",
    "travel",
    "lifestyle",
    "luxury",
    "entrepreneur",
    "success",
    "digital nomad",
    "creator",
    "premium",
    "laptop lifestyle",
    "travel lifestyle",
    "remote entrepreneur",
    "passive income",
    "online business",
    "independence",
    "escape 9 5",
    "escape the 9 5",
  ].some((term) => text.includes(term));
}

function hasFreedomJourneySignal(text: string): boolean {
  return [
    "beach",
    "ocean",
    "sea",
    "sunset",
    "sunrise",
    "mountain",
    "forest",
    "island",
    "coast",
    "tropical",
    "travel",
    "scenic",
    "horizon",
    "digital nomad",
    "work from anywhere",
    "remote entrepreneur",
    "laptop lifestyle",
    "travel lifestyle",
    "luxury",
    "freedom",
    "coastal",
    "seaside",
    "shore",
  ].some((term) => text.includes(term));
}

function hasStrictFreedomRemoteBlend(text: string): boolean {
  const remoteSignals = [
    "remote work",
    "work from anywhere",
    "digital nomad",
    "remote entrepreneur",
    "travel lifestyle",
    "laptop lifestyle",
    "freedom",
    "luxury",
    "entrepreneur",
  ];

  return hasStrongNatureScene(text) && remoteSignals.some((term) => text.includes(term));
}

function isWeakNatureOnly(text: string): boolean {
  return [
    "plant",
    "cactus",
    "pot plant",
    "flower pot",
    "desk plant",
    "table plant",
    "leaf",
    "indoor plant",
  ].some((term) => text.includes(term));
}

function hasBusinessBridge(text: string): boolean {
  return [
    "laptop",
    "computer",
    "workspace",
    "remote work",
    "business",
    "entrepreneur",
    "startup",
    "founder",
    "digital",
    "creator",
    "desk",
    "office",
    "analytics",
    "dashboard",
    "software",
    "marketing",
    "team",
    "workflow",
    "screen",
    "strategy",
    "campaign",
    "saas",
    "automation",
  ].some((term) => text.includes(term));
}

function hasHardOfficeSignal(text: string): boolean {
  return [
    "office",
    "meeting",
    "team",
    "teamwork",
    "corporate",
    "programmer",
    "developer",
    "engineer",
    "monitor",
    "analytics",
    "dashboard",
    "workspace",
    "workplace",
    "typing",
    "keyboard",
    "desktop",
    "students",
    "student",
    "course",
    "class",
    "teacher",
    "teaching",
    "interactive data analysis",
    "office interior",
    "interior",
    "room",
    "job",
    "company",
    "marketing project business",
    "businesswoman",
    "business woman",
    "specialist",
    "executive",
    "brainstorming",
    "discussion",
    "collaborative",
    "software development",
    "coding",
    "coding session",
    "code",
    "macbook",
    "tablet data",
    "data graph",
    "data visualization",
    "indoor setting",
    "seated in a modern indoor setting",
    "research and calculations",
    "professional",
    "communication",
  ].some((term) => text.includes(term));
}

function hasProductBridge(text: string): boolean {
  return [
    "product",
    "demo",
    "hands",
    "holding",
    "device",
    "phone",
    "showcase",
    "closeup",
    "review",
    "unboxing",
    "use case",
    "customer",
    "lifestyle",
    "creator",
    "ugc",
    "commercial",
    "results",
    "transformation",
    "before after",
    "before and after",
  ].some((term) => text.includes(term));
}

function hasFunnelBridge(text: string): boolean {
  return [
    "landing page",
    "sales funnel",
    "sales page",
    "conversion",
    "lead generation",
    "lead magnet",
    "email marketing",
    "checkout",
    "campaign",
    "crm",
    "dashboard",
    "analytics",
    "workspace",
    "laptop",
    "founder",
    "strategy",
    "marketing",
    "performance marketing",
  ].some((term) => text.includes(term));
}

function scoreMatches(list: string[], combined: string, points: number): number {
  let score = 0;
  for (const term of list) {
    if (combined.includes(term)) score += points;
  }
  return score;
}

function blobHasAny(blob: string, terms: string[]): boolean {
  return terms.some((term) => blob.includes(term));
}

function isNatureFreedomMedia(item: MediaItem): boolean {
  const blob = buildMediaBlob(item);

  const negative = [
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "injection",
    "hospital",
    "doctor",
    "medical",
    "surgery",
    "patient",
    "clinic",
    "operating room",
    "lab",
    "restaurant",
    "brunch",
    "cocktail",
    "bar",
    "meal",
    "plates",
    "waiter",
    "meeting",
    "teamwork",
    "analytics",
    "dashboard",
    "coding",
    "software development",
    "interactive data analysis",
    "office interior",
    "indoor setting",
    "seated in a modern indoor setting",
  ];

  if (blobHasAny(blob, negative)) return false;
  if (isWeakNatureOnly(blob) && !hasStrongNatureScene(blob)) return false;
  if (hasHardOfficeSignal(blob)) return false;

  return hasStrongNatureScene(blob) && hasFreedomLifestyleSignal(blob);
}

function isStrictFreedomRecurringAsset(item: MediaItem): boolean {
  const blob = buildMediaBlob(item);

  if (isNatureFreedomMedia(item)) return true;
  if (hasStrictFreedomRemoteBlend(blob) && !hasHardOfficeSignal(blob)) return true;

  if (
    hasStrongNatureScene(blob) &&
    blobHasAny(blob, [
      "travel",
      "luxury",
      "lifestyle",
      "digital nomad",
      "remote work",
      "work from anywhere",
      "freedom",
      "entrepreneur",
      "premium",
    ]) &&
    !hasHardOfficeSignal(blob)
  ) {
    return true;
  }

  return false;
}

function isBlockedFreedomRecurringAsset(item: MediaItem): boolean {
  const blob = buildMediaBlob(item);

  if (isStrictFreedomRecurringAsset(item)) return false;

  if (
    blobHasAny(blob, [
      "office",
      "business",
      "team",
      "teamwork",
      "meeting",
      "brainstorming",
      "discussion",
      "dashboard",
      "analytics",
      "data visualization",
      "data graph",
      "tablet data",
      "coding",
      "software development",
      "programmer",
      "developer",
      "engineer",
      "workspace",
      "workplace",
      "monitor",
      "macbook",
      "keyboard",
      "typing",
      "indoor setting",
      "seated in a modern indoor setting",
      "research and calculations",
      "specialist",
      "executive",
      "professional",
      "communication",
      "company",
      "class",
      "teacher",
      "teaching",
      "student",
      "course",
      "interactive data analysis",
    ])
  ) {
    return true;
  }

  return false;
}

function isFreedomRecurringPenaltyMedia(item: MediaItem): boolean {
  return isBlockedFreedomRecurringAsset(item);
}

function scoreMediaForStory(
  item: MediaItem,
  storyText: string,
  offerMode: OfferMode,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): number {
  const combined = `${buildMediaBlob(item)} ${storyText.toLowerCase()}`;

  let score = 0;
  const mediaType = classifyMediaType(item);
  const duration = Number(item.duration ?? 0);
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  if (mediaType === "video") score += 30;
  if (mediaType === "image") score += 8;
  if (mediaType === "unknown") score -= 6;

  if (mediaType === "video") {
    if (duration >= 4 && duration <= 18) score += 15;
    else if (duration > 18 && duration <= 35) score += 8;
    else if (duration > 35) score -= 4;
  }

  const generalStrongPositive = [
    "ai",
    "automation",
    "digital",
    "tech",
    "technology",
    "software",
    "business",
    "startup",
    "office",
    "laptop",
    "computer",
    "screen",
    "dashboard",
    "analytics",
    "marketing",
    "creator",
    "content",
    "social media",
    "growth",
    "productivity",
    "remote work",
    "entrepreneur",
    "success",
    "freedom",
    "travel",
    "luxury",
    "lifestyle",
    "phone",
    "premium",
    "workspace",
    "remote",
    "online business",
  ];

  const generalSoftPositive = [
    "sunrise",
    "sunset",
    "beach",
    "ocean",
    "mountain",
    "nature",
    "sky",
    "workspace",
    "typing",
    "team",
    "meeting",
    "mobile",
    "coffee shop",
    "city",
    "urban",
    "walk",
    "driving",
    "airport",
    "hotel",
    "window light",
    "freelancer",
    "creator lifestyle",
  ];

  const generalNegative = [
    "cartoon",
    "toy",
    "cute",
    "flower",
    "leaf",
    "food",
    "kitchen closeup",
    "wedding",
    "medical",
    "surgery",
    "cemetery",
    "horror",
    "animal",
    "painting",
    "abstract",
    "lantern",
    "tea table",
    "child toy",
    "game character",
    "fantasy",
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "hospital",
    "doctor",
    "patient",
    "clinic",
    "operating room",
    "laboratory",
    "lab",
    "mask closeup",
  ];

  const productPositive = [
    "product",
    "unboxing",
    "demo",
    "review",
    "showcase",
    "hands",
    "holding",
    "phone",
    "device",
    "commercial",
    "result",
    "results",
    "transformation",
    "before and after",
    "before after",
    "closeup",
    "lifestyle",
    "use case",
    "creator",
    "ugc",
    "testimonial",
    "customer",
    "workflow",
    "setup",
  ];

  const recurringPositive = [
    "saas",
    "subscription",
    "laptop",
    "screen",
    "automation",
    "business software",
    "remote work",
    "founder",
    "startup",
    "coffee shop",
    "travel",
    "freedom",
    "lifestyle",
    "luxury",
    "beach",
    "sunrise",
    "sunset",
    "ocean",
    "mountain",
    "nature",
    "city",
    "entrepreneur",
    "passive income",
    "online business",
    "work from anywhere",
    "digital nomad",
    "island",
    "coast",
    "forest",
    "scenic",
    "tropical",
    "premium",
  ];

  const recurringFreedomNegative = [
    "meeting",
    "teamwork",
    "network",
    "job seeker",
    "career",
    "course",
    "student",
    "intern",
    "trainee",
    "teacher",
    "teaching",
    "online class",
    "online lesson",
    "keyboard",
    "typing",
    "desktop",
    "office interior",
    "interior",
    "analytics",
    "dashboard",
    "office",
    "workspace",
    "programmer",
    "developer",
    "engineer",
    "monitor",
    "workplace",
    "business woman",
    "businesswoman",
    "communication",
    "corporate",
    "interactive data analysis",
    "team",
    "room",
    "company",
    "students",
    "software development",
    "coding",
    "coding session",
    "tablet data",
    "data graph",
    "data visualization",
    "indoor setting",
    "seated in a modern indoor setting",
  ];

  const funnelPositive = [
    "landing page",
    "sales funnel",
    "sales page",
    "conversion",
    "lead generation",
    "marketing dashboard",
    "analytics",
    "campaign",
    "crm",
    "email marketing",
    "email sequence",
    "checkout",
    "ads",
    "business growth",
    "performance marketing",
    "laptop",
    "screen",
    "creator",
    "workspace",
    "lead magnet",
    "founder",
    "strategy",
    "campaign manager",
    "dashboard",
  ];

  const productNegative = [
    "dashboard",
    "spreadsheet",
    "analytics only",
    "office meeting",
    "team presentation",
    "landing page",
    "sales funnel",
    "checkout only",
    "crm",
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "hospital",
    "doctor",
    "patient",
    "clinic",
    "medical",
  ];

  const recurringNegative = [
    "kitchen product",
    "beauty tutorial",
    "makeup closeup",
    "food plate",
    "toy product",
    "pet closeup",
    "random product closeup only",
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "hospital",
    "doctor",
    "patient",
    "clinic",
    "surgery",
    "medical",
  ];

  const funnelNegative = [
    "nature only",
    "beach only",
    "mountain only",
    "random lifestyle only",
    "product closeup only",
    "unboxing only",
    "demo only",
    "vaccine",
    "vaccination",
    "syringe",
    "needle",
    "hospital",
    "doctor",
    "patient",
    "clinic",
    "medical",
  ];

  score += scoreMatches(generalStrongPositive, combined, 10);
  score += scoreMatches(generalSoftPositive, combined, 5);
  score -= scoreMatches(generalNegative, combined, 18);

  if (offerMode === "product") {
    score += scoreMatches(productPositive, combined, 13);
    score -= scoreMatches(productNegative, combined, 12);

    if (hasProductBridge(combined) && mediaType === "video") score += 10;
  }

  if (offerMode === "recurring") {
    score += scoreMatches(recurringPositive, combined, 13);
    score -= scoreMatches(recurringNegative, combined, 14);

    if (isNatureFreedomMedia(item)) {
      score += 22;
      if (mediaType === "video") score += 12;
    }

    if (freedomStory) {
      if (hasStrongNatureScene(combined)) score += 55;
      if (hasFreedomLifestyleSignal(combined)) score += 40;
      if (hasFreedomJourneySignal(combined)) score += 36;
      if (isNatureFreedomMedia(item)) score += 85;
      if (isStrictFreedomRecurringAsset(item)) score += 120;

      if (
        blobHasAny(combined, [
          "beach",
          "ocean",
          "sunset",
          "sunrise",
          "mountain",
          "forest",
          "island",
          "coast",
          "tropical",
          "scenic",
          "travel",
        ])
      ) {
        score += 45;
      }

      if (
        blobHasAny(combined, [
          "digital nomad",
          "luxury lifestyle",
          "travel lifestyle",
          "work from anywhere",
          "remote entrepreneur",
          "laptop lifestyle",
        ])
      ) {
        score += 34;
      }

      score -= scoreMatches(recurringFreedomNegative, combined, 28);

      if (isFreedomRecurringPenaltyMedia(item)) {
        score -= 220;
      }

      if (
        blobHasAny(combined, [
          "office",
          "meeting",
          "team",
          "analytics",
          "dashboard",
          "workspace",
          "keyboard",
          "typing",
          "programmer",
          "developer",
          "monitor",
          "students",
          "class",
          "coding",
          "software development",
          "tablet data",
          "data graph",
          "data visualization",
        ]) &&
        !isStrictFreedomRecurringAsset(item)
      ) {
        score -= 180;
      }
    }
  }

  if (offerMode === "funnel") {
    score += scoreMatches(funnelPositive, combined, 13);
    score -= scoreMatches(funnelNegative, combined, 12);

    if (hasFunnelBridge(combined) && mediaType === "video") score += 10;
  }

  return score;
}

function pickBestByTerms(
  scored: Array<{ item: MediaItem; score: number }>,
  terms: string[],
  seen: Set<string>
): MediaItem | undefined {
  return scored.find((x) => {
    const blob = buildMediaBlob(x.item);
    const url = resolveMediaUrl(x.item);
    const key = url ? canonicalizeUrl(url) : null;

    if (!url || !key || seen.has(key)) return false;
    return terms.some((term) => blob.includes(term));
  })?.item;
}

function pickBestNatureFreedomMedia(
  scored: Array<{ item: MediaItem; score: number }>,
  seen: Set<string>,
  preferVideo = true
): MediaItem | undefined {
  const filtered = scored.filter((x) => {
    const url = resolveMediaUrl(x.item);
    const key = url ? canonicalizeUrl(url) : null;
    if (!url || !key || seen.has(key)) return false;
    return isStrictFreedomRecurringAsset(x.item);
  });

  if (preferVideo) {
    return (
      filtered.find((x) => classifyMediaType(x.item) === "video")?.item ||
      filtered[0]?.item
    );
  }

  return filtered[0]?.item;
}

function pickStoryDrivenMedia(
  items: MediaItem[],
  storyText: string,
  offerMode: OfferMode,
  maxItems = 4,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  },
  variantSeed = 1
): MediaItem[] {
  const unique = shuffleDeterministic(dedupeMedia(items), variantSeed);
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  const scored = unique
    .map((item, index) => ({
      item,
      index,
      score:
        scoreMediaForStory(item, storyText, offerMode, context) +
        index * 0.0001 +
        seededScoreJitter(item, variantSeed),
    }))
    .sort((a, b) => b.score - a.score);

  const videos = scored
    .filter((x) => classifyMediaType(x.item) === "video")
    .map((x) => x.item);

  const images = scored
    .filter((x) => classifyMediaType(x.item) === "image")
    .map((x) => x.item);

  const selected: MediaItem[] = [];
  const seen = new Set<string>();

  const tryPush = (item?: MediaItem) => {
    if (!item) return;
    const url = resolveMediaUrl(item);
    if (!url) return;

    const key = canonicalizeUrl(url);
    if (seen.has(key)) return;

    seen.add(key);
    selected.push(item);
  };

  if (offerMode === "product") {
    tryPush(
      pickBestByTerms(
        scored,
        [
          "product",
          "demo",
          "showcase",
          "hands",
          "holding",
          "phone",
          "device",
          "commercial",
          "closeup",
          "use case",
          "review",
          "ugc",
        ],
        seen
      )
    );

    tryPush(
      pickBestByTerms(
        scored,
        [
          "results",
          "result",
          "transformation",
          "before and after",
          "before after",
          "testimonial",
          "customer",
        ],
        seen
      )
    );

    tryPush(
      pickBestByTerms(
        scored,
        ["workflow", "setup", "modern", "premium", "social media creator"],
        seen
      )
    );
  }

  if (offerMode === "recurring") {
    if (freedomStory) {
      tryPush(
        pickBestByTerms(
          scored,
          [
            "beach",
            "ocean",
            "sunset",
            "sunrise",
            "mountain",
            "forest",
            "island",
            "coast",
            "tropical",
            "nature",
            "scenic",
            "travel",
          ],
          seen
        )
      );

      tryPush(
        pickBestByTerms(
          scored,
          [
            "digital nomad",
            "luxury",
            "lifestyle",
            "work from anywhere",
            "remote entrepreneur",
            "travel lifestyle",
            "laptop lifestyle",
            "premium",
            "freedom",
            "entrepreneur",
          ],
          seen
        )
      );

      tryPush(pickBestNatureFreedomMedia(scored, seen, true));
      tryPush(pickBestNatureFreedomMedia(scored, seen, false));
    } else {
      tryPush(
        pickBestByTerms(
          scored,
          [
            "dashboard",
            "saas",
            "automation",
            "software",
            "laptop",
            "computer",
            "office",
            "analytics",
            "workspace",
          ],
          seen
        )
      );

      tryPush(
        pickBestByTerms(
          scored,
          [
            "freedom",
            "travel",
            "beach",
            "ocean",
            "sunset",
            "sunrise",
            "luxury",
            "lifestyle",
            "coffee shop",
            "city",
            "remote work",
            "entrepreneur",
          ],
          seen
        )
      );

      tryPush(pickBestNatureFreedomMedia(scored, seen, true));
    }
  }

  if (offerMode === "funnel") {
    tryPush(
      pickBestByTerms(
        scored,
        [
          "landing page",
          "sales funnel",
          "sales page",
          "conversion",
          "lead generation",
          "marketing",
          "campaign",
          "analytics",
          "dashboard",
          "checkout",
          "ads",
          "crm",
          "lead magnet",
          "email marketing",
        ],
        seen
      )
    );

    tryPush(
      pickBestByTerms(
        scored,
        [
          "workspace",
          "laptop",
          "creator",
          "business growth",
          "performance marketing",
          "founder",
          "strategy",
          "campaign manager",
        ],
        seen
      )
    );

    tryPush(
      pickBestByTerms(
        scored,
        ["dashboard", "screen", "office", "computer", "team", "meeting"],
        seen
      )
    );
  }

  if (!freedomStory) {
    tryPush(
      pickBestByTerms(
        scored,
        ["office", "work", "laptop", "computer", "stress", "phone", "screen", "workspace", "typing"],
        seen
      )
    );

    tryPush(
      pickBestByTerms(
        scored,
        ["ai", "automation", "software", "dashboard", "analytics", "business", "marketing", "startup", "creator"],
        seen
      )
    );
  }

  tryPush(
    pickBestByTerms(
      scored,
      [
        "freedom",
        "travel",
        "beach",
        "ocean",
        "sunset",
        "sunrise",
        "luxury",
        "lifestyle",
        "coffee shop",
        "city",
        "mountain",
        "nature",
        "remote work",
        "digital nomad",
      ],
      seen
    )
  );

  for (const item of shuffleDeterministic(videos, variantSeed + 17)) {
    if (selected.length >= maxItems) break;
    if (freedomStory && isFreedomRecurringPenaltyMedia(item)) continue;
    tryPush(item);
  }

  for (const item of shuffleDeterministic(images, variantSeed + 31)) {
    if (selected.length >= maxItems) break;
    if (freedomStory && isFreedomRecurringPenaltyMedia(item)) continue;
    tryPush(item);
  }

  for (const row of scored) {
    if (selected.length >= maxItems) break;
    if (freedomStory && isFreedomRecurringPenaltyMedia(row.item)) continue;
    tryPush(row.item);
  }

  if (
    offerMode === "recurring" &&
    !selected.some((item) => isStrictFreedomRecurringAsset(item))
  ) {
    tryPush(pickBestNatureFreedomMedia(scored, seen, true));
    tryPush(pickBestNatureFreedomMedia(scored, seen, false));
  }

  return selected.slice(0, maxItems);
}

function ensureNatureFreedomIncluded(
  items: MediaItem[],
  pool: MediaItem[],
  storyText: string,
  offerMode: OfferMode,
  maxItems: number,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  if (offerMode !== "recurring") return items;
  if (items.some((item) => isStrictFreedomRecurringAsset(item))) return items;

  const scoredPool = dedupeMedia(pool)
    .filter(isReasonableForWorker)
    .map((item, index) => ({
      item,
      index,
      score:
        scoreMediaForStory(item, storyText, offerMode, context) + index * 0.0001,
    }))
    .sort((a, b) => b.score - a.score);

  const candidate =
    scoredPool.find(
      (x) => classifyMediaType(x.item) === "video" && isStrictFreedomRecurringAsset(x.item)
    )?.item ||
    scoredPool.find((x) => isStrictFreedomRecurringAsset(x.item))?.item;

  if (!candidate) return items;

  const current = [...items];
  const existingKeys = new Set(
    current
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  const candidateUrl = resolveMediaUrl(candidate);
  if (!candidateUrl) return current;

  const candidateKey = canonicalizeUrl(candidateUrl);
  if (existingKeys.has(candidateKey)) return current;

  if (current.length >= maxItems) {
    const removableIndex = current.findIndex((item) => !isStrictFreedomRecurringAsset(item));
    if (removableIndex >= 0) {
      current.splice(removableIndex, 1, candidate);
      return current.slice(0, maxItems);
    }
  }

  current.push(candidate);
  return current.slice(0, maxItems);
}

function ensureFreedomRecurringBalance(
  items: MediaItem[],
  pool: MediaItem[],
  storyText: string,
  _mediaType: MediaType,
  maxItems: number,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode: "recurring",
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  if (!freedomStory) return items;

  let out = [...items].filter((item) => !isBlockedFreedomRecurringAsset(item));

  const currentKeys = new Set(
    out
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  const strictCandidates = dedupeMedia(pool)
    .filter(isReasonableForWorker)
    .filter((item) => {
      const url = resolveMediaUrl(item);
      if (!url) return false;
      const key = canonicalizeUrl(url);
      if (currentKeys.has(key)) return false;
      return isStrictFreedomRecurringAsset(item);
    })
    .sort(
      (a, b) =>
        scoreMediaForStory(b, storyText, "recurring", context) -
        scoreMediaForStory(a, storyText, "recurring", context)
    );

  const strongCount = out.filter((item) => isStrictFreedomRecurringAsset(item)).length;

  while (out.length < Math.min(maxItems, 4) && strictCandidates.length > 0) {
    const next = strictCandidates.shift();
    if (!next) break;
    out.push(next);
  }

  if (strongCount < 2) {
    const missing = 2 - out.filter((item) => isStrictFreedomRecurringAsset(item)).length;
    if (missing > 0) {
      for (const candidate of strictCandidates) {
        if (out.length >= maxItems) break;
        out.push(candidate);
      }
    }
  }

  return dedupeMedia(out).slice(0, maxItems);
}

function ensureProductWowIncluded(
  items: MediaItem[],
  pool: MediaItem[],
  storyText: string,
  offerMode: OfferMode,
  maxItems: number,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  if (offerMode !== "product") return items;
  if (items.some((item) => hasProductBridge(buildMediaBlob(item)))) return items;

  const scoredPool = dedupeMedia(pool)
    .filter(isReasonableForWorker)
    .map((item, index) => ({
      item,
      index,
      score:
        scoreMediaForStory(item, storyText, offerMode, context) + index * 0.0001,
    }))
    .sort((a, b) => b.score - a.score);

  const candidate =
    scoredPool.find(
      (x) =>
        classifyMediaType(x.item) === "video" &&
        hasProductBridge(buildMediaBlob(x.item))
    )?.item ||
    scoredPool.find((x) => hasProductBridge(buildMediaBlob(x.item)))?.item;

  if (!candidate) return items;

  const current = [...items];
  const existingKeys = new Set(
    current
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  const candidateUrl = resolveMediaUrl(candidate);
  if (!candidateUrl) return current;

  const candidateKey = canonicalizeUrl(candidateUrl);
  if (existingKeys.has(candidateKey)) return current;

  if (current.length >= maxItems) {
    const removableIndex = current.findIndex(
      (item) => !hasProductBridge(buildMediaBlob(item))
    );
    if (removableIndex >= 0) {
      current.splice(removableIndex, 1, candidate);
      return current.slice(0, maxItems);
    }
  }

  current.push(candidate);
  return current.slice(0, maxItems);
}

function ensureFunnelWowIncluded(
  items: MediaItem[],
  pool: MediaItem[],
  storyText: string,
  offerMode: OfferMode,
  maxItems: number,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  if (offerMode !== "funnel") return items;
  if (items.some((item) => hasFunnelBridge(buildMediaBlob(item)))) return items;

  const scoredPool = dedupeMedia(pool)
    .filter(isReasonableForWorker)
    .map((item, index) => ({
      item,
      index,
      score:
        scoreMediaForStory(item, storyText, offerMode, context) + index * 0.0001,
    }))
    .sort((a, b) => b.score - a.score);

  const candidate =
    scoredPool.find(
      (x) =>
        classifyMediaType(x.item) === "video" &&
        hasFunnelBridge(buildMediaBlob(x.item))
    )?.item ||
    scoredPool.find((x) => hasFunnelBridge(buildMediaBlob(x.item)))?.item;

  if (!candidate) return items;

  const current = [...items];
  const existingKeys = new Set(
    current
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  const candidateUrl = resolveMediaUrl(candidate);
  if (!candidateUrl) return current;

  const candidateKey = canonicalizeUrl(candidateUrl);
  if (existingKeys.has(candidateKey)) return current;

  if (current.length >= maxItems) {
    const removableIndex = current.findIndex(
      (item) => !hasFunnelBridge(buildMediaBlob(item))
    );
    if (removableIndex >= 0) {
      current.splice(removableIndex, 1, candidate);
      return current.slice(0, maxItems);
    }
  }

  current.push(candidate);
  return current.slice(0, maxItems);
}

function deriveWorkerMediaRole(
  item: MediaItem,
  offerMode: OfferMode,
  storyText: string,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): WorkerRole {
  const manualRole =
    normalizeWorkerRole((item as LooseRecord).role) ||
    normalizeWorkerRole((item as LooseRecord).autoaffiRole) ||
    normalizeWorkerRole((item as LooseRecord).incomingRole);

  if (manualRole) return manualRole;

  const blob = buildMediaBlob(item);

  if (offerMode === "product") {
    if (
      blobHasAny(blob, [
        "product",
        "demo",
        "hands",
        "holding",
        "showcase",
        "closeup",
        "review",
        "unboxing",
      ])
    ) {
      return "hook";
    }

    if (
      blobHasAny(blob, [
        "results",
        "result",
        "transformation",
        "before after",
        "before and after",
        "testimonial",
        "customer",
      ])
    ) {
      return "proof";
    }

    if (
      blobHasAny(blob, [
        "lifestyle",
        "creator",
        "ugc",
        "premium",
        "commercial",
        "use case",
      ])
    ) {
      return "payoff";
    }

    return "generic";
  }

  if (offerMode === "funnel") {
    if (
      blobHasAny(blob, [
        "stress",
        "problem",
        "confused",
        "overwhelmed",
        "messy",
        "manual",
        "slow",
      ])
    ) {
      return "problem";
    }

    if (
      blobHasAny(blob, [
        "landing page",
        "sales funnel",
        "sales page",
        "lead generation",
        "conversion",
      ])
    ) {
      return "solution";
    }

    if (
      blobHasAny(blob, [
        "dashboard",
        "analytics",
        "campaign",
        "crm",
        "checkout",
        "email marketing",
      ])
    ) {
      return "proof";
    }

    if (
      blobHasAny(blob, [
        "workspace",
        "founder",
        "laptop",
        "strategy",
        "marketing",
      ])
    ) {
      return "hook";
    }

    return "generic";
  }

  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  if (offerMode === "recurring" && freedomStory) {
    const scenic = blobHasAny(blob, [
      "beach",
      "ocean",
      "sunset",
      "sunrise",
      "mountain",
      "forest",
      "island",
      "coast",
      "tropical",
      "travel",
      "scenic",
      "nature",
    ]);

    const remoteBlend = blobHasAny(blob, [
      "digital nomad",
      "work from anywhere",
      "remote entrepreneur",
      "laptop lifestyle",
      "travel lifestyle",
      "luxury lifestyle",
      "remote work",
    ]);

    const payoffSignals = blobHasAny(blob, [
      "luxury",
      "freedom",
      "premium",
      "entrepreneur",
      "online business",
      "passive income",
      "success",
      "lifestyle",
    ]);

    if (scenic && !remoteBlend) return "hook";
    if (remoteBlend || hasBusinessBridge(blob)) return "solution";
    if (isStrictFreedomRecurringAsset(item) && payoffSignals) return "payoff";
    if (isStrictFreedomRecurringAsset(item)) return "payoff";
    if (payoffSignals) return "payoff";

    return "generic";
  }

  if (
    blobHasAny(blob, [
      "dashboard",
      "automation",
      "software",
      "analytics",
      "workspace",
      "laptop",
      "screen",
    ])
  ) {
    return "solution";
  }

  if (
    blobHasAny(blob, [
      "creator",
      "business",
      "entrepreneur",
      "remote work",
      "success",
    ])
  ) {
    return "hook";
  }

  return "generic";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((v) => normalizeText(v, "")).filter(Boolean))
  );
}

function buildWorkerSemanticHints(
  item: MediaItem,
  offerMode: OfferMode,
  storyText: string,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): string[] {
  const blob = buildMediaBlob(item);
  const role = deriveWorkerMediaRole(item, offerMode, storyText, context);
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  if (offerMode === "product") {
    if (role === "hook") {
      return uniqueStrings([
        "product",
        "demo",
        "showcase",
        "hands",
        "holding",
        "closeup",
        "premium",
      ]);
    }

    if (role === "proof") {
      return uniqueStrings([
        "results",
        "transformation",
        "testimonial",
        "customer",
        "before and after",
      ]);
    }

    if (role === "payoff") {
      return uniqueStrings([
        "creator",
        "ugc",
        "lifestyle",
        "premium",
        "commercial",
        "use case",
      ]);
    }

    return uniqueStrings([
      "product",
      "creator",
      "premium",
      "commercial",
    ]);
  }

  if (offerMode === "funnel") {
    if (role === "hook") {
      return uniqueStrings([
        "founder",
        "workspace",
        "laptop",
        "marketing",
        "strategy",
      ]);
    }

    if (role === "problem") {
      return uniqueStrings([
        "manual",
        "slow",
        "messy workflow",
        "stress",
        "overwhelmed",
      ]);
    }

    if (role === "solution") {
      return uniqueStrings([
        "landing page",
        "sales funnel",
        "conversion",
        "lead generation",
        "checkout",
      ]);
    }

    if (role === "proof") {
      return uniqueStrings([
        "dashboard",
        "analytics",
        "crm",
        "campaign",
        "email marketing",
        "proof",
      ]);
    }

    return uniqueStrings([
      "growth",
      "conversion",
      "marketing",
      "premium",
    ]);
  }

  if (freedomStory) {
    if (role === "hook") {
      return uniqueStrings([
        "beach",
        "ocean",
        "sunset",
        "sunrise",
        "mountain",
        "forest",
        "travel",
        "freedom",
        "lifestyle",
        "premium",
      ]);
    }

    if (role === "solution") {
      return uniqueStrings([
        "work from anywhere",
        "remote entrepreneur",
        "laptop lifestyle",
        "digital nomad",
        "creator",
        "freedom",
        "luxury",
      ]);
    }

    if (role === "proof") {
      return uniqueStrings([
        "online business",
        "creator",
        "remote work",
        "entrepreneur",
        "premium",
      ]);
    }

    if (role === "payoff") {
      return uniqueStrings([
        "digital nomad",
        "luxury lifestyle",
        "travel lifestyle",
        "freedom",
        "online business",
        "premium",
        "entrepreneur",
      ]);
    }

    if (isStrictFreedomRecurringAsset(item) || hasStrongNatureScene(blob)) {
      return uniqueStrings([
        "travel",
        "freedom",
        "lifestyle",
        "premium",
        "digital nomad",
      ]);
    }

    return uniqueStrings([
      "freedom",
      "premium",
      "entrepreneur",
      "lifestyle",
    ]);
  }

  return uniqueStrings([
    "automation",
    "creator",
    "business",
    "remote work",
    "premium",
    "growth",
  ]);
}

function buildSequenceRoles(
  items: MediaItem[],
  offerMode: OfferMode,
  freedomStory: boolean
): WorkerRole[] {
  const count = items.length;
  if (count <= 0) return [];

  if (offerMode === "product") {
    if (count === 1) return ["hook"] as WorkerRole[];
    if (count === 2) return ["hook", "payoff"] as WorkerRole[];
    if (count === 3) return ["hook", "proof", "payoff"] as WorkerRole[];
    if (count === 4) return ["hook", "proof", "proof", "payoff"] as WorkerRole[];
    if (count === 5) return ["hook", "proof", "proof", "payoff", "payoff"] as WorkerRole[];
    return ["hook", "proof", "proof", "payoff", "payoff", "payoff"].slice(0, count) as WorkerRole[];
  }

  if (offerMode === "funnel") {
    if (count === 1) return ["hook"] as WorkerRole[];
    if (count === 2) return ["hook", "solution"] as WorkerRole[];
    if (count === 3) return ["hook", "solution", "payoff"] as WorkerRole[];
    if (count === 4) return ["hook", "problem", "solution", "payoff"] as WorkerRole[];
    if (count === 5) return ["hook", "problem", "solution", "proof", "payoff"] as WorkerRole[];
    return ["hook", "problem", "solution", "proof", "payoff", "payoff"].slice(0, count) as WorkerRole[];
  }

  if (offerMode === "recurring" && freedomStory) {
    if (count === 1) return ["hook"] as WorkerRole[];
    if (count === 2) return ["hook", "payoff"] as WorkerRole[];
    if (count === 3) return ["hook", "solution", "payoff"] as WorkerRole[];
    if (count === 4) return ["hook", "solution", "payoff", "payoff"] as WorkerRole[];
    if (count === 5) return ["hook", "solution", "proof", "payoff", "payoff"] as WorkerRole[];
    return ["hook", "solution", "proof", "payoff", "payoff", "payoff"].slice(0, count) as WorkerRole[];
  }

  if (count === 1) return ["hook"] as WorkerRole[];
  if (count === 2) return ["hook", "solution"] as WorkerRole[];
  if (count === 3) return ["hook", "solution", "payoff"] as WorkerRole[];
  if (count === 4) return ["hook", "problem", "solution", "payoff"] as WorkerRole[];
  if (count === 5) return ["hook", "problem", "solution", "proof", "payoff"] as WorkerRole[];
  return ["hook", "problem", "solution", "proof", "payoff", "payoff"].slice(0, count) as WorkerRole[];
}

function applyStoryRoleSequence(
  items: MediaItem[],
  offerMode: OfferMode,
  storyText: string,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  const roles = buildSequenceRoles(items, offerMode, freedomStory);

  return items.map((item, index) => {
    const forcedRole = roles[index];
    if (!forcedRole) return item;

    return {
      ...item,
      role: forcedRole,
      autoaffiRole: forcedRole,
      incomingRole: forcedRole,
    };
  });
}

function enrichMediaForWorker(
  item: MediaItem,
  offerMode: OfferMode,
  storyText: string,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
) {
  const blob = buildMediaBlob(item);
  const resolvedType = classifyMediaType(item);
  const url = resolveMediaUrl(item) || "";
  const thumb =
    typeof item.thumb === "string" && item.thumb.trim()
      ? item.thumb
      : resolvedType === "image"
      ? url
      : "";

  const natureFreedom = isNatureFreedomMedia(item);
  const strictFreedom = isStrictFreedomRecurringAsset(item);
  const blockedFreedom = isBlockedFreedomRecurringAsset(item);
  const productWow = hasProductBridge(blob);
  const funnelWow = hasFunnelBridge(blob);
  const role = deriveWorkerMediaRole(item, offerMode, storyText, context);
  const workerHints = buildWorkerSemanticHints(item, offerMode, storyText, context);

  const originalTags = Array.isArray(item.tags)
    ? item.tags.map((t) => normalizeText(t, "")).filter(Boolean)
    : [];

  const mergedTags = uniqueStrings([
    ...originalTags,
    ...workerHints,
    ...(natureFreedom ? ["nature_freedom"] : []),
    ...(strictFreedom ? ["strict_freedom"] : []),
    ...(productWow ? ["product_wow"] : []),
    ...(funnelWow ? ["funnel_wow"] : []),
    ...(hasBusinessBridge(blob) ? ["business_bridge"] : []),
    role,
  ]);

  const semanticText = uniqueStrings([
    normalizeText(item.title, ""),
    normalizeText(item.description, ""),
    ...workerHints,
    role,
    offerMode,
    normalizeText(context?.offerName, ""),
    normalizeText(context?.offerCategory, ""),
    normalizeText(context?.genre, ""),
  ]).join(" ");

  const mergedDescription = normalizeText(item.description, "")
    ? `${normalizeText(item.description, "")} ${workerHints.join(" ")}`
        .replace(/\s+/g, " ")
        .trim()
    : workerHints.join(" ");

  return {
    ...item,
    url,
    thumb,
    type: resolvedType === "unknown" ? "video" : resolvedType,
    title: normalizeText(item.title, ""),
    description: mergedDescription,
    tags: mergedTags,
    width:
      item.width ??
      item.video?.width ??
      item.file?.width ??
      item.image?.width ??
      undefined,
    height:
      item.height ??
      item.video?.height ??
      item.file?.height ??
      item.image?.height ??
      undefined,
    duration: Number(item.duration ?? 0) || 0,
    natureFreedom,
    strictFreedom,
    blockedFreedom,
    hybrid:
      strictFreedom ||
      natureFreedom ||
      productWow ||
      funnelWow ||
      hasBusinessBridge(blob),
    role,
    autoaffiRole: role,
    incomingRole: role,
    autoaffiHints: workerHints,
    semanticTags: [
      ...(natureFreedom ? ["nature_freedom"] : []),
      ...(strictFreedom ? ["strict_freedom"] : []),
      ...(productWow ? ["product_wow"] : []),
      ...(funnelWow ? ["funnel_wow"] : []),
      ...(hasBusinessBridge(blob) ? ["business_bridge"] : []),
      ...(hasStrongNatureScene(blob) ? ["nature_scene"] : []),
      ...(hasFreedomJourneySignal(blob) ? ["freedom_journey"] : []),
      ...workerHints,
      role,
    ],
    semanticText,
    offerMode,
  };
}

function buildStorySeed(body: LooseRecord): {
  title: string;
  caption: string;
  scriptText: string;
  storyText: string;
} {
  const scriptRaw = body.script;
  const scriptText = Array.isArray(scriptRaw)
    ? scriptRaw.filter(Boolean).map((v) => normalizeText(v, "")).join("\n")
    : normalizeText(scriptRaw, "");

  const title =
    normalizeText(body.title) ||
    normalizeText(body.hook) ||
    normalizeText(body.idea) ||
    normalizeText(body.topic) ||
    normalizeText(body.genre, "motivation");

  const caption =
    normalizeText(body.caption) ||
    normalizeText(body.description) ||
    normalizeText(body.prompt);

  return {
    title,
    caption,
    scriptText,
    storyText: [title, caption, scriptText].filter(Boolean).join("\n"),
  };
}

function getRequestBaseUrl(req: Request): string {
  const explicitBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";

  if (explicitBaseUrl) {
    const normalizedExplicit = /^https?:\/\//i.test(explicitBaseUrl)
      ? explicitBaseUrl
      : `https://${explicitBaseUrl}`;

    if (!/localhost/i.test(normalizedExplicit)) {
      return normalizedExplicit.replace(/\/+$/, "");
    }
  }

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.url.startsWith("https://") ? "https" : "http");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host");

  if (host && !/localhost/i.test(host)) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  const originHeader = req.headers.get("origin");
  if (originHeader && !/localhost/i.test(originHeader)) {
    return originHeader.replace(/\/+$/, "");
  }

  return "https://www.autoaffi.com";
}

function createTimeoutSignal(ms: number): AbortSignal | undefined {
  const abortSignalWithTimeout = AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  };

  return typeof abortSignalWithTimeout.timeout === "function"
    ? abortSignalWithTimeout.timeout(ms)
    : undefined;
}

function isLocalhostLike(value: string): boolean {
  const v = value.trim().toLowerCase();

  return (
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    v.includes("0.0.0.0") ||
    v.startsWith("[http://[::1]http://[::1]") ||
    v.startsWith("[https://[::1]https://[::1]")
  );
}

function toPublicAbsoluteUrl(url: string, baseUrl: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    if (isLocalhostLike(raw)) return null;
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${baseUrl}${raw}`;
  }

  return null;
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg)(\?.*)?$/i.test(url);
}

function resolveAudioUrl(value: unknown, baseUrl?: string): string | null {
  const v = asRecord(value);

  const candidates = [
    typeof value === "string" ? value : null,
    v.url,
    v.src,
    v.link,
    v.downloadUrl,
    v.download_url,
    v.audioUrl,
    v.audio_url,
    v.musicUrl,
    v.music_url,
    asRecord(v.file).url,
    asRecord(v.file).src,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;

    const normalized = baseUrl
      ? toPublicAbsoluteUrl(candidate, baseUrl)
      : /^https?:\/\//i.test(candidate) && !isLocalhostLike(candidate)
      ? candidate
      : null;

    if (!normalized) continue;
    if (!isAudioUrl(normalized)) continue;

    return normalized;
  }

  return null;
}

function dedupeAudioItems(items: unknown[], baseUrl?: string): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];

  for (const item of items) {
    const url = resolveAudioUrl(item, baseUrl);
    if (!url) continue;

    const key = canonicalizeUrl(url);
    if (seen.has(key)) continue;

    seen.add(key);

    if (typeof item === "string") {
      out.push({ url });
    } else if (item && typeof item === "object") {
      out.push({
        ...(item as Record<string, unknown>),
        url,
      });
    } else {
      out.push({ url });
    }
  }

  return out;
}

function normalizeMusicMode(value: unknown): "auto" | "library" | "upload" | "none" {
  const v = normalizeText(value, "auto").toLowerCase();
  if (v === "library") return "library";
  if (v === "upload") return "upload";
  if (v === "none") return "none";
  return "auto";
}

function resolveStockMusic(body: LooseRecord, baseUrl: string) {
  const uploadedMusic = dedupeAudioItems(
    [
      ...(Array.isArray(body.musicFiles) ? body.musicFiles : []),
      ...(Array.isArray(body.uploadedMusic) ? body.uploadedMusic : []),
      ...(Array.isArray(body.userMusic) ? body.userMusic : []),
    ],
    baseUrl
  );

  const discoveredMusic = dedupeAudioItems(
    [
      ...(Array.isArray(body.stockMusic) ? body.stockMusic : []),
      ...(Array.isArray(body.musicResults) ? body.musicResults : []),
      ...(Array.isArray(body.audioResults) ? body.audioResults : []),
    ],
    baseUrl
  );

  const musicObj = asRecord(body.music);

  const directMusicUrl =
    resolveAudioUrl(body.musicUrl, baseUrl) ||
    resolveAudioUrl(musicObj.url, baseUrl) ||
    resolveAudioUrl(body.stockMusicUrl, baseUrl) ||
    resolveAudioUrl(body.audioUrl, baseUrl) ||
    resolveAudioUrl(body.uploadedMusicUrl, baseUrl);

  const mode = normalizeMusicMode(body.musicMode);

  let musicUrl: string | null = null;

  if (mode === "none") {
    musicUrl = null;
  } else if (mode === "upload") {
    musicUrl =
      directMusicUrl ||
      resolveAudioUrl(uploadedMusic[0], baseUrl) ||
      resolveAudioUrl(discoveredMusic[0], baseUrl) ||
      null;
  } else if (mode === "library") {
    musicUrl =
      directMusicUrl ||
      resolveAudioUrl(discoveredMusic[0], baseUrl) ||
      resolveAudioUrl(uploadedMusic[0], baseUrl) ||
      null;
  } else {
    musicUrl =
      directMusicUrl ||
      resolveAudioUrl(discoveredMusic[0], baseUrl) ||
      resolveAudioUrl(uploadedMusic[0], baseUrl) ||
      null;
  }

  return {
    mode,
    musicUrl,
    uploadedMusic,
    stockMusic: discoveredMusic,
    musicResults: discoveredMusic,
    audioResults: discoveredMusic,
    musicFiles: uploadedMusic,
    allMusicCandidates: dedupeAudioItems(
      [
        ...uploadedMusic,
        ...discoveredMusic,
        ...(musicUrl ? [{ url: musicUrl }] : []),
      ],
      baseUrl
    ),
  };
}

async function fetchFallbackMedia(
  req: Request,
  params: {
    query: string;
    mediaType: MediaType;
    offerMeta: OfferMeta;
    freedomRecurring: boolean;
    forceNatureFreedomClip?: boolean;
  }
): Promise<MediaItem[]> {
  const baseUrl = getRequestBaseUrl(req);

  try {
    const mediaRes = await fetch(`${baseUrl}/api/media/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        type: params.mediaType,
        offerMode: params.offerMeta.mode,
        offerMeta: {
          name: params.offerMeta.name,
          mode: params.offerMeta.mode,
          category: params.offerMeta.category,
          commissionRate: params.offerMeta.commissionRate,
          affiliateUrl: params.offerMeta.affiliateUrl,
          epc: params.offerMeta.epc,
        },
        selectedOffer: {
          name: params.offerMeta.name,
          mode: params.offerMeta.mode,
          category: params.offerMeta.category,
          commissionRate: params.offerMeta.commissionRate,
          affiliateUrl: params.offerMeta.affiliateUrl,
          epc: params.offerMeta.epc,
        },
        freedomRecurring: params.freedomRecurring,
        forceNatureFreedomClip: !!params.forceNatureFreedomClip,
        renderHints: {
          offerMode: params.offerMeta.mode,
          offerName: params.offerMeta.name,
          offerCategory: params.offerMeta.category,
          freedomRecurring: params.freedomRecurring,
          forceNatureFreedomClip: !!params.forceNatureFreedomClip,
        },
      }),
      signal: createTimeoutSignal(45_000),
      cache: "no-store",
    });

    if (!mediaRes.ok) {
      const txt = await mediaRes.text().catch(() => "");
      console.error("[RENDER-VX ROUTE] media/fetch error", mediaRes.status, txt);
      return [];
    }

    const mediaJson = (await mediaRes.json()) as MediaFetchResponse;

    const items = [
      ...(Array.isArray(mediaJson?.results) ? mediaJson.results : []),
      ...(Array.isArray(mediaJson?.combined) ? mediaJson.combined : []),
      ...(Array.isArray(mediaJson?.items) ? mediaJson.items : []),
    ];

    return dedupeMedia(items).slice(0, 24);
  } catch (error) {
    console.error("[RENDER-VX ROUTE] media/fetch crash", error);
    return [];
  }
}

async function fetchFallbackMusic(req: Request, query: string): Promise<unknown[]> {
  const baseUrl = getRequestBaseUrl(req);

  try {
    const musicRes = await fetch(`${baseUrl}/api/music/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
      }),
      signal: createTimeoutSignal(30_000),
      cache: "no-store",
    });

    if (!musicRes.ok) {
      const txt = await musicRes.text().catch(() => "");
      console.error("[RENDER-VX ROUTE] music/fetch error", musicRes.status, txt);
      return [];
    }

    const musicJson = (await musicRes.json()) as LooseRecord;

    const items = [
      ...(Array.isArray(musicJson?.results) ? musicJson.results : []),
      ...(Array.isArray(musicJson?.items) ? musicJson.items : []),
      ...(Array.isArray(musicJson?.audioResults) ? musicJson.audioResults : []),
      ...(Array.isArray(musicJson?.musicResults) ? musicJson.musicResults : []),
      ...(Array.isArray(musicJson?.stockMusic) ? musicJson.stockMusic : []),
    ];

    return dedupeAudioItems(items, baseUrl).slice(0, 12);
  } catch (error) {
    console.error("[RENDER-VX ROUTE] music/fetch crash", error);
    return [];
  }
}

function previewMedia(
  items: MediaItem[],
  storyText = "",
  offerMeta?: OfferMeta,
  genre = ""
) {
  return items.slice(0, 10).map((m) => ({
    url: resolveMediaUrl(m),
    classified: classifyMediaType(m),
    width: m.width ?? m.video?.width ?? m.file?.width ?? m.image?.width ?? null,
    height: m.height ?? m.video?.height ?? m.file?.height ?? m.image?.height ?? null,
    duration: m.duration ?? null,
    type: m.type ?? null,
    source: m.source ?? null,
    title: m.title ?? null,
    natureFreedom: isNatureFreedomMedia(m),
    strictFreedom: isStrictFreedomRecurringAsset(m),
    freedomJourney: hasFreedomJourneySignal(buildMediaBlob(m)),
    officePenalty: isFreedomRecurringPenaltyMedia(m),
    blockedFreedom: isBlockedFreedomRecurringAsset(m),
    productWow: hasProductBridge(buildMediaBlob(m)),
    funnelWow: hasFunnelBridge(buildMediaBlob(m)),
    score: offerMeta
      ? scoreMediaForStory(m, storyText, offerMeta.mode, {
          offerName: offerMeta.name,
          offerCategory: offerMeta.category,
          genre,
        })
      : null,
  }));
}

function prioritizeFreedomRecurringPool(
  items: MediaItem[],
  storyText: string,
  mediaType: MediaType,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode: "recurring",
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  if (!freedomStory) {
    return prioritizeForRequestedMediaType(items, mediaType);
  }

  const clean = dedupeMedia(items).filter(isReasonableForWorker);

  const strictFreedom = clean.filter((item) => isStrictFreedomRecurringAsset(item));
  const softFreedom = clean.filter(
    (item) =>
      !strictFreedom.includes(item) &&
      hasFreedomJourneySignal(buildMediaBlob(item)) &&
      !isBlockedFreedomRecurringAsset(item)
  );
  const neutral = clean.filter(
    (item) =>
      !strictFreedom.includes(item) &&
      !softFreedom.includes(item) &&
      !isBlockedFreedomRecurringAsset(item)
  );

  const ordered = [...strictFreedom, ...softFreedom, ...neutral];
  return prioritizeForRequestedMediaType(ordered, mediaType);
}

function enforceBestWorkerMedia(
  items: MediaItem[],
  storyText: string,
  offerMode: OfferMode,
  mediaType: MediaType,
  maxItems = 5,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  },
  variantSeed = 1
): MediaItem[] {
  const freedomStory = isFreedomRecurringStoryFromContext({
    offerMode,
    storyText,
    offerName: context?.offerName,
    offerCategory: context?.offerCategory,
    genre: context?.genre,
  });

  const sourcePool =
    freedomStory && offerMode === "recurring"
      ? prioritizeFreedomRecurringPool(items, storyText, mediaType, context)
      : dedupeMedia(items).filter(isReasonableForWorker);

  const clean = dedupeMedia(sourcePool).filter(isReasonableForWorker);

  const videos = clean.filter((m) => classifyMediaType(m) === "video");
  const images = clean.filter((m) => classifyMediaType(m) === "image");
  const unknowns = clean.filter((m) => classifyMediaType(m) === "unknown");

  let picked: MediaItem[] = [];

  if (mediaType === "video") {
    if (videos.length > 0) {
      const pickedVideos = pickStoryDrivenMedia(
        videos,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedVideos.length > 0 ? pickedVideos.slice(0, maxItems) : videos.slice(0, maxItems);
    } else if (images.length > 0) {
      const pickedImages = pickStoryDrivenMedia(
        images,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedImages.length > 0 ? pickedImages.slice(0, maxItems) : images.slice(0, maxItems);
    }
  } else if (mediaType === "stills") {
    if (images.length > 0) {
      const pickedImages = pickStoryDrivenMedia(
        images,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedImages.length > 0 ? pickedImages.slice(0, maxItems) : images.slice(0, maxItems);
    } else if (videos.length > 0) {
      const pickedVideos = pickStoryDrivenMedia(
        videos,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedVideos.length > 0 ? pickedVideos.slice(0, maxItems) : videos.slice(0, maxItems);
    }
  } else {
    if (videos.length > 0) {
      const pickedVideos = pickStoryDrivenMedia(
        videos,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedVideos.length > 0 ? pickedVideos.slice(0, maxItems) : videos.slice(0, maxItems);
    } else if (images.length > 0) {
      const pickedImages = pickStoryDrivenMedia(
        images,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked = pickedImages.length > 0 ? pickedImages.slice(0, maxItems) : images.slice(0, maxItems);
    } else if (unknowns.length > 0) {
      const pickedUnknowns = pickStoryDrivenMedia(
        unknowns,
        storyText,
        offerMode,
        maxItems,
        context,
        variantSeed
      );
      picked =
        pickedUnknowns.length > 0 ? pickedUnknowns.slice(0, maxItems) : unknowns.slice(0, maxItems);
    }
  }

  picked = ensureNatureFreedomIncluded(picked, clean, storyText, offerMode, maxItems, context);

  if (offerMode === "recurring" && freedomStory) {
    picked = ensureFreedomRecurringBalance(picked, clean, storyText, mediaType, maxItems, context);
  }

  picked = ensureProductWowIncluded(picked, clean, storyText, offerMode, maxItems, context);
  picked = ensureFunnelWowIncluded(picked, clean, storyText, offerMode, maxItems, context);

  return picked.slice(0, maxItems);
}

function prioritizeForRequestedMediaType(items: MediaItem[], mediaType: MediaType): MediaItem[] {
  const deduped = dedupeMedia(items);
  const videos = deduped.filter((m) => classifyMediaType(m) === "video");
  const images = deduped.filter((m) => classifyMediaType(m) === "image");
  const unknowns = deduped.filter((m) => classifyMediaType(m) === "unknown");

  if (mediaType === "video") return [...videos, ...images, ...unknowns];
  if (mediaType === "stills") return [...images, ...videos, ...unknowns];
  return [...videos, ...images, ...unknowns];
}

function fillSelectedMediaToTarget(
  selected: MediaItem[],
  pool: MediaItem[],
  requestedMaxSegments: number,
  freedomStory = false
): MediaItem[] {
  const out = [...selected];
  const seen = new Set(
    out
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  for (const item of pool) {
    if (out.length >= requestedMaxSegments) break;

    if (freedomStory && isBlockedFreedomRecurringAsset(item)) continue;

    const url = resolveMediaUrl(item);
    if (!url) continue;

    const key = canonicalizeUrl(url);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out.slice(0, requestedMaxSegments);
}

function enforceFinalFreedomRecurringGuard(
  selected: MediaItem[],
  pool: MediaItem[],
  storyText: string,
  requestedMaxSegments: number,
  context?: {
    offerName?: string;
    offerCategory?: string;
    genre?: string;
  }
): MediaItem[] {
  const out = [...selected];
  const strictPool = dedupeMedia(pool)
    .filter(isReasonableForWorker)
    .filter((item) => isStrictFreedomRecurringAsset(item))
    .sort(
      (a, b) =>
        scoreMediaForStory(b, storyText, "recurring", context) -
        scoreMediaForStory(a, storyText, "recurring", context)
    );

  const existingKeys = new Set(
    out
      .map((item) => resolveMediaUrl(item))
      .filter(Boolean)
      .map((url) => canonicalizeUrl(url as string))
  );

  for (let i = 0; i < out.length; i++) {
    if (!isBlockedFreedomRecurringAsset(out[i])) continue;

    const replacement = strictPool.find((candidate) => {
      const url = resolveMediaUrl(candidate);
      if (!url) return false;
      const key = canonicalizeUrl(url);
      return !existingKeys.has(key);
    });

    if (!replacement) continue;

    const replacementUrl = resolveMediaUrl(replacement);
    if (!replacementUrl) continue;

    const oldUrl = resolveMediaUrl(out[i]);
    if (oldUrl) existingKeys.delete(canonicalizeUrl(oldUrl));

    out[i] = replacement;
    existingKeys.add(canonicalizeUrl(replacementUrl));
  }

  const filtered = out.filter((item) => !isBlockedFreedomRecurringAsset(item));

  if (filtered.length >= Math.min(2, requestedMaxSegments)) {
    return filtered.slice(0, requestedMaxSegments);
  }

  const repaired = [...filtered];
  for (const candidate of strictPool) {
    if (repaired.length >= requestedMaxSegments) break;

    const url = resolveMediaUrl(candidate);
    if (!url) continue;
    const key = canonicalizeUrl(url);
    if (repaired.some((item) => canonicalizeUrl(resolveMediaUrl(item) || "") === key)) continue;

    repaired.push(candidate);
  }

  return repaired.slice(0, requestedMaxSegments);
}

export async function POST(req: Request) {
  let jobId = "";

  try {
    const body = (await req.json().catch(() => ({}))) as LooseRecord;
    const baseUrl = getRequestBaseUrl(req);
    jobId = resolveJobId(body);

    await upsertRenderJob({
      jobId,
      status: "processing",
      progress: 10,
      errorMessage: null,
      videoUrl: null,
      renderPayload: body,
    });

    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      console.error("[RENDER-VX ROUTE] Missing RENDER_WORKER_URL");

      await upsertRenderJob({
        jobId,
        status: "failed",
        progress: 0,
        errorMessage: "Missing RENDER_WORKER_URL",
        videoUrl: null,
        renderPayload: body,
      });

      return NextResponse.json(
        { ok: false, error: "Missing RENDER_WORKER_URL", jobId },
        { status: 500 }
      );
    }

    const genre = normalizeText(body.genre, "motivation");
    const mediaType = normalizeMediaType(body.mediaType);

    const exportTimeline = asRecord(body.exportTimeline);

    const videoLength = normalizeNumber(
      body.videoLength ?? body.duration ?? exportTimeline.totalDuration,
      15,
      15,
      25
    );

    const realism = normalizeNumber(body.realism, 5, 1, 10);
    const voiceStyle = normalizeText(body.voiceStyle, "Natural");
    const musicMode = normalizeMusicMode(body.musicMode);

    const musicTransitions = normalizeBoolean(body.musicTransitions, true);
    const musicImpacts = normalizeBoolean(body.musicImpacts, true);
    const musicAmbience = normalizeBoolean(body.musicAmbience, true);

    const { title, caption, scriptText, storyText } = buildStorySeed(body);
    const offerMeta = resolveOfferMeta(body);

    await upsertRenderJob({
      jobId,
      status: "processing",
      progress: 15,
      errorMessage: null,
      videoUrl: null,
      offerMode: offerMeta.mode,
      offerName: offerMeta.name,
      offerCategory: offerMeta.category,
      renderPayload: body,
    });

    const variantSeed = buildRenderVariantSeed(body, offerMeta, storyText);

    const mediaQuery = buildMediaQuery({
      genre,
      title,
      caption,
      storyText,
      offerMeta,
    });

    const freedomRecurring = isFreedomRecurringStory({
      genre,
      storyText,
      offerMeta,
    });

    const scoringContext = {
      offerName: offerMeta.name,
      offerCategory: offerMeta.category,
      genre,
    };

    let stockMusic = resolveStockMusic(body, baseUrl);

    let mediaFiles: MediaItem[] = Array.isArray(body.mediaFiles)
      ? (body.mediaFiles as MediaItem[])
      : [];

    if (!mediaFiles.length) {
      if (mediaType === "stills") {
        const stillsFallback = await fetchFallbackMedia(req, {
          query: mediaQuery,
          mediaType: "stills",
          offerMeta,
          freedomRecurring,
          forceNatureFreedomClip: freedomRecurring,
        });

        console.log("[RENDER-VX ROUTE] Fallback media stills-first", {
          jobId,
          baseUrl,
          query: mediaQuery,
          requestedType: mediaType,
          stillsCount: stillsFallback.length,
          preview: previewMedia(stillsFallback, storyText, offerMeta, genre),
        });

        if (stillsFallback.length) {
          mediaFiles = stillsFallback;
        } else {
          const mixedFallback = await fetchFallbackMedia(req, {
            query: mediaQuery,
            mediaType: "mixed",
            offerMeta,
            freedomRecurring,
            forceNatureFreedomClip: freedomRecurring,
          });

          console.log("[RENDER-VX ROUTE] Fallback media mixed after stills", {
            jobId,
            baseUrl,
            query: mediaQuery,
            mixedFallbackCount: mixedFallback.length,
            preview: previewMedia(mixedFallback, storyText, offerMeta, genre),
          });

          mediaFiles = mixedFallback;
        }
      } else {
        const preferredVideos = await fetchFallbackMedia(req, {
          query: mediaQuery,
          mediaType: "video",
          offerMeta,
          freedomRecurring,
          forceNatureFreedomClip: freedomRecurring,
        });

        console.log("[RENDER-VX ROUTE] Fallback media video-first", {
          jobId,
          baseUrl,
          query: mediaQuery,
          requestedType: mediaType,
          preferredVideosCount: preferredVideos.length,
          preview: previewMedia(preferredVideos, storyText, offerMeta, genre),
        });

        if (preferredVideos.length) {
          mediaFiles = preferredVideos;
        } else {
          const mixedFallback = await fetchFallbackMedia(req, {
            query: mediaQuery,
            mediaType: "mixed",
            offerMeta,
            freedomRecurring,
            forceNatureFreedomClip: freedomRecurring,
          });

          console.log("[RENDER-VX ROUTE] Fallback media mixed", {
            jobId,
            baseUrl,
            query: mediaQuery,
            mixedFallbackCount: mixedFallback.length,
            preview: previewMedia(mixedFallback, storyText, offerMeta, genre),
          });

          if (mixedFallback.length) {
            mediaFiles = mixedFallback;
          } else {
            const stillsFallback = await fetchFallbackMedia(req, {
              query: mediaQuery,
              mediaType: "stills",
              offerMeta,
              freedomRecurring,
              forceNatureFreedomClip: freedomRecurring,
            });

            console.log("[RENDER-VX ROUTE] Fallback media stills", {
              jobId,
              baseUrl,
              query: mediaQuery,
              stillsFallbackCount: stillsFallback.length,
              preview: previewMedia(stillsFallback, storyText, offerMeta, genre),
            });

            mediaFiles = stillsFallback;
          }
        }
      }
    } else {
      console.log("[RENDER-VX ROUTE] Incoming mediaFiles from body", {
        jobId,
        count: mediaFiles.length,
        preview: previewMedia(mediaFiles, storyText, offerMeta, genre),
      });
    }

    if (freedomRecurring) {
      const hasNatureAlready = mediaFiles.some((item) => isStrictFreedomRecurringAsset(item));

      if (!hasNatureAlready) {
        const natureQueries = [
          buildFreedomNatureQuery({
            genre,
            storyText,
            offerMeta,
          }),
          `beach ocean sunset sunrise travel luxury lifestyle digital nomad remote work freedom premium`,
          `mountain forest tropical coast island scenic nature travel freedom lifestyle premium`,
          `${genre} freedom lifestyle beach ocean mountain sunrise travel remote work premium`,
        ]
          .map((q) => normalizeText(q))
          .filter(Boolean);

        const enrichedNature: MediaItem[] = [];

        for (const query of natureQueries) {
          const fetched = await fetchFallbackMedia(req, {
            query,
            mediaType: mediaType === "stills" ? "stills" : "video",
            offerMeta,
            freedomRecurring: true,
            forceNatureFreedomClip: true,
          });

          console.log("[RENDER-VX ROUTE] Freedom nature enrichment", {
            jobId,
            baseUrl,
            query,
            fetchedCount: fetched.length,
            preview: previewMedia(fetched, storyText, offerMeta, genre),
          });

          enrichedNature.push(...fetched);

          const hasNatureNow = dedupeMedia([...mediaFiles, ...enrichedNature]).some((item) =>
            isStrictFreedomRecurringAsset(item)
          );

          if (hasNatureNow) break;
        }

        mediaFiles = dedupeMedia([...mediaFiles, ...enrichedNature]);
      }
    }

    if (offerMeta.mode === "product") {
      const hasProductWow = mediaFiles.some((item) =>
        hasProductBridge(buildMediaBlob(item))
      );

      if (!hasProductWow) {
        const productQueries = [
          buildProductWowQuery({ genre, storyText, offerMeta }),
          `${offerMeta.name} product demo hands showcase closeup review creator ugc`,
          `${offerMeta.category} product lifestyle premium commercial results transformation`,
        ]
          .map((q) => normalizeText(q))
          .filter(Boolean);

        const enrichedProduct: MediaItem[] = [];

        for (const query of productQueries) {
          const fetched = await fetchFallbackMedia(req, {
            query,
            mediaType: mediaType === "stills" ? "stills" : "video",
            offerMeta,
            freedomRecurring: false,
            forceNatureFreedomClip: false,
          });

          console.log("[RENDER-VX ROUTE] Product wow enrichment", {
            jobId,
            baseUrl,
            query,
            fetchedCount: fetched.length,
            preview: previewMedia(fetched, storyText, offerMeta, genre),
          });

          enrichedProduct.push(...fetched);

          const hasProductNow = dedupeMedia([...mediaFiles, ...enrichedProduct]).some((item) =>
            hasProductBridge(buildMediaBlob(item))
          );

          if (hasProductNow) break;
        }

        mediaFiles = dedupeMedia([...mediaFiles, ...enrichedProduct]);
      }
    }

    if (offerMeta.mode === "funnel") {
      const hasFunnelWow = mediaFiles.some((item) =>
        hasFunnelBridge(buildMediaBlob(item))
      );

      if (!hasFunnelWow) {
        const funnelQueries = [
          buildFunnelWowQuery({ genre, storyText, offerMeta }),
          `${offerMeta.name} landing page sales funnel conversion dashboard campaign analytics`,
          `${offerMeta.category} lead generation marketing workspace crm founder strategy premium`,
        ]
          .map((q) => normalizeText(q))
          .filter(Boolean);

        const enrichedFunnel: MediaItem[] = [];

        for (const query of funnelQueries) {
          const fetched = await fetchFallbackMedia(req, {
            query,
            mediaType: mediaType === "stills" ? "stills" : "video",
            offerMeta,
            freedomRecurring: false,
            forceNatureFreedomClip: false,
          });

          console.log("[RENDER-VX ROUTE] Funnel wow enrichment", {
            jobId,
            baseUrl,
            query,
            fetchedCount: fetched.length,
            preview: previewMedia(fetched, storyText, offerMeta, genre),
          });

          enrichedFunnel.push(...fetched);

          const hasFunnelNow = dedupeMedia([...mediaFiles, ...enrichedFunnel]).some((item) =>
            hasFunnelBridge(buildMediaBlob(item))
          );

          if (hasFunnelNow) break;
        }

        mediaFiles = dedupeMedia([...mediaFiles, ...enrichedFunnel]);
      }
    }

    console.log("[RENDER-VX ROUTE] Raw media before filter", {
      jobId,
      incomingCount: mediaFiles.length,
      preview: previewMedia(mediaFiles, storyText, offerMeta, genre),
    });

    const beforeFilter = mediaFiles.length;
    mediaFiles = freedomRecurring
      ? prioritizeFreedomRecurringPool(
          dedupeMedia(mediaFiles).filter(isReasonableForWorker),
          storyText,
          mediaType,
          scoringContext
        )
      : prioritizeForRequestedMediaType(
          dedupeMedia(mediaFiles).filter(isReasonableForWorker),
          mediaType
        );

    mediaFiles = shuffleDeterministic(mediaFiles, variantSeed);

    console.log("[RENDER-VX ROUTE] Media after filter", {
      jobId,
      beforeFilter,
      afterFilter: mediaFiles.length,
      requestedMediaType: mediaType,
      variantSeed,
      preview: previewMedia(mediaFiles, storyText, offerMeta, genre),
    });

    const targetMinPool =
      freedomRecurring ? 4 : offerMeta.mode === "product" || offerMeta.mode === "funnel" ? 6 : 5;

    if (mediaFiles.length < targetMinPool) {
      const topUpQueries =
        offerMeta.mode === "product"
          ? [
              mediaQuery,
              `${offerMeta.name} product demo ugc creator lifestyle result review`,
              `${offerMeta.category} product commercial hands use case customer result`,
            ]
          : offerMeta.mode === "funnel"
          ? [
              mediaQuery,
              `${offerMeta.name} landing page funnel conversion dashboard marketing workspace`,
              `${offerMeta.name} lead generation campaign analytics creator laptop`,
            ]
          : freedomRecurring
          ? [
              mediaQuery,
              buildFreedomNatureQuery({ genre, storyText, offerMeta }),
              `beach ocean sunset sunrise travel luxury lifestyle digital nomad freedom premium`,
            ]
          : [
              mediaQuery,
              `${offerMeta.name} saas dashboard automation workspace creator laptop`,
            ];

      let topUpMedia: MediaItem[] = [];

      for (const query of topUpQueries) {
        const fetched = await fetchFallbackMedia(req, {
          query,
          mediaType: mediaType === "stills" ? "stills" : "video",
          offerMeta,
          freedomRecurring,
          forceNatureFreedomClip: freedomRecurring,
        });

        topUpMedia = dedupeMedia([...topUpMedia, ...fetched]);

        const mergedCandidate = dedupeMedia([...mediaFiles, ...topUpMedia]).filter(isReasonableForWorker);
        const usableCount = freedomRecurring
          ? mergedCandidate.filter((item) => !isBlockedFreedomRecurringAsset(item)).length
          : mergedCandidate.length;

        if (usableCount >= targetMinPool) {
          break;
        }
      }

      const mergedTopUp = dedupeMedia([...mediaFiles, ...topUpMedia]).filter(isReasonableForWorker);

      mediaFiles = freedomRecurring
        ? prioritizeFreedomRecurringPool(mergedTopUp, storyText, mediaType, scoringContext)
        : prioritizeForRequestedMediaType(mergedTopUp, mediaType);

      mediaFiles = shuffleDeterministic(mediaFiles, variantSeed + 101);

      console.log("[RENDER-VX ROUTE] Media after top-up", {
        jobId,
        targetMinPool,
        finalPoolCount: mediaFiles.length,
        preview: previewMedia(mediaFiles, storyText, offerMeta, genre),
      });
    }

    if (!mediaFiles.length) {
      mediaFiles = [
        {
          source: "fallback",
          type: "video",
          url: "https://public.autoaffi.com/fallback/fallback1.mp4",
          thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
          duration: videoLength,
          title: genre,
        },
      ];
    }

    if (musicMode !== "none" && !stockMusic.musicUrl) {
      const fallbackMusicItems = await fetchFallbackMusic(
        req,
        `${genre} cinematic motivational background music premium commercial`
      );

      const fallbackMusicUrl = resolveAudioUrl(fallbackMusicItems[0], baseUrl);

      console.log("[RENDER-VX ROUTE] Fallback music result", {
        jobId,
        baseUrl,
        requested: true,
        mode: musicMode,
        fallbackMusicCount: fallbackMusicItems.length,
        fallbackMusicUrl,
        preview: fallbackMusicItems.slice(0, 5).map((m) => {
          const row = asRecord(m);
          return {
            url: resolveAudioUrl(m, baseUrl),
            title: row.title ?? null,
            source: row.source ?? null,
          };
        }),
      });

      if (fallbackMusicUrl) {
        stockMusic = {
          ...stockMusic,
          musicUrl: fallbackMusicUrl,
          stockMusic: dedupeAudioItems([...stockMusic.stockMusic, ...fallbackMusicItems], baseUrl),
          musicResults: dedupeAudioItems([...stockMusic.musicResults, ...fallbackMusicItems], baseUrl),
          audioResults: dedupeAudioItems([...stockMusic.audioResults, ...fallbackMusicItems], baseUrl),
          allMusicCandidates: dedupeAudioItems(
            [
              ...stockMusic.allMusicCandidates,
              ...fallbackMusicItems,
              { url: fallbackMusicUrl },
            ],
            baseUrl
          ),
        };
      }
    }

    const workerStoryBlob = `${storyText}\n${offerMeta.name}\n${offerMeta.category}\n${offerMeta.mode}`;

    const defaultMaxSegments =
      mediaType === "stills"
        ? 5
        : freedomRecurring
        ? 6
        : offerMeta.mode === "product" || offerMeta.mode === "funnel"
        ? 6
        : 5;

    const requestedMaxSegments = normalizeNumber(
      body.renderHints && typeof body.renderHints === "object"
        ? asRecord(body.renderHints).maxSegments
        : undefined,
      defaultMaxSegments,
      4,
      7
    );

    const safeSelectedMedia = enforceBestWorkerMedia(
      mediaFiles,
      workerStoryBlob,
      offerMeta.mode,
      mediaType,
      requestedMaxSegments,
      scoringContext,
      variantSeed
    );

    let finalSelectedMedia =
      safeSelectedMedia.length > 0
        ? safeSelectedMedia
        : (freedomRecurring
            ? prioritizeFreedomRecurringPool(mediaFiles, workerStoryBlob, mediaType, scoringContext)
            : prioritizeForRequestedMediaType(mediaFiles, mediaType)
          ).slice(0, requestedMaxSegments);

    finalSelectedMedia = fillSelectedMediaToTarget(
      finalSelectedMedia,
      freedomRecurring
        ? prioritizeFreedomRecurringPool(mediaFiles, workerStoryBlob, mediaType, scoringContext)
        : prioritizeForRequestedMediaType(mediaFiles, mediaType),
      requestedMaxSegments,
      freedomRecurring
    );

    if (freedomRecurring) {
      finalSelectedMedia = ensureNatureFreedomIncluded(
        finalSelectedMedia,
        mediaFiles,
        workerStoryBlob,
        offerMeta.mode,
        requestedMaxSegments,
        scoringContext
      );

      finalSelectedMedia = ensureFreedomRecurringBalance(
        finalSelectedMedia,
        mediaFiles,
        workerStoryBlob,
        mediaType,
        requestedMaxSegments,
        scoringContext
      );

      finalSelectedMedia = fillSelectedMediaToTarget(
        finalSelectedMedia,
        prioritizeFreedomRecurringPool(mediaFiles, workerStoryBlob, mediaType, scoringContext),
        requestedMaxSegments,
        true
      );

      finalSelectedMedia = enforceFinalFreedomRecurringGuard(
        finalSelectedMedia,
        mediaFiles,
        workerStoryBlob,
        requestedMaxSegments,
        scoringContext
      );
    }

    if (offerMeta.mode === "product") {
      finalSelectedMedia = ensureProductWowIncluded(
        finalSelectedMedia,
        mediaFiles,
        workerStoryBlob,
        offerMeta.mode,
        requestedMaxSegments,
        scoringContext
      );

      finalSelectedMedia = fillSelectedMediaToTarget(
        finalSelectedMedia,
        prioritizeForRequestedMediaType(mediaFiles, mediaType),
        requestedMaxSegments,
        false
      );
    }

    if (offerMeta.mode === "funnel") {
      finalSelectedMedia = ensureFunnelWowIncluded(
        finalSelectedMedia,
        mediaFiles,
        workerStoryBlob,
        offerMeta.mode,
        requestedMaxSegments,
        scoringContext
      );

      finalSelectedMedia = fillSelectedMediaToTarget(
        finalSelectedMedia,
        prioritizeForRequestedMediaType(mediaFiles, mediaType),
        requestedMaxSegments,
        false
      );
    }

    finalSelectedMedia = shuffleDeterministic(finalSelectedMedia, variantSeed + 303).slice(
      0,
      requestedMaxSegments
    );

    const sequencedMedia = applyStoryRoleSequence(
      finalSelectedMedia,
      offerMeta.mode,
      workerStoryBlob,
      scoringContext
    );

    const workerReadyMediaFiles = sequencedMedia.map((item) =>
      enrichMediaForWorker(item, offerMeta.mode, workerStoryBlob, scoringContext)
    );

    const payload = {
      ...body,

      jobId,

      duration: videoLength,
      videoLength,

      genre,
      mediaType,

      title,
      caption,
      script: scriptText || normalizeText(body.script, ""),
      storySeed: title || genre,
      storyText,

      realism,
      voiceStyle,
      musicMode,
      musicTransitions,
      musicImpacts,
      musicAmbience,

      mediaFiles: workerReadyMediaFiles,

      musicUrl: stockMusic.musicUrl,
      uploadedMusic: stockMusic.uploadedMusic,
      stockMusic: stockMusic.stockMusic,
      musicResults: stockMusic.musicResults,
      audioResults: stockMusic.audioResults,
      musicFiles: stockMusic.musicFiles,
      allMusicCandidates: stockMusic.allMusicCandidates,

      freedomRecurring,

      renderHints: {
        ...asRecord(body.renderHints),
        jobId,
        prioritizeStoryFlow: true,
        preferVideoClips: mediaType !== "stills",
        maxSegments: requestedMaxSegments,
        pacing: "dynamic",
        clipStrategy: freedomRecurring
          ? "freedom-journey-hook-solution-payoff"
          : offerMeta.mode === "product"
          ? "product-demo-proof-payoff"
          : offerMeta.mode === "funnel"
          ? "problem-funnel-conversion-payoff"
          : "problem-solution-payoff",
        avoidIrrelevantVisuals: true,
        forceNatureFreedomClip: freedomRecurring,
        realism,
        musicMode,
        voiceStyle,
        offerMode: offerMeta.mode,
        offerName: offerMeta.name,
        offerCategory: offerMeta.category,
        musicUrl: stockMusic.musicUrl,
        hasUploadedMusic: stockMusic.uploadedMusic.length > 0,
        stockMusicCount: stockMusic.stockMusic.length,
        allMusicCandidatesCount: stockMusic.allMusicCandidates.length,
        freedomRecurring,
        variantSeed,
        selectionVariant: `v-${variantSeed}`,
      },
    };

    const workerEndpoint = `${workerUrl.replace(/\/+$/, "")}/render`;
    const signal = createTimeoutSignal(280_000);

    console.log("[RENDER-VX ROUTE] Sending to worker:", {
      endpoint: workerEndpoint,
      jobId,
      baseUrl,
      genre,
      mediaType,
      duration: payload.duration,
      offerMode: offerMeta.mode,
      offerName: offerMeta.name,
      offerCategory: offerMeta.category,
      mediaQuery,
      freedomRecurring,
      mediaCount: workerReadyMediaFiles.length,
      realism,
      voiceStyle,
      musicMode,
      musicTransitions,
      musicImpacts,
      musicAmbience,
      musicUrl: stockMusic.musicUrl,
      uploadedMusicCount: stockMusic.uploadedMusic.length,
      stockMusicCount: stockMusic.stockMusic.length,
      allMusicCandidatesCount: stockMusic.allMusicCandidates.length,
      maxSegments: requestedMaxSegments,
      variantSeed,
      mediaPreview: workerReadyMediaFiles.map((m) => ({
        type: classifyMediaType(m as MediaItem),
        url: resolveMediaUrl(m as MediaItem),
        duration: (m as MediaItem).duration ?? null,
        title: (m as MediaItem).title ?? null,
        natureFreedom: isNatureFreedomMedia(m as MediaItem),
        strictFreedom: isStrictFreedomRecurringAsset(m as MediaItem),
        freedomJourney: hasFreedomJourneySignal(buildMediaBlob(m as MediaItem)),
        officePenalty: isFreedomRecurringPenaltyMedia(m as MediaItem),
        blockedFreedom: isBlockedFreedomRecurringAsset(m as MediaItem),
        productWow: hasProductBridge(buildMediaBlob(m as MediaItem)),
        funnelWow: hasFunnelBridge(buildMediaBlob(m as MediaItem)),
        score: scoreMediaForStory(m as MediaItem, workerStoryBlob, offerMeta.mode, scoringContext),
        role: (m as LooseRecord).role ?? null,
        autoaffiRole: (m as LooseRecord).autoaffiRole ?? null,
        autoaffiHints: (m as LooseRecord).autoaffiHints ?? null,
        semanticTags: (m as LooseRecord).semanticTags ?? null,
        semanticText: (m as LooseRecord).semanticText ?? null,
      })),
      musicPreview: stockMusic.allMusicCandidates.map((m) => {
        const row = asRecord(m);
        return {
          url: resolveAudioUrl(m, baseUrl),
          title: row.title ?? null,
          source: row.source ?? null,
        };
      }),
    });

    const res = await fetch(workerEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
      cache: "no-store",
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("[RENDER-VX ROUTE] fetch to worker crashed", err);
      throw err;
    });

    if (!res.ok) {
      const status = res.status;
      const text = await res.text().catch(() => "");

      console.error("[RENDER-VX ROUTE] Worker error:", status, text);

      await upsertRenderJob({
        jobId,
        status: "failed",
        progress: 0,
        errorMessage: text || "WORKER_ERROR",
        videoUrl: null,
        offerMode: offerMeta.mode,
        offerName: offerMeta.name,
        offerCategory: offerMeta.category,
        renderPayload: payload,
        workerResponse: {
          status,
          workerMessage: text || null,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "WORKER_ERROR",
          status,
          workerMessage: text || null,
          jobId,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    const finalVideoUrl = normalizeText((json as LooseRecord)?.videoUrl, "") || null;

    await upsertRenderJob({
      jobId,
      status: "completed",
      progress: 100,
      errorMessage: null,
      videoUrl: finalVideoUrl,
      offerMode: offerMeta.mode,
      offerName: offerMeta.name,
      offerCategory: offerMeta.category,
      renderPayload: payload,
      workerResponse: json,
    });

    return NextResponse.json(
      {
        ...json,
        jobId: normalizeText((json as LooseRecord)?.jobId, "") || jobId,
        debug: {
          jobId,
          baseUrl,
          mediaCount: workerReadyMediaFiles.length,
          duration: payload.duration,
          offerMode: offerMeta.mode,
          offerName: offerMeta.name,
          offerCategory: offerMeta.category,
          mediaQuery,
          freedomRecurring,
          realism,
          voiceStyle,
          musicMode,
          musicTransitions,
          musicImpacts,
          musicAmbience,
          musicUrl: stockMusic.musicUrl,
          uploadedMusicCount: stockMusic.uploadedMusic.length,
          stockMusicCount: stockMusic.stockMusic.length,
          allMusicCandidatesCount: stockMusic.allMusicCandidates.length,
          maxSegments: requestedMaxSegments,
          variantSeed,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[RENDER-VX ROUTE] Crash:", err);

    if (jobId) {
      await upsertRenderJob({
        jobId,
        status: "failed",
        progress: 0,
        errorMessage: err instanceof Error ? err.message : "Render-VX route failed",
        videoUrl: null,
        workerResponse: {
          crash: true,
          message: err instanceof Error ? err.message : "Render-VX route failed",
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Render-VX route failed",
        jobId: jobId || null,
      },
      { status: 500 }
    );
  }
}