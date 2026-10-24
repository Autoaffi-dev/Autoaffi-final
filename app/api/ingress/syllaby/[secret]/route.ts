import { NextResponse } from "next/server";
import {
  acceptSyllabyProductionPostback,
  syllabyTestSecretMatches,
} from "@/lib/ingress/syllabyPostback";
import { createServiceRoleInboundStore } from "@/lib/ingress/storeInboundEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SecretContext = {
  params: Promise<{ secret: string }> | { secret: string };
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function readSecret(context: SecretContext): Promise<string> {
  const params =
    typeof (context.params as { then?: unknown })?.then === "function"
      ? await (context.params as Promise<{ secret: string }>)
      : (context.params as { secret: string });
  return String(params?.secret || "");
}

async function handle(req: Request, context: SecretContext) {
  const secret = await readSecret(context);
  if (!syllabyTestSecretMatches(secret, process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET)) {
    return json({ ok: false }, 404);
  }

  try {
    const store = await createServiceRoleInboundStore();
    const result = await acceptSyllabyProductionPostback({
      searchParams: new URL(req.url).searchParams,
      store,
    });
    if (result.conflict) {
      return json({ ok: false, error: "EVENT_CONFLICT" }, 409);
    }
    if (result.duplicate) {
      return json({ ok: true, duplicate: true }, 200);
    }
    return json(
      {
        ok: true,
        duplicate: false,
        matchStatus: result.matchStatus,
      },
      200
    );
  } catch {
    return json({ ok: false, error: "INGRESS_FAILED" }, 500);
  }
}

export function GET(req: Request, context: SecretContext) {
  return handle(req, context);
}

export function POST(req: Request, context: SecretContext) {
  return handle(req, context);
}
