import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/options";

export const runtime = "nodejs";

// DEV fallback får endast vara aktiv om:
// - NODE_ENV !== "production"
// - host är localhost / 127.0.0.1
function allowDevFallback(req: Request) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const isLocalhost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  return process.env.NODE_ENV !== "production" && isLocalhost;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  const userId = (session as any)?.user?.id || "";
  if (userId) {
    return NextResponse.json(
      {
        ok: true,
        dev: false,
        user: {
          id: String(userId),
          name: session?.user?.name || "",
          email: session?.user?.email || "",
        },
      },
      { status: 200 }
    );
  }

  // DEV fallback (låst till local/dev)
  if (allowDevFallback(req)) {
    const devId = (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim();
    if (devId) {
      return NextResponse.json(
        { ok: true, dev: true, user: { id: devId } },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
}