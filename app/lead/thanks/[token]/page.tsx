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

function buildThanksCopy(productType?: string) {
  const pt = (productType || "").toLowerCase();

  if (pt.includes("hoodie")) {
    return {
      kicker: "Autoaffi",
      headline: "Thank you — I’ll reach out personally within 24 hours 🙌",
      body: [
        "I got your message. Respect — you’re the kind of person who moves when something feels real.",
        "Within 24 hours I’ll send you a clear next step + how this flow works (without any fluff).",
      ],
      micro: "If you want to speed it up: reply with one line — what you want most (leads / extra income / growth).",
    };
  }

  if (pt.includes("sticker") || pt.includes("decal") || pt.includes("klister")) {
    return {
      kicker: "Autoaffi",
      headline: "Haha — you actually found me 😀",
      body: [
        "Quick question: where did you find this QR? Which place or country are you in? 😉",
        "Stickers tend to trigger real curiosity — especially in public, high-traffic spots. That’s why this can become a strong lead magnet when used smart.",
        "I’ll contact you within 24 hours and show you exactly how the flow works and how to use it in a clean way.",
      ],
      micro: "No spam. One clear message + next step.",
    };
  }

  if (pt.includes("phone") || pt.includes("case") || pt.includes("mobil")) {
    return {
      kicker: "Autoaffi",
      headline: "Thank you — I’ll contact you within 24 hours ✅",
      body: [
        "I’ve got your details and I’ll reach out personally with more info on how my setup works.",
        "The goal is simple: interest → contact → a clean path forward, without it feeling salesy.",
      ],
      micro: "Want it faster? Reply with your biggest challenge (time / ideas / money / growth).",
    };
  }

  return {
    kicker: "Autoaffi",
    headline: "Thank you — I’ll contact you within 24 hours ✅",
    body: [
      "I’ve received your request and I’ll reach out personally with the next step.",
      "The goal is to keep this simple, clear, and actually useful.",
    ],
    micro: "No spam. Just value.",
  };
}

export default async function LeadThanksPage(props: any) {
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
    .select("token,product_type")
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

  const copy = buildThanksCopy(asset?.product_type);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-3xl border border-white/10 bg-white/5 p-7 md:p-10">
        <div className="text-xs uppercase tracking-wider text-white/60">{copy.kicker}</div>

        <h1 className="mt-2 text-3xl md:text-4xl font-semibold leading-tight">
          {copy.headline}
        </h1>

        <div className="mt-4 space-y-3 text-white/75">
          {copy.body.map((p: string) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-6 text-[12px] text-white/50">{copy.micro}</div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/l/${encodeURIComponent(token)}`}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Back to the page
          </Link>

          <Link
            href={`/`}
            className="inline-flex items-center justify-center rounded-full bg-yellow-300 px-6 py-3 text-sm font-semibold text-black hover:bg-yellow-200 transition"
          >
            Visit Autoaffi
          </Link>
        </div>

        <div className="mt-6 text-[11px] text-white/45">
          Token: {token}
        </div>
      </div>
    </div>
  );
}