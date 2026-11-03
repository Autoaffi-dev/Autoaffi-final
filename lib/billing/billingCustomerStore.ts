import type {
  BillingCustomerBinding,
  BillingCustomerInsertResult,
  BillingCustomerStore,
} from "./billingCustomer";

type CustomerRow = {
  user_id: string;
  stripe_customer_id: string;
};

type CustomerResult = {
  data: CustomerRow | null;
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
    insert(row: {
      user_id: string;
      stripe_customer_id: string;
    }): PromiseLike<{
      error: { code?: string; message?: string } | null;
    }>;
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
  };
}
