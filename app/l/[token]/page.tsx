import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readTokenFromParams(params: any): Promise<string | null> {
  if (!params) return null;
  if (typeof params?.then === "function") {
    const resolved = await params;
    return (resolved?.token || null) as string | null;
  }
  return (params?.token || null) as string | null;
}

function Gold({ children }: { children: React.ReactNode }) {
  return <span className="text-yellow-300">{children}</span>;
}

function buildCopy(productType?: string) {
  const pt = (productType || "").toLowerCase();

  const proof = [
    { label: "Setup time", value: "2 minutes" },
    { label: "Response", value: "Within 24h" },
    { label: "Spam", value: "Nope" },
  ];

  // HOODIE
  if (pt.includes("hoodie")) {
    return {
      kicker: (
        <>
          <Gold>AUTOAFFI</Gold> • premium signal
        </>
      ),
      headline: (
        <>
          This hoodie isn’t merch — it’s a <Gold>signal</Gold>.
        </>
      ),
      subhead:
        "If you scanned this, you’re not “curious”. You’re looking for something that actually makes sense.",
      story: [
        "Most people want momentum — but they don’t have a system.",
        "I’m building a clean setup that turns attention into a simple flow: scan → choose → next step.",
      ],
      bullets: [
        "One link. One QR. One place to run it.",
        "If you want the fast-track: hit Join (mock checkout for now).",
        "If you want a personal reply: hit Contact — I’ll reach out within 24 hours.",
      ],
      closer: (
        <>
          Can you still see me? Come talk to me — and I’ll tell you more. <Gold>🙂</Gold>
        </>
      ),
      proof,
    };
  }

  // STICKER / DECAL
  if (pt.includes("sticker") || pt.includes("decal") || pt.includes("klister")) {
    return {
      kicker: (
        <>
          <Gold>AUTOAFFI</Gold> • found in the wild
        </>
      ),
      headline: (
        <>
          You found the sticker. That wasn’t random <Gold>😄</Gold>
        </>
      ),
      subhead:
        "Quick question before you choose a button…",
      story: [
        "I wonder where you found me — which place or country are you in? 😉",
        "Stickers in public, high-traffic spots create real curiosity — and curiosity is exactly where strong leads start.",
        "If you want, I’ll explain the simple system behind it (clean, trackable, and not spammy).",
      ],
      bullets: [
        "Join = see the premium fast-track (mock checkout for now).",
        "Contact = I reply personally within 24 hours.",
        "No pressure. Just a clear next step.",
      ],
      closer: (
        <>
          Either way — you’re here now. Let’s make it useful. <Gold>✨</Gold>
        </>
      ),
      proof,
    };
  }

  // PHONE CASE
  if (pt.includes("phone") || pt.includes("case") || pt.includes("mobil")) {
    return {
      kicker: (
        <>
          <Gold>AUTOAFFI</Gold> • stand out
        </>
      ),
      headline: (
        <>
          This phone case stands out. So should your <Gold>next step</Gold>.
        </>
      ),
      subhead:
        "Most people scroll past opportunities. You didn’t. That’s the difference.",
      story: [
        "You don’t need motivation — you need a simple path that makes sense.",
        "This is that path: scan → choose → either a personal reply or the premium fast-track.",
      ],
      bullets: [
        "Join = go straight to the premium preview (mock checkout for now).",
        "Contact = I reply personally within 24 hours.",
        "No spam. No weird funnel energy.",
      ],
      closer: (
        <>
          Can you still see me? Come talk to me — and I’ll tell you more. <Gold>🙂</Gold>
        </>
      ),
      proof,
    };
  }

  // DEFAULT
  return {
    kicker: (
      <>
        <Gold>AUTOAFFI</Gold> • quick choice
      </>
    ),
    headline: (
      <>
        Choose your route — <Gold>fast-track</Gold> or personal reply
      </>
    ),
    subhead: "Premium shows the setup. Contact gets a reply within 24 hours.",
    story: [
      "This is a simple, trackable flow built for real people.",
      "Pick what fits you right now — and you’ll get a clear next step.",
    ],
    bullets: ["Join = premium preview (mock).", "Contact = personal reply.", "No spam."],
    closer: <>Let’s keep it simple. <Gold>✅</Gold></>,
    proof: [
      { label: "Setup time", value: "2 minutes" },
      { label: "Response", value: "Within 24h" },
      { label: "Spam", value: "Nope" },
    ],
  };
}

export default async function LandingPage(props: any) {
  const token = await readTokenFromParams(props?.params);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Missing token</h1>
          <p className="mt-2 text-white/70">This link is missing a token.</p>
        </div>
      </div>
    );
  }

  const supabase = getAdminSupabase();

  const { data: asset, error: assetErr } = await supabase
    .from("user_qr_assets")
    .select("id,user_id,token,offer_key,product_type,destination_mode,destination_url,slug")
    .eq("token", token)
    .maybeSingle();

  if (assetErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Server error</h1>
          <p className="mt-2 text-white/70">{assetErr.message}</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="mt-2 text-white/70">This QR link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  // destination fallback (same logic as /go)
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

  const mode = (asset.destination_mode || "affiliate") as "affiliate" | "lead" | "both";
  const copy = buildCopy(asset.product_type);

  // ✅ Join -> mock checkout (Stripe later)
  const joinHref = `/checkout/mock/${encodeURIComponent(token)}${
    destinationUrl ? `?dest=${encodeURIComponent(destinationUrl)}` : ""
  }`;

  // ✅ Contact -> lead form (lead-only)
  const contactHref = `/lead/${encodeURIComponent(token)}?mode=lead`;

  const showJoin = mode !== "lead";
  const showContact = mode !== "affiliate";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-3xl border border-white/10 bg-white/5 p-7 md:p-10">
        <div className="text-xs uppercase tracking-wider text-white/60">{copy.kicker}</div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{copy.headline}</h1>
          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            {asset.product_type || "product"}
          </div>
        </div>

        <p className="mt-3 text-white/70 text-base md:text-lg">{copy.subhead}</p>

        <div className="mt-5 space-y-3 text-white/75">
          {copy.story.map((p: string) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-6 grid gap-2 text-sm text-white/75">
          {copy.bullets.map((b: string) => (
            <div key={b} className="flex gap-2">
              <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-300/60" />
              <div>{b}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {copy.proof.map((p: any) => (
            <div key={p.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xs text-white/50">{p.label}</div>
              <div className="mt-1 font-semibold">{p.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 text-sm text-white/70">
          <span className="text-white/55">Before you choose:</span>{" "}
          <span className="font-medium">{copy.closer}</span>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {showJoin ? (
            <Link
              href={joinHref}
              className="inline-flex items-center justify-center rounded-full bg-yellow-300 px-6 py-3 text-sm font-semibold text-black hover:bg-yellow-200 transition"
            >
              Join the Autoaffi family
            </Link>
          ) : null}

          {showContact ? (
            <Link
              href={contactHref}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Contact me
            </Link>
          ) : null}
        </div>

        <div className="mt-6 text-[11px] text-white/45">
          Token: {token}
          {!destinationUrl ? (
            <div className="mt-2 text-amber-300/90">
              Missing destination URL (affiliate redirect). The flow still works — but “real” affiliate redirect needs destination_url set.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}