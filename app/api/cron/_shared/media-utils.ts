import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function checkCronSecret(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;

  const secret =
    req.headers.get("x-cron-secret") ||
    new URL(req.url).searchParams.get("secret");

  return secret === expected;
}

export function supabaseAdmin() {
  return createClient(assertEnv("SUPABASE_URL"), assertEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

// Beast scoring (1..10)
export function scoreAsset(input: {
  media_type: "image" | "video";
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  keyword?: string;
}) {
  let s = 5;

  const w = input.width ?? 0;
  const h = input.height ?? 0;
  const area = w * h;

  const isHD = w >= 1280 && h >= 720;

  if (input.media_type === "video") s += 3; // reels material priority
  if (isHD) s += 2;

  if (area >= 1920 * 1080) s += 2;
  else if (area >= 1280 * 720) s += 1;

  if (input.media_type === "video") {
    const d = input.duration ?? 0;
    if (d >= 5 && d <= 30) s += 2;
    else if (d > 60) s -= 1;
  }

  if (input.keyword && input.keyword.length > 1) s += 0.5;

  return Math.max(1, Math.min(10, Math.round(s)));
}

// Load existing (dedupe) – NOTE: if table gets huge, we can switch to per-candidate checks later
export async function loadExistingIndex(limit = 50000) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("videezy_assets")
    .select("url, provider, provider_asset_id")
    .limit(limit);

  if (error) throw error;

  const existingUrl = new Set<string>((data || []).map((r: any) => r.url).filter(Boolean));
  const existingPid = new Set<string>(
    (data || [])
      .map((r: any) => `${r.provider || ""}::${r.provider_asset_id || ""}`)
      .filter((k: string) => !k.endsWith("::"))
  );

  return { existingUrl, existingPid };
}

export async function insertChunk(rows: any[], chunkSize = 25) {
  if (!rows.length) return 0;
  const supabase = supabaseAdmin();

  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("videezy_assets").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  return inserted;
}