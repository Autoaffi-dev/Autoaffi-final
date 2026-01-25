export type QrLead = {
  id: number;
  asset_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;

  // timestamps
  ts?: string | null;

  // ✅ NEW insight
  source?: "hoodie" | "sticker" | "phonecase" | null;

  // optional debug (API can send it; UI may ignore)
  token?: string | null;
};

export type TopSourceRow = {
  source: "hoodie" | "sticker" | "phonecase";
  count: number;
};

export async function fetchQrLeads(params: {
  userId: string;
  days?: number;
  limit?: number;
  cursor?: string | null;
}) {
  const days = params.days ?? 30;
  const limit = params.limit ?? 25;

  const qs = new URLSearchParams();
  qs.set("days", String(days));
  qs.set("limit", String(limit));
  if (params.cursor) qs.set("cursor", params.cursor);

  const res = await fetch(`/api/etsy/qr/lead?${qs.toString()}`, {
    method: "GET",
    headers: { "x-autoaffi-user-id": params.userId },
  });

  const json = await res.json();
  if (!res.ok || json?.ok !== true) throw new Error(json?.error || "Failed to fetch QR leads");

  return json as {
    ok: true;
    days: number;
    from: string;
    next_cursor: string | null;
    items: QrLead[];
    top_sources: TopSourceRow[];
    total_in_window: number;
  };
}