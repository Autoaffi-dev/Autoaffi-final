"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/qr/supabaseBrowserClient";

type LeadRow = {
  id: number | string;
  asset_id: string;
  user_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  ts?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function fetchQrLeads(params: {
  userId: string;
  days?: number;
  limit?: number;
  assetId?: string | null;
}) {
  const q = new URLSearchParams();
  q.set("days", String(params.days ?? 30));
  q.set("limit", String(params.limit ?? 50));
  if (params.assetId) q.set("asset_id", params.assetId);

  const res = await fetch(`/api/etsy/qr/leads?${q.toString()}`, {
    method: "GET",
    headers: {
      "x-autoaffi-user-id": params.userId,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LEADS_FETCH_FAILED: ${res.status} ${txt}`);
  }

  return (await res.json()) as { ok: boolean; items?: LeadRow[] };
}

export default function QrLeadsWidget() {
  const sp = useSearchParams();
  const assetId = useMemo(() => sp?.get("asset_id"), [sp]);

  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user?.id) {
        if (alive) {
          setRows([]);
          setErr("Missing session user.");
          setLoading(false);
        }
        return;
      }

      try {
        const out = await fetchQrLeads({
          userId: user.id,
          days: 30,
          limit: 200,
          assetId,
        });

        if (!alive) return;
        setRows(out.items ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Unknown error");
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [assetId, supabase]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-white/90">QR Leads</h3>

        {assetId ? (
          <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-200">
            Filter: asset_id
          </span>
        ) : (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            All QR leads
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-white/60">Loading leads…</div>
      ) : err ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 text-sm text-white/60">No leads yet.</div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-black/20 px-4 py-3 text-xs text-white/60">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-4">Message</div>
          </div>

          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={String(r.id)} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                <div className="col-span-3 text-white/90">{r.name || "—"}</div>
                <div className="col-span-3 text-white/80">{r.email || "—"}</div>
                <div className="col-span-2 text-white/80">{r.phone || "—"}</div>
                <div className={cn("col-span-4 text-white/70", r.message ? "" : "italic text-white/40")}>
                  {r.message || "No message"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-white/45">
        Leads are created from QR landing pages. Follow up fast for best conversion.
      </p>
    </div>
  );
}