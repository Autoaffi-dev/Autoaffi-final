// app/api/affiliate/rakuten/route.js

// ENV:
// RAKUTEN_API_KEY=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa Rakuten Advertiser / Links API
return Response.json({
network: "rakuten",
query: q,
page,
ready: Boolean(process.env.RAKUTEN_API_KEY),
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

// TODO: hämta riktig tracking-url
const affiliateLink = `https://click.linksynergy.com/link?id=YOURID&offerid=${offerId}`;

return Response.json({
network: "rakuten",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}