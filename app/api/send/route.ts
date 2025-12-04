import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { subject, message } = body;

  console.log(`Skickar mejl: ${subject}`);
  console.log(`Meddelande: ${message}`);

  // Här lägger vi senare in integration till SendGrid, Mailgun eller Resend API

  return NextResponse.json({ ok: true });
}