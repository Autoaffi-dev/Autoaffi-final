// app/api/affiliate/amazon/route.js

// ENV (lägg i .env.local när du är redo):
// AFFILIATE_AMAZON_PARTNER_TAG=...
// AFFILIATE_AMAZON_ACCESS_KEY=...
// AFFILIATE_AMAZON_SECRET_KEY=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: koppla mot Amazon Product Advertising API
return Response.json({
network: "amazon",
query: q,
page,
ready: Boolean(
process.env.AFFILIATE_AMAZON_PARTNER_TAG &&
process.env.AFFILIATE_AMAZON_ACCESS_KEY &&
process.env.AFFILIATE_AMAZON_SECRET_KEY
),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { productUrl, asin, userId, source } = body;

if (!productUrl && !asin) {
return Response.json(
{ error: "Provide either 'productUrl' or 'asin' in body." },
{ status: 400 }
);
}

// TODO: Generera riktig Amazon-länk med partner-tag
const partnerTag = process.env.AFFILIATE_AMAZON_PARTNER_TAG || "YOUR_TAG";
const affiliateLink = productUrl
? `${productUrl}${productUrl.includes("?") ? "&" : "?"}tag=${partnerTag}`
: `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;

return Response.json({
network: "amazon",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}