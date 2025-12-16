export async function fetchMyLeadProducts(query: string) {
  return [
    {
      id: "ml-surveypro",
      name: "SurveyPro High-CPA",
      epc: 1.8,
      category: "General",
      platform: "mylead",
    },
  ].filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}