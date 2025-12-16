export async function fetchCpaLeadProducts() {
  const api = "https://www.cpalead.com/dashboard/reports/offers/json";
  const res = await fetch(api).then((r) => r.json());

  return res.offers.slice(0, 50).map((o: any) => ({
    id: `cpalead-${o.id}`,
    platform: "cpalead",
    name: o.name,
    category: o.category ?? "general",
    epc: Number(o.epc ?? 0),
    img: o.image_url ?? null,
    url: o.offer_url ?? "",
  }));
}