"use client";

import React, { useMemo, useState } from "react";

type LeadResponse =
  | { ok: true; continue_url: string; destination_mode: string }
  | { error: string; details?: string };

export default function LeadCapturePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { mode?: string; continue?: string };
}) {
  const token = params?.token || "";
  const mode = (searchParams?.mode || "lead").toLowerCase(); // lead | both | affiliate
  const canContinue = mode === "both" || mode === "affiliate";

  const continueUrl = useMemo(() => {
    // IMPORTANT: skip_log=1 so /go does not insert click again
    return `/go/${encodeURIComponent(token)}?to=affiliate&skip_log=1`;
  }, [token]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!token) {
      setErr("Token saknas.");
      return;
    }

    // Minimal client-side checks (server validates too)
    if (!email && !phone) {
      setErr("Skriv minst e-post eller telefon.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/etsy/qr/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: name?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          message: message?.trim() || null,
        }),
      });

      const data = (await res.json()) as LeadResponse;

      if (!res.ok || "error" in data) {
        setErr(("error" in data ? data.error : "UNKNOWN_ERROR") + (("details" in data && data.details) ? `: ${data.details}` : ""));
        setLoading(false);
        return;
      }

      setDone(true);

      // If offer-mode is both: we auto-forward after short delay (nice UX)
      if (canContinue) {
        setTimeout(() => {
          window.location.href = data.continue_url || continueUrl;
        }, 900);
      }

      setLoading(false);
    } catch (e: any) {
      setErr(e?.message || "Något gick fel");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Få mer info först
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Lämna dina uppgifter så återkommer vi snabbt.
            </p>
          </div>

          {!done ? (
            <form onSubmit={submitLead} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/70">
                  Namn (valfritt)
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                  placeholder="Ditt namn"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/70">
                  E-post
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                  placeholder="namn@email.com"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/70">
                  Telefon (valfritt)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                  placeholder="+46..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/70">
                  Meddelande (valfritt)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 min-h-[90px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                  placeholder="Vad behöver du hjälp med?"
                />
              </div>

              {err ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Skickar..." : "Skicka"}
              </button>

              {canContinue ? (
                <a
                  href={continueUrl}
                  className="block w-full rounded-xl border border-white/15 bg-white/0 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-white/5"
                >
                  Hoppa över & fortsätt
                </a>
              ) : (
                <p className="text-center text-xs text-white/50">
                  (Det här erbjudandet kräver lead först)
                </p>
              )}
            </form>
          ) : (
            <div className="mt-6 text-center">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">
                ✅ Tack! Vi har tagit emot dina uppgifter.
              </div>

              {canContinue ? (
                <a
                  href={continueUrl}
                  className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
                >
                  Fortsätt till erbjudandet
                </a>
              ) : (
                <p className="mt-3 text-sm text-white/70">
                  Du kan stänga sidan nu.
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-white/40">
            Token: <span className="font-mono">{token}</span>
          </p>
        </div>
      </div>
    </div>
  );
}