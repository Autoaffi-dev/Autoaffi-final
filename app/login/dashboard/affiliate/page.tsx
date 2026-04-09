"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type ProductSource =
  | "all"
  | "awin"
  | "cj"
  | "rakuten"
  | "warriorplus"
  | "aliexpress";

type CategoryKey =
  | "all"
  | "tech"
  | "gadgets"
  | "home"
  | "fitness"
  | "beauty"
  | "software"
  | "education"
  | "pets"
  | "fashion";

type RecommendedMode = "best_match" | "top_epc" | "top_score";

type SearchItem = {
  id: string;
  source: string;
  external_id?: string | null;

  title: string;
  description?: string | null;
  category?: string | null;
  niche?: string | null;

  merchant_name?: string | null;
  merchant_id?: string | null;

  image_url?: string | null;

  url?: string | null;
  product_url?: string | null;
  landing_url?: string | null;

  price?: number | null;
  currency?: string | null;
  commission?: number | null;
  epc?: number | null;

  geo_scope?: string | null;
  score?: number | null;
  quality_score?: number | null;
  winner_tier?: string | null;

  canonical_url?: string | null;
  canonical_hash?: string | null;
  price_band?: string | null;
  language?: string | null;
};

type SavedOffer = {
  id: string;
  user_id?: string;
  source: string | null;
  external_id?: string | null;

  title: string | null;
  description?: string | null;
  category?: string | null;
  niche?: string | null;

  merchant_name?: string | null;
  merchant_id?: string | null;

  product_url?: string | null;
  image_url?: string | null;

  affiliate_link?: string | null;
  subid?: string | null;

  is_primary?: boolean | null;
  is_pinned?: boolean | null;
  pin_rank?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

const SOURCES: { key: ProductSource; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "awin", label: "Awin" },
  { key: "cj", label: "CJ" },
  { key: "rakuten", label: "Rakuten" },
  { key: "warriorplus", label: "WarriorPlus" },
  { key: "aliexpress", label: "AliExpress" },
];

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "all", label: "All categories" },
  { key: "tech", label: "Tech" },
  { key: "gadgets", label: "Gadgets" },
  { key: "home", label: "Home" },
  { key: "fitness", label: "Fitness" },
  { key: "beauty", label: "Beauty" },
  { key: "software", label: "Software" },
  { key: "education", label: "Education" },
  { key: "pets", label: "Pets" },
  { key: "fashion", label: "Fashion" },
];

const RECOMMENDED_MODES: { key: RecommendedMode; label: string }[] = [
  { key: "best_match", label: "Best match" },
  { key: "top_epc", label: "Top EPC" },
  { key: "top_score", label: "Top score" },
];

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function resolvedProductUrl(item: SearchItem) {
  return (
    item.product_url?.trim() ||
    item.landing_url?.trim() ||
    item.url?.trim() ||
    null
  );
}

function safeManualTitle(input: string, manualUrl: string) {
  const trimmed = input.trim();
  if (trimmed) return trimmed;

  try {
    const parsed = new URL(manualUrl);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "Manual offer";
  }
}

export default function AffiliatePage() {
  const [keyword, setKeyword] = useState("phone case");
  const [source, setSource] = useState<ProductSource>("all");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [recommendedMode, setRecommendedMode] =
    useState<RecommendedMode>("best_match");
  const [globalSearch, setGlobalSearch] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);

  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedOffers, setSavedOffers] = useState<SavedOffer[]>([]);

  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState<string | null>(null);

  const globalNeedle = useMemo(() => normalize(globalSearch), [globalSearch]);

  const filteredResults = useMemo(() => {
    if (!globalNeedle) return results;

    return results.filter((r) => {
      const hay = [
        r.title,
        r.source,
        r.category,
        r.niche,
        r.description,
        r.merchant_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(globalNeedle);
    });
  }, [results, globalNeedle]);

  const filteredSaved = useMemo(() => {
    if (!globalNeedle) return savedOffers;

    return savedOffers.filter((o) => {
      const hay = [
        o.title,
        o.source,
        o.category,
        o.niche,
        o.product_url,
        o.affiliate_link,
        o.merchant_name,
        o.subid,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(globalNeedle);
    });
  }, [savedOffers, globalNeedle]);

  const recommendedItems = useMemo(() => {
    const base = [...filteredResults];

    if (recommendedMode === "top_epc") {
      base.sort((a, b) => (b.epc ?? 0) - (a.epc ?? 0));
    } else if (recommendedMode === "top_score") {
      base.sort(
        (a, b) =>
          (b.score ?? b.quality_score ?? 0) - (a.score ?? a.quality_score ?? 0)
      );
    }

    return base.slice(0, 3);
  }, [filteredResults, recommendedMode]);

  async function fetchSavedOffers() {
    try {
      setSavedLoading(true);
      setSavedError(null);

      const res = await fetch("/api/affiliate/products/list", {
        method: "GET",
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load saved offers");
      }

      setSavedOffers(Array.isArray(json.items) ? json.items : []);
    } catch (e: any) {
      setSavedError(e?.message || "Failed to load saved offers");
    } finally {
      setSavedLoading(false);
    }
  }

  useEffect(() => {
    fetchSavedOffers();
  }, []);

  async function runSearch() {
    try {
      setSearching(true);
      setSearchError(null);

      const qs = new URLSearchParams();
      qs.set("keyword", keyword);
      if (source !== "all") qs.set("source", source);
      if (category !== "all") qs.set("category", category);
      qs.set("context", "affiliate_offers");
      qs.set("limit", "20");

      const res = await fetch(`/api/offers/search?${qs.toString()}`, {
        method: "GET",
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Search failed");
      }

      const items: SearchItem[] = Array.isArray(json.items) ? json.items : [];
      setResults(items);

      if (!items.length) {
        setSearchError(
          "No results found. Try another keyword or switch source/category."
        );
      }
    } catch (e: any) {
      setResults([]);
      setSearchError(e?.message || "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  async function saveFromResult(item: SearchItem) {
    try {
      const productUrl = resolvedProductUrl(item);

      const payload = {
        item: {
          id: item.id,
          source: item.source,
          external_id: item.external_id ?? null,

          title: item.title,
          description: item.description ?? null,
          category: item.category ?? null,
          niche: item.niche ?? null,

          merchant_name: item.merchant_name ?? null,
          merchant_id: item.merchant_id ?? null,

          image_url: item.image_url ?? null,

          url: item.url ?? null,
          product_url: productUrl,
          landing_url: item.landing_url ?? null,

          price: item.price ?? null,
          currency: item.currency ?? null,
          commission: item.commission ?? null,
          epc: item.epc ?? null,

          geo_scope: item.geo_scope ?? null,
          canonical_url: item.canonical_url ?? null,
          canonical_hash: item.canonical_hash ?? null,
        },
        query: keyword,
        from: "affiliate_offers",
      };

      const res = await fetch("/api/offers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.details || json?.error || "Failed to save offer");
      }

      await fetchSavedOffers();
    } catch (e: any) {
      alert(e?.message || "Could not save right now.");
    }
  }

  async function saveRecommended(item: SearchItem) {
    await saveFromResult(item);
  }

  async function setPrimary(savedId: string) {
    try {
      const res = await fetch("/api/offers/primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to set primary");
      }

      await fetchSavedOffers();
    } catch (e: any) {
      alert(e?.message || "Could not set primary.");
    }
  }

  async function pinOffer(savedId: string, currentlyPinned?: boolean | null) {
    try {
      const res = await fetch("/api/affiliate/products/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savedId,
          pinned: currentlyPinned ? false : true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to pin");
      }

      await fetchSavedOffers();
    } catch (e: any) {
      alert(e?.message || "Could not pin offer.");
    }
  }

  async function removeOffer(savedId: string) {
    try {
      const res = await fetch("/api/affiliate/products/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to remove");
      }

      await fetchSavedOffers();
    } catch (e: any) {
      alert(e?.message || "Could not remove offer.");
    }
  }

  async function addManualLink() {
    try {
      setManualSaving(true);
      setManualMsg(null);

      if (!manualUrl.trim()) {
        setManualMsg("Paste a product URL first.");
        return;
      }

      const productTitle = safeManualTitle(manualTitle, manualUrl.trim());

      const res = await fetch("/api/offers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            id: `byo:${manualUrl.trim()}`,
            source: "byo",
            external_id: manualUrl.trim(),
            title: productTitle,
            product_url: manualUrl.trim(),
            url: manualUrl.trim(),
          },
          query: "manual_link",
          from: "affiliate_offers",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.details || json?.error || "Failed to add link");
      }

      setManualTitle("");
      setManualUrl("");
      setManualMsg("Saved to your Offer Vault.");
      await fetchSavedOffers();
    } catch (e: any) {
      setManualMsg(e?.message || "Could not save right now.");
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Offer Command Center
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Your{" "}
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Products, Links &amp; Tracking
            </span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm md:text-[15px] leading-relaxed text-slate-300">
            Build your own high-conversion offer vault, keep every winner organized,
            and let Autoaffi pull the right products into your content workflow when
            you need them.
          </p>
        </header>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <InfoBox
            title="How Autoaffi uses offers"
            bullets={[
              "Pick once — Autoaffi remembers it.",
              "Use saved offers across Posts and Reels.",
              "Each product gets a unique Sub-ID.",
              "Add, pin, remove, or set Primary anytime.",
            ]}
          />
          <InfoBox
            title="Quick rules"
            bullets={[
              "Search real products from the global catalog.",
              "Save winners when you want a cleaner offer vault.",
              "Use Primary for your default anchor offer.",
              "Keep your best offers pinned at the top.",
            ]}
          />
          <InfoBox
            title="What this unlocks"
            bullets={[
              "Faster content workflows",
              "Cleaner offer storage per user",
              "Better tracking + future payout automation",
            ]}
            highlight="You get access to stronger high-margin, high-EPC products that fit what is moving in the market right now."
          />
        </div>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-slate-900 mr-2">
                  1
                </span>
                Search products
              </CardTitle>
              <p className="mt-1 text-[12px] text-slate-400">
                Search the global Product Index (Awin, CJ, Rakuten, WarriorPlus,
                AliExpress).
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Keyword">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. phone case, hair tool, air fryer…"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              />
            </Field>

            <Field label="Source">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as ProductSource)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              >
                {SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryKey)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_120px]">
            <Field label="Global search filter">
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Filter results + saved offers…"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              />
            </Field>

            <Field label="Recommended mode">
              <select
                value={recommendedMode}
                onChange={(e) =>
                  setRecommendedMode(e.target.value as RecommendedMode)
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              >
                {RECOMMENDED_MODES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-end">
              <button
                type="button"
                onClick={runSearch}
                disabled={searching}
                className="w-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-2 text-[12px] font-semibold text-slate-900 shadow-md hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Pick a category for more reliable matches — Autoaffi will filter
              the catalog for you.
              <span className="block text-slate-500/90 mt-1">
                Tips: try <span className="text-slate-300">tech</span>,{" "}
                <span className="text-slate-300">gadgets</span>,{" "}
                <span className="text-slate-300">home</span>,{" "}
                <span className="text-slate-300">fitness</span>,{" "}
                <span className="text-slate-300">beauty</span>,{" "}
                <span className="text-slate-300">software</span>.
              </span>
            </p>

            <button
              type="button"
              onClick={() => setGlobalSearch("")}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-[12px] font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              Clear filter
            </button>
          </div>

          {searchError && (
            <p className="mt-3 text-[12px] text-yellow-200">{searchError}</p>
          )}

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Recommended picks
              </p>
              <p className="text-[11px] text-slate-500">
                Built from your live search results
              </p>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {recommendedItems.map((item) => (
                <div
                  key={`rec-${item.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2"
                >
                  <p className="text-sm font-semibold text-slate-50">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.category || "Uncategorized"} • {item.source}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    EPC: {item.epc ?? "—"} • Score:{" "}
                    {item.score ?? item.quality_score ?? "—"}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveRecommended(item)}
                      className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 transition"
                    >
                      Save to Offer Vault
                    </button>

                    {resolvedProductUrl(item) ? (
                      <a
                        className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-900 transition"
                        href={resolvedProductUrl(item)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View source
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}

              {!recommendedItems.length ? (
                <p className="text-[12px] text-slate-500">
                  Run a search to generate recommended picks.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Results
            </p>

            <div className="mt-2 grid gap-3">
              {filteredResults.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Source:{" "}
                        <span className="text-slate-200">{item.source}</span>
                        {item.category ? (
                          <>
                            {" "}
                            • Category:{" "}
                            <span className="text-slate-200">
                              {item.category}
                            </span>
                          </>
                        ) : null}
                        {item.niche ? (
                          <>
                            {" "}
                            • Niche:{" "}
                            <span className="text-slate-200">{item.niche}</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveFromResult(item)}
                      className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 transition"
                    >
                      Save
                    </button>
                  </div>

                  {item.description ? (
                    <p className="text-[12px] text-slate-300">
                      {item.description}
                    </p>
                  ) : null}

                  <p className="text-[11px] text-slate-400">
                    EPC: <span className="text-slate-200">{item.epc ?? "—"}</span>
                    {" • "}Commission:{" "}
                    <span className="text-slate-200">
                      {item.commission ?? "—"}
                    </span>
                    {" • "}Score:{" "}
                    <span className="text-slate-200">
                      {item.score ?? item.quality_score ?? "—"}
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {resolvedProductUrl(item) ? (
                      <a
                        className="underline underline-offset-2 text-yellow-300 hover:text-yellow-200"
                        href={resolvedProductUrl(item)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source product ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}

              {!filteredResults.length && !searching ? (
                <p className="text-[12px] text-slate-500">
                  No results to show.
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-slate-900 mr-2">
                  3
                </span>
                Your saved offers
              </CardTitle>
              <p className="mt-1 text-[12px] text-slate-400">
                Everything you add is stored here. Remove anytime. Pin winners.
                Set one Primary.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchSavedOffers}
              className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              Refresh
            </button>
          </div>

          {savedError && (
            <p className="mt-3 text-[12px] text-yellow-200">{savedError}</p>
          )}
          {savedLoading && (
            <p className="mt-3 text-[12px] text-slate-400">
              Loading saved offers…
            </p>
          )}

          <div className="mt-4 grid gap-3">
            {filteredSaved.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {o.title || "Untitled offer"}
                      {o.is_primary ? (
                        <span className="ml-2 rounded-full bg-yellow-400/15 border border-yellow-400/40 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                          Primary
                        </span>
                      ) : null}
                      {o.is_pinned ? (
                        <span className="ml-2 rounded-full bg-slate-900/70 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                          Pinned
                        </span>
                      ) : null}
                    </p>

                    <p className="text-[11px] text-slate-400">
                      Source:{" "}
                      <span className="text-slate-200">
                        {o.source || "unknown"}
                      </span>
                      {o.category ? (
                        <>
                          {" "}
                          • Category:{" "}
                          <span className="text-slate-200">{o.category}</span>
                        </>
                      ) : null}
                      {o.niche ? (
                        <>
                          {" "}
                          • Niche:{" "}
                          <span className="text-slate-200">{o.niche}</span>
                        </>
                      ) : null}
                    </p>

                    {o.subid ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Sub-ID: <span className="text-yellow-300">{o.subid}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPrimary(o.id)}
                      disabled={!!o.is_primary}
                      className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {o.is_primary ? "Primary set" : "Set Primary"}
                    </button>
                    <button
                      type="button"
                      onClick={() => pinOffer(o.id, o.is_pinned)}
                      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-900 transition"
                    >
                      {o.is_pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOffer(o.id)}
                      className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/15 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  {o.product_url ? (
                    <a
                      className="underline underline-offset-2 text-yellow-300 hover:text-yellow-200"
                      href={o.product_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source product ↗
                    </a>
                  ) : null}
                  <Link
  className="underline underline-offset-2 text-yellow-300 hover:text-yellow-200"
  href={`/offer/${o.id}`}
  target="_blank"
>
  Open affiliate link ↗
</Link>
                </div>
              </div>
            ))}

            {!filteredSaved.length && !savedLoading ? (
              <p className="text-[12px] text-slate-500">
                No offers saved yet. Use Search above to add products.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-slate-900 mr-2">
              4
            </span>
            Add your own product link (optional)
          </CardTitle>
          <p className="mt-1 text-[12px] text-slate-400">
            If you already have a product URL, paste it here and we&apos;ll save
            it to your offers so Posts/Reels can use it too.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Product title (optional)">
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g. Premium Phone Case"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              />
            </Field>

            <Field label="Product link">
              <input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Paste product URL…"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/60"
              />
            </Field>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              This is for users who want to keep their own links stored inside
              the same offer system.
            </p>

            <button
              type="button"
              onClick={addManualLink}
              disabled={manualSaving}
              className="rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-2 text-[12px] font-semibold text-slate-900 shadow-md hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {manualSaving ? "Saving…" : "Add link"}
            </button>
          </div>

          {manualMsg && (
            <p className="mt-2 text-[12px] text-yellow-200">{manualMsg}</p>
          )}
        </Card>

        <div className="mt-8 flex justify-center">
          <Link
            href="/login/dashboard"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-2 text-[12px] font-semibold text-slate-900 shadow-md hover:brightness-110 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
      {children}
    </section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-300">
      {children}
    </p>
  );
}

function InfoBox({
  title,
  bullets,
  highlight,
}: {
  title: string;
  bullets: string[];
  highlight?: string;
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
      {highlight ? (
        <p className="mt-3 text-[12px] font-semibold text-yellow-300 leading-relaxed">
          {highlight}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[11px] text-slate-200">
      <span className="block">{label}</span>
      {children}
    </label>
  );
}