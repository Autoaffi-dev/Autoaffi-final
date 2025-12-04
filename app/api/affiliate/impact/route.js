// app/api/affiliate/impact/route.js

// ENV:
// IMPACT_API_KEY=...
// IMPACT_ACCOUNT_SID=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa Impact Radius API
return Response.json({
network: "impact",
query: q,
page,
ready: Boolean(process.env.IMPACT_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { campaignId, userId, source } = body;

if (!campaignId) {
return Response.json(
{ error: "Missing 'campaignId' in body." },
{ status: 400 }
);
}

// TODO: generera tracking-länk via Impact API
const affiliateLink = `https://impact.link/campaign/${campaignId}`;

return Response.json({
network: "impact",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}