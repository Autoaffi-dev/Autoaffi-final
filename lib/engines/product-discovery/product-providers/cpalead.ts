export async function fetchCpaLeadProducts(query: string) {
  return [
    {
      id: "cpa-weightquiz",
      name: "Weight Loss Quiz",
      epc: 1.2,
      category: "Health",
      platform: "cpalead",
    },
  ].filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}