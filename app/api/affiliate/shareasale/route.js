// app/api/affiliate/shareasale/route.js

// ENV:
// SHAREASALE_API_TOKEN=...
// SHAREASALE_AFFILIATE_ID=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa ShareASale API (merchant/links)
return Response.json({
network: "shareasale",
query: q,
page,
ready: Boolean(process.env.SHAREASALE_API_TOKEN),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { merchantId, productUrl, userId, source } = body;

if (!merchantId && !productUrl) {
return Response.json(
{ error: "Provide 'merchantId' or 'productUrl' in body." },
{ status: 400 }
);
}

// TODO: bygg riktig tracking-länk (exempel)
const affiliateId = process.env.SHAREASALE_AFFILIATE_ID || "yourid";
const affiliateLink = productUrl
? `https://shareasale.com/r.cfm?b=XXXX&m=${merchantId ||
"MERCHANT"}&u=${affiliateId}&urllink=${encodeURIComponent(productUrl)}`
: `https://shareasale.com/r.cfm?m=${merchantId}&u=${affiliateId}`;

return Response.json({
network: "shareasale",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}