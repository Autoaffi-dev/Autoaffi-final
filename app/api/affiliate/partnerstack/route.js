// app/api/affiliate/partnerstack/route.js

// ENV:
// PARTNERSTACK_API_KEY=...

export async function GET(request) {
const { searchParams } = new URL(request.url);
const q = searchParams.get("q") ?? "";
const page = searchParams.get("page") ?? "1";

// TODO: anropa PartnerStack API för program/links
return Response.json({
network: "partnerstack",
query: q,
page,
ready: Boolean(process.env.PARTNERSTACK_API_KEY),
});
}

export async function POST(request) {
const body = await request.json().catch(() => ({}));
const { programSlug, userId, source } = body;

if (!programSlug) {
return Response.json(
{ error: "Missing 'programSlug' in body." },
{ status: 400 }
);
}

// TODO: riktig referral-länk
const affiliateLink = `https://partnerstack.com/${programSlug}/ref/${userId || "your-ref"}`;

return Response.json({
network: "partnerstack",
affiliateLink,
userId: userId ?? null,
source: source ?? "content-optimizer",
});
}