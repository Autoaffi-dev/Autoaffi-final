import { NextResponse } from 'next/server';

export async function POST(req: Request){
  const body = await req.json();
  const { provider, product_title } = body;

  // If provider keys exist in env, call provider API to create trackable link.
  // For now we return a mock or placeholder.
  const mockUrl = `https://autoaffi.link/${provider.toLowerCase()}/${encodeURIComponent(product_title).slice(0,40)}`;

  // TODO: Save to Supabase via server-side key (SUPABASE_SERVICE_ROLE_KEY)
  return NextResponse.json({ ok:true, url: mockUrl });