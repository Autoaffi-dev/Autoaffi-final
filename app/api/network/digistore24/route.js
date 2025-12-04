export async function GET() {
  const apiKey = process.env.DIGISTORE24_API_KEY;
  const baseUrl = "https://www.digistore24.com/api/call/";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Digistore24 API key" }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }

  // ✅ Riktiga funktioner från API Reference A–Z
  const functions = [
    "productList",
    "orderList",
    "affiliateStatsList",
    "getAccountBalance",
  ];

  const results = {};

  for (const func of functions) {
    try {
      const res = await fetch(`${baseUrl}${func}`, {
        method: "GET",
        headers: {
          "X-DS-API-KEY": apiKey,
          "Accept": "application/json",
        },
      });

      const text = await res.text();

      if (text.startsWith("<!DOCTYPE")) {
        results[func] = {
          success: false,
          error: "HTML response (likely login or permission issue)",
        };
      } else {
        results[func] = JSON.parse(text);
      }
    } catch (err) {
      results[func] = { success: false, error: err.message };
    }
  }

  return new Response(JSON.stringify({ success: true, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}