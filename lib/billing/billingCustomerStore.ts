import type {
  BillingCustomerBinding,
  BillingCustomerInsertResult,
  BillingCustomerStore,
  RecordVerifiedAccountResult,
  VerifiedCustomerAccount,
} from "./billingCustomer";

type CustomerRow = {
  user_id: string;
  stripe_customer_id: string;
};

type VerifiedCustomerRow = CustomerRow & {
  livemode: boolean | null;
  stripe_account_id: string | null;
};

type CustomerResult = {
  data: CustomerRow | null;
  error: { code?: string; message?: string } | null;
};

type VerifiedCustomerResult = {
  data: VerifiedCustomerRow | null;
  error: { code?: string; message?: string } | null;
};

type WriteResult = {
  error: { code?: string; message?: string } | null;
};

export type BillingCustomerQueryClient = {
  from(table: "billing_stripe_customers"): {
    select(columns: "user_id,stripe_customer_id"): {
      eq(
        column: "user_id" | "stripe_customer_id",
        value: string
      ): {
        maybeSingle(): PromiseLike<CustomerResult>;
      };
    };
    select(columns: "user_id,stripe_customer_id,livemode,stripe_account_id"): {
      eq(column: "user_id", value: string): {
        maybeSingle(): PromiseLike<VerifiedCustomerResult>;
      };
    };
    insert(row: {
      user_id: string;
      stripe_customer_id: string;
    }): PromiseLike<WriteResult>;
    update(row: {
      livemode: boolean;
      stripe_account_id: string;
    }): {
      eq(column: "user_id", value: string): {
        eq(column: "stripe_customer_id", value: string): {
          is(column: "livemode", value: null): {
            is(column: "stripe_account_id", value: null): PromiseLike<WriteResult>;
          };
        };
      };
    };
  };
};

function bindingFrom(result: CustomerResult): BillingCustomerBinding | null {
  if (result.error) throw new Error("BILLING_CUSTOMER_STORE_FAILED");
  if (!result.data) return null;
  return {
    userId: result.data.user_id,
    stripeCustomerId: result.data.stripe_customer_id,
  };
}

export function createSupabaseBillingCustomerStore(
  client: BillingCustomerQueryClient
): BillingCustomerStore {
  function read(column: "user_id" | "stripe_customer_id", value: string) {
    return client
      .from("billing_stripe_customers")
      .select("user_id,stripe_customer_id")
      .eq(column, value)
      .maybeSingle();
  }

  return {
    async findByUserId(userId) {
      return bindingFrom(await read("user_id", userId));
    },

    async findByStripeCustomerId(stripeCustomerId) {
      return bindingFrom(await read("stripe_customer_id", stripeCustomerId));
    },

    async insert(binding: BillingCustomerBinding): Promise<BillingCustomerInsertResult> {
      const result = await client.from("billing_stripe_customers").insert({
        user_id: binding.userId,
        stripe_customer_id: binding.stripeCustomerId,
      });
      if (!result.error) return { ok: true };
      if (result.error.code === "23505") return { ok: false, reason: "unique_violation" };
      throw new Error("BILLING_CUSTOMER_STORE_FAILED");
    },

    async recordVerifiedAccount(input: VerifiedCustomerAccount): Promise<RecordVerifiedAccountResult> {
      const current = await readVerified(client, input.userId);
      const decision = verifiedAccountDecision(current, input);
      if (decision !== "record") return decision;
      const updated = await client
        .from("billing_stripe_customers")
        .update({
          livemode: input.livemode,
          stripe_account_id: input.stripeAccountId,
        })
        .eq("user_id", input.userId)
        .eq("stripe_customer_id", input.stripeCustomerId)
        .is("livemode", null)
        .is("stripe_account_id", null);
      if (updated.error) throw new Error("BILLING_CUSTOMER_STORE_FAILED");
      const again = await readVerified(client, input.userId);
      if (
        again &&
        again.user_id === input.userId &&
        again.stripe_customer_id === input.stripeCustomerId &&
        again.livemode === input.livemode &&
        again.stripe_account_id === input.stripeAccountId
      ) {
        return "recorded";
      }
      return verifiedAccountDecision(again, input) === "already_verified" ? "already_verified" : "conflict";
    },
  };
}

async function readVerified(
  client: BillingCustomerQueryClient,
  userId: string
): Promise<VerifiedCustomerRow | null> {
  const result = await client
    .from("billing_stripe_customers")
    .select("user_id,stripe_customer_id,livemode,stripe_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("BILLING_CUSTOMER_STORE_FAILED");
  return result.data;
}

export function verifiedAccountDecision(
  row: VerifiedCustomerRow | null,
  input: VerifiedCustomerAccount
): RecordVerifiedAccountResult | "record" {
  if (!row || row.user_id !== input.userId || row.stripe_customer_id !== input.stripeCustomerId) return "missing";
  if (row.livemode === input.livemode && row.stripe_account_id === input.stripeAccountId) return "already_verified";
  if (row.livemode !== null || row.stripe_account_id !== null) return "conflict";
  return "record";
}
