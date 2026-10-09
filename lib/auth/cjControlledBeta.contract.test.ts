import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { prepareCjCustomerSearchItems } from "../affiliate/cj/searchGate.ts";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  customerAutomatedSources,
  getBetaAutomatedSources,
  isBetaAutomatedSource,
  isControlledCjBetaUser,
  isControlledCjCatalogItem,
  isCustomerAutomatedSource,
  retainCustomerSearchItem,
  type ControlledCjBetaEnv,
} from "../affiliate/productSourceReadiness.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const rexingExternalId = "cj_5357356_42979911696574";
const otherCjExternalId = "cj_5357356_00000000000000";

const config: ControlledCjBetaEnv = {
  userIds: userId,
  externalIds: rexingExternalId,
};

function catalog(source: string, externalId: string) {
  return { source, external_id: externalId };
}

describe("controlled CJ beta gate", () => {
  it("keeps the global ready list exactly warriorplus", () => {
    const readiness = read("lib/affiliate/productSourceReadiness.ts");
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    assert.match(readiness, /BETA_TRACKING_READY_AUTOMATED_SOURCES = \["warriorplus"\]/);
    assert.doesNotMatch(readiness, /"cj"/);
    assert.equal(getBetaAutomatedSources("cj").includes("cj"), false);
    assert.deepEqual(getBetaAutomatedSources("warriorplus,cj"), ["warriorplus"]);
    assert.equal(isBetaAutomatedSource("cj"), false);
    assert.equal(isBetaAutomatedSource("cj", "warriorplus,cj"), false);
    assert.equal(isBetaAutomatedSource("warriorplus"), true);
  });

  it("fails closed when either controlled env is unset, blank, or malformed", () => {
    const previousUsers = process.env.CJ_CONTROLLED_BETA_USER_IDS;
    const previousProducts = process.env.CJ_CONTROLLED_BETA_EXTERNAL_IDS;
    delete process.env.CJ_CONTROLLED_BETA_USER_IDS;
    delete process.env.CJ_CONTROLLED_BETA_EXTERNAL_IDS;
    try {
      assert.equal(isControlledCjBetaUser(userId), false);
      assert.deepEqual(customerAutomatedSources(userId), ["warriorplus"]);
    } finally {
      if (previousUsers === undefined) delete process.env.CJ_CONTROLLED_BETA_USER_IDS;
      else process.env.CJ_CONTROLLED_BETA_USER_IDS = previousUsers;
      if (previousProducts === undefined) delete process.env.CJ_CONTROLLED_BETA_EXTERNAL_IDS;
      else process.env.CJ_CONTROLLED_BETA_EXTERNAL_IDS = previousProducts;
    }

    const incomplete: ControlledCjBetaEnv[] = [
      {},
      { userIds: userId },
      { externalIds: rexingExternalId },
      { userIds: "", externalIds: rexingExternalId },
      { userIds: "   ", externalIds: rexingExternalId },
      { userIds: userId, externalIds: "" },
      { userIds: userId, externalIds: "   " },
      { userIds: `${userId}, not-a-uuid`, externalIds: rexingExternalId },
      { userIds: userId, externalIds: `${rexingExternalId}, has space` },
      { userIds: "linus@example.com", externalIds: rexingExternalId },
      { userIds: userId.slice(0, 8), externalIds: rexingExternalId },
    ];

    for (const env of incomplete) {
      assert.equal(isControlledCjBetaUser(userId, env), false);
      assert.equal(isControlledCjCatalogItem(userId, "cj", rexingExternalId, env), false);
      assert.deepEqual(customerAutomatedSources(userId, undefined, env), ["warriorplus"]);
    }
  });

  it("allows only the exact user and the exact Rexing external id", () => {
    assert.equal(isControlledCjBetaUser(userId, config), true);
    assert.deepEqual(customerAutomatedSources(userId, undefined, config), [
      "warriorplus",
      "cj",
    ]);
    assert.equal(isCustomerAutomatedSource(userId, "cj", config), true);
    assert.equal(
      isControlledCjCatalogItem(userId, "cj", rexingExternalId, config),
      true
    );
    assert.equal(
      isControlledCjCatalogItem(userId, "CJ", `  ${rexingExternalId}  `, config),
      true
    );

    assert.equal(isControlledCjBetaUser(otherUserId, config), false);
    assert.equal(isCustomerAutomatedSource(otherUserId, "cj", config), false);
    assert.deepEqual(customerAutomatedSources(otherUserId, undefined, config), [
      "warriorplus",
    ]);
    assert.equal(
      isControlledCjCatalogItem(otherUserId, "cj", rexingExternalId, config),
      false
    );

    assert.equal(isControlledCjBetaUser(userId.slice(0, userId.length - 1), config), false);
    assert.equal(isControlledCjBetaUser(userId.slice(0, 8), config), false);
    assert.equal(isControlledCjBetaUser("linus@example.com", config), false);
    assert.equal(
      isControlledCjCatalogItem(userId, "cj", rexingExternalId.slice(0, 12), config),
      false
    );
    assert.equal(
      isControlledCjCatalogItem(userId, "cj", otherCjExternalId, config),
      false
    );
    assert.equal(isControlledCjCatalogItem(userId, "cj", "", config), false);
  });

  it("does not enable any other network for the allowlisted user", () => {
    for (const source of ["awin", "aliexpress", "rakuten", "clickbank", "impact", "byo"]) {
      assert.equal(isCustomerAutomatedSource(userId, source, config), false);
      assert.equal(customerAutomatedSources(userId, undefined, config).includes(source), false);
      assert.equal(isControlledCjCatalogItem(userId, source, rexingExternalId, config), false);
    }
    assert.equal(isCustomerAutomatedSource(userId, "warriorplus", config), true);
    assert.equal(isBetaAutomatedSource("warriorplus", "warriorplus,cj"), true);
    assert.equal(isBetaAutomatedSource("awin", "awin"), false);
  });

  it("keeps Posts and Affiliate Offers to the pinned CJ product and Reels at zero", () => {
    const items = [
      catalog("warriorplus", "wp-offer-1"),
      catalog("cj", rexingExternalId),
      catalog("cj", otherCjExternalId),
      catalog("awin", "awin-1"),
    ];
    const visible = items.filter((item) =>
      retainCustomerSearchItem(userId, item.source, item.external_id, config)
    );
    assert.deepEqual(
      visible.map((item) => `${item.source}:${item.external_id}`),
      [`warriorplus:wp-offer-1`, `cj:${rexingExternalId}`, "awin:awin-1"]
    );

    for (const context of ["posts", " affiliate_offers ", "AFFILIATE_OFFERS"]) {
      const prepared = prepareCjCustomerSearchItems(visible, context);
      assert.equal(prepared.applyReviewGate, true);
      assert.deepEqual(
        prepared.items.filter((item) => item.source === "cj").map((item) => item.external_id),
        [rexingExternalId]
      );
    }

    for (const context of [undefined, null, "", "reels", "REELS", "tiktok", "facebook"]) {
      const prepared = prepareCjCustomerSearchItems(visible, context);
      assert.equal(prepared.applyReviewGate, false);
      assert.equal(
        prepared.items.some((item) => String(item.source).toLowerCase() === "cj"),
        false
      );
    }

    const hiddenFromOtherUser = items.filter((item) =>
      retainCustomerSearchItem(otherUserId, item.source, item.external_id, config)
    );
    assert.equal(
      hiddenFromOtherUser.some((item) => item.source === "cj"),
      false
    );
  });

  it("permits select only for the exact user and exact external id", () => {
    const select = read("app/api/offers/select/route.ts");
    const gate = select.indexOf('error: "SOURCE_NOT_BETA_ENABLED"');
    const catalogCheck = select.indexOf(
      "isControlledCjCatalogItem(userId, source, resolveExternalId(payload))"
    );
    const tracking = select.indexOf("await cjAdapter.createTrackingLink");

    assert.match(select, /else if \(!isBetaAutomatedSource\(source\)\)/);
    assert.match(select, /void body\?\.userId/);
    assert.match(select, /requireUserId\(req\)/);
    assert.match(select, /warriorPlusTrackingMatches/);
    assert.match(select, /buildAffiliateLink\(/);
    assert.ok(gate > catalogCheck && catalogCheck > 0);
    assert.ok(tracking > gate);
    assert.equal(isControlledCjCatalogItem(userId, "cj", rexingExternalId, config), true);
    assert.equal(isControlledCjCatalogItem(userId, "cj", otherCjExternalId, config), false);
    assert.equal(isControlledCjCatalogItem(otherUserId, "cj", rexingExternalId, config), false);
  });

  it("wires search to the session user and leaves /go independent of the env", () => {
    const products = read("app/api/products/search/route.ts");
    const offers = read("app/api/offers/search/route.ts");
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    const go = read("app/go/offer/[savedId]/route.ts");

    assert.match(products, /const betaSources = getBetaAutomatedSources\(\)/);
    assert.match(products, /customerAutomatedSources\(params\.userId, betaSources\)/);
    assert.match(products, /qb = qb\.in\("source", allowedSources\)/);
    assert.match(products, /retainCustomerSearchItem\(searchUserId, item\.source, item\.external_id\)/);
    assert.match(products, /prepareCjCustomerSearchItems\(results, rawSearchContext\)/);
    assert.match(products, /applyCjSearchGate\(searchUserId, preparedCjSearch\.items\)/);
    assert.doesNotMatch(products, /source === ["']cj["']/);

    assert.match(offers, /const betaSources = getBetaAutomatedSources\(\)/);
    assert.match(offers, /customerAutomatedSources\(userId, betaSources\)/);
    assert.match(offers, /retainCustomerSearchItem\(userId, item\.source, item\.external_id\)/);
    assert.match(offers, /prepareCjCustomerSearchItems\(items, contextParam\)/);
    assert.match(offers, /applyCjSearchGate\(userId, preparedCjSearch\.items\)/);
    assert.match(offers, /source_not_beta_enabled/);
    assert.doesNotMatch(offers, /searchParams\.get\(["']userId["']\)/);
    assert.doesNotMatch(products, /searchParams\.get\(["']userId["']\)/);

    assert.match(posts, /context=posts/);
    assert.doesNotMatch(reels, /context=posts/);
    assert.match(reels, /from: "reels"/);
    assert.doesNotMatch(reels, /CJ_CONTROLLED_BETA/);
    assert.doesNotMatch(go, /CJ_CONTROLLED_BETA/);
    assert.doesNotMatch(go, /customerAutomatedSources|isControlledCjCatalogItem|controlledCjExternalIds/);
    assert.match(go, /resolveCjGoClick/);
  });
});
