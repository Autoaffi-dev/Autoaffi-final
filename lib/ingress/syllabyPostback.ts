import { timingSafeStringEqual } from "../auth/cronAuth";
import {
  AMOUNT_UNIT_MINOR_HUNDREDTHS,
  isVerifiedProductionConfig,
  SYLLABY_CURRENCY_SOURCE,
  SYLLABY_PRODUCTION_ENVIRONMENT,
  SYLLABY_TEST_ACCOUNT,
  SYLLABY_TEST_CURRENCY,
  SYLLABY_TEST_ENVIRONMENT,
  SYLLABY_TEST_PLATFORM,
  SYLLABY_TEST_PROGRAM,
  SYLLABY_TEST_PROVIDER,
  syllabyProductionConfig,
  syllabyTestConfig,
  type FirstPromoterProgramConfig,
} from "./firstPromoterProgram";

export {
  SYLLABY_CURRENCY_SOURCE,
  SYLLABY_PRODUCTION_ENVIRONMENT,
  SYLLABY_TEST_ACCOUNT,
  SYLLABY_TEST_CURRENCY,
  SYLLABY_TEST_ENVIRONMENT,
  SYLLABY_TEST_PLATFORM,
  SYLLABY_TEST_PROGRAM,
  SYLLABY_TEST_PROVIDER,
};

export const MATCH_MATCHED = "matched";
export const MATCH_UNRESOLVED = "unresolved_review";

const SUB_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
const EVENT_TYPE_PATTERN = /^[\x20-\x7E]{1,64}$/;
const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MINOR_DIGITS = "1000000000000";
const QUERY_KEYS = [
  "sub_id",
  "event_id",
  "event_type",
  "conversion_amount",
  "reward_amount",
] as const;

export type MatchStatus = typeof MATCH_MATCHED | typeof MATCH_UNRESOLVED;

export type MatchReason =
  | "matched"
  | "duplicate_query_param"
  | "missing_event_id"
  | "invalid_amount"
  | "missing_or_invalid_sub_id"
  | "unknown_sub_id"
  | "ambiguous_sub_id";

export type SyllabyQueryPayload = {
  sub_id: string | null;
  event_id: string | null;
  event_type: string | null;
  conversion_amount: string | null;
  reward_amount: string | null;
};

export type ScopedPostbackEvent = {
  provider: string;
  accountScope: string;
  programScope: string;
  environment: "test" | "production";
  platform: string;
  isTest: boolean;
  currencyCode: string;
  currencySource: string;
  duplicateQuery: boolean;
  amountValid: boolean;
  subId: string | null;
  subIdValid: boolean;
  eventId: string | null;
  eventType: string | null;
  conversionAmountText: string | null;
  rewardAmountText: string | null;
  conversionAmountMinor: number | null;
  rewardAmountMinor: number | null;
  payload: SyllabyQueryPayload;
};

export type SyllabyPostbackEvent = ScopedPostbackEvent & {
  provider: "firstpromoter";
  accountScope: "syllaby";
  programScope: "syllaby_affiliates";
  platform: "syllaby";
  currencyCode: "USD";
  currencySource: "provider_documentation";
};

export type SyllabyTestEvent = SyllabyPostbackEvent & {
  environment: typeof SYLLABY_TEST_ENVIRONMENT;
  isTest: true;
};

export type SyllabyProductionEvent = SyllabyPostbackEvent & {
  environment: typeof SYLLABY_PRODUCTION_ENVIRONMENT;
  isTest: false;
};

export type TestIdentityRef = {
  id: string;
  ownerUserId: string;
  trackingCode: string;
  provider: string;
  accountScope: string;
  programScope: string;
  environment: string;
};

export type MatchDecision = {
  matchStatus: MatchStatus;
  matchReason: MatchReason;
  matchedOwnerId: string | null;
  matchedIdentityId: string | null;
};

export type SyllabyOfferRef = {
  userId: string;
  trackingCode: string;
  platform: string;
  active: boolean;
};

export type InboundEventWrite = ScopedPostbackEvent & MatchDecision;

export type EventContentSnapshot = {
  provider: string;
  accountScope: string;
  programScope: string;
  environment: string;
  platform: string;
  eventId: string | null;
  eventType: string | null;
  subId: string | null;
  conversionAmountText: string | null;
  rewardAmountText: string | null;
  conversionAmountMinor: number | null;
  rewardAmountMinor: number | null;
  currencyCode: string;
  currencySource: string;
  isTest: boolean;
  payload: SyllabyQueryPayload;
};

export type IdentityLookup = {
  provider: string;
  accountScope: string;
  programScope: string;
  environment: string;
  trackingCode: string;
};

export type OfferLookup = {
  platform: string;
  trackingCode: string;
};

export type SyllabyInboundStore = {
  findTestIdentities(args: IdentityLookup): Promise<TestIdentityRef[]>;
  findSyllabyOffers(args: OfferLookup): Promise<SyllabyOfferRef[]>;
  insertEvent(event: InboundEventWrite): Promise<{ inserted: boolean; conflict: boolean }>;
};

export type AcceptSyllabyResult =
  | { ok: true; duplicate: true; conflict: false }
  | { ok: true; duplicate: false; conflict: true }
  | {
      ok: true;
      duplicate: false;
      conflict: false;
      matchStatus: MatchStatus;
      matchReason: MatchReason;
      matchedOwnerId: string | null;
    };

type FieldRead =
  | { state: "absent" }
  | { state: "duplicate" }
  | { state: "value"; value: string };

function unresolved(matchReason: MatchReason): MatchDecision {
  return {
    matchStatus: MATCH_UNRESOLVED,
    matchReason,
    matchedOwnerId: null,
    matchedIdentityId: null,
  };
}

function readField(params: URLSearchParams, key: string): FieldRead {
  const values = params.getAll(key);
  if (values.length === 0) return { state: "absent" };
  if (values.length > 1) return { state: "duplicate" };
  const trimmed = values[0].trim();
  if (!trimmed) return { state: "absent" };
  return { state: "value", value: trimmed };
}

/**
 * The payload amount is a decimal in the major currency, such as "1.25".
 * The parser converts that text to hundredths. Do not divide the stored minor amount again.
 */
export function decimalToMinor(raw: string): number | null {
  const parsed = parseMinor(raw);
  return parsed.ok ? parsed.minor : null;
}

function parseMinor(raw: string): { ok: true; minor: number } | { ok: false } {
  if (!DECIMAL_PATTERN.test(raw)) return { ok: false };
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = body.split(".");
  if (!/^\d+$/.test(whole) || whole.length > 1 && whole.startsWith("0")) return { ok: false };
  if (fraction.length > 2) return { ok: false };
  const digits = (whole + (fraction + "00").slice(0, 2)).replace(/^0+/, "") || "0";
  const aboveRange =
    digits.length > MAX_MINOR_DIGITS.length ||
    (digits.length === MAX_MINOR_DIGITS.length && digits > MAX_MINOR_DIGITS);
  if (aboveRange) return { ok: false };
  const minor = Number(digits);
  if (!Number.isSafeInteger(minor)) return { ok: false };
  return { ok: true, minor: negative ? -minor : minor };
}

function amountField(field: FieldRead): {
  text: string | null;
  minor: number | null;
  valid: boolean;
} {
  if (field.state === "absent") return { text: null, minor: null, valid: true };
  if (field.state === "duplicate") return { text: null, minor: null, valid: false };
  const parsed = parseMinor(field.value);
  if (!parsed.ok) {
    return {
      text: field.value.length <= 64 ? field.value : null,
      minor: null,
      valid: false,
    };
  }
  return { text: field.value, minor: parsed.minor, valid: true };
}

export function syllabyTestSecretMatches(
  provided: string,
  expected: string | null | undefined
): boolean {
  const wanted = String(expected || "");
  if (!wanted) return false;
  return timingSafeStringEqual(String(provided || ""), wanted);
}

function parseScopedQuery(
  params: URLSearchParams,
  config: FirstPromoterProgramConfig
): ScopedPostbackEvent {
  const fields = {
    sub_id: readField(params, QUERY_KEYS[0]),
    event_id: readField(params, QUERY_KEYS[1]),
    event_type: readField(params, QUERY_KEYS[2]),
    conversion_amount: readField(params, QUERY_KEYS[3]),
    reward_amount: readField(params, QUERY_KEYS[4]),
  };
  const duplicateQuery = Object.values(fields).some((field) => field.state === "duplicate");
  const subValue = fields.sub_id.state === "value" ? fields.sub_id.value : null;
  const eventValue = fields.event_id.state === "value" ? fields.event_id.value : null;
  const typeValue = fields.event_type.state === "value" ? fields.event_type.value : null;
  const subIdValid = subValue != null && SUB_ID_PATTERN.test(subValue);
  const eventId = eventValue != null && EVENT_ID_PATTERN.test(eventValue) ? eventValue : null;
  const eventType = typeValue != null && EVENT_TYPE_PATTERN.test(typeValue) ? typeValue : null;
  const conversion = amountField(fields.conversion_amount);
  const reward = amountField(fields.reward_amount);
  const amountValid = conversion.valid && reward.valid && !duplicateQuery;

  return {
    provider: config.provider,
    accountScope: config.accountScope,
    programScope: config.programScope,
    environment: config.environment,
    platform: config.platform,
    isTest: config.isTest,
    currencyCode: config.currencyCode,
    currencySource: config.currencySource,
    duplicateQuery,
    amountValid,
    subId: subIdValid ? subValue : null,
    subIdValid,
    eventId: duplicateQuery && fields.event_id.state === "duplicate" ? null : eventId,
    eventType,
    conversionAmountText: conversion.text,
    rewardAmountText: reward.text,
    conversionAmountMinor: conversion.minor,
    rewardAmountMinor: reward.minor,
    payload: {
      sub_id: subIdValid ? subValue : null,
      event_id: eventId,
      event_type: eventType,
      conversion_amount: conversion.valid ? conversion.text : null,
      reward_amount: reward.valid ? reward.text : null,
    },
  };
}

export function parseSyllabyTestQuery(params: URLSearchParams): SyllabyTestEvent {
  return parseScopedQuery(params, syllabyTestConfig) as SyllabyTestEvent;
}

export function parseSyllabyProductionQuery(params: URLSearchParams): SyllabyProductionEvent {
  return parseScopedQuery(params, syllabyProductionConfig) as SyllabyProductionEvent;
}

function decideScopedTestMatch(
  event: ScopedPostbackEvent,
  identities: TestIdentityRef[]
): MatchDecision {
  if (event.duplicateQuery) return unresolved("duplicate_query_param");
  if (!event.eventId) return unresolved("missing_event_id");
  if (!event.amountValid) return unresolved("invalid_amount");
  if (!event.subIdValid || !event.subId) return unresolved("missing_or_invalid_sub_id");

  const hits = identities.filter(
    (row) =>
      row.trackingCode === event.subId &&
      row.provider === event.provider &&
      row.accountScope === event.accountScope &&
      row.programScope === event.programScope &&
      row.environment === event.environment
  );
  if (hits.length === 1) {
    return {
      matchStatus: MATCH_MATCHED,
      matchReason: "matched",
      matchedOwnerId: hits[0].ownerUserId,
      matchedIdentityId: hits[0].id,
    };
  }
  if (hits.length === 0) return unresolved("unknown_sub_id");
  return unresolved("ambiguous_sub_id");
}

export function decideSyllabyTestMatch(
  event: SyllabyTestEvent,
  identities: TestIdentityRef[]
): MatchDecision {
  return decideScopedTestMatch(event, identities);
}

function decideScopedProductionMatch(
  event: ScopedPostbackEvent,
  offers: SyllabyOfferRef[]
): MatchDecision {
  if (event.duplicateQuery) return unresolved("duplicate_query_param");
  if (!event.eventId) return unresolved("missing_event_id");
  if (!event.amountValid) return unresolved("invalid_amount");
  if (!event.subIdValid || !event.subId) return unresolved("missing_or_invalid_sub_id");

  const owners = new Map<string, string>();
  for (const row of offers) {
    if (row.platform !== event.platform) continue;
    if (row.trackingCode !== event.subId) continue;
    const userId = row.userId.trim();
    if (!USER_ID_PATTERN.test(userId)) throw new Error("OFFER_OWNER_INVALID");
    const key = userId.toLowerCase();
    if (!owners.has(key)) owners.set(key, userId);
  }
  if (owners.size === 1) {
    return {
      matchStatus: MATCH_MATCHED,
      matchReason: "matched",
      matchedOwnerId: [...owners.values()][0],
      matchedIdentityId: null,
    };
  }
  if (owners.size === 0) return unresolved("unknown_sub_id");
  return unresolved("ambiguous_sub_id");
}

export function decideSyllabyProductionMatch(
  event: SyllabyProductionEvent,
  offers: SyllabyOfferRef[]
): MatchDecision {
  return decideScopedProductionMatch(event, offers);
}

export function eventContentSnapshot(event: InboundEventWrite): EventContentSnapshot {
  return {
    provider: event.provider,
    accountScope: event.accountScope,
    programScope: event.programScope,
    environment: event.environment,
    platform: event.platform,
    eventId: event.eventId,
    eventType: event.eventType,
    subId: event.subId,
    conversionAmountText: event.conversionAmountText,
    rewardAmountText: event.rewardAmountText,
    conversionAmountMinor: event.conversionAmountMinor,
    rewardAmountMinor: event.rewardAmountMinor,
    currencyCode: event.currencyCode,
    currencySource: event.currencySource,
    isTest: event.isTest,
    payload: { ...event.payload },
  };
}

export function sameEventContent(left: EventContentSnapshot, right: EventContentSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canResolveOwner(event: ScopedPostbackEvent): event is ScopedPostbackEvent & {
  eventId: string;
  subId: string;
} {
  return Boolean(
    event.eventId && event.amountValid && event.subIdValid && event.subId && !event.duplicateQuery
  );
}

async function storeDecision(
  store: SyllabyInboundStore,
  event: ScopedPostbackEvent,
  decision: MatchDecision
): Promise<AcceptSyllabyResult> {
  const stored = await store.insertEvent({ ...event, ...decision });
  if (stored.conflict) return { ok: true, duplicate: false, conflict: true };
  if (!stored.inserted) return { ok: true, duplicate: true, conflict: false };
  return {
    ok: true,
    duplicate: false,
    conflict: false,
    matchStatus: decision.matchStatus,
    matchReason: decision.matchReason,
    matchedOwnerId: decision.matchedOwnerId,
  };
}

export async function acceptScopedPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
  config: FirstPromoterProgramConfig;
}): Promise<AcceptSyllabyResult> {
  if (args.config.isTest !== (args.config.environment === "test")) {
    throw new Error("ENVIRONMENT_MISMATCH");
  }
  if (!args.config.isTest && !isVerifiedProductionConfig(args.config)) {
    throw new Error("PRODUCTION_NOT_CONFIGURED");
  }
  if (args.config.amountUnit !== AMOUNT_UNIT_MINOR_HUNDREDTHS) {
    throw new Error("AMOUNT_UNIT_UNVERIFIED");
  }

  const event = parseScopedQuery(args.searchParams, args.config);
  if (event.isTest) {
    const identities = canResolveOwner(event)
      ? await args.store.findTestIdentities({
          provider: event.provider,
          accountScope: event.accountScope,
          programScope: event.programScope,
          environment: event.environment,
          trackingCode: event.subId,
        })
      : [];
    return storeDecision(args.store, event, decideScopedTestMatch(event, identities));
  }

  const offers = canResolveOwner(event)
    ? await args.store.findSyllabyOffers({
        platform: event.platform,
        trackingCode: event.subId,
      })
    : [];
  return storeDecision(args.store, event, decideScopedProductionMatch(event, offers));
}

export async function acceptSyllabyTestPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
}): Promise<AcceptSyllabyResult> {
  return acceptScopedPostback({
    searchParams: args.searchParams,
    store: args.store,
    config: syllabyTestConfig,
  });
}

export async function acceptSyllabyProductionPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
}): Promise<AcceptSyllabyResult> {
  return acceptScopedPostback({
    searchParams: args.searchParams,
    store: args.store,
    config: syllabyProductionConfig,
  });
}
