import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies(); // ✅ viktig fix: await

  const cookieNames = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];

  for (const name of cookieNames) {
    store.set({
      name,
      value: "",
      path: "/",
      expires: new Date(0),
    });
  }

  // extra: cache headers så logout aldrig blir cached
  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}