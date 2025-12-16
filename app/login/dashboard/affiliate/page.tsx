"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Plan = "basic" | "pro" | "elite";

function resolvePlan(input?: string | string[] | null): Plan {
  if (!input) return "basic";
  const v = Array.isArray(input) ? input[0] : input;
  const lower = v.toLowerCase();
  if (lower === "pro") return "pro";
  if (lower === "elite") return "elite";
  return "basic";
}

function planLabel(plan: Plan) {
  if (plan === "elite") return "Elite";
  if (plan === "pro") return "Pro";
  return "Basic";
}

interface AffiliateFormState {
  digistoreId: string;
  myleadId: string;
  cpaleadId: string;
  impactId: string;
  amazonTrackingId: string;
  customNetworkName: string;
  customNetworkId: string;
}

const initialFormState: AffiliateFormState = {
  digistoreId: "",
  myleadId: "",
  cpaleadId: "",
  impactId: "",
  amazonTrackingId: "",
  customNetworkName: "",
  customNetworkId: "",
};

export default function AffiliatePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const activePlan = resolvePlan(searchParams?.plan);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AffiliateFormState>(initialFormState);

  const mlgsCopy = useMemo(() => {
    if (activePlan === "elite") {
      return {
        title: "MLGS Leads Engine – daily",
        bullet: "Elite: daily fresh leads delivered into your Leads Hub.",
      };
    }
    if (activePlan === "pro") {
      return {
        title: "MLGS Leads Engine – 3x per week",
        bullet: "Pro: leads delivered 3x per week into your Leads Hub.",
      };
    }
    return {
      title: "MLGS Leads Engine",
      bullet:
        "Pro: 3x per week • Elite: daily. Basic can still use MyLead & CPAlead.",
    };
  }, [activePlan]);

  function updateField<K extends keyof AffiliateFormState>(
    key: K,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setSaveMessage(null);

      const res = await fetch("/api/affiliate/save-ids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to save affiliate IDs");
      }

      setSaveMessage("Saved! Your IDs are now used across Autoaffi.");
    } catch (err: any) {
      console.error("Save affiliate IDs error:", err);
      setSaveMessage("Could not save right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* HEADER */}
        <header className="mb-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Affiliate Links &amp; Offers
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Set up your{" "}
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              affiliate IDs &amp; core networks
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm md:text-[15px] text-slate-300">
            Autoaffi never logs into networks for you.{" "}
            <span className="font-semibold text-yellow-300">
              You create your own affiliate accounts and IDs,
            </span>{" "}
            then Autoaffi uses them to suggest offers, content angles and track
            performance across Posts, Reels and Funnels.
          </p>
        </header>

        {/* CURRENT PLAN STATUS */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Current plan
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-50">
              {planLabel(activePlan)} – Affiliate stack
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              All plans can add affiliate IDs and choose networks.{" "}
              <span className="text-yellow-300">
                Pro &amp; Elite unlock deeper automation, lead engines and
                smarter suggestions, but your base stack is always yours.
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900">
              {planLabel(activePlan)}
            </span>
            <div className="flex gap-2 text-[11px]">
              <Link
                href="/login/dashboard/pricing"
                className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 font-semibold text-slate-900 shadow-md hover:brightness-110 transition"
              >
                Upgrade plan
              </Link>
            </div>
          </div>
        </section>

        {/* STEP 1 – CREATE / SIGN IN */}
        <StepBlock
          step="1"
          title="Create / sign in to your affiliate accounts"
          highlight="You own the accounts. Autoaffi just uses your IDs and public product pages."
        >
<p className="text-[13px] text-slate-300 mb-3">
  To earn and track commissions, you need your own affiliate
  accounts. Start with these{" "}
  <span className="text-slate-200 font-semibold">
    recommended core networks
  </span>
  :
</p>

          <p className="text-[11px] text-amber-300 font-semibold mb-2">
  Recommended: Add at least <span className="text-yellow-400">3 networks </span>
  to maximize offer matches and improve your earnings potential.
</p>

          <div className="grid gap-3 md:grid-cols-2">
            <NetworkCard
              name="Digistore24"
              type="Digital products · Core"
              badge="Recommended"
              bullets={[
                "Large digital product marketplace",
                "Strong EPC on top offers",
                "Perfect for front-end & backend offers",
              ]}
              howTo={[
                "Create a free Digistore24 account.",
                "Find your affiliate settings (account → profile) to see your ID.",
                "You can also click “Promote now” on any product – the link will contain your ID.",
              ]}
            />
            <NetworkCard
              name="MyLead"
              type="CPA & lead offers · Core"
              badge="Core"
              bullets={[
                "CPA, CPL and mixed payout models",
                "Works well with social media traffic",
                "Great for quick-win offers and testing",
              ]}
              howTo={[
                "Register a free MyLead account.",
                "Check your profile / tools section for your main ID or prefix.",
                "When you open a campaign, your tracking link will include the same ID.",
              ]}
            />
            <NetworkCard
              name="CPAlead"
              type="CPA & mobile · Test lab"
              badge="Test"
              bullets={[
                "Mobile-friendly & incentive offers",
                "Useful for some GEOs & niches",
                "Great as an experiment channel",
              ]}
              howTo={[
                "Sign up to CPAlead as publisher.",
                "Open your profile to see your account ID / prefix.",
                "Any offer you open will reuse this ID inside the tracking link.",
              ]}
            />
            <NetworkCard
              name="Amazon Associates"
              type="Physical products · Trust"
              badge="Trust"
              bullets={[
                "Physical products & bundles",
                "Lower commissions but huge trust",
                "Perfect as a complement to digital offers",
              ]}
              howTo={[
                "Create an Amazon Associates account.",
                "Use the SiteStripe or Associates panel to see your tracking ID.",
                "When you create a product link, it will automatically include that ID.",
              ]}
            />
            <NetworkCard
              name="Impact"
              type="Brand & SaaS · Premium"
              badge="Premium"
              bullets={[
                "Access to strong SaaS & brand programs",
                "Often high-quality, long-term partnerships",
                "Perfect for niche-specific recurring offers",
              ]}
              howTo={[
                "Create an Impact account.",
                "Apply to programs that fit your niche.",
                "Your base affiliate link or parameters will be visible in each program.",
              ]}
            />
            <NetworkCard
              name="Custom / Other network"
              type="Any network with a trackable link"
              badge="Flexible"
              bullets={[
                "Use any network that gives an affiliate link or ID.",
                "Autoaffi treats it as part of your stack.",
                "Good for country-specific or niche networks.",
              ]}
              howTo={[
                "Sign up to your chosen network.",
                "Locate your main affiliate ID or base link in the account.",
                "Add the ID/link in the fields below.",
              ]}
            />
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            You can always add more networks later.{" "}
            <span className="text-yellow-300">
              Autoaffi only needs IDs and public product URLs – never passwords.
            </span>
          </p>
        </StepBlock>

        {/* STEP 2 – ADD IDS */}
        <StepBlock
          step="2"
          title="Add your affiliate IDs and main links"
          highlight="You add them once – Autoaffi reuses them across content, campaigns and products."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <IdFieldCard
              title="Core networks – IDs"
              description="These IDs are used by Product Discovery, Reels, Posts and future reporting."
            >
              <Field
                label="Digistore24 affiliate ID / username"
                placeholder="e.g. yourname"
                value={form.digistoreId}
                onChange={(v) => updateField("digistoreId", v)}
              />
              <Field
                label="MyLead partner ID / main link ID"
                placeholder="e.g. 123456 or partner-name"
                value={form.myleadId}
                onChange={(v) => updateField("myleadId", v)}
              />
              <Field
                label="CPAlead account ID / tracking prefix"
                placeholder="e.g. 98765 or yourprefix"
                value={form.cpaleadId}
                onChange={(v) => updateField("cpaleadId", v)}
              />
              <Field
                label="Impact affiliate ID / account identifier"
                placeholder="e.g. affiliate123 or your-impact-id"
                value={form.impactId}
                onChange={(v) => updateField("impactId", v)}
              />
              <Field
                label="Amazon tracking ID"
                placeholder="e.g. yourbrand-21"
                value={form.amazonTrackingId}
                onChange={(v) => updateField("amazonTrackingId", v)}
              />
            </IdFieldCard>

            <IdFieldCard
              title="Custom / future networks"
              description="Any other network that pays you via a trackable link can be added here."
            >
              <Field
                label="Custom network name"
                placeholder="e.g. Awin, CJ, local network"
                value={form.customNetworkName}
                onChange={(v) => updateField("customNetworkName", v)}
              />
              <Field
                label="Custom network affiliate ID / base link"
                placeholder="Paste your main affiliate link or ID"
                value={form.customNetworkId}
                onChange={(v) => updateField("customNetworkId", v)}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Autoaffi will treat this as part of your stack and include it
                when recommending offers or building links, as long as the
                format is consistent.
              </p>
            </IdFieldCard>
          </div>

          {/* SAVE ROW */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 max-w-md">
              When you save,{" "}
              <span className="text-yellow-300">
                Autoaffi stores your IDs centrally
              </span>{" "}
              so Reels, Posts, Funnels and Product Discovery can all build links
              with the correct tracking.
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-md hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "Saving..." : "Save affiliate IDs"}
            </button>
          </div>
          {saveMessage && (
            <p className="mt-2 text-[11px] text-yellow-300">{saveMessage}</p>
          )}

          {/* MLGS TOGGLE INFO (LEADS) */}
          <div className="mt-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
                {mlgsCopy.title}
              </p>
              <p className="mt-1 text-[12px] text-yellow-100">
                {mlgsCopy.bullet}
              </p>
              <p className="mt-1 text-[11px] text-yellow-100/80">
                Leads appear in <span className="font-semibold">Leads Hub</span>{" "}
                and <span className="font-semibold">Contact Manager</span>. You
                decide which campaigns they belong to. MLGS leads are handled at
                platform level – you still control how you use them.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {activePlan === "basic" && (
                <>
                  <span className="inline-flex items-center rounded-full border border-yellow-500/40 bg-slate-950/80 px-3 py-1 text-[11px] text-yellow-300">
                    Upgrade to Pro or Elite to enable MLGS Leads Engine
                  </span>
                  <Link
                    href="/login/dashboard/pricing"
                    className="text-[11px] text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
                  >
                    See plans &amp; what&apos;s included ↗
                  </Link>
                </>
              )}

              {activePlan === "pro" && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
                  MLGS Leads Engine: active 3x per week (Pro)
                </span>
              )}

              {activePlan === "elite" && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-100">
                  MLGS Leads Engine: daily distribution (Elite)
                </span>
              )}
            </div>
          </div>
        </StepBlock>

        {/* STEP 3 – HOW AUTOAFFI USES YOUR IDS */}
        <StepBlock
          step="3"
          title="How Autoaffi uses your links & IDs"
          highlight="This is why your IDs matter – and how they connect to the rest of the platform."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Inside Content Optimizer (Posts & Reels)"
              bullets={[
                "Suggests offers that match your niche and audience.",
                "Hooks & captions can mention the outcomes your offers deliver.",
                "Links are attached to content so you don’t have to copy/paste every time.",
              ]}
              footer="You always decide which offer is used in each post or reel."
            />
            <InfoCard
              title="Inside campaigns, funnels & insights"
              bullets={[
                "Campaigns show which offers are attached and how they perform over time.",
                "Funnel Builders help you keep a consistent backend (OLSP / HBA / CF etc.).",
                "Future advanced engines can use your IDs to rotate similar offers safely.",
              ]}
              footer="Networks still pay you directly – Autoaffi only routes traffic and gives you better decisions."
            />
          </div>

          <p className="mt-4 text-[11px] text-slate-500 max-w-xl">
            Autoaffi never changes payout rules and never needs your passwords.
            You own the accounts, Autoaffi just helps you use them smarter.
          </p>
        </StepBlock>
      </div>
    </main>
  );
}

/* ---------- Small layout helpers ---------- */

function StepBlock({
  step,
  title,
  highlight,
  children,
}: {
  step: string;
  title: string;
  highlight?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-slate-900">
            {step}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
            {highlight && (
              <p className="mt-1 max-w-xl text-[11px] text-slate-400">
                {highlight}
              </p>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function NetworkCard({
  name,
  type,
  bullets,
  howTo,
  badge,
}: {
  name: string;
  type: string;
  bullets: string[];
  howTo: string[];
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-50">{name}</p>
          <p className="text-[11px] text-slate-400">{type}</p>
        </div>
        {badge && (
          <span className="rounded-full border border-yellow-400/70 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
            {badge}
          </span>
        )}
      </div>
      <ul className="space-y-1 text-[12px] text-slate-300">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
      <div className="mt-2 rounded-xl border border-slate-800/80 bg-slate-950/80 p-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          How to get your ID
        </p>
        <ul className="space-y-1 text-[11px] text-slate-400">
          {howTo.map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IdFieldCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
        {title}
      </p>
      <p className="mb-3 text-[11px] text-slate-400">{description}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[11px] text-slate-200">
      <span className="mb-1 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[12px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/70 focus:border-yellow-400/60"
      />
    </label>
  );
}

function InfoCard({
  title,
  bullets,
  footer,
}: {
  title: string;
  bullets: string[];
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
        {title}
      </p>
      <ul className="space-y-1.5 text-[12px] text-slate-300">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
      {footer && <p className="mt-2 text-[11px] text-slate-500">{footer}</p>}
    </div>
  );
}