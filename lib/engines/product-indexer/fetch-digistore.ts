export async function fetchDigistoreProducts() {
  const url = "https://www.digistore24.com/en/search/products";

  const html = await fetch(url).then((r) => r.text());

  const matches = [...html.matchAll(/product\/(\d+)/g)];
 
  const uniqueIds = [...new Set(matches.map((m) => m[1]))];

  return uniqueIds.map((id) => ({
    id: `digistore-${id}`,
    platform: "digistore",
    name: `Digistore Product ${id}`,
    category: "general",
    epc: null,
    img: null,
    url: `https://www.digistore24.com/en/product/${id}`,
  }));
}