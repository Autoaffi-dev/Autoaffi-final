export type Currency = "usd" | "eur" | "sek" | "gbp" | string;

export type PaymentSource =
  | "stripe-subscription"
  | "stripe-one-time"
  | "recurring-platform"
  | "product-network";

export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";

export type PayoutStatus = "pending" | "processing" | "paid" | "failed";

export type PayoutMethod = "paypal" | "bank" | "stripe_connect";

// -----------------------------
// CORE DOMAIN TYPES
// -----------------------------

export interface PaymentEvent {
  id: string;
  userId: string;
  source: PaymentSource;
  sourceRef?: string | null;
  platform?: string | null;
  grossAmount: number;
  currency: Currency;
  feeAmount: number;
  netAmount: number;
  status: PaymentStatus;
  meta?: any;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceSnapshot {
  userId: string;
  availableAmount: number;
  pendingAmount: number;
  currency: Currency;
  updatedAt: string;
}

export interface PayoutRow {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  status: PayoutStatus;
  method: PayoutMethod;
  destination: string | null;
  externalPayoutId: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------
// STORE-INTERFACE (MATCHAR DIN DB-FIL)
// -----------------------------

export interface MegaEngine2Store {
  // PAYMENT EVENTS
  insertPaymentEvent(
    input: Omit<PaymentEvent, "id" | "createdAt" | "updatedAt">
  ): Promise<PaymentEvent>;

  listUserEventsSince(
    userId: string,
    since: Date
  ): Promise<PaymentEvent[]>;

  // BALANCES
  getUserBalance(userId: string): Promise<BalanceSnapshot | null>;

  upsertUserBalance(
    userId: string,
    deltaAvailable: number,
    deltaPending: number,
    currency: Currency
  ): Promise<BalanceSnapshot>;

  // PAYOUTS
  insertPayout(input: {
    userId: string;
    amount: number;
    currency: Currency;
    method: PayoutMethod;
    destination: string | null;
  }): Promise<PayoutRow>;

  listPayoutsForUser(userId: string): Promise<PayoutRow[]>;

  markPayoutAsPaid(
    payoutId: string,
    externalPayoutId?: string | null
  ): Promise<PayoutRow | null>;
}

// -----------------------------
// HELPERS
// -----------------------------

// 3% kortavgift – vår kostnad vi drar bort från brutto
export function calculateCardFee(grossAmount: number): number {
  if (!Number.isFinite(grossAmount)) return 0;
  const fee = grossAmount * 0.03;
  return Math.round(fee * 100) / 100;
}

export function normalizeCurrency(
  currency: string | null | undefined
): Currency {
  if (!currency) return "usd";
  return currency.toLowerCase();
}

// -----------------------------
// STRIPE SUBSCRIPTION PAYMENT
// (ANVÄNDS I /api/webhooks/stripe)
// -----------------------------

export interface StripeSubscriptionPaymentInput {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  planCode: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  meta?: Record<string, any>;
}

/**
 * 🔥 recordStripeSubscriptionPayment
 * - loggar betalningen i payment_events
 * - uppdaterar user_balances (available += netAmount)
 */
export async function recordStripeSubscriptionPayment(
  store: MegaEngine2Store,
  input: StripeSubscriptionPaymentInput
) {
  const currency = normalizeCurrency(input.currency);
  const gross = input.amount;
  const fee = calculateCardFee(gross);
  const net = gross - fee;

  // 1) Spara payment_event (ingen createdAt/updatedAt här – DB sköter det)
  const event = await store.insertPaymentEvent({
    userId: input.userId,
    source: "stripe-subscription",
    sourceRef: input.stripeInvoiceId,
    platform: "autoaffi-stripe",
    grossAmount: gross,
    currency,
    feeAmount: fee,
    netAmount: net,
    status: "completed",
    meta: {
      ...input.meta,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      planCode: input.planCode,
    },
  });

  // 2) Uppdatera balans (alla medlemskap → direkt available)
  const balance = await store.upsertUserBalance(
    input.userId,
    net,
    0,
    currency
  );

  return { event, balance };
}

// -----------------------------
// WALLET / PAYOUTS – FÖR PAYOUTS-CARDET
// -----------------------------

export interface WalletSnapshot {
  userId: string;
  available: number;
  pending: number;
  currency: Currency;
  lastUpdated: string;
  payouts: PayoutRow[];
}

export async function getWalletSnapshotForUser(
  store: MegaEngine2Store,
  userId: string
): Promise<WalletSnapshot> {
  const balance = await store.getUserBalance(userId);
  const payouts = await store.listPayoutsForUser(userId);

  return {
    userId,
    available: balance?.availableAmount ?? 0,
    pending: balance?.pendingAmount ?? 0,
    currency: balance?.currency ?? "usd",
    lastUpdated: balance?.updatedAt ?? new Date().toISOString(),
    payouts,
  };
}

// -----------------------------
// REQUEST PAYOUT
// (ANVÄNDS AV /api/dashboard/payouts)
// -----------------------------

export interface RequestPayoutInput {
  userId: string;
  amount: number;
  currency: Currency;
  method: PayoutMethod;
  destination: string | null;
}

/**
 * requestPayout
 * - validerar saldo
 * - skapar payout-row
 * - drar ner available-balance
 */
export async function requestPayout(
  store: MegaEngine2Store,
  input: RequestPayoutInput
): Promise<{ payout: PayoutRow; balance: BalanceSnapshot }> {
  const balance = await store.getUserBalance(input.userId);
  const available = balance?.availableAmount ?? 0;

  if (input.amount <= 0) {
    throw new Error("Payout amount must be greater than 0");
  }

  if (input.amount > available) {
    throw new Error("Insufficient available balance for payout");
  }

  const payout = await store.insertPayout({
    userId: input.userId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    destination: input.destination,
  });

  const updatedBalance = await store.upsertUserBalance(
    input.userId,
    -input.amount,
    0,
    balance?.currency ?? input.currency
  );

  return { payout, balance: updatedBalance };
}