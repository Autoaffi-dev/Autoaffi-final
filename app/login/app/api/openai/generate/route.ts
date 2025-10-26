import { NextResponse } from 'next/server';

export async function POST(req: Request){
  const body = await req.json();
  const { originalCaption } = body;

  // mock suggestions (replace with real OpenAI call using OPENAI_API_KEY)
  const suggestions = [
    { caption: `${originalCaption} — Love this! Check link in bio.`, affiliate: { provider:'Awin', product_title:'TubeMagic Pro', affiliate_url:'https://example.com/aff1' } },
    { caption: `${originalCaption} — Game changer for creators 🚀`, affiliate: { provider:'Impact', product_title:'ReelTemplates Pro', affiliate_url:'https://example.com/aff2' } },
    { caption: `Boost your reels today 🎯 ${originalCaption}`, affiliate: { provider:'Tradedoubler', product_title:'Faceless Pack', affiliate_url:'https://example.com/aff3' } },
  ];

  return NextResponse.json({ suggestions });