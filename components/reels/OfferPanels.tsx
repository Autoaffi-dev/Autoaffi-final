"use client";

import React from "react";

// TYPES FOR PRODUCT MOCKS (optional)
interface ProductInfo {
  id: string;
  name: string;
  stars: number;
  commission: number;
  epc: number;
  description: string;
}

interface RecurringPlatform {
  id: string;
  name: string;
  commission: number;
  highlight: boolean;
  note: string;
  subId?: string | null;        // ⬅ från /api/recurring/platforms
  affiliateUrl?: string | null; // ⬅ färdig affiliate-länk om den finns
}

interface OfferPanelsProps {
  offerMode: "product" | "recurring" | "funnel";
  setOfferMode: (v: "product" | "recurring" | "funnel") => void;

  productCategory: string;
  setProductCategory: (v: string) => void;

  manualProductSearch: string;
  setManualProductSearch: (v: string) => void;

  currentProducts: ProductInfo[];
  selectedProduct: ProductInfo | null;
  setSelectedProduct: (p: ProductInfo | null) => void;

  generateAffiliateLinkForProduct: (id: string) => void;
  affiliateLink: string | null;
  missingAffiliateWarning: boolean;

  recurringPlatform: string;
  setRecurringPlatform: (v: string) => void;

  recurringSubID: string;
  setRecurringSubID: (v: string) => void;

  recurringPlatforms: RecurringPlatform[];
  generateAffiliateLinkForRecurring: (id: string) => void;

  funnelUrl: string;
  setFunnelUrl: (v: string) => void;
}

export default function OfferPanels({
  offerMode,
  setOfferMode,

  productCategory,
  setProductCategory,
  manualProductSearch,
  setManualProductSearch,
  currentProducts,
  selectedProduct,
  setSelectedProduct,
  generateAffiliateLinkForProduct,
  affiliateLink,
  missingAffiliateWarning,

  recurringPlatform,
  setRecurringPlatform,
  recurringSubID,
  setRecurringSubID,
  recurringPlatforms,
  generateAffiliateLinkForRecurring,

  funnelUrl,
  setFunnelUrl,
}: OfferPanelsProps) {
  return (
    <section className="mb-8 rounded-2xl border border-emerald-400/40 bg-slate-900 p-5 text-sm">
      {/* TITLE */}
      <h2 className="text-sm font-semibold text-emerald-200 mb-3">
        Choose your monetization path
      </h2>

      {/* OFFER MODE TOGGLE */}
      <div className="flex gap-2 mb-5">
        {["product", "recurring", "funnel"].map((opt) => (
          <button
            key={opt}
            onClick={() => setOfferMode(opt as any)}
            className={`px-4 py-1.5 rounded-lg text-xs border transition ${
              offerMode === opt
                ? "bg-purple-600 border-purple-300 text-white shadow-[0_0_10px_rgba(192,132,252,0.4)]"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------- */}
      {/* PRODUCT MODE */}
      {/* -------------------------------------------------- */}
      {offerMode === "product" && (
        <div className="space-y-4">
          {/* CATEGORY SELECT — DARK UI FIXED */}
          <div>
            <label className="text-xs font-semibold">Product Category</label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className="w-full mt-1 rounded-lg bg-slate-800 border border-slate-600 text-xs px-3 py-2 text-slate-200"
            >
              <option value="ai">AI</option>
              <option value="business">Business</option>
              <option value="fitness">Fitness</option>
              <option value="crypto">Crypto</option>
              <option value="education">Education</option>
            </select>
          </div>

          {/* MANUAL PRODUCT SEARCH */}
          <div>
            <label className="text-xs font-semibold">Search products</label>
            <input
              type="text"
              value={manualProductSearch}
              onChange={(e) => setManualProductSearch(e.target.value)}
              className="w-full mt-1 rounded-lg bg-slate-800 border border-slate-600 text-xs px-3 py-2 text-slate-200"
              placeholder="Search manually..."
            />
          </div>

          {/* PRODUCT RESULTS */}
          <div className="space-y-3">
            {currentProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  generateAffiliateLinkForProduct(p.id); // RAWID → affiliate-länk
                }}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedProduct?.id === p.id
                    ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-semibold text-slate-100">
                  {p.name}
                </p>
                <p className="text-xs text-slate-400">{p.description}</p>

                <div className="flex gap-3 text-[11px] mt-2 text-slate-300">
                  <span>⭐ {p.stars}</span>
                  <span>{p.commission}% commission</span>
                  <span>EPC ${p.epc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AFFILIATE LINK DISPLAY */}
          {selectedProduct && (
            <div className="mt-4">
              {missingAffiliateWarning ? (
                <p className="text-xs text-red-400">
                  You must add your affiliate ID for this network in your
                  dashboard.
                </p>
              ) : (
                affiliateLink && (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs break-all bg-slate-950/80 border border-slate-700 px-3 py-2 rounded-lg text-slate-200">
                      {affiliateLink}
                    </p>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(affiliateLink)
                      }
                      className="px-3 py-1 rounded-lg text-xs bg-purple-600 text-white"
                    >
                      Copy
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* RECURRING MODE */}
      {/* -------------------------------------------------- */}
      {offerMode === "recurring" && (
        <div className="space-y-4">
          <label className="text-xs font-semibold">Recurring Platform</label>

          <div className="space-y-2">
            {recurringPlatforms.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  // Markera vald plattform
                  setRecurringPlatform(p.id);

                  // Sätt aktivt tracking-ID i state (kommer från user_recurring_platforms)
                  setRecurringSubID(p.subId ?? "");

                  // Låt page.tsx hantera affiliateLink via denna callback
                  generateAffiliateLinkForRecurring(p.id);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  recurringPlatform === p.id
                    ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-semibold text-slate-100">
                  {p.name}
                </p>
                <p className="text-xs text-slate-400">{p.note}</p>

                <p className="text-[11px] text-emerald-300 mt-1">
                  {p.commission}% recurring commission
                </p>

                {p.highlight && (
                  <p className="text-[10px] text-amber-300 mt-1">
                    Autoaffi recommended
                  </p>
                )}

                {p.subId && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Your tracking ID:{" "}
                    <span className="text-emerald-300">{p.subId}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Aktivt tracking-ID (visas under listan) */}
          {recurringSubID && (
            <div className="mt-2 text-[11px] text-slate-500">
              <p>
                Active tracking ID:&nbsp;
                <span className="text-emerald-300">{recurringSubID}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* FUNNEL MODE */}
      {/* -------------------------------------------------- */}
      {offerMode === "funnel" && (
        <div className="space-y-3">
          <label className="text-xs font-semibold">Funnel URL (rawid)</label>
          <input
            type="text"
            value={funnelUrl}
            onChange={(e) => setFunnelUrl(e.target.value)}
            placeholder="https://your-funnel.com"
            className="w-full rounded-lg bg-slate-800 border border-slate-600 text-xs px-3 py-2 text-slate-200"
          />

          <p className="text-[10px] text-slate-400">
            Autoaffi will sync this funnel ID to hooks, CTA, timeline & affiliate
            tracking.
          </p>
        </div>
      )}
    </section>
  );
}