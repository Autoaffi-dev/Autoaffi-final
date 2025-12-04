import { NextResponse } from 'next/server';

// Mockad data – kopplas senare till Supabase eller MLGS API
export async function GET() {
  const leads = [
    { id: 1, name: 'Anna Karlsson', email: 'anna@example.com', status: 'new' },
    { id: 2, name: 'Johan Persson', email: 'johan@example.com', status: 'contacted' }
  ];

  return NextResponse.json({ ok: true, leads });
}