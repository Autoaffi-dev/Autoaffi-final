// app/api/affiliate/clickbank/route.js

// ENV:
// CLICKBANK_API_KEY=...
// CLICKBANK_VENDOR=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa ClickBank Marketplace / API
return Response.json({
network: "clickbank",
query: q,
page,
ready: Boolean(process.env.CLICKBANK_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { offerId, userId, source } = body;

if (!offerId) {
return Response.json(
{ error: "Missing 'offerId' in body." },
{ status: 400 }
);
}

// TODO: bygg riktig hoplink
const nickname = process.env.CLICKBANK_VENDOR || "yourid";
const affiliateLink = `https://${nickname}.${offerId}.hop.clickbank.net`;

return Response.json({
network: "clickbank",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}