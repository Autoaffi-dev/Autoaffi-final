export async function fetchImpactProducts(query: string) {
  return [
    {
      id: "imp-fitnessmeal",
      name: "Fitness Meal App",
      epc: 1.9,
      category: "Health",
      platform: "impact",
    },
  ].filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}