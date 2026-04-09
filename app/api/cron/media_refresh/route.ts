import { NextResponse } from "next/server";
import { checkCronSecret } from "../_shared/media-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubJobResult = {
  path: string;
  ok: boolean;
  status: number;
  body: any;
};

async function callInternal(req: Request, path: string, secret: string): Promise<SubJobResult> {
  const url = new URL(req.url);
  url.pathname = path;
  url.searchParams.set("secret", secret);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = { raw: await res.text().catch(() => "") };
    }

    return {
      path,
      ok: res.ok && body?.ok !== false,
      status: res.status,
      body,
    };
  } catch (err: any) {
    return {
      path,
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: err?.message ?? "Internal fetch failed",
      },
    };
  }
}

export async function GET(req: Request) {
  try {
    if (!checkCronSecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const secret =
      req.headers.get("x-cron-secret") ||
      new URL(req.url).searchParams.get("secret") ||
      "";

    const results: SubJobResult[] = [];

    results.push(await callInternal(req, "/api/cron/vecteezy_refresh", secret));
    results.push(await callInternal(req, "/api/cron/pexels_refresh", secret));
    results.push(await callInternal(req, "/api/cron/pixabay_refresh", secret));

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    return NextResponse.json(
      {
        ok: successCount > 0,
        summary: {
          total: results.length,
          successCount,
          failCount,
        },
        ran: results.map((r) => ({
          path: r.path,
          ok: r.ok,
          status: r.status,
          provider: r.body?.provider ?? null,
          inserted: r.body?.inserted ?? 0,
          reason: r.body?.reason ?? null,
          rotation: r.body?.rotation ?? null,
          downloadsUsed: r.body?.downloadsUsed ?? r.body?.downloadCalls ?? null,
          error: r.body?.error ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("MEDIA REFRESH CRON ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "media_refresh failed",
      },
      { status: 500 }
    );
  }
}
