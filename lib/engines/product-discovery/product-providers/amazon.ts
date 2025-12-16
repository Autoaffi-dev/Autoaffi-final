export async function fetchAmazonProducts(query: string) {
  return [
    {
      id: "amz-fitnessapp",
      name: "Smart Fitness Tracker",
      epc: 0.8,
      category: "Fitness",
      platform: "amazon",
    },
  ].filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}