export const CHECKOUT_ATTEMPT_COLUMNS =
  "id,user_id,row_version,status,idempotency_key,create_anchor_at,stripe_customer_id,stripe_account_id,plan,stripe_price_id,unit_amount,currency,quantity,livemode,success_url,cancel_url,mode,adaptive_pricing_enabled,automatic_tax_enabled,stripe_session_id,stripe_session_url,observed_late_session_id,supersede_plan,expire_idempotency_key,expire_anchor_at,successor_attempt_id";

export type CheckoutStatus = "pending" | "open" | "expiring" | "complete" | "expired" | "unknown";

export type CheckoutAttempt = {
  id: string;
  user_id: string;
  row_version: number;
  status: CheckoutStatus;
  idempotency_key: string;
  create_anchor_at: string;
  stripe_customer_id: string;
  stripe_account_id: string;
  plan: "basic" | "pro" | "elite";
  stripe_price_id: string;
  unit_amount: number;
  currency: "usd";
  quantity: 1;
  livemode: boolean;
  success_url: string;
  cancel_url: string;
  mode: "subscription";
  adaptive_pricing_enabled: false;
  automatic_tax_enabled: false;
  stripe_session_id: string | null;
  stripe_session_url: string | null;
  observed_late_session_id: string | null;
  supersede_plan: "basic" | "pro" | "elite" | null;
  expire_idempotency_key: string | null;
  expire_anchor_at: string | null;
  successor_attempt_id: string | null;
};

export type FinishExpiringResult =
  | { outcome: "conflict" }
  | { outcome: "closed_without_successor"; status: "expired" | "complete"; reason?: string }
  | { outcome: "reserved_successor"; successor_id: string };

export type FinishExpiringInput = {
  userId: string;
  attemptId: string;
  rowVersion: number;
  stripeAccountId: string;
  action: "close_without_successor" | "reserve_successor";
  closeStatus: "expired" | "complete" | null;
  successor: Record<string, string | number> | null;
};

export class CheckoutStoreError extends Error {
  constructor() {
    super("CHECKOUT_STORE_FAILED");
    this.name = "CheckoutStoreError";
  }
}

export class CheckoutAttemptConflict extends Error {
  constructor() {
    super("CHECKOUT_ATTEMPT_CONFLICT");
    this.name = "CheckoutAttemptConflict";
  }
}

export type CheckoutStore = {
  findBlocking(userId: string): Promise<CheckoutAttempt | null>;
  findById(userId: string, attemptId: string): Promise<CheckoutAttempt | null>;
  insertPending(row: CheckoutAttempt): Promise<void>;
  compareAndSet(
    row: CheckoutAttempt,
    patch: Partial<CheckoutAttempt>,
    expectedExpireKey?: string | null
  ): Promise<CheckoutAttempt | null>;
  finishExpiring(input: FinishExpiringInput): Promise<FinishExpiringResult>;
};

const BLOCKING_STATUSES = ["pending", "open", "unknown", "expiring", "complete"];

type RowResult = {
  data: CheckoutAttempt | CheckoutAttempt[] | null;
  error: { code?: string; message?: string } | null;
};

type Filter = {
  eq(column: string, value: string | number | boolean | null): Filter;
  in(column: string, values: string[]): Filter;
  is(column: string, value: null): Filter;
  maybeSingle(): PromiseLike<RowResult>;
  select(columns: string): Filter;
};

export type CheckoutQueryClient = {
  from(table: "billing_checkout_sessions"): {
    select(columns: string): Filter;
    insert(row: CheckoutAttempt): {
      select(columns: string): { maybeSingle(): PromiseLike<RowResult> };
    };
    update(patch: Record<string, unknown>): Filter;
  };
  rpc(
    fn: "billing_checkout_finish_expiring",
    args: Record<string, unknown>
  ): PromiseLike<{ data: FinishExpiringResult | null; error: { message?: string } | null }>;
};

function oneRow(result: RowResult): CheckoutAttempt | null {
  if (result.error) {
    if (result.error.code === "23505") throw new CheckoutAttemptConflict();
    throw new CheckoutStoreError();
  }
  if (!result.data) return null;
  return Array.isArray(result.data) ? result.data[0] ?? null : result.data;
}

export function createSupabaseCheckoutStore(client: CheckoutQueryClient): CheckoutStore {
  return {
    async findBlocking(userId) {
      const result = await client
        .from("billing_checkout_sessions")
        .select(CHECKOUT_ATTEMPT_COLUMNS)
        .eq("user_id", userId)
        .in("status", BLOCKING_STATUSES)
        .maybeSingle();
      return oneRow(result);
    },
    async findById(userId, attemptId) {
      const result = await client
        .from("billing_checkout_sessions")
        .select(CHECKOUT_ATTEMPT_COLUMNS)
        .eq("user_id", userId)
        .eq("id", attemptId)
        .maybeSingle();
      return oneRow(result);
    },
    async insertPending(row) {
      const result = await client
        .from("billing_checkout_sessions")
        .insert(row)
        .select(CHECKOUT_ATTEMPT_COLUMNS)
        .maybeSingle();
      if (!oneRow(result)) throw new CheckoutStoreError();
    },
    async compareAndSet(row, patch, expectedExpireKey) {
      const next: Record<string, unknown> = {
        ...patch,
        row_version: row.row_version + 1,
        updated_at: new Date().toISOString(),
      };
      let filter = client
        .from("billing_checkout_sessions")
        .update(next)
        .eq("id", row.id)
        .eq("user_id", row.user_id)
        .eq("status", row.status)
        .eq("row_version", row.row_version);
      if (expectedExpireKey !== undefined) filter = filter.eq("expire_idempotency_key", expectedExpireKey);
      const result = await filter.select(CHECKOUT_ATTEMPT_COLUMNS).maybeSingle();
      return oneRow(result);
    },
    async finishExpiring(input) {
      const result = await client.rpc("billing_checkout_finish_expiring", {
        p_user_id: input.userId,
        p_attempt_id: input.attemptId,
        p_row_version: input.rowVersion,
        p_stripe_account_id: input.stripeAccountId,
        p_action: input.action,
        p_close_status: input.closeStatus,
        p_successor: input.successor,
      });
      if (result.error || !result.data || typeof result.data.outcome !== "string") throw new CheckoutStoreError();
      return result.data;
    },
  };
}
