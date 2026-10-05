import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  getBetaAutomatedSources,
  isBetaAutomatedSource,
} from "../../affiliate/productSourceReadiness.ts";
import { fetchCj } from "./fetch-cj.ts";
import {
  normalizeRow,
  resolveCjIngestScope,
  resolveProductIndexCronSources,
  runProductIndexer,
} from "./indexer.ts";

const root = path.resolve(import.meta.dirname, "../../..");
const ADVERTISER_ID = "5357356";
const PRODUCT_ID = "42979911696574";
const EXTERNAL_ID = `cj_${ADVERTISER_ID}_${PRODUCT_ID}`;
const MERCHANT_URL = "https://rexingusa.com/products/m1s-monocular";
const CLICK_URL = "https://www.kqzyfj.com/click-101896828-5357356?sid=aa_u_test";

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function catalogRow(overrides: Record<string, unknown> = {}) {
  return {
    advertiserId: ADVERTISER_ID,
    advertiserName: "Rexing",
    id: PRODUCT_ID,
    title: "Rexing M1S Monocular",
    description: "short",
    imageLink: null,
    buyUrl: MERCHANT_URL,
    sku: "DO_NOT_USE_SKU",
    linkCode: { clickUrl: CLICK_URL },
    price: { amount: "49.99", currency: "USD" },
    ...overrides,
  };
}

function catalogData(rows: Record<string, unknown>[]) {
  return {
    data: {
      products: {
        totalCount: rows.length,
        resultList: rows,
      },
    },
  };
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PRODUCT_INDEX_GLOBAL_WINNERS: process.env.PRODUCT_INDEX_GLOBAL_WINNERS,
  CJ_PAT: process.env.CJ_PAT,
  CJ_COMPANY_ID: process.env.CJ_COMPANY_ID,
  CJ_INGEST_ADVERTISER_IDS: process.env.CJ_INGEST_ADVERTISER_IDS,
  CJ_INGEST_PRODUCT_IDS: process.env.CJ_INGEST_PRODUCT_IDS,
  PRODUCT_INDEX_CRON_SOURCES: process.env.PRODUCT_INDEX_CRON_SOURCES,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function useIndexerEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://indexer-test.supabase.co";
  process.env.SUPABASE_URL = "https://indexer-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.PRODUCT_INDEX_GLOBAL_WINNERS = "false";
  process.env.CJ_PAT = "test-cj-pat";
  process.env.CJ_COMPANY_ID = "7858215";
}

describe("CJ controlled ingestion", () => {
  it("A. default cron sources still exclude CJ", () => {
    assert.deepEqual(resolveProductIndexCronSources(undefined), [
      "warriorplus",
      "awin",
      "aliexpress",
    ]);
    assert.deepEqual(resolveProductIndexCronSources(""), [
      "warriorplus",
      "awin",
      "aliexpress",
    ]);
    assert.deepEqual(resolveProductIndexCronSources("   "), [
      "warriorplus",
      "awin",
      "aliexpress",
    ]);
    assert.equal(resolveProductIndexCronSources(undefined).includes("cj"), false);
    assert.deepEqual(resolveProductIndexCronSources("cj"), ["cj"]);

    const cron = read("app/api/cron/product-index/route.ts");
    assert.match(cron, /"warriorplus", "awin", "cj", "aliexpress"/);
    assert.match(
      cron,
      /resolveProductIndexCronSources\(process\.env\.PRODUCT_INDEX_CRON_SOURCES\)/
    );
    assert.match(cron, /cjAdvertiserIds: cjScope\.advertiserIds/);
    assert.match(cron, /cjProductIds: cjScope\.productIds/);
    assert.equal(cron.includes(ADVERTISER_ID), false);
    assert.equal(cron.includes(PRODUCT_ID), false);
  });

  it("B. CJ requested without advertiser scope performs no unscoped CJ fetch", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new Error("unscoped CJ fetch");
    };
    globalThis.fetch = fetchImpl;

    assert.deepEqual(await fetchCj({ fetchImpl, pat: "test-cj-pat" }), []);
    assert.deepEqual(
      await fetchCj({
        fetchImpl,
        pat: "test-cj-pat",
        scopedIngestion: true,
        advertiserIds: [],
      }),
      []
    );
    assert.deepEqual(resolveCjIngestScope(undefined), {
      advertiserIds: [],
      productIds: [],
    });
    assert.equal(calls, 0);

    useIndexerEnv();
    delete process.env.CJ_INGEST_ADVERTISER_IDS;
    const report = await runProductIndexer({
      sources: ["cj"],
      limit: 5,
      cjAdvertiserIds: [],
      cjProductIds: [PRODUCT_ID],
    });

    assert.equal(calls, 0);
    assert.equal(report.sources.cj.fetched, 0);
    assert.equal(report.sources.cj.upserted, 0);
    assert.match(report.sources.cj.errors.join("\n"), /advertiser scope is empty/);
  });

  it("C-D. scoped advertiser and optional product id are sent as partnerIds and productIds", async () => {
    const bodies: any[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body || "{}")));
      return jsonResponse(catalogData([catalogRow(), catalogRow({ id: "111", advertiserId: "424242" })]));
    };

    await fetchCj({
      pat: "test-cj-pat",
      companyId: "7858215",
      scopedIngestion: true,
      advertiserIds: [ADVERTISER_ID],
      productIds: [PRODUCT_ID],
      limit: 1,
      fetchImpl,
    });

    assert.equal(bodies.length, 1);
    assert.match(bodies[0].query, /CjScopedProductSearch/);
    assert.match(bodies[0].query, /partnerIds: \$partnerIds/);
    assert.match(bodies[0].query, /productIds: \$productIds/);
    assert.doesNotMatch(bodies[0].query, /linkCode|clickUrl|shopperId/);
    assert.deepEqual(bodies[0].variables.partnerIds, [ADVERTISER_ID]);
    assert.deepEqual(bodies[0].variables.productIds, [PRODUCT_ID]);
    assert.equal(bodies[0].variables.limit, 1);
  });

  it("E-G. scoped fixture keeps canonical identity, merchant URL, advertiser filter, and limit", async () => {
    const rows = [
      catalogRow({
        advertiserId: "424242",
        advertiserName: "Other",
        id: "999",
        title: "Foreign product",
        description: "x".repeat(80),
        imageLink: "https://cdn.example/foreign.jpg",
        buyUrl: "https://other.example/p",
      }),
      catalogRow(),
      catalogRow({
        id: "222",
        title: "Second Rexing product",
        buyUrl: "https://rexingusa.com/products/second",
      }),
      catalogRow({
        id: "333",
        title: "Third Rexing product",
        buyUrl: "https://rexingusa.com/products/third",
      }),
    ];

    const scoped = await fetchCj({
      pat: "test-cj-pat",
      companyId: "7858215",
      scopedIngestion: true,
      advertiserIds: [ADVERTISER_ID],
      productIds: [PRODUCT_ID],
      limit: 10,
      fetchImpl: async () => jsonResponse(catalogData(rows)),
    });

    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].source, "cj");
    assert.equal(scoped[0].external_id, EXTERNAL_ID);
    assert.equal(scoped[0].merchant_id, ADVERTISER_ID);
    assert.equal(scoped[0].product_url, MERCHANT_URL);
    assert.equal(scoped[0].deep_link, MERCHANT_URL);
    assert.equal(scoped[0].description, "short");
    assert.equal(scoped[0].image_url, null);
    assert.equal(scoped[0].price, 49.99);
    assert.equal(scoped[0].product_url.includes("kqzyfj.com"), false);
    assert.equal(scoped[0].product_url.includes("sid="), false);
    assert.equal(scoped[0].external_id.includes("DO_NOT_USE_SKU"), false);

    const normalized = normalizeRow(scoped[0], "cj");
    assert.ok(normalized);
    assert.equal(normalized.source, "cj");
    assert.equal(normalized.external_id, EXTERNAL_ID);
    assert.equal(normalized.merchant_id, ADVERTISER_ID);
    assert.equal(normalized.product_url, MERCHANT_URL);

    const limitedBodies: any[] = [];
    const limited = await fetchCj({
      pat: "test-cj-pat",
      companyId: "7858215",
      scopedIngestion: true,
      advertiserIds: [ADVERTISER_ID],
      limit: 1,
      fetchImpl: async (_input, init) => {
        limitedBodies.push(JSON.parse(String(init?.body || "{}")));
        return jsonResponse(catalogData(rows));
      },
    });

    assert.equal(limitedBodies[0].variables.limit, 1);
    assert.equal(limitedBodies[0].variables.productIds, null);
    assert.equal(limited.length, 1);
    assert.equal(limited[0].merchant_id, ADVERTISER_ID);
    assert.equal(limited[0].external_id, EXTERNAL_ID);

    useIndexerEnv();
    const upserts: any[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("ads.api.cj.com")) {
        return jsonResponse(catalogData(rows));
      }
      if (url.includes("/rest/v1/product_index")) {
        upserts.push(JSON.parse(String(init?.body || "[]")));
        return jsonResponse([], 201);
      }
      return jsonResponse({ message: `unexpected ${url}` }, 500);
    };

    const report = await runProductIndexer({
      sources: ["cj"],
      limit: 10,
      cjAdvertiserIds: [ADVERTISER_ID],
      cjProductIds: [PRODUCT_ID],
    });

    assert.equal(report.sources.cj.errors.length, 0);
    assert.equal(report.sources.cj.upserted, 1);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0].length, 1);
    assert.equal(upserts[0][0].source, "cj");
    assert.equal(upserts[0][0].external_id, EXTERNAL_ID);
    assert.equal(upserts[0][0].merchant_id, ADVERTISER_ID);
    assert.equal(upserts[0][0].product_url, MERCHANT_URL);
    assert.equal(JSON.stringify(upserts).includes("424242"), false);
    assert.equal(JSON.stringify(upserts).includes("kqzyfj.com"), false);

    upserts.length = 0;
    const limitedReport = await runProductIndexer({
      sources: ["cj"],
      limit: 1,
      cjAdvertiserIds: [ADVERTISER_ID],
    });
    assert.equal(limitedReport.sources.cj.upserted, 1);
    assert.equal(upserts[0].length, 1);
    assert.equal(upserts[0][0].merchant_id, ADVERTISER_ID);
  });

  it("fails closed when the scoped product has only a CJ click URL", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        catalogData([
          catalogRow({
            buyUrl: CLICK_URL,
            link: CLICK_URL,
            mobileLink: CLICK_URL,
            productUrl: CLICK_URL,
          }),
        ])
      );

    await assert.rejects(
      () =>
        fetchCj({
          pat: "test-cj-pat",
          companyId: "7858215",
          scopedIngestion: true,
          advertiserIds: [ADVERTISER_ID],
          productIds: [PRODUCT_ID],
          limit: 1,
          fetchImpl,
        }),
      /no merchant destination URL/
    );
  });

  it("keeps the existing presentation filters on the non-scoped winners path", async () => {
    const fetchSrc = read("lib/engines/product-indexer/fetch-cj.ts");
    assert.match(fetchSrc, /const DEFAULT_MIN_DESC = 60/);
    assert.match(fetchSrc, /const DEFAULT_REQUIRE_IMAGE = true/);
    assert.match(fetchSrc, /if \(d\.length < minDescriptionLen\) continue/);

    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      if (String(body.query || "").includes("productFeed")) {
        return jsonResponse({
          errors: [{ message: 'Cannot query field "productFeed" on type Query' }],
        });
      }
      return jsonResponse(
        catalogData([
          catalogRow({
            description: "short",
            imageLink: null,
          }),
        ])
      );
    };

    const rows = await fetchCj({
      pat: "test-cj-pat",
      companyId: "7858215",
      advertiserIds: [ADVERTISER_ID],
      scopedIngestion: false,
      fetchImpl,
    });
    assert.deepEqual(rows, []);
  });

  it("H-J. CJ stays out of the customer beta, search, and save gates", () => {
    const readiness = read("lib/affiliate/productSourceReadiness.ts");
    const search = read("app/api/products/search/route.ts");
    const select = read("app/api/offers/select/route.ts");

    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    assert.match(readiness, /BETA_TRACKING_READY_AUTOMATED_SOURCES = \["warriorplus"\]/);
    assert.equal(isBetaAutomatedSource("cj"), false);
    assert.deepEqual(getBetaAutomatedSources(undefined), ["warriorplus"]);
    assert.deepEqual(
      ["cj"].filter((source) => getBetaAutomatedSources(undefined).includes(source)),
      []
    );

    assert.match(search, /const betaSources = getBetaAutomatedSources\(\)/);
    assert.match(search, /qb = qb\.in\("source", allowedSources\)/);
    assert.doesNotMatch(search, /source === ["']cj["']/);

    const gate = select.indexOf('error: "SOURCE_NOT_BETA_ENABLED"');
    const cjBranch = select.indexOf('if (source === "cj")');
    assert.ok(gate > 0);
    assert.ok(cjBranch > gate);
    assert.match(select, /else if \(!isBetaAutomatedSource\(source\)\)/);

    const indexer = read("lib/engines/product-indexer/indexer.ts");
    const fetcher = read("lib/engines/product-indexer/fetch-cj.ts");
    assert.doesNotMatch(indexer, /cjAdapter|createCjTrackingLink|linkCode/);
    assert.doesNotMatch(fetcher, /cjAdapter|createCjTrackingLink|linkCode|clickUrl/);
    assert.equal(indexer.includes(ADVERTISER_ID), false);
    assert.equal(fetcher.includes(PRODUCT_ID), false);
  });
});
