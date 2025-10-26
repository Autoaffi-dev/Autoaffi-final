import { NextResponse } from 'next/server';

export async function POST(req: Request){
  const payload = await req.json();
  console.log('affiliate webhook:', payload);
  // TODO: verify signature, insert sale record to DB
  return NextResponse.json({ ok:true });
}