import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createMegaEngine2Store,
} from "@/lib/engines/payments/mega-engine-2-db";
import {
  recordStripeSubscriptionPayment,
} from "@/lib/engines/payments/mega-engine-2-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecret = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20" as any,
});

export async function POST(req: NextRequest) {
  try {
    if (!webhookSecret) {
      console.error("[StripeWebhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[StripeWebhook] Signature verification failed:", err?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const store = createMegaEngine2Store();

    // Vi fokuserar på invoice.paid som triggas av subscriptions
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      // userId måste finnas i metadata (sätts vid checkout / subscription creation)
      const userId = (invoice.metadata as any)?.autoaffiUserId;
      if (!userId) {
        console.warn("[StripeWebhook] invoice.paid without autoaffiUserId");
        return NextResponse.json({ ok: true, ignored: true });
      }

      const amountPaid = (invoice.amount_paid ?? 0) / 100;
      const currency = (invoice.currency ?? "usd").toLowerCase();

      // Plan-kod från metadata eller pris
      const planCode =
        ((invoice.metadata as any)?.planCode as "basic" | "pro" | "elite") ||
        ("basic" as const);

await recordStripeSubscriptionPayment(store, {
  userId,
  stripeCustomerId: invoice.customer?.toString() ?? "",
  stripeSubscriptionId:
    (invoice as any).subscription?.toString() ?? "unknown-subscription",
  stripeInvoiceId: invoice.id,
  planCode,
  amount: amountPaid,
  currency,
  occurredAt: new Date(invoice.created * 1000),
  meta: {
      rawInvoiceId: invoice.id,
  },
});

      return NextResponse.json({ ok: true });
    }

    // Andra webhook-typer kan loggas/ignoreras för nu
    console.log("[StripeWebhook] Unhandled event type:", event.type);

    return NextResponse.json({ ok: true, ignored: true });
  } catch (err: any) {
    console.error("[StripeWebhook] Error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}