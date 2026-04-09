import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import AutoContinue from "./AutoContinue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfferRow = {
  id: string;
  title: string | null;
  description: string | null;
  source: string | null;
  category: string | null;
  niche: string | null;
  merchant_name: string | null;
  image_url: string | null;
  product_url: string | null;
  affiliate_link: string | null;
  subid: string | null;
  is_primary: boolean | null;
  is_pinned: boolean | null;
};

function safeUrl(value?: string | null) {
  const v = String(value || "").trim();
  if (!v) return null;

  try {
    return new URL(v).toString();
  } catch {
    return null;
  }
}

function sourceLabel(source?: string | null) {
  switch ((source || "").toLowerCase()) {
    case "awin":
      return "Awin";
    case "cj":
      return "CJ";
    case "rakuten":
      return "Rakuten";
    case "warriorplus":
      return "WarriorPlus";
    case "aliexpress":
      return "AliExpress";
    case "byo":
      return "Custom Link";
    default:
      return source || "Offer";
  }
}

function shortDescription(offer: OfferRow) {
  if (offer.description?.trim()) return offer.description.trim();

  if (offer.category?.trim()) {
    return `A selected ${offer.category.trim().toLowerCase()} offer prepared inside Autoaffi.`;
  }

  return "A selected offer prepared inside Autoaffi and ready to continue to the product page.";
}

export default async function OfferBridgePage({
  params,
}: {
  params: Promise<{ savedId: string }> | { savedId: string };
}) {
  const resolvedParams =
    typeof (params as any)?.then === "function"
      ? await (params as Promise<{ savedId: string }>)
      : (params as { savedId: string });

  const savedId = String(resolvedParams?.savedId || "").trim();

  if (!savedId) notFound();

  const lookup = await supabaseAdmin
    .from("user_offers")
    .select(
      [
        "id",
        "title",
        "description",
        "source",
        "category",
        "niche",
        "merchant_name",
        "image_url",
        "product_url",
        "affiliate_link",
        "subid",
        "is_primary",
        "is_pinned",
      ].join(",")
    )
    .eq("id", savedId)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    notFound();
  }

  const offer = lookup.data as unknown as OfferRow;
  const continueUrl = `/go/offer/${offer.id}`;
  const sourceUrl = safeUrl(offer.product_url);
  const title = offer.title || "Selected Offer";
  const source = sourceLabel(offer.source);
  const description = shortDescription(offer);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border border-slate-800/80 bg-slate-950/85 p-5 md:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Autoaffi Selected Offer
          </p>

          <h1 className="max-w-3xl text-2xl font-extrabold tracking-tight md:text-4xl leading-tight">
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-[15px]">
            Continue to view this selected offer. We prepared this page to give you
            a cleaner handoff before opening the product page.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <Badge>{source}</Badge>
            {offer.category ? <Badge>{offer.category}</Badge> : null}
            {offer.niche ? <Badge>{offer.niche}</Badge> : null}
            {offer.is_pinned ? <Badge>Pinned Pick</Badge> : null}
            {offer.is_primary ? <Badge variant="gold">Featured Offer</Badge> : null}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              {offer.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offer.image_url}
                  alt={title}
                  className="h-full min-h-[220px] w-full object-cover"
                />
              ) : (
                <div className="flex min-h-[220px] items-center justify-center px-4 text-center text-[12px] text-slate-500">
                  Product preview unavailable
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Why continue
              </p>

              <ul className="mt-3 space-y-2 text-[13px] text-slate-300">
                <li>• Clean handoff before opening the external product page</li>
                <li>• Quick product overview before you continue</li>
                <li>• Easier experience than jumping out instantly</li>
              </ul>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Product overview
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                {description}
              </p>

              {offer.merchant_name ? (
                <p className="mt-4 text-[12px] text-slate-400">
                  Seller:{" "}
                  <span className="font-semibold text-slate-200">
                    {offer.merchant_name}
                  </span>
                </p>
              ) : null}

              <AutoContinue continueUrl={continueUrl} sourceUrl={sourceUrl} />
            </div>
          </div>

          <p className="mt-5 text-[11px] text-slate-500">
            Some marketplaces may still show their own sign-in or pop-up prompts
            after you continue. That behavior comes from the destination platform.
          </p>
        </section>
      </div>
    </main>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "gold";
}) {
  const cls =
    variant === "gold"
      ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200"
      : "border-slate-700 bg-slate-900/70 text-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}