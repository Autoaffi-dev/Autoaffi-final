import { TEST_ACCESS_COLUMNS, type TestAccessSnapshot } from "./testAccess";
import { EntitlementReadError, type SubscriptionReadClient } from "./loadPaidSubscription";

export async function loadTestAccess(
  userId: string,
  db?: SubscriptionReadClient
): Promise<TestAccessSnapshot | null> {
  if (db) {
    const result = await db
      .from("billing_test_access")
      .select(TEST_ACCESS_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    return testAccessFromResult(result.data as TestAccessSnapshot | null, result.error);
  }

  const { supabaseAdmin } = await import("../supabaseAdmin");
  const result = await supabaseAdmin
    .from("billing_test_access")
    .select(TEST_ACCESS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return testAccessFromResult(result.data as TestAccessSnapshot | null, result.error);
}

function testAccessFromResult(
  data: TestAccessSnapshot | null,
  error: { message?: string } | null
): TestAccessSnapshot | null {
  if (error) throw new EntitlementReadError();
  return data ?? null;
}
