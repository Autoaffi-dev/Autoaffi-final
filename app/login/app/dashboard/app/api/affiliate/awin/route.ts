// app/api/affiliate/awin/route.ts
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

const AWIN_API = 'https://api.awin.com'; // ex, kontrollera docs för rätt endpoint

export async function POST(req: Request) {
  const body = await req.json();
  const { productQuery } = body;

  const AWIN_KEY = process.env.AWIN_API_KEY;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  if (!AWIN_KEY) {
    // fallback: mock
    return NextResponse.json({ ok: true, products: [{ id:'mock1', name:`Mock Awin ${productQuery}`, advertiser:'Awin Advertiser' }]});
  }

  // Example: search endpoint (exakt path kan skilja, check Awin docs)
  const searchUrl = `${AWIN_API}/publishers/${PUBLISHER_ID}/products?search=${encodeURIComponent(productQuery)}&pageSize=10`;
  const res = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AWIN_KEY}`, 'Accept': 'application/json' }
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ ok: false, error: txt }, { status: 502 });
  }
  const data: any = await res.json();

  // Map to simplified format
  const products = (data.items || data).map((p: any) => ({
    id: p.id,
    name: p.productName || p.name || p.title,
    advertiser: p.advertiserName || p.advertiser
  }));

  return NextResponse.json({ ok: true, products });
}