export async function fetchMyLeadProducts() {
  const url = "https://mylead.global/en/campaigns";
  const html = await fetch(url).then((r) => r.text());

  const matches = [...html.matchAll(/campaign\/(\d+)/g)];
  const ids = [...new Set(matches.map((m) => m[1]))];

  return ids.slice(0, 50).map((id) => ({
    id: `mylead-${id}`,
    platform: "mylead",
    name: `MyLead Campaign ${id}`,
    category: "general",
    epc: null,
    img: null,
    url: `https://mylead.global/en/campaign/${id}`,
  }));
}