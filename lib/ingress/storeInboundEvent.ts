import {
  eventContentSnapshot,
  sameEventContent,
  type EventContentSnapshot,
  type InboundEventWrite,
  type SyllabyInboundStore,
  type TestIdentityRef,
} from "./syllabyPostback";

type DbError = { code?: string; message?: string } | null;

export type InboundDb = {
  from(table: string): any;
};

export function isUniqueViolation(error: DbError): boolean {
  return error?.code === "23505";
}

export function toInboundEventRow(event: InboundEventWrite): Record<string, unknown> {
  return {
    provider: event.provider,
    account_scope: event.accountScope,
    program_scope: event.programScope,
    environment: event.environment,
    platform: event.platform,
    external_event_id: event.eventId,
    event_type: event.eventType,
    sub_id: event.subId,
    conversion_amount_text: event.conversionAmountText,
    reward_amount_text: event.rewardAmountText,
    conversion_amount_minor: event.conversionAmountMinor,
    reward_amount_minor: event.rewardAmountMinor,
    currency_code: event.currencyCode,
    currency_source: event.currencySource,
    is_test: true,
    match_status: event.matchStatus,
    match_reason: event.matchReason,
    matched_owner_id: event.matchedOwnerId,
    matched_identity_id: event.matchedIdentityId,
    payload: event.payload,
  };
}

export function snapshotFromRow(row: Record<string, unknown>): EventContentSnapshot {
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as EventContentSnapshot["payload"])
      : {
          sub_id: null,
          event_id: null,
          event_type: null,
          conversion_amount: null,
          reward_amount: null,
        };
  return {
    provider: String(row.provider),
    accountScope: String(row.account_scope),
    programScope: String(row.program_scope),
    environment: String(row.environment),
    platform: String(row.platform),
    eventId: row.external_event_id == null ? null : String(row.external_event_id),
    eventType: row.event_type == null ? null : String(row.event_type),
    subId: row.sub_id == null ? null : String(row.sub_id),
    conversionAmountText:
      row.conversion_amount_text == null ? null : String(row.conversion_amount_text),
    rewardAmountText: row.reward_amount_text == null ? null : String(row.reward_amount_text),
    conversionAmountMinor:
      row.conversion_amount_minor == null ? null : Number(row.conversion_amount_minor),
    rewardAmountMinor: row.reward_amount_minor == null ? null : Number(row.reward_amount_minor),
    currencyCode: String(row.currency_code),
    currencySource: String(row.currency_source),
    isTest: row.is_test === true,
    payload: {
      sub_id: payload.sub_id ?? null,
      event_id: payload.event_id ?? null,
      event_type: payload.event_type ?? null,
      conversion_amount: payload.conversion_amount ?? null,
      reward_amount: payload.reward_amount ?? null,
    },
  };
}

const EVENT_COLUMNS = [
  "provider",
  "account_scope",
  "program_scope",
  "environment",
  "platform",
  "external_event_id",
  "event_type",
  "sub_id",
  "conversion_amount_text",
  "reward_amount_text",
  "conversion_amount_minor",
  "reward_amount_minor",
  "currency_code",
  "currency_source",
  "is_test",
  "match_status",
  "match_reason",
  "matched_owner_id",
  "matched_identity_id",
  "payload",
].join(",");

export function createInboundStore(db: InboundDb): SyllabyInboundStore {
  return {
    async findTestIdentities(args): Promise<TestIdentityRef[]> {
      const { data, error } = await db
        .from("affiliate_test_identities")
        .select("id, owner_user_id")
        .eq("provider", args.provider)
        .eq("account_scope", args.accountScope)
        .eq("program_scope", args.programScope)
        .eq("environment", args.environment)
        .eq("tracking_code", args.trackingCode);
      if (error) throw new Error("TEST_IDENTITY_LOOKUP_FAILED");
      return (data ?? []).map((row: { id: string; owner_user_id: string }) => ({
        id: row.id,
        ownerUserId: row.owner_user_id,
        trackingCode: args.trackingCode,
        provider: args.provider,
        accountScope: args.accountScope,
        programScope: args.programScope,
        environment: args.environment,
      }));
    },
    async insertEvent(event) {
      const row = toInboundEventRow(event);
      const inserted = await db.from("affiliate_inbound_events").insert(row);
      if (!inserted.error) return { inserted: true, conflict: false };
      if (!isUniqueViolation(inserted.error) || !event.eventId) {
        throw new Error("INBOUND_EVENT_INSERT_FAILED");
      }

      const existing = await db
        .from("affiliate_inbound_events")
        .select(EVENT_COLUMNS)
        .eq("provider", event.provider)
        .eq("account_scope", event.accountScope)
        .eq("program_scope", event.programScope)
        .eq("environment", event.environment)
        .eq("external_event_id", event.eventId)
        .limit(1);
      if (existing.error || !existing.data?.[0]) {
        throw new Error("INBOUND_EVENT_INSERT_FAILED");
      }
      const same = sameEventContent(snapshotFromRow(existing.data[0]), eventContentSnapshot(event));
      return { inserted: false, conflict: !same };
    },
  };
}

export async function createServiceRoleInboundStore(): Promise<SyllabyInboundStore> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return createInboundStore(supabaseAdmin as unknown as InboundDb);
}
