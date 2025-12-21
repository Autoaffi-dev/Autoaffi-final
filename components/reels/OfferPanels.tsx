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
}

interface OfferPanelsProps {
  // OFFER MODE
  offerMode: "product" | "recurring" | "funnel";
  setOfferMode: (v: "product" | "recurring" | "funnel") => void;

  // PRODUCT STATE
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

  // RECURRING STATE
  recurringPlatform: string;
  setRecurringPlatform: (v: string) => void;

  recurringSubID: string;
  setRecurringSubID: (v: string) => void;

  recurringPlatforms: RecurringPlatform[];
  generateAffiliateLinkForRecurring: (id: string) => void;

  // FUNNEL STATE
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
  recurringPlatforms,
  generateAffiliateLinkForRecurring,

  funnelUrl,
  setFunnelUrl,
}: OfferPanelsProps) {
  return (
    <section className="mb-8 rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-5 text-sm">

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
                : "bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>

      {/* PRODUCT MODE PANEL */}
      {offerMode === "product" && (
        <div className="space-y-4">

          {/* CATEGORY SELECT */}
          <div>
            <label className="text-xs font-semibold">Product Category</label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className="w-full mt-1 rounded-lg bg-black/20 border border-white/10 text-xs px-3 py-2"
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
              className="w-full mt-1 rounded-lg bg-black/20 border border-white/10 text-xs px-3 py-2"
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
                  generateAffiliateLinkForProduct(p.id);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedProduct?.id === p.id
                    ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-semibold text-slate-100">{p.name}</p>
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
                  You must add your affiliate ID for this network in your dashboard.
                </p>
              ) : (
                affiliateLink && (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs break-all bg-slate-950/80 border border-slate-700 px-3 py-2 rounded-lg">
                      {affiliateLink}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(affiliateLink)}
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

      {/* RECURRING MODE PANEL */}
      {offerMode === "recurring" && (
        <div className="space-y-4">

          <label className="text-xs font-semibold">Recurring Platform</label>

          <div className="space-y-2">
            {recurringPlatforms.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setRecurringPlatform(p.id);
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
              </div>
            ))}
          </div>

          {/* SUBID DISPLAY IF EXISTS */}
          {recurringSubID && (
            <p className="text-[11px] text-slate-500">
              Sub ID: <span className="text-emerald-300">{recurringSubID}</span>
            </p>
          )}
        </div>
      )}

      {/* FUNNEL MODE PANEL */}
      {offerMode === "funnel" && (
        <div className="space-y-3">
          <label className="text-xs font-semibold">Funnel URL</label>
          <input
            type="text"
            value={funnelUrl}
            onChange={(e) => setFunnelUrl(e.target.value)}
            placeholder="https://your-funnel.com"
            className="w-full rounded-lg bg-black/20 border border-white/10 text-xs px-3 py-2"
          />

          <p className="text-[10px] text-slate-400">
            Autoaffi will use this funnel in the CTA, hook angle & timeline.
          </p>
        </div>
      )}
    </section>
  );
}