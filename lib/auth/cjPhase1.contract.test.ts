import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  customerFacingProductCommission,
  getBetaAutomatedSources,
  isBetaAutomatedSource,
} from "../affiliate/productSourceReadiness.ts";
import {
  CJ_PROGRAM_TERMS_ENDPOINT,
  CJ_PROMOTIONAL_PROPERTIES_ENDPOINT,
  readCjServerConfig,
} from "../affiliate/cj/config.ts";
import { evaluateCjAdvertiserUse } from "../affiliate/cj/eligibility.ts";
import {
  classifyCjCommission,
  getCJAdvertiserContract,
  isActiveCjContractStatus,
  isKnownCjCommissionRateType,
  type CjStructuredCommission,
} from "../affiliate/cj/programTerms.ts";
import {
  createCJPromotionalProperty,
  listCJPromotionalProperties,
} from "../affiliate/cj/promotionalProperty.ts";
import {
  CjPropertyMappingError,
  type CjPropertyMappingInsert,
  type CjPropertyMappingRow,
  type CjPropertyMappingStore,
} from "../affiliate/cj/propertyMapping.ts";
import { resolveSocialPromotionalProperty } from "../affiliate/cj/socialAccountProperty.ts";
import type { CjSocialAccountSnapshot } from "../affiliate/cj/socialAccountProperty.ts";
import { syncCjPromotionalProperty } from "../affiliate/cj/syncPromotionalProperty.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function instagramAccount(
  overrides: Partial<CjSocialAccountSnapshot> = {}
): CjSocialAccountSnapshot {
  return {
    id: "social-1",
    user_id: "user-a",
    platform: "instagram",
    status: "connected",
    username: null,
    meta: {
      username: "linus.creator",
      instagram_id: "1789001",
    },
    ...overrides,
  };
}

function mapping(
  overrides: Partial<CjPropertyMappingRow> = {}
): CjPropertyMappingRow {
  return {
    id: "map-1",
    user_id: "user-a",
    platform: "instagram",
    social_account_id: "social-1",
    social_account_identifier: "instagram:1789001",
    social_media_handle: "linus.creator",
    cj_social_platform: "INSTAGRAM",
    cj_pid: "100125586",
    property_type: "SOCIAL_MEDIA",
    status: "ACTIVE",
    ...overrides,
  };
}

function memoryStore(seed: CjPropertyMappingRow[] = []): CjPropertyMappingStore & {
  rows: CjPropertyMappingRow[];
} {
  const rows = [...seed];
  return {
    rows,
    async findByUserProperty(userId, platform, socialAccountIdentifier) {
      return (
        rows.find(
          (row) =>
            row.user_id === userId &&
            row.platform === platform &&
            row.social_account_identifier === socialAccountIdentifier
        ) || null
      );
    },
    async findByPid(cjPid) {
      return rows.find((row) => row.cj_pid === cjPid) || null;
    },
    async insert(row: CjPropertyMappingInsert) {
      if (rows.some((existing) => existing.cj_pid === row.cj_pid && existing.user_id !== row.user_id)) {
        throw new CjPropertyMappingError("CJ_PID_OWNED_BY_ANOTHER_USER");
      }
      if (
        rows.some(
          (existing) =>
            existing.user_id === row.user_id &&
            existing.platform === row.platform &&
            existing.social_account_identifier === row.social_account_identifier
        )
      ) {
        throw new CjPropertyMappingError("CJ_PROPERTY_STORE_FAILED");
      }
      const saved: CjPropertyMappingRow = {
        ...row,
        id: `map-${rows.length + 1}`,
      };
      rows.push(saved);
      return saved;
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CJ phase 1 foundation", () => {
  it("1-2. CJ stays out of the tracking-ready list and env cannot enable it", () => {
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    assert.equal(BETA_TRACKING_READY_AUTOMATED_SOURCES.includes("cj" as "warriorplus"), false);
    assert.equal(isBetaAutomatedSource("cj", "cj"), false);
    assert.deepEqual(getBetaAutomatedSources("cj"), []);
    assert.deepEqual(getBetaAutomatedSources("warriorplus,cj"), ["warriorplus"]);
  });

  it("3-6. property and program clients use the official endpoints and bearer auth", async () => {
    const propertySrc = read("lib/affiliate/cj/promotionalProperty.ts");
    const termsSrc = read("lib/affiliate/cj/programTerms.ts");
    const graphqlSrc = read("lib/affiliate/cj/graphql.ts");
    assert.equal(CJ_PROMOTIONAL_PROPERTIES_ENDPOINT, "https://accounts.api.cj.com/graphql");
    assert.equal(CJ_PROGRAM_TERMS_ENDPOINT, "https://programs.api.cj.com/query");
    assert.match(propertySrc, /CJ_PROMOTIONAL_PROPERTIES_ENDPOINT/);
    assert.match(termsSrc, /CJ_PROGRAM_TERMS_ENDPOINT/);
    assert.match(graphqlSrc, /Authorization: `Bearer \$\{pat\}`/);

    let propertyAuth = "";
    let propertyUrl = "";
    let propertyBody = "";
    await listCJPromotionalProperties({
      pat: "test-pat",
      publisherId: "1111111",
      fetchImpl: async (url, init) => {
        propertyUrl = String(url);
        propertyAuth = String((init?.headers as Record<string, string>).Authorization || "");
        propertyBody = String(init?.body || "");
        return jsonResponse({
          data: { promotionalProperties: { totalCount: 0, resultList: [] } },
        });
      },
    });
    assert.equal(propertyUrl, "https://accounts.api.cj.com/graphql");
    assert.equal(propertyAuth, "Bearer test-pat");
    assert.equal(propertyBody.includes("test-pat"), false);

    let termsUrl = "";
    let termsAuth = "";
    await getCJAdvertiserContract({
      pat: "test-pat",
      publisherId: "1111111",
      advertiserId: "999",
      fetchImpl: async (url, init) => {
        termsUrl = String(url);
        termsAuth = String((init?.headers as Record<string, string>).Authorization || "");
        return jsonResponse({
          data: { publisher: { contracts: { resultList: [] } } },
        });
      },
    });
    assert.equal(termsUrl, "https://programs.api.cj.com/query");
    assert.equal(termsAuth, "Bearer test-pat");
  });

  it("6. PAT is server env only and is absent from client surfaces", () => {
    const serverFiles = [
      "lib/affiliate/cj/config.ts",
      "lib/affiliate/cj/graphql.ts",
      "app/api/cj/promotional-properties/sync/route.ts",
    ];
    for (const rel of serverFiles) {
      const src = read(rel);
      assert.doesNotMatch(src, /NEXT_PUBLIC_CJ/);
      assert.doesNotMatch(src, /NEXT_PUBLIC_.*PAT/);
    }
    assert.match(read("lib/affiliate/cj/config.ts"), /env\.CJ_PAT/);
    assert.match(read("lib/affiliate/cj/config.ts"), /env\.CJ_COMPANY_ID/);
    assert.throws(() => readCjServerConfig({} as NodeJS.ProcessEnv), /CJ_PAT_MISSING/);

    const clientDirs = ["app/login", "components", "app/go", "app/offer"];
    for (const dir of clientDirs) {
      walk(path.join(root, dir), (file) => {
        const text = fs.readFileSync(file, "utf8");
        assert.equal(text.includes("CJ_PAT"), false, file);
        assert.equal(text.includes("CJ_COMPANY_ID"), false, file);
        assert.equal(text.includes("NEXT_PUBLIC_CJ"), false, file);
      });
    }
  });

  it("7-8. Instagram username maps to CJ INSTAGRAM and missing handles fail closed", () => {
    const resolved = resolveSocialPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount(),
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.socialMediaPlatform, "INSTAGRAM");
      assert.equal(resolved.propertyType, "SOCIAL_MEDIA");
      assert.equal(resolved.socialMediaHandle, "linus.creator");
      assert.equal(resolved.socialAccountIdentifier, "instagram:1789001");
    }

    const atHandle = resolveSocialPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount({ meta: { username: "@linus.creator", instagram_id: "1789001" } }),
    });
    assert.equal(atHandle.ok, true);
    if (atHandle.ok) assert.equal(atHandle.socialMediaHandle, "linus.creator");

    const missing = resolveSocialPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount({ meta: {}, username: null }),
    });
    assert.deepEqual(missing, { ok: false, reason: "CJ_SOCIAL_HANDLE_MISSING" });

    const email = resolveSocialPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount({ meta: { username: "person@example.com", email: "person@example.com" } }),
    });
    assert.deepEqual(email, { ok: false, reason: "CJ_SOCIAL_HANDLE_MISSING" });

    for (const platform of ["tiktok", "youtube", "facebook", "linkedin", "threads"]) {
      const result = resolveSocialPromotionalProperty({
        canonicalUserId: "user-a",
        account: instagramAccount({
          platform,
          meta: { display_name: "Guessed", username: "should-not-map", email: "a@b.c" },
          username: "should-not-map",
        }),
      });
      assert.deepEqual(result, { ok: false, reason: "CJ_PLATFORM_UNSUPPORTED" });
    }
  });

  it("9-13. sync ignores client user, handle, and PID, and is idempotent for the canonical user", async () => {
    const store = memoryStore();
    let creates = 0;
    const fetchImpl: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const query = String(body.query || "");
      if (query.includes("createPromotionalProperty")) {
        creates += 1;
        assert.equal(JSON.stringify(body.variables).includes("client-pid"), false);
        assert.equal(JSON.stringify(body.variables).includes("user-b"), false);
        assert.equal(body.variables.input.propertyTypeDetails.socialMediaPlatform, "INSTAGRAM");
        assert.equal(body.variables.input.propertyTypeDetails.socialMediaHandle, "linus.creator");
        assert.equal(body.variables.input.isPrimary, false);
        return jsonResponse({
          data: {
            createPromotionalProperty: {
              id: "555001",
              publisherId: "1111111",
              name: "Instagram @linus.creator",
              description: "Connected Instagram account registered by Autoaffi.",
              status: "ACTIVE",
              isPrimary: false,
              propertyTypeDetails: {
                type: "SOCIAL_MEDIA",
                socialMediaHandle: "linus.creator",
                socialMediaPlatform: "INSTAGRAM",
              },
            },
          },
        });
      }
      assert.equal(String(url), "https://accounts.api.cj.com/graphql");
      return jsonResponse({
        data: { promotionalProperties: { totalCount: 0, resultList: [] } },
      });
    };

    const first = await syncCjPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount(),
      store,
      pat: "test-pat",
      publisherId: "1111111",
      fetchImpl,
      requestedPid: "client-pid",
      requestedUserId: "user-b",
      requestedHandle: "attacker",
    });
    assert.equal(first.mapping.user_id, "user-a");
    assert.equal(first.mapping.cj_pid, "555001");
    assert.equal(first.mapping.cj_pid === "client-pid", false);
    assert.equal(first.idempotent, false);

    const second = await syncCjPromotionalProperty({
      canonicalUserId: "user-a",
      account: instagramAccount(),
      store,
      pat: "test-pat",
      publisherId: "1111111",
      fetchImpl,
      requestedPid: "another-client-pid",
      requestedUserId: "user-b",
    });
    assert.equal(second.idempotent, true);
    assert.equal(second.mapping.cj_pid, "555001");
    assert.equal(creates, 1);
    assert.equal(store.rows.length, 1);

    await assert.rejects(
      syncCjPromotionalProperty({
        canonicalUserId: "user-a",
        account: instagramAccount({ user_id: "user-b" }),
        store,
        pat: "test-pat",
        publisherId: "1111111",
        fetchImpl,
      }),
      (err: unknown) =>
        err instanceof CjPropertyMappingError &&
        err.code === "CJ_SOCIAL_ACCOUNT_OWNER_MISMATCH"
    );
    assert.equal(creates, 1);

    const foreign = memoryStore([
      mapping({ user_id: "user-b", cj_pid: "555001", social_account_identifier: "instagram:999" }),
    ]);
    await assert.rejects(
      syncCjPromotionalProperty({
        canonicalUserId: "user-a",
        account: instagramAccount(),
        store: foreign,
        pat: "test-pat",
        publisherId: "1111111",
        fetchImpl: async () =>
          jsonResponse({
            data: {
              promotionalProperties: {
                totalCount: 1,
                resultList: [
                  {
                    id: "555001",
                    publisherId: "1111111",
                    name: "Instagram @linus.creator",
                    status: "ACTIVE",
                    isPrimary: false,
                    propertyTypeDetails: {
                      type: "SOCIAL_MEDIA",
                      socialMediaHandle: "@linus.creator",
                      socialMediaPlatform: "INSTAGRAM",
                    },
                  },
                ],
              },
            },
          }),
      }),
      (err: unknown) =>
        err instanceof CjPropertyMappingError && err.code === "CJ_PID_OWNED_BY_ANOTHER_USER"
    );
    assert.equal(foreign.rows.length, 1);
    assert.equal(foreign.rows[0].user_id, "user-b");
  });

  it("create fails closed when CJ does not return a PID", async () => {
    await assert.rejects(
      createCJPromotionalProperty({
        pat: "test-pat",
        publisherId: "1111111",
        name: "Instagram @linus.creator",
        socialMediaHandle: "linus.creator",
        socialMediaPlatform: "INSTAGRAM",
        fetchImpl: async () =>
          jsonResponse({
            data: { createPromotionalProperty: { id: "", status: "ACTIVE" } },
          }),
      }),
      (err: unknown) => err instanceof Error && err.message === "CJ_PID_MISSING"
    );
  });

  it("14-18. only an ACTIVE contract counts as an active advertiser relationship", async () => {
    assert.equal(isActiveCjContractStatus("ACTIVE"), true);
    for (const status of ["PENDING_OFFER", "PENDING_REVERSION", "CANCELLED", "EXPIRED", "", null]) {
      assert.equal(isActiveCjContractStatus(status), false);
    }

    async function statusOf(contractStatus: string | null) {
      if (contractStatus === null) {
        const result = await getCJAdvertiserContract({
          pat: "test-pat",
          publisherId: "1111111",
          advertiserId: "42",
          fetchImpl: async () =>
            jsonResponse({ data: { publisher: { contracts: { resultList: [] } } } }),
        });
        return result;
      }
      return getCJAdvertiserContract({
        pat: "test-pat",
        publisherId: "1111111",
        advertiserId: "42",
        fetchImpl: async () =>
          jsonResponse({
            data: {
              publisher: {
                contracts: {
                  resultList: [
                    {
                      advertiserId: "42",
                      status: contractStatus,
                      startTime: "2026-01-01T00:00:00Z",
                      endTime: null,
                      programTerms: { id: "pt-1", name: "Default", actionTerms: [] },
                    },
                  ],
                },
              },
            },
          }),
      });
    }

    const active = await statusOf("ACTIVE");
    assert.equal(active?.isActive, true);
    assert.equal(active?.contractStatus, "ACTIVE");
    assert.equal(active?.programTermsId, "pt-1");
    assert.equal((await statusOf("PENDING_OFFER"))?.isActive, false);
    assert.equal((await statusOf("CANCELLED"))?.isActive, false);
    assert.equal((await statusOf("EXPIRED"))?.isActive, false);
    assert.equal(await statusOf(null), null);
  });

  it("19-22. review, method, and customer commission stay fail-closed", () => {
    const base = {
      canonicalUserId: "user-a",
      account: instagramAccount(),
      mapping: mapping(),
      contractStatus: "ACTIVE",
      method: "social_media",
    };

    assert.deepEqual(
      evaluateCjAdvertiserUse({ ...base, review: null }),
      { ok: false, reason: "CJ_PROGRAM_NOT_REVIEWED" }
    );
    assert.deepEqual(
      evaluateCjAdvertiserUse({
        ...base,
        review: { advertiser_id: "42", status: "disabled", permitted_methods: ["social_media"] },
      }),
      { ok: false, reason: "CJ_PROGRAM_DISABLED" }
    );
    assert.deepEqual(
      evaluateCjAdvertiserUse({
        ...base,
        review: { advertiser_id: "42", status: "allowed", permitted_methods: ["website"] },
      }),
      { ok: false, reason: "CJ_METHOD_NOT_ALLOWED" }
    );
    assert.deepEqual(
      evaluateCjAdvertiserUse({ ...base, mapping: null, review: allowedReview() }),
      { ok: false, reason: "CJ_PROPERTY_MISSING" }
    );
    assert.deepEqual(
      evaluateCjAdvertiserUse({
        ...base,
        mapping: mapping({ status: "ARCHIVED" }),
        review: allowedReview(),
      }),
      { ok: false, reason: "CJ_PROPERTY_INACTIVE" }
    );
    assert.deepEqual(
      evaluateCjAdvertiserUse({ ...base, contractStatus: "PENDING_OFFER", review: allowedReview() }),
      { ok: false, reason: "CJ_CONTRACT_NOT_ACTIVE" }
    );

    const eligible = evaluateCjAdvertiserUse({ ...base, review: allowedReview() });
    assert.deepEqual(eligible, { ok: true, cjPid: "100125586", method: "social_media" });
    assert.equal(customerFacingProductCommission(), null);

    const commissions: CjStructuredCommission[] = [
      {
        rank: 0,
        isViewThrough: false,
        situation: null,
        itemList: null,
        promotionalProperties: [],
        rate: { type: "PERCENT", value: 1, currency: null },
      },
      {
        rank: 1,
        isViewThrough: false,
        situation: null,
        itemList: { id: "54", name: "item list 1" },
        promotionalProperties: [],
        rate: { type: "FIXED", value: 2, currency: "USD" },
      },
      {
        rank: 3,
        isViewThrough: false,
        situation: { id: "58094", name: "loyalty" },
        itemList: { id: "54", name: "item list 1" },
        promotionalProperties: [],
        rate: { type: "FIXED_PER_ORDER", value: 4, currency: "USD" },
      },
      {
        rank: 5,
        isViewThrough: false,
        situation: null,
        itemList: null,
        promotionalProperties: [{ id: "8067264", name: "PID 1" }],
        rate: { type: "PERCENT", value: 5, currency: null },
      },
    ];

    assert.equal(isKnownCjCommissionRateType("PERCENT"), true);
    assert.equal(isKnownCjCommissionRateType("FIXED"), true);
    assert.equal(isKnownCjCommissionRateType("FIXED_PER_ORDER"), true);
    assert.deepEqual(classifyCjCommission(commissions[1]), {
      rateType: "FIXED",
      itemListSpecific: true,
      situationSpecific: false,
      promotionalPropertySpecific: false,
    });
    assert.equal(classifyCjCommission(commissions[2]).situationSpecific, true);
    assert.equal(classifyCjCommission(commissions[3]).promotionalPropertySpecific, true);
    assert.equal(customerFacingProductCommission(), null);
  });

  it("23-26. WarriorPlus, BYO, the CJ stub, and customer search stay unchanged", () => {
    const select = read("app/api/offers/select/route.ts");
    const products = read("app/api/products/search/route.ts");
    const offers = read("app/api/offers/search/route.ts");
    const readiness = read("lib/affiliate/productSourceReadiness.ts");
    assert.match(select, /SOURCE_NOT_BETA_ENABLED/);
    assert.match(select, /warriorPlusTrackingMatches/);
    assert.match(select, /BYO_URL_MUST_BE_HTTP/);
    assert.match(products, /getBetaAutomatedSources\(\)/);
    assert.match(offers, /source_not_beta_enabled/);
    assert.match(readiness, /BETA_TRACKING_READY_AUTOMATED_SOURCES = \["warriorplus"\]/);
    assert.doesNotMatch(readiness, /"cj"/);

    const surfaces = [
      "app/login/dashboard/affiliate/page.tsx",
      "app/login/dashboard/content-optimizer/posts/page.tsx",
      "app/login/dashboard/content-optimizer/reels/page.tsx",
      "app/api/offers/select/route.ts",
      "app/api/products/search/route.ts",
      "app/api/offers/search/route.ts",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(
      surfaces,
      /\/api\/affiliate\/(cj|awin|digistore24|impact|partnerstack|rakuten|clickbank|amazon|shareasale|tradedoubler)/
    );
    assert.doesNotMatch(surfaces, /\/api\/cj\/promotional-properties\/sync/);

    const sync = read("app/api/cj/promotional-properties/sync/route.ts");
    assert.match(sync, /requireUserId\(req\)/);
    assert.match(sync, /void body\?\.userId/);
    assert.match(sync, /void body\?\.pid/);
    assert.match(sync, /void body\?\.cjPid/);
    assert.match(sync, /\.eq\("user_id", userId\)/);
    assert.doesNotMatch(sync, /buildCJLink/);
    assert.doesNotMatch(sync, /BETA_TRACKING_READY_AUTOMATED_SOURCES/);
  });

  it("migration keeps PID rows when social accounts are deleted and does not seed advertisers", () => {
    const sql = read("supabase/migrations/20260927_cj_phase1_property_contract.sql");
    assert.match(sql, /create table if not exists public\.cj_promotional_properties/);
    assert.match(sql, /create table if not exists public\.cj_program_reviews/);
    assert.match(sql, /unique \(user_id, platform, social_account_identifier\)/);
    assert.match(sql, /unique \(cj_pid\)/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on table public\.cj_promotional_properties from authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.cj_program_reviews to service_role/);
    assert.doesNotMatch(sql, /references public\.user_social_accounts/);
    assert.doesNotMatch(sql, /wayfair|rexing|dhgate|booking/i);
    assert.doesNotMatch(sql, /insert into public\.cj_program_reviews/i);
  });
});

function allowedReview() {
  return {
    advertiser_id: "42",
    status: "allowed",
    permitted_methods: ["social_media"],
  };
}

function walk(dir: string, visit: (file: string) => void) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) visit(full);
  }
}
