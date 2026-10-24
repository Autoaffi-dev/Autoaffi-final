import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  acceptSyllabyProductionPostback,
  acceptSyllabyTestPostback,
  decimalToMinor,
  eventContentSnapshot,
  MATCH_MATCHED,
  MATCH_UNRESOLVED,
  parseSyllabyTestQuery,
  sameEventContent,
  syllabyTestSecretMatches,
  SYLLABY_CURRENCY_SOURCE,
  SYLLABY_PRODUCTION_ENVIRONMENT,
  SYLLABY_TEST_ACCOUNT,
  SYLLABY_TEST_CURRENCY,
  SYLLABY_TEST_ENVIRONMENT,
  SYLLABY_TEST_PLATFORM,
  SYLLABY_TEST_PROGRAM,
  SYLLABY_TEST_PROVIDER,
  type AcceptSyllabyResult,
  type IdentityLookup,
  type InboundEventWrite,
  type OfferLookup,
  type SyllabyInboundStore,
  type SyllabyOfferRef,
  type TestIdentityRef,
} from "./syllabyPostback.ts";
import {
  createInboundStore,
  isUniqueViolation,
  snapshotFromRow,
  toInboundEventRow,
  type InboundDb,
} from "./storeInboundEvent.ts";

const root = path.resolve(import.meta.dirname, "../..");
const owner = "00000000-0000-4000-8000-000000000001";
const otherOwner = "00000000-0000-4000-8000-000000000002";
const identityId = "00000000-0000-4000-8000-000000000010";
const knownCode = "aa12bc34";

function params(values: Record<string, string>) {
  return new URLSearchParams(values);
}

function identity(
  trackingCode: string,
  id = identityId,
  ownerUserId = owner,
  overrides: Partial<TestIdentityRef> = {}
): TestIdentityRef {
  return {
    id,
    ownerUserId,
    trackingCode,
    provider: SYLLABY_TEST_PROVIDER,
    accountScope: SYLLABY_TEST_ACCOUNT,
    programScope: SYLLABY_TEST_PROGRAM,
    environment: SYLLABY_TEST_ENVIRONMENT,
    ...overrides,
  };
}

function fresh(result: AcceptSyllabyResult) {
  assert.equal(result.duplicate, false);
  assert.equal(result.conflict, false);
  if (result.duplicate || result.conflict) {
    throw new Error("expected a first delivery");
  }
  return result;
}

function memoryStore(identities: TestIdentityRef[]): SyllabyInboundStore & {
  rows: InboundEventWrite[];
  lookups: IdentityLookup[];
} {
  const rows: InboundEventWrite[] = [];
  const lookups: IdentityLookup[] = [];
  return {
    rows,
    lookups,
    async findTestIdentities(args) {
      lookups.push(args);
      return identities.filter(
        (row) =>
          row.trackingCode === args.trackingCode &&
          row.provider === args.provider &&
          row.accountScope === args.accountScope &&
          row.programScope === args.programScope &&
          row.environment === args.environment
      );
    },
    async findSyllabyOffers() {
      throw new Error("TEST_PATH_READ_OFFERS");
    },
    async insertEvent(event) {
      const existing = rows.find(
        (row) =>
          event.eventId != null &&
          row.eventId === event.eventId &&
          row.provider === event.provider &&
          row.accountScope === event.accountScope &&
          row.programScope === event.programScope &&
          row.environment === event.environment
      );
      if (!existing) {
        rows.push(event);
        return { inserted: true, conflict: false };
      }
      const same = sameEventContent(eventContentSnapshot(existing), eventContentSnapshot(event));
      return { inserted: false, conflict: !same };
    },
  };
}

function query(data: Record<string, unknown>[]) {
  const builder = {
    eq() {
      return builder;
    },
    limit() {
      return builder;
    },
    then(
      onfulfilled: (value: { data: Record<string, unknown>[]; error: null }) => unknown
    ) {
      return Promise.resolve({ data, error: null }).then(onfulfilled);
    },
  };
  return builder;
}

describe("Syllaby test postback fixtures", () => {
  it("known test code matches the test owner and keeps the adapter currency", async () => {
    const store = memoryStore([identity(knownCode)]);
    const result = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({
          sub_id: knownCode,
          event_id: "evt-1",
          event_type: "commission",
          conversion_amount: "12.34",
          reward_amount: "4.9",
          currency: "EUR",
          account_scope: "other-account",
          environment: "production",
        }),
        store,
      })
    );

    assert.equal(result.matchStatus, MATCH_MATCHED);
    assert.equal(result.matchedOwnerId, owner);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].isTest, true);
    assert.equal(store.rows[0].provider, SYLLABY_TEST_PROVIDER);
    assert.equal(store.rows[0].accountScope, SYLLABY_TEST_ACCOUNT);
    assert.equal(store.rows[0].programScope, SYLLABY_TEST_PROGRAM);
    assert.equal(store.rows[0].environment, SYLLABY_TEST_ENVIRONMENT);
    assert.equal(store.rows[0].currencyCode, SYLLABY_TEST_CURRENCY);
    assert.equal(store.rows[0].currencySource, SYLLABY_CURRENCY_SOURCE);
    assert.equal(store.rows[0].conversionAmountMinor, 1234);
    assert.equal(store.rows[0].rewardAmountMinor, 490);
    assert.equal(store.rows[0].payload.sub_id, knownCode);
    assert.deepEqual(store.lookups[0], {
      provider: SYLLABY_TEST_PROVIDER,
      accountScope: SYLLABY_TEST_ACCOUNT,
      programScope: SYLLABY_TEST_PROGRAM,
      environment: SYLLABY_TEST_ENVIRONMENT,
      trackingCode: knownCode,
    });
    assert.equal("payout" in store.rows[0], false);
  });

  it("a same code in another account or environment does not match", async () => {
    const store = memoryStore([
      identity(knownCode, identityId, owner, { environment: "production" }),
      identity(knownCode, "00000000-0000-4000-8000-000000000012", owner, {
        accountScope: "other-account",
      }),
    ]);
    const result = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-scope" }),
        store,
      })
    );
    assert.equal(result.matchStatus, MATCH_UNRESOLVED);
    assert.equal(result.matchReason, "unknown_sub_id");
    assert.equal(result.matchedOwnerId, null);
    assert.equal(store.lookups[0].accountScope, SYLLABY_TEST_ACCOUNT);
    assert.equal(store.lookups[0].environment, SYLLABY_TEST_ENVIRONMENT);
  });

  it("missing, invalid, and unknown codes stay unresolved without an owner", async () => {
    const store = memoryStore([identity(knownCode)]);
    const cases = [
      params({ event_id: "evt-missing", conversion_amount: "1.00" }),
      params({ sub_id: "bad code", event_id: "evt-invalid" }),
      params({ sub_id: "unknown1", event_id: "evt-unknown" }),
    ];

    for (const searchParams of cases) {
      const result = fresh(await acceptSyllabyTestPostback({ searchParams, store }));
      assert.equal(result.matchStatus, MATCH_UNRESOLVED);
      assert.equal(result.matchedOwnerId, null);
    }

    assert.equal(store.rows.every((row) => row.matchedOwnerId == null), true);
    assert.equal(store.rows.every((row) => row.matchStatus === MATCH_UNRESOLVED), true);
  });

  it("oversized identifiers are rejected instead of being clipped and matched", async () => {
    const longSub = "a".repeat(65);
    const longEvent = `evt-${"e".repeat(125)}`;
    const store = memoryStore([identity(longSub.slice(0, 64)), identity(knownCode)]);

    const oversizedSub = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: longSub, event_id: "evt-long-sub" }),
        store,
      })
    );
    assert.equal(oversizedSub.matchReason, "missing_or_invalid_sub_id");
    assert.equal(oversizedSub.matchedOwnerId, null);
    assert.equal(store.rows[0].subId, null);
    assert.notEqual(store.rows[0].subId, longSub.slice(0, 64));
    assert.equal(store.rows[0].payload.sub_id, null);

    const oversizedEvent = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: knownCode, event_id: longEvent }),
        store,
      })
    );
    assert.equal(oversizedEvent.matchReason, "missing_event_id");
    assert.equal(oversizedEvent.matchedOwnerId, null);
    assert.equal(store.rows[1].eventId, null);
    assert.notEqual(store.rows[1].eventId, longEvent.slice(0, 128));
    assert.equal(store.lookups.length, 0);
  });

  it("duplicated query parameters are not resolved by taking the first value", async () => {
    const store = memoryStore([identity(knownCode), identity("bbbbbbbb")]);
    const duplicatedSub = fresh(
      await acceptSyllabyTestPostback({
        searchParams: new URLSearchParams(
          `sub_id=${knownCode}&sub_id=bbbbbbbb&event_id=evt-dup-sub`
        ),
        store,
      })
    );
    assert.equal(duplicatedSub.matchReason, "duplicate_query_param");
    assert.equal(duplicatedSub.matchedOwnerId, null);
    assert.equal(store.rows[0].subId, null);
    assert.equal(store.rows[0].eventId, "evt-dup-sub");

    const duplicatedEvent = fresh(
      await acceptSyllabyTestPostback({
        searchParams: new URLSearchParams(
          `sub_id=${knownCode}&event_id=evt-a&event_id=evt-b`
        ),
        store,
      })
    );
    assert.equal(duplicatedEvent.matchReason, "duplicate_query_param");
    assert.equal(store.rows[1].eventId, null);
    assert.equal(store.rows[1].matchedOwnerId, null);
    assert.equal(store.lookups.length, 0);
  });

  it("two identities for one code are unresolved", async () => {
    const store = memoryStore([
      identity(knownCode, identityId, owner),
      identity(knownCode, "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000002"),
    ]);
    const result = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-ambiguous" }),
        store,
      })
    );
    assert.equal(result.matchStatus, MATCH_UNRESOLVED);
    assert.equal(result.matchReason, "ambiguous_sub_id");
    assert.equal(result.matchedOwnerId, null);
  });

  it("a missing event id does not assign the known owner", async () => {
    const store = memoryStore([identity(knownCode)]);
    const result = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: knownCode, conversion_amount: "3.00" }),
        store,
      })
    );
    assert.equal(result.matchReason, "missing_event_id");
    assert.equal(result.matchedOwnerId, null);
  });

  it("an identical redelivery is idempotent and changed content is a conflict", async () => {
    const store = memoryStore([identity(knownCode)]);
    const searchParams = params({
      sub_id: knownCode,
      event_id: "evt-dup",
      reward_amount: "1.00",
    });
    const first = fresh(await acceptSyllabyTestPostback({ searchParams, store }));
    const second = await acceptSyllabyTestPostback({ searchParams, store });
    const changed = await acceptSyllabyTestPostback({
      searchParams: params({
        sub_id: "unknown1",
        event_id: "evt-dup",
        reward_amount: "9.00",
      }),
      store,
    });

    assert.equal(first.matchStatus, MATCH_MATCHED);
    assert.equal(second.duplicate, true);
    assert.equal(second.conflict, false);
    assert.equal(changed.duplicate, false);
    assert.equal(changed.conflict, true);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchedOwnerId, owner);
    assert.equal(store.rows[0].subId, knownCode);
    assert.equal(store.rows[0].rewardAmountMinor, 100);
  });

  it("a later test identity does not turn an identical payload into a conflict", async () => {
    const identities: TestIdentityRef[] = [];
    const store = memoryStore(identities);
    const searchParams = params({
      sub_id: knownCode,
      event_id: "evt-late-identity",
      reward_amount: "1.00",
    });
    const first = fresh(await acceptSyllabyTestPostback({ searchParams, store }));
    identities.push(identity(knownCode));
    const second = await acceptSyllabyTestPostback({ searchParams, store });

    assert.equal(first.matchStatus, MATCH_UNRESOLVED);
    assert.equal(first.matchReason, "unknown_sub_id");
    assert.equal(first.matchedOwnerId, null);
    assert.equal(second.duplicate, true);
    assert.equal(second.conflict, false);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchStatus, MATCH_UNRESOLVED);
    assert.equal(store.rows[0].matchReason, "unknown_sub_id");
    assert.equal(store.rows[0].matchedOwnerId, null);
    assert.equal(store.rows[0].matchedIdentityId, null);
  });

  it("amounts use integer cents, reject bad format, and reject the documented range", () => {
    assert.equal(decimalToMinor("0.29"), 29);
    assert.equal(decimalToMinor("1.10"), 110);
    assert.equal(decimalToMinor("10.00"), 1000);
    assert.equal(decimalToMinor("-1.5"), -150);
    assert.equal(decimalToMinor("10000000000.00"), 1000000000000);
    assert.equal(decimalToMinor("10000000000.01"), null);
    assert.equal(decimalToMinor("9007199254740993.00"), null);
    assert.equal(decimalToMinor("12.345"), null);
    assert.equal(decimalToMinor("1x10"), null);
    assert.equal(decimalToMinor("1e2"), null);

    const parsed = parseSyllabyTestQuery(
      params({
        sub_id: knownCode,
        event_id: "evt-amount",
        conversion_amount: "12.345",
        reward_amount: "0.29",
      })
    );
    assert.equal(parsed.amountValid, false);
    assert.equal(parsed.conversionAmountText, "12.345");
    assert.equal(parsed.conversionAmountMinor, null);
    assert.equal(parsed.rewardAmountMinor, 29);
    assert.equal(parsed.payload.conversion_amount, null);
  });

  it("an invalid amount does not match the known owner", async () => {
    const store = memoryStore([identity(knownCode)]);
    const result = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({
          sub_id: knownCode,
          event_id: "evt-bad-amount",
          conversion_amount: "10000000000.01",
        }),
        store,
      })
    );
    assert.equal(result.matchReason, "invalid_amount");
    assert.equal(result.matchedOwnerId, null);
    assert.equal(store.lookups.length, 0);
  });

  it("secret comparison fails closed for a missing or different secret", () => {
    assert.equal(syllabyTestSecretMatches("path-secret", "path-secret"), true);
    assert.equal(syllabyTestSecretMatches("other", "path-secret"), false);
    assert.equal(syllabyTestSecretMatches("path-secret", ""), false);
    assert.equal(syllabyTestSecretMatches("", "path-secret"), false);
  });

  it("unique violation is a duplicate insert and the row builder forces test mode", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ code: "42501" }), false);
    const parsed = parseSyllabyTestQuery(params({ sub_id: knownCode, event_id: "evt-row" }));
    const row = toInboundEventRow({
      ...parsed,
      matchStatus: MATCH_UNRESOLVED,
      matchReason: "unknown_sub_id",
      matchedOwnerId: null,
      matchedIdentityId: null,
    });
    assert.equal(row.is_test, true);
    assert.equal(row.provider, SYLLABY_TEST_PROVIDER);
    assert.equal(row.account_scope, SYLLABY_TEST_ACCOUNT);
    assert.equal(row.program_scope, SYLLABY_TEST_PROGRAM);
    assert.equal(row.environment, SYLLABY_TEST_ENVIRONMENT);
    assert.equal(row.currency_code, "USD");
    assert.equal(row.matched_owner_id, null);
    assert.equal("payout_status" in row, false);
    assert.equal(
      sameEventContent(snapshotFromRow(row), eventContentSnapshot({
        ...parsed,
        matchStatus: MATCH_UNRESOLVED,
        matchReason: "unknown_sub_id",
        matchedOwnerId: null,
        matchedIdentityId: null,
      })),
      true
    );
  });

  it("a unique violation is idempotent when the stored content is identical", async () => {
    const seen: Record<string, unknown>[] = [];
    const db = {
      from(table: string) {
        if (table === "affiliate_test_identities") {
          return {
            select() {
              return query([{ id: identityId, owner_user_id: owner }]);
            },
          };
        }
        return {
          select() {
            return query(seen);
          },
          async insert(row: Record<string, unknown>) {
            if (seen.length > 0) return { error: { code: "23505" } };
            seen.push(row);
            return { error: null };
          },
        };
      },
    } as unknown as InboundDb;
    const store = createInboundStore(db);
    const first = fresh(
      await acceptSyllabyTestPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-db", reward_amount: "1.00" }),
        store,
      })
    );
    const second = await acceptSyllabyTestPostback({
      searchParams: params({ sub_id: knownCode, event_id: "evt-db", reward_amount: "1.00" }),
      store,
    });
    assert.equal(first.matchStatus, MATCH_MATCHED);
    assert.equal(second.duplicate, true);
    assert.equal(second.conflict, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].reward_amount_minor, 100);
  });

  it("a unique violation with different content is a conflict and does not overwrite", async () => {
    const seen: Record<string, unknown>[] = [];
    let updates = 0;
    const db = {
      from(table: string) {
        if (table === "affiliate_test_identities") {
          return {
            select() {
              return query([{ id: identityId, owner_user_id: owner }]);
            },
          };
        }
        return {
          select() {
            return query(seen);
          },
          async insert(row: Record<string, unknown>) {
            if (seen.length > 0) return { error: { code: "23505" } };
            seen.push(row);
            return { error: null };
          },
          async update() {
            updates += 1;
            return { error: null };
          },
        };
      },
    } as unknown as InboundDb;
    const store = createInboundStore(db);
    await acceptSyllabyTestPostback({
      searchParams: params({ sub_id: knownCode, event_id: "evt-conflict", reward_amount: "1.00" }),
      store,
    });
    const changed = await acceptSyllabyTestPostback({
      searchParams: params({
        sub_id: knownCode,
        event_id: "evt-conflict",
        reward_amount: "9.00",
      }),
      store,
    });
    assert.equal(changed.conflict, true);
    assert.equal(changed.duplicate, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].reward_amount_minor, 100);
    assert.equal(updates, 0);
  });

  it("a stored unresolved row stays duplicate after the test identity appears", async () => {
    const seen: Record<string, unknown>[] = [];
    let identities: { id: string; owner_user_id: string }[] = [];
    let updates = 0;
    const db = {
      from(table: string) {
        if (table === "affiliate_test_identities") {
          return {
            select() {
              return query(identities);
            },
          };
        }
        return {
          select() {
            return query(seen);
          },
          async insert(row: Record<string, unknown>) {
            if (seen.length > 0) return { error: { code: "23505" } };
            seen.push(row);
            return { error: null };
          },
          async update() {
            updates += 1;
            return { error: null };
          },
        };
      },
    } as unknown as InboundDb;
    const store = createInboundStore(db);
    const searchParams = params({
      sub_id: knownCode,
      event_id: "evt-late-db",
      reward_amount: "1.00",
    });
    const first = fresh(await acceptSyllabyTestPostback({ searchParams, store }));
    identities = [{ id: identityId, owner_user_id: owner }];
    const second = await acceptSyllabyTestPostback({ searchParams, store });

    assert.equal(first.matchReason, "unknown_sub_id");
    assert.equal(first.matchedOwnerId, null);
    assert.equal(second.duplicate, true);
    assert.equal(second.conflict, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].match_status, MATCH_UNRESOLVED);
    assert.equal(seen[0].match_reason, "unknown_sub_id");
    assert.equal(seen[0].matched_owner_id, null);
    assert.equal(seen[0].matched_identity_id, null);
    assert.equal(updates, 0);
  });
});

describe("Syllaby ingress boundaries", () => {
  it("the route is the test endpoint, ignores the body, and does not read production offer tables", () => {
    const route = fs.readFileSync(
      path.join(root, "app/api/ingress/syllaby/test/[secret]/route.ts"),
      "utf8"
    );
    const parser = fs.readFileSync(path.join(root, "lib/ingress/syllabyPostback.ts"), "utf8");
    const store = fs.readFileSync(path.join(root, "lib/ingress/storeInboundEvent.ts"), "utf8");
    const combined = `${route}\n${parser}\n${store}`;

    assert.match(route, /export function GET/);
    assert.match(route, /export function POST/);
    assert.match(route, /EVENT_CONFLICT/);
    assert.doesNotMatch(route, /req\.json|req\.text|req\.formData/);
    assert.match(route, /searchParams/);
    assert.match(route, /SYLLABY_POSTBACK_TEST_SECRET/);
    assert.equal(
      parser.split("\n").find((line) => line.startsWith("const DECIMAL_PATTERN")),
      "const DECIMAL_PATTERN = /^-?\\d+(\\.\\d{1,2})?$/;"
    );
    assert.doesNotMatch(route, /user_recurring_offers|SYLLABY_POSTBACK_PRODUCTION_SECRET/);
    assert.doesNotMatch(combined, /user_offers|payouts/);
    assert.doesNotMatch(combined, /\.update\(|\.delete\(/);
    assert.match(store, /\.eq\("account_scope"/);
    assert.match(store, /\.eq\("environment"/);
    assert.match(store, /\.eq\("program_scope"/);
    assert.match(store, /\.eq\("provider"/);
  });

  it("the migration isolates the test path and clears default grants before the narrow grant", () => {
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20261021_affiliate_inbound_events.sql"),
      "utf8"
    );
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /constraint affiliate_test_identities_environment_check/);
    assert.match(sql, /check \(environment = 'test'\)/);
    assert.match(sql, /constraint affiliate_inbound_events_test_isolation_check/);
    assert.match(sql, /check \(is_test = \(environment = 'test'\)\)/);
    assert.match(sql, /constraint affiliate_inbound_events_environment_check/);
    assert.match(sql, /environment in \('test', 'production'\)/);
    assert.match(
      sql,
      /unique \(provider, account_scope, program_scope, environment, tracking_code\)/
    );
    assert.match(
      sql,
      /provider,\s*account_scope,\s*program_scope,\s*environment,\s*external_event_id/
    );
    assert.match(sql, /sub_id is null or sub_id ~ '\^\[A-Za-z0-9_-\]\{1,64\}\$'/);
    assert.match(sql, /between -1000000000000 and 1000000000000/);
    assert.match(sql, /revoke all on table public\.affiliate_inbound_events from public/);
    assert.match(sql, /revoke all on table public\.affiliate_inbound_events from anon/);
    assert.match(sql, /revoke all on table public\.affiliate_inbound_events from authenticated/);
    assert.match(sql, /revoke all on table public\.affiliate_inbound_events from service_role/);
    assert.match(sql, /revoke all on table public\.affiliate_test_identities from public/);
    assert.match(sql, /revoke all on table public\.affiliate_test_identities from anon/);
    assert.match(sql, /revoke all on table public\.affiliate_test_identities from authenticated/);
    assert.match(sql, /revoke all on table public\.affiliate_test_identities from service_role/);
    assert.match(sql, /grant select, insert on table public\.affiliate_inbound_events to service_role/);
    assert.match(sql, /grant select, insert on table public\.affiliate_test_identities to service_role/);
    assert.doesNotMatch(sql, /grant\s+(update|delete|all)/i);
    assert.doesNotMatch(sql, /insert into/i);
    assert.match(sql, /where external_event_id is not null/);
  });

  it("the production constraint migration keeps nulls out of the wrong environment", () => {
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20261023_syllaby_production_match_constraint.sql"),
      "utf8"
    );
    assert.match(sql, /\nbegin;\n/);
    assert.match(sql, /\ncommit;\n?$/);
    assert.match(sql, /drop constraint affiliate_inbound_events_owner_check/);
    assert.match(sql, /\) is true\)/);
    assert.match(sql, /environment = 'production'/);
    assert.match(sql, /is_test = false/);
    assert.match(sql, /matched_identity_id is null/);
    assert.match(sql, /environment = 'test'/);
    assert.match(sql, /is_test = true/);
    assert.match(sql, /matched_identity_id is not null/);
    assert.match(sql, /matched_owner_id is null/);
    assert.doesNotMatch(sql, /grant |revoke |row level security|insert into/i);
  });

  it("the payout route stays disabled", () => {
    const payouts = fs.readFileSync(path.join(root, "app/api/dashboard/payouts/route.ts"), "utf8");
    assert.match(payouts, /PAYOUTS_DISABLED/);
    assert.match(payouts, /status: 503/);
  });
});

function offer(userId: string, active: boolean, trackingCode = knownCode, platform = SYLLABY_TEST_PLATFORM): SyllabyOfferRef {
  return { userId, trackingCode, platform, active };
}

function productionStore(offers: SyllabyOfferRef[]): SyllabyInboundStore & {
  rows: InboundEventWrite[];
  offerLookups: OfferLookup[];
  identityLookups: IdentityLookup[];
} {
  const rows: InboundEventWrite[] = [];
  const offerLookups: OfferLookup[] = [];
  const identityLookups: IdentityLookup[] = [];
  return {
    rows,
    offerLookups,
    identityLookups,
    async findTestIdentities(args) {
      identityLookups.push(args);
      return [];
    },
    async findSyllabyOffers(args) {
      offerLookups.push(args);
      return offers.filter(
        (row) => row.platform === args.platform && row.trackingCode === args.trackingCode
      );
    },
    async insertEvent(event) {
      const existing = rows.find(
        (row) =>
          event.eventId != null &&
          row.eventId === event.eventId &&
          row.provider === event.provider &&
          row.accountScope === event.accountScope &&
          row.programScope === event.programScope &&
          row.environment === event.environment
      );
      if (!existing) {
        rows.push(event);
        return { inserted: true, conflict: false };
      }
      const same = sameEventContent(eventContentSnapshot(existing), eventContentSnapshot(event));
      return { inserted: false, conflict: !same };
    },
  };
}

type OfferQueryOp =
  | { method: "select"; columns: string }
  | { method: "eq"; column: string; value: unknown }
  | { method: "order"; column: string; value: unknown }
  | { method: "range"; start: number; end: number };

function recordingOfferQuery(
  ops: OfferQueryOp[],
  onRange: (
    start: number,
    end: number
  ) => { data: Record<string, unknown>[] | null; error: { code?: string } | null }
) {
  let pending: { data: Record<string, unknown>[] | null; error: { code?: string } | null } = {
    data: null,
    error: { code: "QUERY_NOT_EXECUTED" },
  };
  const builder = {
    select(columns: string) {
      ops.push({ method: "select", columns });
      return builder;
    },
    eq(column: string, value: unknown) {
      ops.push({ method: "eq", column, value });
      return builder;
    },
    order(column: string, value: unknown) {
      ops.push({ method: "order", column, value });
      return builder;
    },
    range(start: number, end: number) {
      ops.push({ method: "range", start, end });
      pending = onRange(start, end);
      return builder;
    },
    then(
      onfulfilled: (value: {
        data: Record<string, unknown>[] | null;
        error: { code?: string } | null;
      }) => unknown
    ) {
      return Promise.resolve(pending).then(onfulfilled);
    },
  };
  return builder;
}

describe("Syllaby production offer matching", () => {
  it("matches one active owner and one inactive owner without using promo_link", async () => {
    for (const active of [true, false]) {
      const offers = [
        offer(owner, active),
        offer(owner, !active, knownCode, "submagic"),
      ];
      const store = productionStore(offers);
      const result = fresh(
        await acceptSyllabyProductionPostback({
          searchParams: params({
            sub_id: knownCode,
            event_id: `evt-${active ? "active" : "inactive"}`,
            reward_amount: "1.00",
            user_id: otherOwner,
            environment: "test",
            account_scope: "autoaffi31",
            promo_link: "https://example.invalid",
          }),
          store,
        })
      );
      assert.equal(result.matchStatus, MATCH_MATCHED);
      assert.equal(result.matchedOwnerId, owner);
      assert.equal(store.rows[0].matchedIdentityId, null);
      assert.equal(store.rows[0].environment, SYLLABY_PRODUCTION_ENVIRONMENT);
      assert.equal(store.rows[0].isTest, false);
      assert.equal(store.rows[0].accountScope, SYLLABY_TEST_ACCOUNT);
      assert.equal(store.identityLookups.length, 0);
      assert.deepEqual(store.offerLookups[0], {
        platform: SYLLABY_TEST_PLATFORM,
        trackingCode: knownCode,
      });
    }
  });

  it("treats an active row and an inactive row with different owners as ambiguous", async () => {
    const store = productionStore([offer(owner, true), offer(otherOwner, false)]);
    const result = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-both" }),
        store,
      })
    );
    assert.equal(result.matchReason, "ambiguous_sub_id");
    assert.equal(result.matchedOwnerId, null);
    assert.equal(store.rows[0].matchedOwnerId, null);
    assert.equal(store.rows[0].matchedIdentityId, null);
  });

  it("keeps an unknown code unresolved and does not turn a lookup failure into unknown", async () => {
    const missing = productionStore([]);
    const unknown = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-unknown-offer" }),
        store: missing,
      })
    );
    assert.equal(unknown.matchReason, "unknown_sub_id");
    assert.equal(unknown.matchedOwnerId, null);

    const failing = productionStore([]);
    failing.findSyllabyOffers = async () => {
      throw new Error("OFFER_LOOKUP_FAILED");
    };
    await assert.rejects(
      () =>
        acceptSyllabyProductionPostback({
          searchParams: params({ sub_id: knownCode, event_id: "evt-db-down" }),
          store: failing,
        }),
      /OFFER_LOOKUP_FAILED/
    );
  });

  it("keeps the original owner when the same payload returns after active changes", async () => {
    const offers = [offer(owner, false)];
    const store = productionStore(offers);
    const searchParams = params({
      sub_id: knownCode,
      event_id: "evt-status",
      reward_amount: "1.00",
    });
    const first = fresh(await acceptSyllabyProductionPostback({ searchParams, store }));
    offers[0].active = true;
    const second = await acceptSyllabyProductionPostback({ searchParams, store });

    assert.equal(first.matchedOwnerId, owner);
    assert.equal(second.duplicate, true);
    assert.equal(second.conflict, false);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchedOwnerId, owner);
    assert.equal(store.rows[0].matchStatus, MATCH_MATCHED);
    assert.equal(store.rows[0].rewardAmountMinor, 100);
    assert.equal(store.rows[0].isTest, false);
  });

  it("a changed payload conflicts and leaves the original production event unchanged", async () => {
    const store = productionStore([offer(owner, true)]);
    const first = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({
          sub_id: knownCode,
          event_id: "evt-prod-conflict",
          reward_amount: "1.00",
        }),
        store,
      })
    );
    const changed = await acceptSyllabyProductionPostback({
      searchParams: params({
        sub_id: knownCode,
        event_id: "evt-prod-conflict",
        reward_amount: "9.00",
      }),
      store,
    });
    assert.equal(first.matchedOwnerId, owner);
    assert.equal(changed.conflict, true);
    assert.equal(changed.duplicate, false);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchedOwnerId, owner);
    assert.equal(store.rows[0].rewardAmountMinor, 100);
  });

  it("stores the same external event id once in test and once in production", async () => {
    const rows: InboundEventWrite[] = [];
    const identityLookups: IdentityLookup[] = [];
    const offerLookups: OfferLookup[] = [];
    const store: SyllabyInboundStore = {
      async findTestIdentities(args) {
        identityLookups.push(args);
        return [identity(knownCode)];
      },
      async findSyllabyOffers(args) {
        offerLookups.push(args);
        return [offer(otherOwner, false)];
      },
      async insertEvent(event) {
        const existing = rows.find(
          (row) =>
            row.eventId === event.eventId &&
            row.provider === event.provider &&
            row.accountScope === event.accountScope &&
            row.programScope === event.programScope &&
            row.environment === event.environment
        );
        if (existing) return { inserted: false, conflict: true };
        rows.push(event);
        return { inserted: true, conflict: false };
      },
    };
    const searchParams = params({
      sub_id: knownCode,
      event_id: "evt-shared",
      reward_amount: "1.00",
    });
    const testResult = fresh(await acceptSyllabyTestPostback({ searchParams, store }));
    const productionResult = fresh(await acceptSyllabyProductionPostback({ searchParams, store }));

    assert.equal(testResult.matchedOwnerId, owner);
    assert.equal(productionResult.matchedOwnerId, otherOwner);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].environment, SYLLABY_TEST_ENVIRONMENT);
    assert.equal(rows[0].isTest, true);
    assert.equal(rows[0].matchedIdentityId, identityId);
    assert.equal(rows[1].environment, SYLLABY_PRODUCTION_ENVIRONMENT);
    assert.equal(rows[1].isTest, false);
    assert.equal(rows[1].matchedIdentityId, null);
    assert.equal(identityLookups.length, 1);
    assert.equal(offerLookups.length, 1);
    assert.equal(
      toInboundEventRow(rows[0]).is_test,
      true
    );
    assert.equal(toInboundEventRow(rows[1]).is_test, false);
    assert.equal(toInboundEventRow(rows[1]).environment, "production");
  });

  it("records the offer query chain and treats the owner on the next synthetic page as ambiguous", async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      user_id: owner,
      tracking_code: knownCode,
      platform: SYLLABY_TEST_PLATFORM,
      active: true,
    }));
    const secondPage = [
      {
        user_id: otherOwner,
        tracking_code: knownCode,
        platform: SYLLABY_TEST_PLATFORM,
        active: false,
      },
    ];
    assert.equal(firstPage.length, 1000);
    assert.equal(secondPage.length, 1);
    const expectedOps: OfferQueryOp[] = [
      { method: "select", columns: "user_id, tracking_code, platform, active" },
      { method: "eq", column: "platform", value: SYLLABY_TEST_PLATFORM },
      { method: "eq", column: "tracking_code", value: knownCode },
      { method: "order", column: "user_id", value: { ascending: true } },
      { method: "range", start: 0, end: 999 },
      { method: "select", columns: "user_id, tracking_code, platform, active" },
      { method: "eq", column: "platform", value: SYLLABY_TEST_PLATFORM },
      { method: "eq", column: "tracking_code", value: knownCode },
      { method: "order", column: "user_id", value: { ascending: true } },
      { method: "range", start: 1000, end: 1999 },
    ];

    const ops: OfferQueryOp[] = [];
    let inserted: Record<string, unknown> | null = null;
    const db = {
      from(table: string) {
        if (table === "user_recurring_offers") {
          return recordingOfferQuery(ops, (start, end) => {
            if (start === 0 && end === 999) return { data: firstPage, error: null };
            if (start === 1000 && end === 1999) return { data: secondPage, error: null };
            return { data: null, error: { code: "UNEXPECTED_RANGE" } };
          });
        }
        return {
          async insert(row: Record<string, unknown>) {
            inserted = row;
            return { error: null };
          },
        };
      },
    } as unknown as InboundDb;
    const result = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-page" }),
        store: createInboundStore(db),
      })
    );
    assert.deepEqual(ops, expectedOps);
    assert.equal(result.matchReason, "ambiguous_sub_id");
    assert.equal(result.matchedOwnerId, null);
    assert.equal(inserted?.match_reason, "ambiguous_sub_id");
    assert.equal(inserted?.matched_owner_id, null);
    assert.equal(inserted?.matched_identity_id, null);

    const failingOps: OfferQueryOp[] = [];
    let failingInserts = 0;
    const failingDb = {
      from(table: string) {
        if (table === "user_recurring_offers") {
          return recordingOfferQuery(failingOps, (start, end) => {
            if (start === 0 && end === 999) return { data: firstPage, error: null };
            if (start === 1000 && end === 1999) return { data: null, error: { code: "08006" } };
            return { data: null, error: { code: "UNEXPECTED_RANGE" } };
          });
        }
        return {
          async insert() {
            failingInserts += 1;
            throw new Error("INSERT_AFTER_LOOKUP_FAILURE");
          },
        };
      },
    } as unknown as InboundDb;
    await assert.rejects(
      () =>
        acceptSyllabyProductionPostback({
          searchParams: params({ sub_id: knownCode, event_id: "evt-offer-error" }),
          store: createInboundStore(failingDb),
        }),
      /OFFER_LOOKUP_FAILED/
    );
    assert.deepEqual(failingOps, expectedOps);
    assert.equal(failingInserts, 0);
  });

  it("rejects a valid owner when another row for the code has an invalid user id", async () => {
    const store = productionStore([offer(owner, true), offer("not-a-uuid", false)]);
    await assert.rejects(
      () =>
        acceptSyllabyProductionPostback({
          searchParams: params({ sub_id: knownCode, event_id: "evt-invalid-sibling" }),
          store,
        }),
      /OFFER_OWNER_INVALID/
    );
    assert.equal(store.rows.length, 0);
  });

  it("rejects a single invalid owner row without inserting", async () => {
    const store = productionStore([offer("", true)]);
    await assert.rejects(
      () =>
        acceptSyllabyProductionPostback({
          searchParams: params({ sub_id: knownCode, event_id: "evt-invalid-only" }),
          store,
        }),
      /OFFER_OWNER_INVALID/
    );
    assert.equal(store.rows.length, 0);
  });

  it("an empty offer lookup stays unknown_sub_id", async () => {
    const store = productionStore([]);
    const result = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-empty-offers" }),
        store,
      })
    );
    assert.equal(result.matchReason, "unknown_sub_id");
    assert.equal(result.matchedOwnerId, null);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchReason, "unknown_sub_id");
    assert.equal(store.rows[0].matchedOwnerId, null);
  });

  it("one inactive owner stays matched", async () => {
    const inactiveOwner = "abcdefab-cdef-4abc-8abc-000000000001";
    const store = productionStore([
      offer(inactiveOwner, false),
      offer(inactiveOwner.toUpperCase(), false),
    ]);
    const result = fresh(
      await acceptSyllabyProductionPostback({
        searchParams: params({ sub_id: knownCode, event_id: "evt-inactive-only" }),
        store,
      })
    );
    assert.notEqual(inactiveOwner.toUpperCase(), inactiveOwner);
    assert.equal(result.matchStatus, MATCH_MATCHED);
    assert.equal(result.matchedOwnerId?.toLowerCase(), inactiveOwner);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchedOwnerId?.toLowerCase(), inactiveOwner);
    assert.equal(store.rows[0].matchedIdentityId, null);
    assert.equal(store.rows[0].isTest, false);
  });

  it("rejects a missing or wrong production secret before any database write", async () => {
    const route = fs.readFileSync(
      path.join(root, "app/api/ingress/syllaby/[secret]/route.ts"),
      "utf8"
    );
    const secretAt = route.indexOf(
      "syllabyTestSecretMatches(secret, process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET)"
    );
    const rejectAt = route.indexOf("return json({ ok: false }, 404)");
    const storeAt = route.indexOf("const store = await createServiceRoleInboundStore()");
    assert.ok(secretAt > 0);
    assert.ok(rejectAt > secretAt);
    assert.ok(storeAt > rejectAt);
    assert.doesNotMatch(route, /matchedOwnerId|user_id|req\.json|req\.text|req\.formData/);
    assert.match(route, /SYLLABY_POSTBACK_PRODUCTION_SECRET/);
    assert.doesNotMatch(route, /SYLLABY_POSTBACK_TEST_SECRET/);
    assert.doesNotMatch(route, /findTestIdentities|affiliate_test_identities/);

    const previous = process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET;
    let writes = 0;
    async function handle(secret: string) {
      if (!syllabyTestSecretMatches(secret, process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET)) {
        return { status: 404, body: { ok: false } as Record<string, unknown> };
      }
      writes += 1;
      return { status: 200, body: { ok: true } as Record<string, unknown> };
    }
    try {
      delete process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET;
      let result = await handle("wrong-secret");
      assert.equal(result.status, 404);
      process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET = "expected-secret";
      result = await handle("wrong-secret");
      assert.equal(result.status, 404);
      assert.equal(result.body.ok, false);
      assert.equal("matchedOwnerId" in result.body, false);
      assert.equal("user_id" in result.body, false);
      assert.equal(writes, 0);
    } finally {
      if (previous === undefined) delete process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET;
      else process.env.SYLLABY_POSTBACK_PRODUCTION_SECRET = previous;
    }
  });
});
