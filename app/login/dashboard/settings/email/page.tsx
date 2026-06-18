"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  Unplug,
} from "lucide-react";

type EmailStatusResponse = {
  ok: boolean;
  mode?: "live" | "dev";
  connected: boolean;
  provider?: "gmail" | "outlook" | "other";
  email?: string | null;
  connectedAt?: string | null;
  error?: string;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID?.trim();
  if (devUserId) {
    headers["x-autoaffi-user-id"] = devUserId;
  }

  return headers;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString();
}

function providerLabel(provider?: string) {
  if (provider === "gmail") return "Gmail";
  if (provider === "outlook") return "Outlook";
  if (provider === "other") return "Other";
  return "Unknown";
}

function humanizeError(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Something went wrong.";

  switch (raw) {
    case "GOOGLE_OAUTH_DENIED":
      return "Google authorization was cancelled or denied.";
    case "MISSING_CODE_OR_STATE":
      return "Google callback was missing required authorization data.";
    case "STATE_NOT_FOUND":
      return "The Gmail connect session could not be matched. Please try again.";
    case "TOKEN_EXCHANGE_FAILED":
      return "Google token exchange failed. Please try again.";
    case "GOOGLE_USERINFO_FAILED":
      return "Could not load the Gmail account details from Google.";
    case "INBOX_DEACTIVATE_FAILED":
      return "Could not deactivate the previous inbox state.";
    case "INBOX_UPDATE_FAILED":
      return "Could not update the connected inbox row.";
    case "TOKEN_DEACTIVATE_FAILED":
      return "Could not rotate the previous token row.";
    case "TOKEN_INSERT_FAILED":
      return "Could not save the Gmail access token.";
    case "CALLBACK_FAILED":
      return "The Gmail callback failed before Autoaffi could finish the connection.";
    case "PROVIDER_NOT_SUPPORTED_YET":
      return "Outlook is prepared in the architecture, but Gmail is the only active provider right now.";
    default:
      return raw;
  }
}

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<EmailStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [connectLoading, setConnectLoading] = useState<"gmail" | "outlook" | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);

    try {
      const res = await fetch("/api/business/email/status", {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as EmailStatusResponse | null;

      if (!res.ok) {
        setStatus(
          data ?? {
            ok: false,
            connected: false,
            error: "Failed to load email status.",
          }
        );
        return;
      }

      setStatus(data);
    } catch {
      setStatus({
        ok: false,
        connected: false,
        error: "Failed to load email status.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");
    const details = url.searchParams.get("details");

    if (success === "gmail_connected") {
      setActionMessage("Gmail connected successfully.");
      setActionError(null);
    } else if (error) {
      setActionMessage(null);
      setActionError(details ? `${humanizeError(error)} (${details})` : humanizeError(error));
    }

    if (success || error || details) {
      url.searchParams.delete("success");
      url.searchParams.delete("error");
      url.searchParams.delete("details");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const connected = !!status?.connected;

  const statusTone = useMemo(() => {
    if (loading) return "loading";
    if (connected) return "connected";
    return "required";
  }, [loading, connected]);

  async function handleConnect(provider: "gmail" | "outlook") {
    setConnectLoading(provider);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/business/email/connect", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ provider }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setActionError(
          humanizeError(
            data?.details ||
              data?.error ||
              `Could not start ${providerLabel(provider)} connection.`
          )
        );
        return;
      }

      const redirectUrl =
        typeof data?.redirectUrl === "string" ? data.redirectUrl.trim() : "";

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      setActionError(
        `${providerLabel(provider)} connect did not return a redirect URL.`
      );
    } catch {
      setActionError(`Could not start ${providerLabel(provider)} connection.`);
    } finally {
      setConnectLoading(null);
    }
  }

  async function handleDisconnect() {
    setDisconnectLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch("/api/business/email/disconnect", {
        method: "POST",
        headers: buildHeaders(),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setActionError(data?.details || data?.error || "Could not disconnect inbox.");
        return;
      }

      setActionMessage("Inbox disconnected.");
      await loadStatus();
    } catch {
      setActionError("Could not disconnect inbox.");
    } finally {
      setDisconnectLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050c1f] text-white">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 xl:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/65">
            Dashboard / Settings /{" "}
            <span className="font-medium text-[#f7d57b]">Connected Inbox</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Active Plan: <span className="font-semibold text-[#f7d57b]">Basic</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-[#d5a63e]/25 bg-[radial-gradient(circle_at_top_left,rgba(14,46,96,0.55),rgba(3,12,33,0.96)_55%)] shadow-[0_0_60px_rgba(0,0,0,0.35)]">
          <section className="border-b border-white/8 p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="flex items-start gap-5">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[28px] border border-[#d5a63e]/45 bg-[linear-gradient(180deg,rgba(23,29,42,0.92),rgba(10,17,32,0.98))] shadow-[0_0_30px_rgba(213,166,62,0.18)]">
                    <Mail className="h-14 w-14 text-[#f2c357]" />
                  </div>

                  <div className="max-w-3xl">
                    <h1 className="text-4xl font-semibold tracking-tight text-[#f7d57b] md:text-5xl">
                      Connected Inbox
                    </h1>

                    <p className="mt-4 max-w-3xl text-lg leading-8 text-white/84">
                      Connect your email to unlock tracked outreach inside Autoaffi.
                    </p>

                    <p className="mt-3 max-w-3xl text-base leading-7 text-white/68">
                      Business Finder, Contact Manager, and Leads Hub all rely on the same connected
                      inbox status. Once activated, sent emails, replies, and outreach progress can stay
                      visible inside Autoaffi.
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-6 rounded-[24px] border p-5 shadow-[0_0_28px_rgba(213,166,62,0.18)]",
                    statusTone === "connected"
                      ? "border-emerald-400/35 bg-emerald-500/10"
                      : "border-[#d5a63e]/45 bg-[linear-gradient(180deg,rgba(25,28,34,0.65),rgba(11,16,26,0.82))]"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border",
                        statusTone === "connected"
                          ? "border-emerald-400/40 bg-emerald-500/10"
                          : "border-[#d5a63e]/45 bg-[#111827]/70"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-white/70" />
                      ) : connected ? (
                        <CheckCircle2 className="h-7 w-7 text-emerald-300" />
                      ) : (
                        <AlertCircle className="h-7 w-7 text-[#f2c357]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className={cn(
                            "text-lg font-semibold",
                            connected ? "text-emerald-300" : "text-[#f7d57b]"
                          )}
                        >
                          {loading
                            ? "Checking inbox status"
                            : connected
                            ? "Email activated"
                            : "Email activation required"}
                        </div>

                        {!loading && connected && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </span>
                        )}

                        {!loading && !connected && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Required for tracked outreach
                          </span>
                        )}
                      </div>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">
                        {loading
                          ? "Please wait while Autoaffi checks your inbox connection status."
                          : connected
                          ? "Your connected inbox is ready. Business Finder can use tracked outreach, and Contact Manager plus Leads Hub can stay aligned with sent-message activity."
                          : "Connect your inbox to send tracked messages, sync outreach states, and keep Business Finder, Contact Manager, and Leads Hub working together."}
                      </p>

                      {!loading && connected && (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                              Provider
                            </div>
                            <div className="mt-2 text-sm font-medium text-white">
                              {providerLabel(status?.provider)}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                              Email
                            </div>
                            <div className="mt-2 text-sm font-medium text-white">
                              {status?.email || "—"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                              Connected at
                            </div>
                            <div className="mt-2 text-sm font-medium text-white">
                              {formatDateTime(status?.connectedAt)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleConnect("gmail")}
                          disabled={!!connectLoading}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#d5a63e]/55 px-4 py-2.5 text-sm font-medium text-[#f7d57b] transition hover:bg-[#d5a63e]/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {connectLoading === "gmail" ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Connecting Gmail
                            </>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4" />
                              {connected && status?.provider === "gmail"
                                ? "Reconnect Gmail"
                                : "Connect Gmail"}
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/45 cursor-not-allowed"
                          title="Outlook is prepared in the architecture and can be enabled later."
                        >
                          <Link2 className="h-4 w-4" />
                          Connect Outlook (coming soon)
                        </button>

                        {connected && (
                          <button
                            type="button"
                            onClick={handleDisconnect}
                            disabled={disconnectLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {disconnectLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Disconnecting
                              </>
                            ) : (
                              <>
                                <Unplug className="h-4 w-4" />
                                Disconnect inbox
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {actionMessage && (
                        <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-sm leading-6 text-emerald-200">
                          {actionMessage}
                        </div>
                      )}

                      {actionError && (
                        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-200">
                          {actionError}
                        </div>
                      )}

                      {status?.error && !actionError && (
                        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-200">
                          {status.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#d5a63e]/25 bg-[linear-gradient(180deg,rgba(9,18,36,0.88),rgba(6,11,25,0.96))] p-5 shadow-[0_0_35px_rgba(213,166,62,0.12)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d5a63e]/45 bg-[#0d162b]">
                    <ShieldCheck className="h-6 w-6 text-[#f2c357]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#f7d57b]">
                      Why connected inbox matters
                    </div>
                    <div className="text-sm text-white/55">
                      One connection powers multiple Autoaffi cards
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    {
                      title: "Business Finder",
                      description:
                        "Required for tracked outreach, send-state control, and email-based company contact flow.",
                    },
                    {
                      title: "Contact Manager",
                      description:
                        "Helps keep sent activity, follow-up logic, and future reply handling structured inside Autoaffi.",
                    },
                    {
                      title: "Leads Hub",
                      description:
                        "Supports visible lead-state progression when outreach activity is tied to a connected inbox.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{item.title}</div>
                        <ChevronRight className="h-4 w-4 text-[#f7d57b]" />
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/62">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#d5a63e]/22 bg-[#d5a63e]/8 px-4 py-4 text-sm leading-6 text-[#f5df9f]">
                  Autoaffi uses inbox status as a shared foundation so your outreach experience can stay
                  consistent wherever you start first.
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 p-6 md:p-8 xl:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f7d57b]">
                1. Connect
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Connect Gmail so Autoaffi can use a verified inbox identity for tracked outreach.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f7d57b]">
                2. Activate
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Once the inbox is active, Business Finder can unlock send controls and the platform can show
                the right email status across cards.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f7d57b]">
                3. Track
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Sent outreach, future replies, and lead-state movement can stay visible inside Autoaffi
                instead of being lost outside the platform.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}