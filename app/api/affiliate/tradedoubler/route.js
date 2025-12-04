// app/api/affiliate/tradedoubler/route.js

// ENV:
// TRADEDOUBLER_API_TOKEN=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa Tradedoubler API/XML-feed
return Response.json({
network: "tradedoubler",
query: q,
page,
ready: Boolean(process.env.TRADEDOUBLER_API_TOKEN),
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

// TODO: skapa tracking-länk via Tradedoubler
const affiliateLink = `https://clk.tradedoubler.com/click?p=XXXX&a=YYYY&url=${encodeURIComponent(
productUrl
)}`;

return Response.json({
network: "tradedoubler",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}