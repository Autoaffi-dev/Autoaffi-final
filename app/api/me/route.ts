import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServerClient";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
      return NextResponse.json({ userId: null }, { status: 401 });
    }

    return NextResponse.json({ userId: data.user.id }, { status: 200 });
  } catch {
    return NextResponse.json({ userId: null }, { status: 500 });
  }
}