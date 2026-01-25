import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";

  return Response.json({
    network: "shareasale",
    query: q,
    page,
    ready: Boolean(process.env.SHAREASALE_API_TOKEN),
  });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { merchantId, productUrl, source } = body;

  if (!merchantId && !productUrl) {
    return Response.json(
      { error: "Provide 'merchantId' or 'productUrl' in body." },
      { status: 400 }
    );
  }

  const affiliateId = process.env.SHAREASALE_AFFILIATE_ID || "yourid";

  const affiliateLink = productUrl
    ? `https://shareasale.com/r.cfm?b=XXXX&m=${merchantId || "MERCHANT"}&u=${affiliateId}&urllink=${encodeURIComponent(productUrl)}`
    : `https://shareasale.com/r.cfm?m=${merchantId}&u=${affiliateId}`;

  return Response.json({
    network: "shareasale",
    affiliateLink,
    userId, // från session
    source: source ?? "content-optimizer",
  });
}