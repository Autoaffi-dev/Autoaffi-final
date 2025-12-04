// app/api/affiliate/cj/route.js

// ENV:
// CJ_API_KEY=...
// CJ_WEBSITE_ID=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa CJ Product Catalog / Links API
return Response.json({
network: "cj",
query: q,
page,
ready: Boolean(process.env.CJ_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { linkId, userId, source } = body;

if (!linkId) {
return Response.json(
{ error: "Missing 'linkId' in body." },
{ status: 400 }
);
}

// TODO: hämta riktig tracking-länk från CJ
const affiliateLink = `https://www.anrdoezrs.net/click-XXXXXXX-${linkId}`;

return Response.json({
network: "cj",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}