import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const insertUrl = `${SUPABASE_URL}/rest/v1/affiliate_links`;

    const res = await fetch(insertUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("Affiliate Save Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}