import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { provider, product_title, originalCaption } = await req.json();

  // Skapa en enkel mock-länk och caption-förslag
  const slug = encodeURIComponent((product_title || 'offer').toLowerCase().replace(/\s+/g, '-')).slice(0,60);
  const affiliate_url = `https://autoaffi.link/${(provider || 'generic').toLowerCase()}/${slug}`;

  const suggestions = [
    {
      caption: `🚀 Boost your growth with ${product_title}! ${originalCaption || ''} #faceless #affiliate`,
      affiliate: { provider, product_title, affiliate_url }
    },
    {
      caption: `💡 New drop: ${product_title}. Tap to learn & earn. ${originalCaption || ''}`,
      affiliate: { provider, product_title, affiliate_url }
    },
  ];

  return NextResponse.json({ ok: true, suggestions });
}