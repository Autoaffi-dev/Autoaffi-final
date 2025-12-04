import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`, {
    headers: {
      Authorization: process.env.PEXELS_API_KEY!,
    },
  });

  const data = await res.json();
  return NextResponse.json(data);
}