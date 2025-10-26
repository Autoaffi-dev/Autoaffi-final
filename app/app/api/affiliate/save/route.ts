// app/api/affiliate/save/route.ts
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  const body = await req.json();
  const { postId, userId, provider, product_title, affiliate_url, commission } = body;

  if (!SUPABASE_KEY) return NextResponse.json({ ok:false, error:'no supabase key' }, { status:500 });

  const insertUrl = `${https://xhxynfvxecekdmhjipgt.supabase.co}/rest/v1/affiliate_links`;
  const res = await fetch(insertUrl, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      post_id: postId,
      user_id: userId,
      provider,
      product_title,
      affiliate_url,
      commission
    })
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ ok:false, error:data }, { status:500 });
  return NextResponse.json({ ok:true, row: data[0] });
}