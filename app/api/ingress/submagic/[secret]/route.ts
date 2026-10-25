import { NextResponse } from "next/server";
import { isSubmagicProductionEnabled } from "@/lib/ingress/firstPromoterProgram";
import { receiveSubmagicProductionPostback } from "@/lib/ingress/firstPromoterPostback";
import { syllabyTestSecretMatches } from "@/lib/ingress/syllabyPostback";
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
  if (!isSubmagicProductionEnabled()) {
    return json({ ok: false, error: "PRODUCTION_NOT_CONFIGURED" }, 404);
  }

  const secret = await readSecret(context);
  if (!syllabyTestSecretMatches(secret, process.env.SUBMAGIC_POSTBACK_PRODUCTION_SECRET)) {
    return json({ ok: false }, 404);
  }

  const result = await receiveSubmagicProductionPostback({
    secret,
    expectedSecret: process.env.SUBMAGIC_POSTBACK_PRODUCTION_SECRET,
    searchParams: new URL(req.url).searchParams,
    createStore: createServiceRoleInboundStore,
  });
  return json(result.body, result.status);
}

export function GET(req: Request, context: SecretContext) {
  return handle(req, context);
}

export function POST(req: Request, context: SecretContext) {
  return handle(req, context);
}
