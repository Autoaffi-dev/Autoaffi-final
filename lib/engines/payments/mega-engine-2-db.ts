import { createClient } from "@supabase/supabase-js";
import type {
  MegaEngine2Store,
  PaymentEvent,
  BalanceSnapshot,
  PayoutRow,
} from "./mega-engine-2-core";

// -----------------------------
// SUPABASE CLIENT (SERVER-SIDE)
// -----------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[MegaEngine2] Missing SUPABASE env vars. Check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// -----------------------------
// DB-ROW TYPES (matchar tabeller)
// -----------------------------

interface PaymentEventRow {
  id: string;
  user_id: string;
  source: string;
  source_ref: string | null;
  platform: string | null;
  gross_amount: number;
  currency: string;
  fee_amount: number;
  net_amount: number;
  status: string;
  meta: any;
  created_at: string;
  updated_at: string;
}

interface UserBalanceRow {
  user_id: string;
  available_amount: number;
  pending_amount: number;
  currency: string;
  updated_at: string;
}

interface PayoutRowDb {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  destination: string | null;
  external_payout_id: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------
// MAPPERS
// -----------------------------

function mapPaymentRow(row: PaymentEventRow): PaymentEvent {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source as any,
    sourceRef: row.source_ref,
    platform: row.platform,
    grossAmount: Number(row.gross_amount),
    currency: row.currency,
    feeAmount: Number(row.fee_amount),
    netAmount: Number(row.net_amount),
    status: row.status as any,
    meta: row.meta ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBalanceRow(row: UserBalanceRow): BalanceSnapshot {
  return {
    userId: row.user_id,
    availableAmount: Number(row.available_amount),
    pendingAmount: Number(row.pending_amount),
    currency: row.currency,
    updatedAt: row.updated_at,
  };
}

function mapPayoutRow(row: PayoutRowDb): PayoutRow {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as any,
    method: row.method as any,
    destination: row.destination,
    externalPayoutId: row.external_payout_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -----------------------------
// STORE IMPLEMENTATION
// -----------------------------

export function createMegaEngine2Store(): MegaEngine2Store {
  return {
    // PAYMENT EVENTS
    async insertPaymentEvent(input) {
      const { data, error } = await supabase
        .from("payment_events")
        .insert({
          user_id: input.userId,
          source: input.source,
          source_ref: input.sourceRef,
          platform: input.platform,
          gross_amount: input.grossAmount,
          currency: input.currency,
          fee_amount: input.feeAmount,
          net_amount: input.netAmount,
          status: input.status,
          meta: input.meta ?? {},
        })
        .select("*")
        .single<PaymentEventRow>();

      if (error || !data) {
        console.error("[MegaEngine2] insertPaymentEvent error:", error);
        throw new Error("Failed to insert payment event");
      }

      return mapPaymentRow(data);
    },

    async listUserEventsSince(userId, since) {
      const { data, error } = await supabase
        .from("payment_events")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (error || !data) {
        console.error("[MegaEngine2] listUserEventsSince error:", error);
        return [];
      }

      return (data as PaymentEventRow[]).map(mapPaymentRow);
    },

    // BALANCES
    async getUserBalance(userId) {
      const { data, error } = await supabase
        .from("user_balances")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle<UserBalanceRow>();

      if (error || !data) {
        if (error) {
          console.error("[MegaEngine2] getUserBalance error:", error);
        }
        return null;
      }

      return mapBalanceRow(data);
    },

    async upsertUserBalance(
      userId,
      deltaAvailable,
      deltaPending,
      currency
    ) {
      // Hämta aktuell balans
      const current = await this.getUserBalance(userId);

      const newAvailable = (current?.availableAmount ?? 0) + deltaAvailable;
      const newPending = (current?.pendingAmount ?? 0) + deltaPending;

      const { data, error } = await supabase
        .from("user_balances")
        .upsert({
          user_id: userId,
          available_amount: newAvailable,
          pending_amount: newPending,
          currency: currency.toLowerCase(),
        })
        .select("*")
        .single<UserBalanceRow>();

      if (error || !data) {
        console.error("[MegaEngine2] upsertUserBalance error:", error);
        throw new Error("Failed to upsert user balance");
      }

      return mapBalanceRow(data);
    },

    // PAYOUTS
    async insertPayout(input) {
      const { data, error } = await supabase
        .from("payouts")
        .insert({
          user_id: input.userId,
          amount: input.amount,
          currency: input.currency.toLowerCase(),
          status: "pending",
          method: input.method,
          destination: input.destination,
          external_payout_id: null,
        })
        .select("*")
        .single<PayoutRowDb>();

      if (error || !data) {
        console.error("[MegaEngine2] insertPayout error:", error);
        throw new Error("Failed to insert payout");
      }

      return mapPayoutRow(data);
    },

    async listPayoutsForUser(userId) {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.error("[MegaEngine2] listPayoutsForUser error:", error);
        return [];
      }

      return (data as PayoutRowDb[]).map(mapPayoutRow);
    },

    async markPayoutAsPaid(payoutId, externalPayoutId) {
      const { data, error } = await supabase
        .from("payouts")
        .update({
          status: "paid",
          external_payout_id: externalPayoutId ?? null,
        })
        .eq("id", payoutId)
        .select("*")
        .maybeSingle<PayoutRowDb>();

      if (error || !data) {
        console.error("[MegaEngine2] markPayoutAsPaid error:", error);
        return null;
      }

      return mapPayoutRow(data);
    },
  };
}