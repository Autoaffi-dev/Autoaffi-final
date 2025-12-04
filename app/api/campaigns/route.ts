import { NextResponse } from 'next/server';

// Hämtar kampanjer (mockade data tills Supabase kopplas)
export async function GET() {
  const campaigns = [
    {
      id: 1,
      subject: 'Testkampanj 1',
      message: 'Detta är ett testutskick från Autoaffi.',
      sent_at: '2025-10-28'
    },
    {
      id: 2,
      subject: 'Höstkampanj',
      message: 'Spara 20% på premium-planen denna vecka!',
      sent_at: '2025-10-27'
    }
  ];

  return NextResponse.json({ ok: true, campaigns });
}

// Skapar ny kampanj (kommer användas av formulär senare)
export async function POST(req: Request) {
  const body = await req.json();
  const { subject, message } = body;

  // Här kommer Supabase insert i nästa steg
  console.log('Ny kampanj skapad:', subject, message);

  return NextResponse.json({ ok: true, created: true });
}