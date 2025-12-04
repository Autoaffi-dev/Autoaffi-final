// app/api/affiliate/awin/route.js

// ENV:
// AWIN_API_KEY=...
// AWIN_PUBLISHER_ID=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa AWIN Product API / Advertiser API
return Response.json({
network: "awin",
query: q,
page,
ready: Boolean(process.env.AWIN_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { productUrl, userId, source } = body;

if (!productUrl) {
return Response.json(
{ error: "Missing 'productUrl' in body." },
{ status: 400 }
);
}

// TODO: AWIN-länk via API eller klickspårningslänk
const publisherId = process.env.AWIN_PUBLISHER_ID || "yourid";
const affiliateLink = `https://www.awin1.com/cread.php?awinmid=XXX&awinaffid=${publisherId}&ued=${encodeURIComponent(
productUrl
)}`;

return Response.json({
network: "awin",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}