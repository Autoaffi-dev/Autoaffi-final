export type BillingCustomerBinding = {
  userId: string;
  stripeCustomerId: string;
};

export type BillingCustomerInsertResult =
  | { ok: true }
  | { ok: false; reason: "unique_violation" };

export type BillingCustomerStore = {
  findByUserId(userId: string): Promise<BillingCustomerBinding | null>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<BillingCustomerBinding | null>;
  insert(binding: BillingCustomerBinding): Promise<BillingCustomerInsertResult>;
};

export type StripeCustomerClient = {
  customers: {
    create(
      params: { metadata: { user_id: string } },
      options: { idempotencyKey: string }
    ): Promise<{ id: string }>;
  };
};

export class BillingCustomerUnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "BillingCustomerUnauthorizedError";
  }
}

export class BillingCustomerOwnerConflictError extends Error {
  constructor() {
    super("BILLING_CUSTOMER_OWNER_CONFLICT");
    this.name = "BillingCustomerOwnerConflictError";
  }
}

export class BillingCustomerNotBoundError extends Error {
  constructor() {
    super("BILLING_CUSTOMER_NOT_BOUND");
    this.name = "BillingCustomerNotBoundError";
  }
}

const UNAUTHORIZED = "UNAUTHORIZED";

async function verifiedBindingAfterConflict(
  db: BillingCustomerStore,
  userId: string,
  createdCustomerId: string
): Promise<BillingCustomerBinding> {
  let byUser: BillingCustomerBinding | null = null;
  let byCustomer: BillingCustomerBinding | null = null;
  try {
    byUser = await db.findByUserId(userId);
    byCustomer = await db.findByStripeCustomerId(createdCustomerId);
  } catch {
    throw new BillingCustomerNotBoundError();
  }

  if (byCustomer && byCustomer.userId !== userId) {
    throw new BillingCustomerOwnerConflictError();
  }
  if (byUser && byUser.userId !== userId) {
    throw new BillingCustomerNotBoundError();
  }
  if (byUser && byCustomer && byUser.stripeCustomerId !== byCustomer.stripeCustomerId) {
    throw new BillingCustomerNotBoundError();
  }
  if (byUser && byUser.stripeCustomerId === createdCustomerId) {
    return byUser;
  }
  if (byUser && byUser.stripeCustomerId !== createdCustomerId && !byCustomer) {
    return byUser;
  }
  if (!byUser && byCustomer && byCustomer.userId === userId && byCustomer.stripeCustomerId === createdCustomerId) {
    return byCustomer;
  }
  throw new BillingCustomerNotBoundError();
}

export async function findOrCreateBillingCustomer(input: {
  request: Request;
  resolveUserId: (request: Request) => Promise<string>;
  stripe: StripeCustomerClient;
  db: BillingCustomerStore;
}): Promise<BillingCustomerBinding> {
  let userId = "";
  try {
    userId = String((await input.resolveUserId(input.request)) || "");
  } catch (err) {
    if (err instanceof Error && err.message === UNAUTHORIZED) {
      throw new BillingCustomerUnauthorizedError();
    }
    throw err;
  }
  if (!userId) throw new BillingCustomerUnauthorizedError();

  const existing = await input.db.findByUserId(userId);
  if (existing) return existing;

  const created = await input.stripe.customers.create(
    { metadata: { user_id: userId } },
    { idempotencyKey: `billing-customer:${userId}` }
  );

  let insertResult: BillingCustomerInsertResult;
  try {
    insertResult = await input.db.insert({
      userId,
      stripeCustomerId: created.id,
    });
  } catch {
    throw new BillingCustomerNotBoundError();
  }

  if (!insertResult.ok) {
    return verifiedBindingAfterConflict(input.db, userId, created.id);
  }

  let saved: BillingCustomerBinding | null;
  try {
    saved = await input.db.findByUserId(userId);
  } catch {
    throw new BillingCustomerNotBoundError();
  }
  if (!saved) throw new BillingCustomerNotBoundError();
  return saved;
}
