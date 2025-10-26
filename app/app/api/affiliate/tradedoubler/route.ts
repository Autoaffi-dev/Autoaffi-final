// app/api/affiliate/tradedoubler/route.ts
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST(req: Request) {
  const { productQuery } = await req.json();
  const CLIENT_ID = process.env.TD_CLIENT_ID;
  const CLIENT_SECRET = process.env.TD_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ ok: true, products: [{ id:'td-mock-1', name:`Mock TD ${productQuery}`, advertiser:'TD Advertiser' }]});
  }

  // Example auth + product search (adjust to actual TD endpoints)
  // Acquire token if required (some endpoints use basic auth)
  // This is a simplified flow — check tradedoubler docs for exact endpoints
  const searchUrl = `https://api.tradedoubler.com/1.0/products?query=${encodeURIComponent(productQuery)}&limit=10`;
  const res = await fetch(searchUrl, {
    headers: { 'Authorization': `Basic ${Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')}` }
  });
  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ ok:false, error: txt }, { status: 502 });
  }
  const data: any = await res.json();
  const products = (data.products||data).map((p:any)=>({ id:p.productId || p.id, name: p.title || p.name, advertiser: p.merchantName }));
  return NextResponse.json({ ok:true, products });
}