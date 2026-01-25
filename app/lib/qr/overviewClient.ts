export type QrOverviewItem = {
  id: string;
  user_id: string;
  offer_key: string;
  product_type: string;
  destination_mode: string;
  destination_url: string | null;
  token: string;
  slug: string;
  qr_png_path: string;
  storage_path: string;
  ts?: string;
};

export type QrOverviewResponse = {
  ok: boolean;
  days: number;
  from: string | null;
  items: QrOverviewItem[];
  next_cursor: string | null;
};

export async function fetchQrOverview(params: {
  userId: string;
  offerKey: string;
  days?: number;
  limit?: number;
  cursor?: string | null;
}): Promise<QrOverviewResponse> {
  const days = params.days ?? 30;
  const limit = params.limit ?? 50;

  const qs = new URLSearchParams();
  qs.set("offer_key", params.offerKey);
  qs.set("days", String(days));
  qs.set("limit", String(limit));
  if (params.cursor) qs.set("cursor", params.cursor);

  const res = await fetch(`/api/etsy/qr/overview?${qs.toString()}`, {
    method: "GET",
    headers: { "x-autoaffi-user-id": params.userId },
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || `OVERVIEW_FETCH_FAILED_${res.status}`);
  }

  return data as QrOverviewResponse;
}