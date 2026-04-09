import { createClient } from "@supabase/supabase-js";
import LeadCaptureClient from "./LeadCaptureClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawPageProps = {
  params:
    | {
        token: string;
      }
    | Promise<{
        token: string;
      }>;
  searchParams?:
    | {
        u?: string;
        platform?: string;
      }
    | Promise<{
        u?: string;
        platform?: string;
      }>;
};

type AssetRow = {
  id: string | number;
  token: string;
  slug: string | null;
  offer_key: string | null;
  product_type: string | null;
  destination_mode: string | null;
  destination_url: string | null;
  user_id: string;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing env for Supabase admin client");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

async function readTokenFromParams(
  params: RawPageProps["params"]
): Promise<string | null> {
  const resolved = await params;
  return resolved?.token || null;
}

async function readSearchParams(
  searchParams: RawPageProps["searchParams"]
): Promise<{ u?: string; platform?: string }> {
  if (!searchParams) return {};
  return await searchParams;
}

async function resolveUserIdFromUserCode(
  supabase: any,
  userCode: string
): Promise<string | null> {
  const recurringRes = await (supabase.from("user_recurring_platforms") as any)
    .select("user_id, autoaffi_user_code, platform")
    .eq("autoaffi_user_code", userCode)
    .maybeSingle();

  if (recurringRes.error) {
    throw new Error(
      `Failed to resolve user from autoaffi user code: ${recurringRes.error.message}`
    );
  }

  return recurringRes.data?.user_id || null;
}

async function findAssetByTokenOrSlug(
  supabase: any,
  tokenOrSlug: string
): Promise<AssetRow | null> {
  const res = await (supabase.from("user_qr_assets") as any)
    .select(
      "id, token, slug, offer_key, product_type, destination_mode, destination_url, user_id"
    )
    .or(`token.eq.${tokenOrSlug},slug.eq.${tokenOrSlug}`)
    .maybeSingle();

  if (res.error) {
    throw new Error(`Asset lookup failed: ${res.error.message}`);
  }

  return (res.data as AssetRow | null) || null;
}

async function findAssetByUserAndSlug(
  supabase: any,
  userId: string,
  tokenOrSlug: string
): Promise<AssetRow | null> {
  const res = await (supabase.from("user_qr_assets") as any)
    .select(
      "id, token, slug, offer_key, product_type, destination_mode, destination_url, user_id"
    )
    .eq("user_id", userId)
    .or(`slug.eq.${tokenOrSlug},offer_key.eq.${tokenOrSlug}`)
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(`User asset lookup failed: ${res.error.message}`);
  }

  return (res.data as AssetRow | null) || null;
}

async function resolveFallbackDestinationUrl(
  supabase: any,
  asset: AssetRow
): Promise<string> {
  let destinationUrl = (asset.destination_url || "").trim();

  if (!destinationUrl) {
    const destRes = await (supabase.from("user_offer_destinations") as any)
      .select("destination_url")
      .eq("user_id", asset.user_id)
      .eq("offer_key", asset.offer_key || "autoaffi")
      .maybeSingle();

    if (destRes.error) {
      throw new Error(`Destination lookup failed: ${destRes.error.message}`);
    }

    destinationUrl = (destRes.data?.destination_url || "").trim();
  }

  return destinationUrl;
}

export default async function LeadPage(props: RawPageProps) {
  const tokenOrSlug = await readTokenFromParams(props.params);
  const search = await readSearchParams(props.searchParams);
  const userCode = (search?.u || "").trim();

  const supabase: any = getAdminSupabase();

  if (!tokenOrSlug) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Missing token</h1>
          <p className="mt-2 text-white/70">This link is missing a token.</p>
        </div>
      </div>
    );
  }

  let asset: AssetRow | null = await findAssetByTokenOrSlug(
    supabase,
    tokenOrSlug
  );

  if (!asset && userCode) {
    const userId = await resolveUserIdFromUserCode(supabase, userCode);

    if (userId) {
      asset = await findAssetByUserAndSlug(supabase, userId, tokenOrSlug);
    }
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="mt-2 text-white/70">
            This QR or profile link is invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const destinationUrl = await resolveFallbackDestinationUrl(supabase, asset);
  const missingDestination = !destinationUrl;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Before you go — quick question</h1>
            <p className="mt-2 text-white/70">
              Leave your details and I’ll get back to you within{" "}
              <span className="text-white">24 hours</span>.
            </p>
            <p className="mt-3 text-white/60 text-sm">
              No spam. One clear message. Done.
            </p>

            {missingDestination ? (
              <p className="mt-3 text-amber-300 text-sm">
                Note: This link is missing a destination URL. Lead flow still works.
              </p>
            ) : null}
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            {asset.product_type || "product"}
          </div>
        </div>

        <div className="mt-6">
          <LeadCaptureClient
            token={asset.token}
            mode="lead"
            next={destinationUrl || undefined}
          />
        </div>

        <div className="mt-5 text-[11px] text-white/35">
          Token: {asset.token}
        </div>
      </div>
    </div>
  );
}