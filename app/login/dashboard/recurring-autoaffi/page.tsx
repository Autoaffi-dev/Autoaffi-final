"use client";

import React, { useEffect, useMemo, useState } from "react";

type ProductType = "hoodie" | "sticker" | "phonecase";

type SessionApiResponse = {
  ok: boolean;
  dev?: boolean;
  user?: { id: string; name?: string; email?: string };
  error?: string;
};

type LinkApiResponse =
  | { ok: true; userId: string; code: string; affiliate_link: string }
  | { ok: false; error: string; hint?: string };

type QrAsset = {
  id: string;
  user_id: string;
  offer_key: string;
  product_type: ProductType;
  destination_mode: "affiliate" | "lead" | "both";
  destination_url: string;
  token: string;
  slug: string;
  qr_png_path?: string | null;
  storage_path?: string | null;
  created_at: string;
  clicks_30d?: number;
  leads_30d?: number;
  conv_30d?: number;
};

type OverviewApiResponse =
  | {
      ok: true;
      latest: QrAsset | null;
      history: QrAsset[];
      items: QrAsset[];
      next_cursor?: string | null;
      days?: number;
      from?: string;
    }
  | { ok: false; error: string; details?: string; hint?: string };

type CreateApiResponse =
  | { ok: true; asset: QrAsset }
  | { ok: false; error: string; hint?: string; details?: string };

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeEncode(s: string) {
  return encodeURIComponent(s || "");
}

export default function RecurringAutoaffiPage() {
  // ---------------------------
  // Session / user
  // ---------------------------
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");

  // ---------------------------
  // Affiliate link
  // ---------------------------
  const [linkLoading, setLinkLoading] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState<string>("");
  const [affiliateCode, setAffiliateCode] = useState<string>("");
  const [linkError, setLinkError] = useState<string>("");

  // ---------------------------
  // Latest overview
  // ---------------------------
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [latest, setLatest] = useState<QrAsset | null>(null);
  const [overviewError, setOverviewError] = useState<string>("");

  // ---------------------------
  // Step 1
  // ---------------------------
  const [productType, setProductType] = useState<ProductType>("hoodie");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string>("");
  const [generateOkMsg, setGenerateOkMsg] = useState<string>("");

  // ---------------------------
  // Step 2 (hidden until generate)
  // ---------------------------
  const [showStep2, setShowStep2] = useState(false);
  const [previewToken, setPreviewToken] = useState<string>("");
  const [previewPngUrl, setPreviewPngUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState<string>("");

  // ---------------------------
  // Step 3 gating
  // ---------------------------
  const [confirmedQr, setConfirmedQr] = useState(false);

  // DEV UUID (Supabase) – används för dev test (riktig UUID)
  const devUuid = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim();
  }, []);


// Etsy shop URL (byt till din riktiga när du vill)
const etsyShopUrl = useMemo(() => {
  return (process.env.NEXT_PUBLIC_ETSY_SHOP_URL || "[https://www.etsy.com").trim();
}, []);


  function buildAutoaffiHeaders() {
    const userIdForApi = (devUuid || sessionUserId || "").trim();
    const headers: HeadersInit = {};
    if (userIdForApi) headers["x-autoaffi-user-id"] = userIdForApi;
    return { headers, userIdForApi };
  }

  function computePngUrl(asset: QrAsset, userIdForApi: string) {
    const path = (asset.storage_path || asset.qr_png_path || "").trim();
    if (!isNonEmptyString(path)) return "";
    // <img> kan inte skicka custom headers -> uid i query i DEV
    return `/api/etsy/qr/image?path=${safeEncode(path)}&uid=${safeEncode(userIdForApi)}`;
  }

  function setPreviewFromAsset(asset: QrAsset | null, userIdForApi: string) {
    setPreviewError("");
    if (!asset || !isNonEmptyString(asset.token)) {
      setPreviewToken("");
      setPreviewPngUrl("");
      return;
    }
    setPreviewToken(asset.token);
    setPreviewPngUrl(computePngUrl(asset, userIdForApi));
  }

  // ---------------------------
  // Load session once
  // ---------------------------
  useEffect(() => {
    let alive = true;

    async function loadSession() {
      try {
        setSessionLoading(true);
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as SessionApiResponse;

        if (!alive) return;

        if (data?.ok && data?.user?.id) {
          setSessionUserId(String(data.user.id || "").trim());
          setSessionName(String(data.user.name || "").trim());
        } else {
          setSessionUserId("");
          setSessionName("");
        }
      } catch {
        if (!alive) return;
        setSessionUserId("");
        setSessionName("");
      } finally {
        if (!alive) return;
        setSessionLoading(false);
      }
    }

    loadSession();
    return () => {
      alive = false;
    };
  }, []);

  // ---------------------------
  // Load affiliate link (auto on load)
  // ---------------------------
  async function loadAffiliateLink() {
    setLinkError("");
    const { headers, userIdForApi } = buildAutoaffiHeaders();

    if (!isNonEmptyString(userIdForApi)) {
      setLinkError("UNAUTHORIZED: Missing user id (devUuid or sessionUserId).");
      return;
    }

    try {
      setLinkLoading(true);
      const res = await fetch("/api/recurring/autoaffi/link", { headers, cache: "no-store" });
      const data = (await res.json()) as LinkApiResponse;

      if (!res.ok || !data || data.ok !== true) {
        const err = (data as any)?.error || "Could not load";
        const hint = (data as any)?.hint ? ` (${(data as any).hint})` : "";
        setAffiliateLink("");
        setAffiliateCode("");
        setLinkError(`${err}${hint}`);
        return;
      }

      setAffiliateLink(data.affiliate_link);
      setAffiliateCode(data.code);
    } catch (e: any) {
      setAffiliateLink("");
      setAffiliateCode("");
      setLinkError(e?.message || "Could not load");
    } finally {
      setLinkLoading(false);
    }
  }

  // ---------------------------
  // Load latest overview (auto on load)
  // ---------------------------
  async function loadLatest() {
    setOverviewError("");
    const { headers, userIdForApi } = buildAutoaffiHeaders();

    if (!isNonEmptyString(userIdForApi)) {
      setOverviewError("UNAUTHORIZED: Missing user id (devUuid or sessionUserId).");
      return;
    }

    try {
      setOverviewLoading(true);
      const res = await fetch("/api/etsy/qr/overview?limit=50&days=30", { headers, cache: "no-store" });
      const data = (await res.json()) as OverviewApiResponse;

      if (!res.ok || !data || data.ok !== true) {
        const err = (data as any)?.error || "Could not load";
        const details = (data as any)?.details ? ` (${(data as any).details})` : "";
        setLatest(null);
        setOverviewError(`${err}${details}`);
        return;
      }

      setLatest(data.latest || null);
      // OBS: vi fyller INTE Step 2 här — Step 2 ska bara synas efter Generate
    } catch (e: any) {
      setLatest(null);
      setOverviewError(e?.message || "Could not load");
    } finally {
      setOverviewLoading(false);
    }
  }

  // Auto-load once session/devUuid exists
  useEffect(() => {
    if (sessionLoading) return;
    const { userIdForApi } = buildAutoaffiHeaders();
    if (!isNonEmptyString(userIdForApi)) return;

    loadAffiliateLink();
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading]);

  // ---------------------------
  // Generate QR
  // ---------------------------
  async function handleGenerateQr() {
    setGenerateError("");
    setGenerateOkMsg("");
    setPreviewError("");

    const { headers, userIdForApi } = buildAutoaffiHeaders();

    if (!isNonEmptyString(userIdForApi)) {
      setGenerateError("UNAUTHORIZED: Missing user id (devUuid or sessionUserId).");
      return;
    }

    if (!isNonEmptyString(affiliateLink)) {
      setGenerateError("Affiliate link is missing (auto-load failed). Try reloading the page.");
      return;
    }

    // Step 2 + Step 3 ska alltid resetta på ny generate
    setShowStep2(false);
    setConfirmedQr(false);

    const payload = {
      offer_key: "autoaffi-premium",
      product_type: productType,
      destination_mode: "both" as const, // alltid lead + premium
      destination_url: affiliateLink,
    };

    try {
      setGenerateLoading(true);

      const res = await fetch("/api/etsy/qr/create", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CreateApiResponse;

      if (!res.ok || !data || data.ok !== true) {
        setGenerateError((data as any)?.error || "CREATE_FAILED");
        return;
      }

      setGenerateOkMsg("QR created successfully ✅");

      setPreviewFromAsset(data.asset, userIdForApi);
      setShowStep2(true);

      // uppdatera latest boxen
      await loadLatest();
    } catch (e: any) {
      setGenerateError(e?.message || "CREATE_FAILED");
    } finally {
      setGenerateLoading(false);
    }
  }

  async function downloadQrImage() {
    if (!previewPngUrl) return;
    try {
      const res = await fetch(previewPngUrl, { cache: "no-store" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `autoaffi-qr-${productType}-${previewToken || "token"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch {
      // fallback: öppna i ny flik
      window.open(previewPngUrl, "_blank");
    }
  }

  const productCards: Array<{
    key: ProductType;
    title: string;
    desc: string;
  }> = [
    {
      key: "hoodie",
      title: "Hoodie",
      desc: "Strong signal. High curiosity. Great conversation starter.",
    },
    {
      key: "sticker",
      title: "Sticker",
      desc: "High-traffic placement → huge reach. Perfect lead magnet.",
    },
    {
      key: "phonecase",
      title: "Phone Case",
      desc: "Always visible. People ask. You control the story.",
    },
  ];

  return (
    <main className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-yellow-200">
            Autoaffi Recurring = Digital + Offline Income Engine
          </h1>

          {/* ✅ ÄNDRA INTE denna text */}
          <p className="mt-2 text-sm text-white/70">
            This is the Autoaffi core engine. Turn one link into recurring income — and turn one QR into real-world leads.
            Track every scan, every click, every contact. Your content runs online. Your QR runs offline. Autoaffi connects both.
          </p>

          <div className="mt-2 text-xs text-white/50">
            {sessionLoading ? "Loading session..." : sessionUserId ? `Logged in: ${sessionName || "User"}` : "Not logged in"}
          </div>
        </div>

        {/* Affiliate Link (wider + centered + only Copy) */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <div className="mx-auto max-w-4xl text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Your Autoaffi Affiliate Link
            </div>

            <div className="mt-3 break-all rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/90">
              {linkLoading ? "Loading..." : affiliateLink || (linkError ? linkError : "Could not load")}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-white/55">
              {affiliateCode ? <div>Code: {affiliateCode}</div> : null}
              {devUuid ? <div className="text-emerald-300/70">DEV UUID active ✅</div> : null}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={() => {
                  if (affiliateLink) navigator.clipboard.writeText(affiliateLink);
                }}
                className="rounded-full bg-yellow-300 px-6 py-2 text-sm font-semibold text-black hover:bg-yellow-200 disabled:opacity-60"
                disabled={!affiliateLink}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Latest + Good to know (History removed) */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Latest QR + Good to know</div>
              <div className="text-xs text-white/60">
                Every lead will be available in the Contact Manager card. Reply fast for best conversions.
              </div>
              {overviewError ? <div className="mt-2 text-xs text-red-300">{overviewError}</div> : null}
            </div>

            {overviewLoading ? (
              <div className="text-xs text-white/40">Loading...</div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* Latest */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-semibold uppercase text-white/60">Latest</div>

              {latest ? (
                <div className="mt-3">
                  <div className="text-lg font-semibold text-white">
                    {latest.product_type === "phonecase" ? "Phone Case" : latest.product_type === "sticker" ? "Sticker" : "Hoodie"}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-white/60">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Token: {latest.token}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Clicks (30d): {latest.clicks_30d ?? 0}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Leads (30d): {latest.leads_30d ?? 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/60">No QR yet. Generate your first one in Step 1.</div>
              )}
            </div>

            {/* Good to know */}
            <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/5 p-5">
              <div className="text-xs font-semibold uppercase text-yellow-200/90">Good to know</div>

              <div className="mt-3 space-y-2 text-sm text-white/80">
                <div className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-200/70" />
                  <div>Make leads offline while your content runs online.</div>
                </div>
                <div className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-200/70" />
                  <div>Promote your business in public <span className="text-yellow-200 font-semibold">and</span> private places.</div>
                </div>
                <div className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-200/70" />
                  <div>Collect leads while you’re at work, at home, traveling — even sleeping.</div>
                </div>
                <div className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-200/70" />
                  <div>QR acts like a silent salesperson: people self-initiate.</div>
                </div>
                <div className="flex gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-yellow-200/70" />
                  <div>Track scans + leads so you learn what placement converts best.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1 */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-yellow-200/80">Step 1</div>
            <h3 className="mt-2 text-2xl font-extrabold text-white">Choose your product</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-white/60">
              Pick the product you will place the QR on. We generate a dedicated landing page + lead flow automatically.
            </p>
          </div>

          <div className="mt-7 mx-auto max-w-5xl">
            <div className="grid gap-4 md:grid-cols-3">
              {productCards.map((p) => {
                const active = productType === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setProductType(p.key)}
                    className={[
                      "text-left rounded-2xl border bg-black/20 p-5 transition",
                      active ? "border-yellow-300/70 ring-1 ring-yellow-300/30" : "border-white/10 hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="text-[11px] font-semibold uppercase text-white/50">Product</div>
                    <div className="mt-2 text-xl font-extrabold text-white">
                      {p.title}
                    </div>
                    <div className="mt-2 text-sm text-white/70">{p.desc}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleGenerateQr}
                disabled={generateLoading || !affiliateLink}
                className="rounded-full bg-yellow-300 px-10 py-3 text-sm font-semibold text-black hover:bg-yellow-200 disabled:opacity-60"
              >
                {generateLoading ? "Generating..." : "Generate QR"}
              </button>

              {generateError ? <div className="text-xs text-red-300">{generateError}</div> : null}
              {generateOkMsg ? <div className="text-xs text-emerald-300">{generateOkMsg}</div> : null}
            </div>
          </div>
        </div>

        {/* STEP 2 (hidden until Generate) */}
        {showStep2 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-200/80">Step 2</div>
              <h3 className="mt-2 text-2xl font-extrabold text-white">Scan + confirm your QR</h3>

              <div className="mt-2 text-sm text-white/70">
                <span className="text-yellow-200 font-semibold">Autoaffi</span> — Scan the QR now and confirm you reach the correct landing page for your product.
                When that’s confirmed, download the image.
              </div>
            </div>

            <div className="mt-7 mx-auto max-w-5xl grid gap-5 md:grid-cols-2">
              {/* QR Preview */}
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="text-xs font-semibold uppercase text-white/60">QR Preview</div>

                <div className="mt-4 flex items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-4">
                  {previewPngUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPngUrl}
                      alt="QR"
                      className="h-72 w-72 rounded-xl bg-white p-2"
                      onError={() => {
                        setPreviewError("QR image failed to load. If terminal shows 401 on /api/etsy/qr/image, we update the image route.");
                      }}
                    />
                  ) : (
                    <div className="text-sm text-white/50">No QR image yet.</div>
                  )}
                </div>

                {previewToken ? (
                  <div className="mt-3 text-[11px] text-white/60">Token: {previewToken}</div>
                ) : null}

                {previewError ? <div className="mt-3 text-xs text-red-300">{previewError}</div> : null}
              </div>

              {/* Actions + Confirm */}
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="text-xs font-semibold uppercase text-white/60">Actions</div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={downloadQrImage}
                    disabled={!previewPngUrl}
                    className="rounded-full bg-yellow-300 px-6 py-3 text-sm font-semibold text-black hover:bg-yellow-200 disabled:opacity-60"
                  >
                    Download QR image
                  </button>
                </div>

                {/* Confirm under QR (gold text) */}
                <div className="mt-5 rounded-2xl border border-yellow-300/25 bg-yellow-300/5 p-5">
                  <div className="text-sm font-semibold text-yellow-200">Before Step 3</div>
                  <div className="mt-2 text-sm text-white/75">
                    Confirm the QR is correct. Every lead will be available in the Contact Manager card.
                  </div>

                  <label className="mt-4 flex items-start gap-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      className="mt-[3px] h-4 w-4"
                      checked={confirmedQr}
                      onChange={(e) => setConfirmedQr(e.target.checked)}
                    />
                    <span>
                      I scanned the QR and reached the correct landing page for my product.
                    </span>
                  </label>

                  {typeof window !== "undefined" && window.location.origin.includes("localhost") ? (
                    <div className="mt-3 text-[11px] text-white/55">
                      Note: If your Go URL is localhost, phone camera scanning won&apos;t work until deployed (Vercel) or using LAN/IP.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* STEP 3 (locked until confirmed) */}
        {showStep2 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-200/80">Step 3</div>
              <h3 className="mt-2 text-2xl font-extrabold text-white">Place your QR on the product</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-white/60">
                To use your QR code on the product you chose, open the Autoaffi Etsy shop below. Remember to use your QR on the same product type you selected in Step 1.
              </p>
            </div>

            <div className="mt-6 mx-auto max-w-5xl rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
              <button
                onClick={() => window.open(etsyShopUrl, "_blank")}
                disabled={!confirmedQr}
                className="rounded-full bg-yellow-300 px-10 py-3 text-sm font-semibold text-black hover:bg-yellow-200 disabled:opacity-50"
              >
                Open Autoaffi Etsy Shop
              </button>

              {!confirmedQr ? (
                <div className="mt-3 text-xs text-white/55">
                  Locked until you confirm the QR is correct in Step 2.
                </div>
              ) : null}

              <div className="mt-4 text-[12px] text-white/60">
                Tip: The more visible the placement, the better the lead quality.
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-10 text-center">
          <a
            href="/login/dashboard"
            className="rounded-full bg-yellow-300 px-6 py-2 text-sm font-semibold text-black hover:bg-yellow-200"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}