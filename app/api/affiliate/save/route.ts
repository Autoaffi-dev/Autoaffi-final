import { NextResponse } from 'next/server';

// TODO: koppla Supabase här i v5; nu loggar vi bara
export async function POST(req: Request) {
  const body = await req.json();
  console.log('Saving affiliate link:', body);
  // Exempel-payload som förväntas:
  // { provider, product_id, product_title, affiliate_url, caption }
  return NextResponse.json({ ok: true, saved: true });
}