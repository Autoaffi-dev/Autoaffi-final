"use client";

import React from "react";

interface Props {
  offerMeta: any;
  onCopyLink: () => void;
}

export default function OfferMetaPanel({ offerMeta, onCopyLink }: Props) {
  if (!offerMeta) return null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-100">
            Offer attached to this reel
          </p>
          <p className="text-xs text-slate-300">{offerMeta.name}</p>
        </div>

        {/* RATING */}
        {typeof offerMeta.rating === "number" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 border border-emerald-400/50 px-3 py-1 text-[11px] text-emerald-200">
            ⭐ {offerMeta.rating.toFixed(1)}/5
          </span>
        )}
      </div>

      {/* TAGS */}
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 mb-2">
        {offerMeta.mode && (
          <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
            Mode: {offerMeta.mode}
          </span>
        )}

        {offerMeta.commissionRate && (
          <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
            Commission: {offerMeta.commissionRate}
          </span>
        )}

        {offerMeta.epc && (
          <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
            EPC: ${offerMeta.epc}
          </span>
        )}

        {offerMeta.category && (
          <span className="rounded-full bg-slate-950/80 border border-slate-700 px-2 py-0.5">
            {offerMeta.category}
          </span>
        )}
      </div>

      {/* AFFILIATE URL */}
      {offerMeta.affiliateUrl && (
        <div className="mt-2">
          <p className="text-[11px] text-slate-400 mb-1">
            Affiliate link Autoaffi suggests for this reel:
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex-1 break-all rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-100">
              {offerMeta.affiliateUrl}
            </p>

            <button
              type="button"
              onClick={onCopyLink}
              className="mt-1 sm:mt-0 rounded-full border border-emerald-400/70 bg-slate-950 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/10"
            >
              Copy link
            </button>
          </div>

          <p className="mt-1 text-[10px] text-slate-500">
            Use this in your description or first comment. Autoaffi will also
            weave it into your CTA.
          </p>
        </div>
      )}
    </div>
  );
}