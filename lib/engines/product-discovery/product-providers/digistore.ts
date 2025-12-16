export async function fetchDigistoreProducts(query: string) {
  return [
    {
      id: "ds-fatburn",
      name: "Fat Burner System",
      epc: 3.4,
      category: "Health",
      platform: "digistore",
    },
    {
      id: "ds-crypto",
      name: "Crypto Masterclass",
      epc: 2.2,
      category: "Finance",
      platform: "digistore",
    },
  ].filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}