import type { EntitlementPlan } from "./paidPlan";

export type PaidCardPlan = "basic" | "pro" | "elite";

export type EntitlementView =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; plan: EntitlementPlan };

const PAID: readonly PaidCardPlan[] = ["basic", "pro", "elite"];

export function entitlementViewFromResponse(status: number, body: unknown): EntitlementView {
  if (status !== 200) return { status: "error" };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { status: "error" };
  const plan = (body as { plan?: unknown }).plan;
  if (plan === "none" || plan === "basic" || plan === "pro" || plan === "elite") {
    return { status: "ready", plan };
  }
  return { status: "error" };
}

export function paidCardPlan(view: EntitlementView): PaidCardPlan | null {
  if (view.status !== "ready") return null;
  return view.plan === "none" ? null : view.plan;
}

export function entitlementLabel(view: EntitlementView): string {
  if (view.status === "loading") return "Loading";
  if (view.status === "error") return "Unavailable";
  if (view.plan === "none") return "No plan";
  if (view.plan === "basic") return "Basic";
  if (view.plan === "pro") return "Pro";
  return "Elite";
}

export function cardForceLocked(view: EntitlementView, openWithoutPlan: boolean): boolean {
  if (openWithoutPlan) return false;
  return paidCardPlan(view) === null;
}

export function isPaidPlan(value: string): value is PaidCardPlan {
  return (PAID as readonly string[]).includes(value);
}
