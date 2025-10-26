// app/api/affiliate/impact/route.ts
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST(req: Request) {
  const { productQuery } = await req.json();
  const CLIENT_ID = process.env.IMPACT_CLIENT_ID;
  const CLIENT_SECRET = process.env.IMPACT_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ ok: true, products:[{ id:'impact-mock-1', name:`Mock Impact ${productQuery}`, advertiser:'Impact Advertiser' }]});
  }

  // Impact uses OAuth2 client credentials to get an access token
  const tokenRes = await fetch('https://api.impact.com/Console/Authentication/OAuth', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return NextResponse.json({ ok:false, error: txt }, { status: 502 });
  }
  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Search example (adjust to correct Impact endpoint)
  const searchUrl = `https://api.impact.com/Mediapartners/v1/partners/?search=${encodeURIComponent(productQuery)}&limit=10`;
  const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` }});
  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ ok:false, error: txt }, { status: 502 });
  }
  const data: any = await res.json();
  const products = (data.items||data).map((p:any)=>({ id:p.id, name:p.name || p.title, advertiser: p.advertiserName || '' }));
  return NextResponse.json({ ok:true, products });
}