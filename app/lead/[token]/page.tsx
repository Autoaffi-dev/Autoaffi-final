import { createClient } from "@supabase/supabase-js";
import LeadCaptureClient from "./LeadCaptureClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing env for Supabase admin client");

  return createClient(url, key, { auth: { persistSession: false } });
}

// Next kan ibland ge params som Promise i nyare versioner
async function readTokenFromParams(params: any): Promise<string | null> {
  if (!params) return null;
  if (typeof params?.then === "function") {
    const resolved = await params;
    return (resolved?.token || null) as string | null;
  }
  return (params?.token || null) as string | null;
}

export default async function LeadPage(props: any) {
  const token = await readTokenFromParams(props?.params);
  const supabase = getAdminSupabase();

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Missing token</h1>
          <p className="mt-2 text-white/70">This link is missing a token.</p>
        </div>
      </div>
    );
  }

  const { data: asset } = await supabase
    .from("user_qr_assets")
    .select("token,offer_key,product_type,destination_mode,destination_url,slug,user_id")
    .eq("token", token)
    .maybeSingle();

  if (!asset) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="mt-2 text-white/70">This QR link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  // (valfritt) fallback destination, men lead-flödet ska inte redirecta till mock/premium här.
  let destinationUrl = (asset.destination_url || "").trim();
  if (!destinationUrl) {
    const { data: destRow } = await supabase
      .from("user_offer_destinations")
      .select("destination_url")
      .eq("user_id", asset.user_id)
      .eq("offer_key", asset.offer_key)
      .maybeSingle();

    destinationUrl = (destRow?.destination_url || "").trim();
  }

  const missingDestination = !destinationUrl;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Before you go — quick question</h1>
            <p className="mt-2 text-white/70">
              Leave your details and I’ll get back to you within <span className="text-white">24 hours</span>.
            </p>
            <p className="mt-3 text-white/60 text-sm">
              No spam. One clear message. Done.
            </p>

            {missingDestination ? (
              <p className="mt-3 text-amber-300 text-sm">
                Note: This link is missing a destination URL (owner must set it later).
                Lead flow still works.
              </p>
            ) : null}
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            {asset.product_type || "product"}
          </div>
        </div>

        <div className="mt-6">
          {/* ✅ FORCE LEAD MODE: även om URL råkar ha mode=both så blir det lead här */}
          <LeadCaptureClient token={token} mode={"lead"} next={destinationUrl || undefined} />
        </div>

        <div className="mt-5 text-[11px] text-white/35">
          Token: {token}
        </div>
      </div>
    </div>
  );
}