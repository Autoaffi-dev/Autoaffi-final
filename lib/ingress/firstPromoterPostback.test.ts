import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  AMOUNT_UNIT_MINOR_HUNDREDTHS,
  isSubmagicProductionEnabled,
  isVerifiedProductionConfig,
  SUBMAGIC_ACCOUNT,
  SUBMAGIC_PROGRAM,
  SUBMAGIC_PLATFORM,
  SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE,
  SUBMAGIC_SYNTHETIC_TEST_CURRENCY,
  submagicProductionConfig,
  submagicTestConfig,
  syllabyProductionConfig,
  type FirstPromoterProgramConfig,
} from "./firstPromoterProgram.ts";
import {
  acceptFirstPromoterPostback,
  acceptSubmagicProductionPostback,
  acceptSubmagicTestPostback,
  receiveSubmagicProductionPostback,
  receiveSubmagicTestPostback,
} from "./firstPromoterPostback.ts";
import { createInboundStore, type InboundDb } from "./storeInboundEvent.ts";
import {
  acceptSyllabyProductionPostback,
  acceptSyllabyTestPostback,
  eventContentSnapshot,
  sameEventContent,
  SYLLABY_CURRENCY_SOURCE,
  SYLLABY_TEST_ACCOUNT,
  SYLLABY_TEST_CURRENCY,
  SYLLABY_TEST_PLATFORM,
  SYLLABY_TEST_PROGRAM,
  SYLLABY_TEST_PROVIDER,
  type IdentityLookup,
  type InboundEventWrite,
  type OfferLookup,
  type SyllabyInboundStore,
  type SyllabyOfferRef,
  type TestIdentityRef,
} from "./syllabyPostback.ts";

const root = path.resolve(import.meta.dirname, "../..");

function readSource(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
}

const syllabyOwner = "00000000-0000-4000-8000-000000000001";
const submagicOwner = "00000000-0000-4000-8000-000000000002";
const otherOwner = "00000000-0000-4000-8000-000000000003";
const syllabyIdentityId = "00000000-0000-4000-8000-000000000011";
const submagicIdentityId = "00000000-0000-4000-8000-000000000012";
const code = "aa12bc34";

function params(values: Record<string, string>) {
  return new URLSearchParams(values);
}

function hostile(eventId: string, overrides: Record<string, string> = {}) {
  return params({
    sub_id: code,
    event_id: eventId,
    reward_amount: "1.25",
    user_id: otherOwner,
    account_scope: SYLLABY_TEST_ACCOUNT,
    program_scope: SYLLABY_TEST_PROGRAM,
    environment: "production",
    currency: SYLLABY_TEST_CURRENCY,
    currency_code: SYLLABY_TEST_CURRENCY,
    platform: SYLLABY_TEST_PLATFORM,
    ...overrides,
  });
}

function identity(
  scope: {
    id: string;
    ownerUserId: string;
    accountScope: string;
    programScope: string;
    environment: string;
    platform: string;
  }
): TestIdentityRef {
  return {
    id: scope.id,
    ownerUserId: scope.ownerUserId,
    trackingCode: code,
    provider: SYLLABY_TEST_PROVIDER,
    accountScope: scope.accountScope,
    programScope: scope.programScope,
    environment: scope.environment,
    platform: scope.platform,
  };
}

function offer(
  userId: string,
  platform: string,
  active = false
): SyllabyOfferRef {
  return { userId, trackingCode: code, platform, active };
}

function injectedSubmagicProduction(): FirstPromoterProgramConfig {
  return {
    provider: SYLLABY_TEST_PROVIDER,
    accountScope: SUBMAGIC_ACCOUNT,
    programScope: SUBMAGIC_PROGRAM,
    platform: SUBMAGIC_PLATFORM,
    environment: "production",
    isTest: false,
    currencyCode: "EUR",
    currencySource: "injected_test_configuration",
    amountUnit: AMOUNT_UNIT_MINOR_HUNDREDTHS,
    affiliateIdentifierVerified: true,
    postbackSupportVerified: true,
    currencyVerified: true,
  };
}

function memoryStore(input?: {
  identities?: TestIdentityRef[];
  offers?: SyllabyOfferRef[];
  filter?: boolean;
}): SyllabyInboundStore & {
  rows: InboundEventWrite[];
  identityLookups: IdentityLookup[];
  offerLookups: OfferLookup[];
  insertCount: number;
} {
  const identities = input?.identities ?? [];
  const offers = input?.offers ?? [];
  const filter = input?.filter !== false;
  const rows: InboundEventWrite[] = [];
  const identityLookups: IdentityLookup[] = [];
  const offerLookups: OfferLookup[] = [];
  const store = {
    rows,
    identityLookups,
    offerLookups,
    insertCount: 0,
    async findTestIdentities(args: IdentityLookup) {
      identityLookups.push(args);
      if (!filter) return identities;
      return identities.filter(
        (row) =>
          row.provider === args.provider &&
          row.accountScope === args.accountScope &&
          row.programScope === args.programScope &&
          row.environment === args.environment &&
          row.trackingCode === args.trackingCode
      );
    },
    async findSyllabyOffers(args: OfferLookup) {
      offerLookups.push(args);
      if (!filter) return offers;
      return offers.filter(
        (row) => row.platform === args.platform && row.trackingCode === args.trackingCode
      );
    },
    async insertEvent(event: InboundEventWrite) {
      store.insertCount += 1;
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
  return store;
}

function countingStore() {
  return {
    created: 0,
    async createStore(): Promise<SyllabyInboundStore> {
      this.created += 1;
      throw new Error("STORE_CREATED");
    },
  };
}

describe("FirstPromoter program isolation", () => {
  it("stores the same tracking code and event id separately for Syllaby and Submagic", async () => {
    const identities = [
      identity({
        id: syllabyIdentityId,
        ownerUserId: syllabyOwner,
        accountScope: SYLLABY_TEST_ACCOUNT,
        programScope: SYLLABY_TEST_PROGRAM,
        environment: "test",
        platform: SYLLABY_TEST_PLATFORM,
      }),
      identity({
        id: submagicIdentityId,
        ownerUserId: submagicOwner,
        accountScope: SUBMAGIC_ACCOUNT,
        programScope: SUBMAGIC_PROGRAM,
        environment: "test",
        platform: SUBMAGIC_PLATFORM,
      }),
    ];
    const store = memoryStore({ identities, filter: false });
    const searchParams = hostile("evt-shared");

    const syllaby = await acceptSyllabyTestPostback({ searchParams, store });
    const submagic = await acceptSubmagicTestPostback({ searchParams, store });

    assert.equal(syllaby.matchedOwnerId, syllabyOwner);
    assert.equal(submagic.matchedOwnerId, submagicOwner);
    assert.equal(store.rows.length, 2);
    assert.equal(store.rows[0].accountScope, SYLLABY_TEST_ACCOUNT);
    assert.equal(store.rows[0].programScope, SYLLABY_TEST_PROGRAM);
    assert.equal(store.rows[0].platform, SYLLABY_TEST_PLATFORM);
    assert.equal(store.rows[0].matchedIdentityId, syllabyIdentityId);
    assert.equal(store.rows[1].accountScope, SUBMAGIC_ACCOUNT);
    assert.equal(store.rows[1].programScope, SUBMAGIC_PROGRAM);
    assert.equal(store.rows[1].platform, SUBMAGIC_PLATFORM);
    assert.equal(store.rows[1].matchedIdentityId, submagicIdentityId);
    assert.notEqual(store.rows[0].accountScope, store.rows[1].accountScope);
    assert.notEqual(store.rows[0].programScope, store.rows[1].programScope);
    assert.deepEqual(store.identityLookups[0], {
      provider: SYLLABY_TEST_PROVIDER,
      accountScope: SYLLABY_TEST_ACCOUNT,
      programScope: SYLLABY_TEST_PROGRAM,
      environment: "test",
      trackingCode: code,
    });
    assert.deepEqual(store.identityLookups[1], {
      provider: SYLLABY_TEST_PROVIDER,
      accountScope: SUBMAGIC_ACCOUNT,
      programScope: SUBMAGIC_PROGRAM,
      environment: "test",
      trackingCode: code,
    });
  });

  it("stores one Syllaby production event and one injected Submagic production event", async () => {
    const offers = [
      offer(syllabyOwner, SYLLABY_TEST_PLATFORM, true),
      offer(submagicOwner, SUBMAGIC_PLATFORM, false),
    ];
    const store = memoryStore({ offers, filter: false });
    const searchParams = hostile("evt-offers", {
      environment: "test",
      platform: "not-the-server-platform",
      account_scope: "incoming-account",
      program_scope: "incoming-program",
      user_id: otherOwner,
    });

    const syllaby = await acceptSyllabyProductionPostback({ searchParams, store });
    const submagic = await acceptFirstPromoterPostback({
      searchParams,
      store,
      config: injectedSubmagicProduction(),
    });

    assert.equal(syllaby.matchedOwnerId, syllabyOwner);
    assert.equal(submagic.matchedOwnerId, submagicOwner);
    assert.notEqual(syllaby.matchedOwnerId, otherOwner);
    assert.notEqual(submagic.matchedOwnerId, otherOwner);
    assert.equal(store.rows.length, 2);
    assert.equal(store.rows[0].eventId, "evt-offers");
    assert.equal(store.rows[1].eventId, "evt-offers");
    assert.equal(store.rows[0].subId, code);
    assert.equal(store.rows[1].subId, code);
    assert.equal(store.rows[0].accountScope, SYLLABY_TEST_ACCOUNT);
    assert.equal(store.rows[0].programScope, SYLLABY_TEST_PROGRAM);
    assert.equal(store.rows[0].platform, SYLLABY_TEST_PLATFORM);
    assert.equal(store.rows[0].environment, "production");
    assert.equal(store.rows[0].isTest, false);
    assert.equal(store.rows[0].matchedIdentityId, null);
    assert.equal(store.rows[0].currencyCode, SYLLABY_TEST_CURRENCY);
    assert.equal(store.rows[1].accountScope, SUBMAGIC_ACCOUNT);
    assert.equal(store.rows[1].programScope, SUBMAGIC_PROGRAM);
    assert.equal(store.rows[1].platform, SUBMAGIC_PLATFORM);
    assert.equal(store.rows[1].environment, "production");
    assert.equal(store.rows[1].isTest, false);
    assert.equal(store.rows[1].matchedIdentityId, null);
    assert.equal(store.rows[1].currencyCode, "EUR");
    assert.notEqual(store.rows[0].accountScope, store.rows[1].accountScope);
    assert.notEqual(store.rows[0].programScope, store.rows[1].programScope);
    assert.deepEqual(store.offerLookups[0], {
      platform: SYLLABY_TEST_PLATFORM,
      trackingCode: code,
    });
    assert.deepEqual(store.offerLookups[1], {
      platform: SUBMAGIC_PLATFORM,
      trackingCode: code,
    });
    assert.equal(store.identityLookups.length, 0);
    assert.equal(isSubmagicProductionEnabled(), false);
  });

  it("keeps test identities inside their account, program, and environment", async () => {
    const identities = [
      identity({
        id: syllabyIdentityId,
        ownerUserId: syllabyOwner,
        accountScope: SYLLABY_TEST_ACCOUNT,
        programScope: SYLLABY_TEST_PROGRAM,
        environment: "test",
        platform: SYLLABY_TEST_PLATFORM,
      }),
      identity({
        id: submagicIdentityId,
        ownerUserId: submagicOwner,
        accountScope: SUBMAGIC_ACCOUNT,
        programScope: SUBMAGIC_PROGRAM,
        environment: "test",
        platform: SUBMAGIC_PLATFORM,
      }),
      identity({
        id: "00000000-0000-4000-8000-000000000013",
        ownerUserId: otherOwner,
        accountScope: SUBMAGIC_ACCOUNT,
        programScope: SUBMAGIC_PROGRAM,
        environment: "production",
        platform: SUBMAGIC_PLATFORM,
      }),
      identity({
        id: "00000000-0000-4000-8000-000000000014",
        ownerUserId: otherOwner,
        accountScope: SUBMAGIC_ACCOUNT,
        programScope: "other_program",
        environment: "test",
        platform: SUBMAGIC_PLATFORM,
      }),
    ];
    const store = memoryStore({ identities, filter: false });
    const result = await acceptSubmagicTestPostback({
      searchParams: hostile("evt-identity-scope"),
      store,
    });

    assert.equal(result.matchedOwnerId, submagicOwner);
    assert.equal(store.rows[0].matchedIdentityId, submagicIdentityId);
    assert.equal(store.rows[0].environment, "test");
    assert.equal(store.rows[0].isTest, true);
    assert.equal(store.identityLookups[0].environment, "test");
    assert.equal(store.identityLookups[0].programScope, SUBMAGIC_PROGRAM);
  });

  it("separates a Submagic test event from an injected production event", async () => {
    const store = memoryStore({
      identities: [
        identity({
          id: submagicIdentityId,
          ownerUserId: submagicOwner,
          accountScope: SUBMAGIC_ACCOUNT,
          programScope: SUBMAGIC_PROGRAM,
          environment: "test",
          platform: SUBMAGIC_PLATFORM,
        }),
      ],
      offers: [offer(otherOwner, SUBMAGIC_PLATFORM, false)],
    });
    const searchParams = hostile("evt-env");
    const testResult = await acceptSubmagicTestPostback({ searchParams, store });
    const productionResult = await acceptFirstPromoterPostback({
      searchParams,
      store,
      config: injectedSubmagicProduction(),
    });

    assert.equal(testResult.matchedOwnerId, submagicOwner);
    assert.equal(productionResult.matchedOwnerId, otherOwner);
    assert.equal(store.rows.length, 2);
    assert.equal(store.rows[0].environment, "test");
    assert.equal(store.rows[0].isTest, true);
    assert.equal(store.rows[0].matchedIdentityId, submagicIdentityId);
    assert.equal(store.rows[1].environment, "production");
    assert.equal(store.rows[1].isTest, false);
    assert.equal(store.rows[1].matchedIdentityId, null);
    assert.equal(store.identityLookups.length, 1);
    assert.equal(store.offerLookups.length, 1);
  });

  it("matches one inactive Submagic owner and leaves two owners unassigned", async () => {
    const inactive = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, false)],
    });
    const matched = await acceptFirstPromoterPostback({
      searchParams: hostile("evt-inactive"),
      store: inactive,
      config: injectedSubmagicProduction(),
    });
    assert.equal(matched.matchedOwnerId, submagicOwner);
    assert.equal(inactive.rows[0].matchedIdentityId, null);
    assert.equal(inactive.rows[0].isTest, false);

    const ambiguous = memoryStore({
      offers: [
        offer(submagicOwner, SUBMAGIC_PLATFORM, true),
        offer(otherOwner, SUBMAGIC_PLATFORM, false),
      ],
    });
    const unresolved = await acceptFirstPromoterPostback({
      searchParams: hostile("evt-ambiguous"),
      store: ambiguous,
      config: injectedSubmagicProduction(),
    });
    assert.equal(unresolved.matchReason, "ambiguous_sub_id");
    assert.equal(unresolved.matchedOwnerId, null);
    assert.equal(ambiguous.rows.length, 1);
    assert.equal(ambiguous.rows[0].matchedOwnerId, null);
    assert.equal(ambiguous.rows[0].matchedIdentityId, null);
  });

  it("stops before insert when an offer owner is invalid", async () => {
    const store = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, true), offer("not-a-uuid", SUBMAGIC_PLATFORM, false)],
    });
    await assert.rejects(
      () =>
        acceptFirstPromoterPostback({
          searchParams: hostile("evt-invalid-owner"),
          store,
          config: injectedSubmagicProduction(),
        }),
      /OFFER_OWNER_INVALID/
    );
    assert.equal(store.insertCount, 0);
    assert.equal(store.rows.length, 0);
  });

  it("treats an identical delivery as a duplicate and a changed payload as a conflict", async () => {
    const store = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, false)],
    });
    const searchParams = hostile("evt-replay");
    const first = await acceptFirstPromoterPostback({
      searchParams,
      store,
      config: injectedSubmagicProduction(),
    });
    const duplicate = await acceptFirstPromoterPostback({
      searchParams,
      store,
      config: injectedSubmagicProduction(),
    });
    const changed = await acceptFirstPromoterPostback({
      searchParams: hostile("evt-replay", { reward_amount: "9.00" }),
      store,
      config: injectedSubmagicProduction(),
    });

    assert.equal(first.matchedOwnerId, submagicOwner);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.conflict, false);
    assert.equal(changed.conflict, true);
    assert.equal(changed.duplicate, false);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].matchedOwnerId, submagicOwner);
    assert.equal(store.rows[0].rewardAmountMinor, 125);
  });

  it("ignores incoming owner, scope, environment, and currency", async () => {
    const store = memoryStore({
      identities: [
        identity({
          id: submagicIdentityId,
          ownerUserId: submagicOwner,
          accountScope: SUBMAGIC_ACCOUNT,
          programScope: SUBMAGIC_PROGRAM,
          environment: "test",
          platform: SUBMAGIC_PLATFORM,
        }),
      ],
    });
    const result = await acceptSubmagicTestPostback({
      searchParams: hostile("evt-ignore"),
      store,
    });

    assert.equal(result.matchedOwnerId, submagicOwner);
    assert.notEqual(result.matchedOwnerId, otherOwner);
    assert.equal(store.rows[0].provider, SYLLABY_TEST_PROVIDER);
    assert.equal(store.rows[0].accountScope, SUBMAGIC_ACCOUNT);
    assert.equal(store.rows[0].programScope, SUBMAGIC_PROGRAM);
    assert.equal(store.rows[0].environment, "test");
    assert.equal(store.rows[0].platform, SUBMAGIC_PLATFORM);
    assert.equal(store.rows[0].currencyCode, SUBMAGIC_SYNTHETIC_TEST_CURRENCY);
    assert.equal(store.rows[0].currencySource, SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE);
    assert.equal(store.rows[0].isTest, true);
    assert.notEqual(store.rows[0].currencyCode, SYLLABY_TEST_CURRENCY);
    assert.notEqual(store.rows[0].currencySource, SYLLABY_CURRENCY_SOURCE);
  });
});

describe("Submagic production gate", () => {
  it("rejects XTS with provider documentation and every verification flag set", async () => {
    const store = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, true)],
      identities: [
        identity({
          id: submagicIdentityId,
          ownerUserId: submagicOwner,
          accountScope: SUBMAGIC_ACCOUNT,
          programScope: SUBMAGIC_PROGRAM,
          environment: "production",
          platform: SUBMAGIC_PLATFORM,
        }),
      ],
    });
    const config: FirstPromoterProgramConfig = {
      provider: SYLLABY_TEST_PROVIDER,
      accountScope: SUBMAGIC_ACCOUNT,
      programScope: SUBMAGIC_PROGRAM,
      platform: SUBMAGIC_PLATFORM,
      environment: "production",
      isTest: false,
      currencyCode: SUBMAGIC_SYNTHETIC_TEST_CURRENCY,
      currencySource: SYLLABY_CURRENCY_SOURCE,
      amountUnit: AMOUNT_UNIT_MINOR_HUNDREDTHS,
      affiliateIdentifierVerified: true,
      postbackSupportVerified: true,
      currencyVerified: true,
    };

    assert.equal(config.currencySource, "provider_documentation");
    assert.equal(isVerifiedProductionConfig(config), false);
    assert.equal(isVerifiedProductionConfig(syllabyProductionConfig), true);
    await assert.rejects(
      () =>
        acceptFirstPromoterPostback({
          searchParams: hostile("evt-xts"),
          store,
          config,
        }),
      /PRODUCTION_NOT_CONFIGURED/
    );
    assert.equal(store.offerLookups.length, 0);
    assert.equal(store.identityLookups.length, 0);
    assert.equal(store.insertCount, 0);
    assert.equal(isSubmagicProductionEnabled(), false);
  });

  it("rejects an incomplete production configuration before creating a store", async () => {
    const gate = countingStore();
    const result = await receiveSubmagicProductionPostback({
      secret: "gate-check",
      expectedSecret: "gate-check",
      searchParams: hostile("evt-disabled"),
      createStore: () => gate.createStore(),
    });

    assert.equal(result.status, 404);
    assert.equal(result.body.error, "PRODUCTION_NOT_CONFIGURED");
    assert.equal(gate.created, 0);
    assert.equal(isSubmagicProductionEnabled(), false);

    const store = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, true)],
    });
    await assert.rejects(
      () =>
        acceptSubmagicProductionPostback({
          searchParams: hostile("evt-disabled-accept"),
          store,
        }),
      /PRODUCTION_NOT_CONFIGURED/
    );
    assert.equal(store.insertCount, 0);

    const route = readSource("app/api/ingress/submagic/[secret]/route.ts");
    const receiver = readSource("lib/ingress/firstPromoterPostback.ts");
    const routeGate = route.indexOf("if (!isSubmagicProductionEnabled())");
    const routeStore = route.indexOf("createStore: createServiceRoleInboundStore");
    assert.ok(routeGate > 0);
    assert.ok(route.indexOf('error: "PRODUCTION_NOT_CONFIGURED"') > routeGate);
    assert.ok(routeStore > routeGate);
    assert.doesNotMatch(route, /await createServiceRoleInboundStore\(/);
    const productionFn = receiver.slice(
      receiver.indexOf("export async function receiveSubmagicProductionPostback")
    );
    const enabledAt = productionFn.indexOf("if (!isSubmagicProductionEnabled())");
    const createAt = productionFn.indexOf("await args.createStore()");
    assert.ok(enabledAt >= 0);
    assert.ok(createAt > enabledAt);
  });

  it("writes nothing for a missing or wrong test secret", async () => {
    const missing = countingStore();
    const missingResult = await receiveSubmagicTestPostback({
      secret: "present",
      expectedSecret: undefined,
      searchParams: hostile("evt-missing-secret"),
      createStore: () => missing.createStore(),
    });
    const wrong = countingStore();
    const wrongResult = await receiveSubmagicTestPostback({
      secret: "other",
      expectedSecret: "expected",
      searchParams: hostile("evt-wrong-secret"),
      createStore: () => wrong.createStore(),
    });
    const production = countingStore();
    const productionResult = await receiveSubmagicProductionPostback({
      secret: "other",
      expectedSecret: undefined,
      searchParams: hostile("evt-production-secret"),
      createStore: () => production.createStore(),
    });

    assert.equal(missingResult.status, 404);
    assert.equal(wrongResult.status, 404);
    assert.equal(productionResult.status, 404);
    assert.equal(missing.created, 0);
    assert.equal(wrong.created, 0);
    assert.equal(production.created, 0);

    const route = readSource("app/api/ingress/submagic/test/[secret]/route.ts");
    const secretAt = route.indexOf(
      "syllabyTestSecretMatches(secret, process.env.SUBMAGIC_POSTBACK_TEST_SECRET)"
    );
    const storeAt = route.indexOf("createStore: createServiceRoleInboundStore");
    assert.ok(secretAt > 0);
    assert.ok(route.indexOf("return json({ ok: false }, 404)") > secretAt);
    assert.ok(storeAt > secretAt);
    assert.match(route, /export function GET/);
    assert.match(route, /export function POST/);
    assert.doesNotMatch(route, /req\.json|req\.text|req\.formData/);
    assert.doesNotMatch(route, /SUBMAGIC_POSTBACK_PRODUCTION_SECRET/);
  });

  it("does not let the synthetic test configuration enable production", async () => {
    const store = memoryStore({
      offers: [offer(submagicOwner, SUBMAGIC_PLATFORM, true)],
      identities: [
        identity({
          id: submagicIdentityId,
          ownerUserId: submagicOwner,
          accountScope: SUBMAGIC_ACCOUNT,
          programScope: SUBMAGIC_PROGRAM,
          environment: "test",
          platform: SUBMAGIC_PLATFORM,
        }),
      ],
    });
    const syntheticProduction = {
      ...submagicTestConfig,
      environment: "production" as const,
      isTest: false,
      affiliateIdentifierVerified: true,
      postbackSupportVerified: true,
      currencyVerified: true,
    };

    await assert.rejects(
      () =>
        acceptFirstPromoterPostback({
          searchParams: hostile("evt-synthetic"),
          store,
          config: syntheticProduction,
        }),
      /PRODUCTION_NOT_CONFIGURED/
    );
    await assert.rejects(
      () =>
        acceptSubmagicProductionPostback({
          searchParams: hostile("evt-frozen"),
          store,
        }),
      /PRODUCTION_NOT_CONFIGURED/
    );

    assert.equal(store.insertCount, 0);
    assert.equal(isSubmagicProductionEnabled(), false);
    assert.equal(submagicProductionConfig.affiliateIdentifierVerified, false);
    assert.equal(submagicProductionConfig.postbackSupportVerified, false);
    assert.equal(submagicProductionConfig.currencyVerified, false);
    assert.equal(submagicProductionConfig.currencyCode, "");
    assert.equal(submagicProductionConfig.amountUnit, null);
    assert.equal(submagicTestConfig.currencyCode, SUBMAGIC_SYNTHETIC_TEST_CURRENCY);
    assert.equal(submagicTestConfig.currencySource, SUBMAGIC_SYNTHETIC_CURRENCY_SOURCE);
    assert.notEqual(submagicTestConfig.currencyCode, SYLLABY_TEST_CURRENCY);
    assert.throws(
      () => {
        (submagicProductionConfig as { currencyVerified: boolean }).currencyVerified = true;
      },
      TypeError
    );
    assert.equal(isSubmagicProductionEnabled(), false);

    const route = readSource("app/api/ingress/submagic/[secret]/route.ts");
    const adapter = readSource("lib/ingress/firstPromoterPostback.ts");
    assert.match(route, /isSubmagicProductionEnabled\(\)/);
    assert.match(route, /SUBMAGIC_POSTBACK_PRODUCTION_SECRET/);
    assert.doesNotMatch(route, /SUBMAGIC_POSTBACK_TEST_SECRET|XTS|USD|provider_documentation/);
    assert.doesNotMatch(adapter, /USD|provider_documentation|XTS/);
    assert.doesNotMatch(route, /submagicTestConfig|SUBMAGIC_SYNTHETIC/);
  });

  it("queries Submagic offers by server platform without an active filter", async () => {
    const ops: Array<{ method: string; column?: string; value?: unknown; columns?: string }> = [];
    let inserts = 0;
    const db = {
      from(table: string) {
        if (table !== "user_recurring_offers") {
          return {
            async insert() {
              inserts += 1;
              return { error: null };
            },
          };
        }
        let pending: { data: Record<string, unknown>[] | null; error: null } = {
          data: null,
          error: null,
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
            ops.push({ method: "range", value: { start, end } });
            pending = {
              data: [
                {
                  user_id: submagicOwner,
                  tracking_code: code,
                  platform: SUBMAGIC_PLATFORM,
                  active: false,
                },
              ],
              error: null,
            };
            return builder;
          },
          then(onfulfilled: (value: typeof pending) => unknown) {
            return Promise.resolve(pending).then(onfulfilled);
          },
        };
        return builder;
      },
    } as unknown as InboundDb;

    const result = await acceptFirstPromoterPostback({
      searchParams: hostile("evt-query"),
      store: createInboundStore(db),
      config: injectedSubmagicProduction(),
    });

    assert.equal(result.matchedOwnerId, submagicOwner);
    assert.equal(inserts, 1);
    assert.deepEqual(
      ops.map((op) => op.method),
      ["select", "eq", "eq", "order", "range"]
    );
    assert.equal(ops[0].columns, "user_id, tracking_code, platform, active");
    assert.deepEqual(ops[1], { method: "eq", column: "platform", value: SUBMAGIC_PLATFORM });
    assert.deepEqual(ops[2], { method: "eq", column: "tracking_code", value: code });
    assert.deepEqual(ops[3], { method: "order", column: "user_id", value: { ascending: true } });
    assert.deepEqual(ops[4], { method: "range", value: { start: 0, end: 999 } });
    assert.equal(
      ops.some((op) => op.column === "active" || op.column === "promo_link"),
      false
    );
  });
});
