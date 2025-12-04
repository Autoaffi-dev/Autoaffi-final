"use client";

type Plan = "basic" | "pro" | "elite";

export type SEOSectionsProps = {
  plan: Plan;
  hasLink: boolean;
};

export default function SEOSections({ plan, hasLink }: SEOSectionsProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 space-y-3 text-[11px] text-slate-300">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        How Autoaffi SEO helper works
      </p>

      <p>
        <span className="font-semibold text-yellow-300">1. You write or generate content.</span>{" "}
        Autoaffi reads the text and does a quick health check for social SEO.
      </p>

      <p>
        <span className="font-semibold text-yellow-300">2. We suggest keywords & hashtags.</span>{" "}
        These are{" "}
        <span className="text-slate-200">starting points, not magic words</span>. Tweak them to fit
        your niche, offer and style.
      </p>

      <p>
        <span className="font-semibold text-yellow-300">3. Links make it smarter.</span>{" "}
        {hasLink ? (
          <>You&apos;ve added a link – great. Autoaffi assumes this is your main CTA for the post.</>
        ) : (
          <>
            You haven&apos;t added a link yet. When you paste a link, Autoaffi will optimize with a
            clear &quot;reason to click&quot; in mind.
          </>
        )}
      </p>

      {plan === "basic" && (
        <p className="text-slate-400">
          On <span className="text-slate-50 font-semibold">Basic</span>, you get the core SEO
          helper. Upgrade later to unlock deeper trend analysis and cross-platform optimization.
        </p>
      )}

      {plan === "pro" && (
        <p className="text-slate-400">
          On <span className="text-slate-50 font-semibold">Pro</span>, you&apos;ll later unlock
          multi-platform suggestions and more advanced keyword sets as we roll them out.
        </p>
      )}

      {plan === "elite" && (
        <p className="text-slate-400">
          On <span className="text-yellow-300 font-semibold">Elite</span>, this panel will connect
          to deeper engines like Viral AI & Network Insights for smarter angles.
        </p>
      )}
    </div>
  );
}