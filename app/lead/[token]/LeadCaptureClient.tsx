"use client";

import React, { useMemo, useState } from "react";

type Mode = "affiliate" | "lead" | "both";

function isNonEmpty(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export default function LeadCaptureClient({
  token,
  mode,
  next,
}: {
  token: string;
  mode: Mode;
  next?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const nextUrl = useMemo(() => (isNonEmpty(next) ? next.trim() : ""), [next]);

  // ✅ IMPORTANT: Contact flow should NEVER go to mock.
  // Legacy safety: treat "both" as "lead" (contact) in this form.
  const effectiveMode: Mode = mode === "both" ? "lead" : mode;

  async function postLead(payload: any) {
    try {
      const res = await fetch("/api/etsy/qr/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        return {
          ok: false as const,
          error: String(data?.error || `SUBMIT_FAILED (${res.status})`),
          data,
        };
      }

      return { ok: true as const, data };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "SUBMIT_FAILED" };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg("");
    setOkMsg("");

    if (!isNonEmpty(token)) {
      setErrMsg("Missing token.");
      return;
    }

    // ✅ matchar API: kräver email eller phone
if (!isNonEmpty(email) && !isNonEmpty(phone)) {
  setErrMsg("Please add email or phone.");
  return;
}

    const payload = {
      token,
      name: isNonEmpty(name) ? name.trim() : null,
      email: isNonEmpty(email) ? email.trim() : null,
      phone: isNonEmpty(phone) ? phone.trim() : null,
      message: isNonEmpty(message) ? message.trim() : null,

      // context
      mode: effectiveMode, // ✅ important
      next: nextUrl || null,
      ts: new Date().toISOString(),
    };

    try {
      setLoading(true);

      const result = await postLead(payload);

      if (!result.ok) {
        setErrMsg(result.error || "SUBMIT_FAILED");
        return;
      }

      setOkMsg("Sent ✅");

      // Small UX pause so user sees "Sent ✅"
      setTimeout(() => {
        // ✅ 1) LEAD (and legacy BOTH) => thank you page
        if (effectiveMode === "lead") {
          window.location.href = `/lead/thanks/${encodeURIComponent(token)}`;
          return;
        }

        // ✅ 2) AFFILIATE => go routing (should be rare for this form)
        window.location.href = `/go/${encodeURIComponent(token)}?skip_log=1`;
      }, 350);
    } catch (e: any) {
      setErrMsg(e?.message || "SUBMIT_FAILED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (recommended)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (optional)"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-yellow-300 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-200 disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send"}
      </button>

      {errMsg ? <div className="text-xs text-red-300">{errMsg}</div> : null}
      {okMsg ? <div className="text-xs text-emerald-300">{okMsg}</div> : null}

      <div className="text-[11px] text-white/35">
        Mode: {mode} → effective: {effectiveMode} {nextUrl ? "• Next available" : ""}
      </div>
    </form>
  );
}