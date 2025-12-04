// app/api/affiliate/digistore24/route.js

// ENV:
// DIGISTORE24_API_KEY=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa Digistore24 API (products)
return Response.json({
network: "digistore24",
query: q,
page,
ready: Boolean(process.env.DIGISTORE24_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { productId, userId, source } = body;

if (!productId) {
return Response.json(
{ error: "Missing 'productId' in body." },
{ status: 400 }
);
}

// TODO: bygg riktig affiliate-länk från Digistore24
const affiliateId = process.env.DIGISTORE24_AFFILIATE_ID || "yourid";
const affiliateLink = `https://www.digistore24.com/redir/${productId}/${affiliateId}`;

return Response.json({
network: "digistore24",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}