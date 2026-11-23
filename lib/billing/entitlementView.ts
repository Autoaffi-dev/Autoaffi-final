import type { EntitlementPlan } from "./paidPlan";
import { effectivePlan as higherPlan } from "./testAccess";

export type PaidCardPlan = "basic" | "pro" | "elite";

export type EntitlementView =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      paidPlan: EntitlementPlan;
      testPlan: EntitlementPlan;
      effectivePlan: EntitlementPlan;
      testExpiresAt: string | null;
    };

const PLANS = new Set(["none", "basic", "pro", "elite"]);
const PAID: readonly PaidCardPlan[] = ["basic", "pro", "elite"];

function readPlan(value: unknown): EntitlementPlan | null {
  return value === "none" || value === "basic" || value === "pro" || value === "elite" ? value : null;
}

export function entitlementViewFromResponse(status: number, body: unknown): EntitlementView {
  if (status !== 200) return { status: "error" };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: "error" };
  const record = body as { plan?: unknown; paidPlan?: unknown; testPlan?: unknown; effectivePlan?: unknown; testExpiresAt?: unknown };
  if ("plan" in record || !PLANS.has(String(record.paidPlan))) return { status: "error" };
  const paidPlan = readPlan(record.paidPlan);
  const testPlan = readPlan(record.testPlan);
  const featurePlan = readPlan(record.effectivePlan);
  if (!paidPlan || !testPlan || !featurePlan || higherPlan(paidPlan, testPlan) !== featurePlan) return { status: "error" };
  if (testPlan === "none") {
    if (record.testExpiresAt != null) return { status: "error" };
    return { status: "ready", paidPlan, testPlan, effectivePlan: featurePlan, testExpiresAt: null };
  }
  if (record.testExpiresAt == null) {
    return { status: "ready", paidPlan, testPlan, effectivePlan: featurePlan, testExpiresAt: null };
  }
  if (typeof record.testExpiresAt !== "string" || !Number.isFinite(Date.parse(record.testExpiresAt))) {
    return { status: "error" };
  }
  return { status: "ready", paidPlan, testPlan, effectivePlan: featurePlan, testExpiresAt: record.testExpiresAt };
}

export function effectiveCardPlan(view: EntitlementView): PaidCardPlan | null {
  if (view.status !== "ready") return null;
  return view.effectivePlan === "none" ? null : view.effectivePlan;
}

export function paidStatusLabel(plan: EntitlementPlan): string {
  if (plan === "basic") return "Basic";
  if (plan === "pro") return "Pro";
  if (plan === "elite") return "Elite";
  return "No paid plan";
}

export function testStatusLabel(plan: EntitlementPlan): string | null {
  if (plan === "basic") return "Basic test";
  if (plan === "pro") return "Pro test";
  if (plan === "elite") return "Elite test";
  return null;
}

export function entitlementLabel(view: EntitlementView): string {
  if (view.status === "loading") return "Loading";
  if (view.status === "error") return "Unavailable";
  const test = testStatusLabel(view.testPlan);
  if (view.paidPlan === "none" && !test) return "No plan";
  if (!test) return paidStatusLabel(view.paidPlan);
  if (view.paidPlan === "none") return `No paid plan · ${test}`;
  return `Paid ${paidStatusLabel(view.paidPlan)} · ${test}`;
}

export function cardForceLocked(view: EntitlementView, openWithoutPlan: boolean): boolean {
  if (openWithoutPlan) return false;
  return effectiveCardPlan(view) === null;
}

export function isPaidPlan(value: string): value is PaidCardPlan {
  return (PAID as readonly string[]).includes(value);
}

/** Current plan follows the verified paid plan. Test access never selects it. */
export function isCurrentPaidPlan(view: EntitlementView, planName: string): boolean {
  if (view.status !== "ready" || view.paidPlan === "none") return false;
  const paidName = view.paidPlan === "basic" ? "Basic" : view.paidPlan === "pro" ? "Pro" : "Elite";
  return planName === paidName;
}
