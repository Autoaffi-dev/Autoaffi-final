import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  warriorPlusTrackingMatches,
} from "../productSourceReadiness.ts";
import { buildWarriorPlusLink } from "../sources/warriorplus.ts";
import { buildStableSubId } from "../stableOfferSubId.ts";
import {
  createWarriorPlusTrackingLink,
  WARRIORPLUS_CONNECTOR_CAPABILITIES,
  warriorPlusAdapter,
} from "./warriorPlusAdapter.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const externalId = "offer-77";
const productUrl = "https://warriorplus.com/o2/offer-77?vendor=1";

function request(overrides?: {
  productUrl?: string | null;
  promotionContext?: string;
  externalId?: string;
}) {
  return {
    userId,
    externalId: overrides?.externalId ?? externalId,
    indexRow: {
      merchant_id: "wp_vendor",
      product_url:
        overrides && "productUrl" in overrides
          ? overrides.productUrl ?? ""
          : productUrl,
      is_active: true,
      is_approved: true,
    },
    promotionContext: overrides?.promotionContext ?? "affiliate_offers",
  };
}

function params(affiliateLink: string) {
  return new URL(affiliateLink).searchParams;
}

describe("WarriorPlus connector stage 1 passive adapter", () => {
  it("declares source warriorplus and the proven capabilities", () => {
    assert.equal(warriorPlusAdapter.source, "warriorplus");
    assert.deepEqual(warriorPlusAdapter.capabilities, {
      offerSync: false,
      productFeed: true,
      advertiserSync: false,
      deepLinks: false,
      subId: true,
      transactions: false,
      reporting: false,
      promotionalProperties: false,
    });
    assert.equal(WARRIORPLUS_CONNECTOR_CAPABILITIES.deepLinks, false);
    assert.equal(WARRIORPLUS_CONNECTOR_CAPABILITIES.productFeed, true);
    assert.equal(WARRIORPLUS_CONNECTOR_CAPABILITIES.subId, true);
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
  });

  it("mints the stable SubID and matches the existing builder", async () => {
    const expectedSubId = buildStableSubId(userId, "warriorplus", externalId);
    const direct = await buildWarriorPlusLink({
      source: "warriorplus",
      productUrl,
      externalId,
      userId,
      subid: expectedSubId,
      context: "posts",
    });

    const result = await warriorPlusAdapter.createTrackingLink(
      request({ promotionContext: "posts" })
    );

    assert.equal(result.subid, expectedSubId);
    assert.match(
      result.subid,
      /^aa_u_[0-9a-f]{6}__src_warriorplus__of_[0-9a-f]{6}$/
    );
    assert.equal(result.affiliateLink, direct.affiliateLink);
    assert.equal(result.subid, direct.subid);
    assert.equal(params(result.affiliateLink).get("hop_sid"), expectedSubId);
    assert.equal(params(result.affiliateLink).get("sid"), expectedSubId);
    assert.equal(params(result.affiliateLink).get("hop_tid"), "posts");
    assert.equal(params(result.affiliateLink).get("vendor"), "1");
    assert.equal(warriorPlusTrackingMatches(result.affiliateLink, result.subid), true);
  });

  it("ignores a caller-supplied SubID and uses indexRow.product_url", async () => {
    const expectedSubId = buildStableSubId(userId, "warriorplus", externalId);
    const result = await createWarriorPlusTrackingLink({
      ...request(),
      subid: "client-supplied",
      pid: "999",
      destination: "https://evil.example/other",
    } as never);

    assert.equal(result.subid, expectedSubId);
    assert.equal(params(result.affiliateLink).get("hop_sid"), expectedSubId);
    assert.equal(params(result.affiliateLink).get("sid"), expectedSubId);
    assert.equal(new URL(result.affiliateLink).origin, "https://warriorplus.com");
    assert.equal(new URL(result.affiliateLink).pathname, "/o2/offer-77");
  });

  it("uses affiliate_offers when promotionContext is empty", async () => {
    const result = await warriorPlusAdapter.createTrackingLink(
      request({ promotionContext: "" })
    );
    const direct = await buildWarriorPlusLink({
      source: "warriorplus",
      productUrl,
      externalId,
      userId,
      subid: buildStableSubId(userId, "warriorplus", externalId),
      context: "",
    });

    assert.equal(params(result.affiliateLink).get("hop_tid"), "affiliate_offers");
    assert.equal(result.affiliateLink, direct.affiliateLink);
  });

  it("preserves an existing hop_tid", async () => {
    const tagged = "https://warriorplus.com/o2/offer-77?hop_tid=kept&vendor=1";
    const result = await warriorPlusAdapter.createTrackingLink(
      request({ productUrl: tagged, promotionContext: "posts" })
    );

    assert.equal(params(result.affiliateLink).get("hop_tid"), "kept");
    assert.equal(params(result.affiliateLink).get("vendor"), "1");
    assert.equal(params(result.affiliateLink).get("hop_sid"), result.subid);
    assert.equal(params(result.affiliateLink).get("sid"), result.subid);
  });

  it("preserves matching hop_sid and sid", async () => {
    const subid = buildStableSubId(userId, "warriorplus", externalId);
    const tagged = `https://warriorplus.com/o2/offer-77?hop_sid=${subid}&sid=${subid}&ref=keep`;
    const result = await warriorPlusAdapter.createTrackingLink(
      request({ productUrl: tagged, promotionContext: "reels" })
    );

    assert.equal(params(result.affiliateLink).get("hop_sid"), subid);
    assert.equal(params(result.affiliateLink).get("sid"), subid);
    assert.equal(params(result.affiliateLink).get("ref"), "keep");
    assert.equal(params(result.affiliateLink).get("hop_tid"), "reels");
    assert.equal(warriorPlusTrackingMatches(result.affiliateLink, result.subid), true);
  });

  it("does not overwrite a conflicting hop_sid, and the matcher rejects it", async () => {
    const tagged = "https://warriorplus.com/o2/offer-77?hop_sid=other-sid&ref=keep";
    const result = await warriorPlusAdapter.createTrackingLink(
      request({ productUrl: tagged })
    );

    assert.equal(params(result.affiliateLink).get("hop_sid"), "other-sid");
    assert.equal(params(result.affiliateLink).get("sid"), result.subid);
    assert.equal(params(result.affiliateLink).get("ref"), "keep");
    assert.equal(warriorPlusTrackingMatches(result.affiliateLink, result.subid), false);
  });

  it("does not overwrite a conflicting sid, and the matcher rejects it", async () => {
    const tagged = "https://warriorplus.com/o2/offer-77?sid=other-sid&color=blue";
    const result = await warriorPlusAdapter.createTrackingLink(
      request({ productUrl: tagged })
    );

    assert.equal(params(result.affiliateLink).get("sid"), "other-sid");
    assert.equal(params(result.affiliateLink).get("hop_sid"), result.subid);
    assert.equal(params(result.affiliateLink).get("color"), "blue");
    assert.equal(warriorPlusTrackingMatches(result.affiliateLink, result.subid), false);
  });

  it("rejects a malformed product URL with the builder error", async () => {
    await assert.rejects(
      () =>
        warriorPlusAdapter.createTrackingLink(
          request({ productUrl: "not a url" })
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "WarriorPlus requires a valid productUrl");
        return true;
      }
    );
  });
});

const routeRoot = path.resolve(import.meta.dirname, "../../..");

function readRoute(rel: string) {
  return fs.readFileSync(path.join(routeRoot, rel), "utf8");
}

function routeBuilderMeta(subid: string, context: string, campaign: string | null) {
  return {
    mode: "tokenized",
    hop_sid: subid,
    hop_tid: context || campaign || "affiliate_offers",
  };
}

describe("WarriorPlus stage 2 tracking parity", () => {
  it("matches the direct builder for posts and affiliate_offers", async () => {
    for (const promotionContext of ["posts", "affiliate_offers"]) {
      const routeSubId = buildStableSubId(userId, "warriorplus", externalId);
      const direct = await buildWarriorPlusLink({
        source: "warriorplus",
        productUrl,
        externalId,
        userId,
        subid: routeSubId,
        context: promotionContext,
      });
      const result = await warriorPlusAdapter.createTrackingLink(
        request({ promotionContext })
      );

      assert.equal(result.subid, routeSubId);
      assert.equal(result.affiliateLink, direct.affiliateLink);
      assert.equal(result.subid, direct.subid);
      assert.equal(params(result.affiliateLink).get("hop_sid"), routeSubId);
      assert.equal(params(result.affiliateLink).get("sid"), routeSubId);
      assert.equal(params(result.affiliateLink).get("hop_tid"), promotionContext);
      assert.equal(warriorPlusTrackingMatches(result.affiliateLink, routeSubId), true);
      assert.deepEqual(
        routeBuilderMeta(routeSubId, promotionContext, "campaign-present"),
        direct.meta
      );
    }
  });

  it("keeps a matching hop_sid and sid and the stable SubID", async () => {
    const routeSubId = buildStableSubId(userId, "warriorplus", externalId);
    const tagged = `https://warriorplus.com/o2/offer-77?hop_sid=${routeSubId}&sid=${routeSubId}&ref=keep`;
    const result = await createWarriorPlusTrackingLink(
      request({ productUrl: tagged, promotionContext: "posts" })
    );

    assert.equal(result.subid, routeSubId);
    assert.equal(params(result.affiliateLink).get("hop_sid"), routeSubId);
    assert.equal(params(result.affiliateLink).get("sid"), routeSubId);
    assert.equal(params(result.affiliateLink).get("ref"), "keep");
    assert.equal(warriorPlusTrackingMatches(result.affiliateLink, routeSubId), true);
  });

  it("leaves conflicting hop_sid and sid in place, and the matcher rejects them", async () => {
    const routeSubId = buildStableSubId(userId, "warriorplus", externalId);
    const conflictingSid = await createWarriorPlusTrackingLink(
      request({
        productUrl: "https://warriorplus.com/o2/offer-77?hop_sid=other-sid&ref=keep",
      })
    );
    const conflictingSub = await createWarriorPlusTrackingLink(
      request({
        productUrl: "https://warriorplus.com/o2/offer-77?sid=other-sid&color=blue",
      })
    );

    assert.equal(conflictingSid.subid, routeSubId);
    assert.equal(params(conflictingSid.affiliateLink).get("hop_sid"), "other-sid");
    assert.equal(params(conflictingSid.affiliateLink).get("sid"), routeSubId);
    assert.equal(
      warriorPlusTrackingMatches(conflictingSid.affiliateLink, routeSubId),
      false
    );
    assert.equal(params(conflictingSub.affiliateLink).get("sid"), "other-sid");
    assert.equal(params(conflictingSub.affiliateLink).get("hop_sid"), routeSubId);
    assert.equal(
      warriorPlusTrackingMatches(conflictingSub.affiliateLink, routeSubId),
      false
    );
  });

  it("keeps builder metadata on the inputs when hop_tid is already present", async () => {
    const tagged = "https://warriorplus.com/o2/offer-77?hop_tid=vendor-camp&vendor=1";
    const routeSubId = buildStableSubId(userId, "warriorplus", externalId);

    for (const promotionContext of ["posts", "affiliate_offers"]) {
      const direct = await buildWarriorPlusLink({
        source: "warriorplus",
        productUrl: tagged,
        externalId,
        userId,
        subid: routeSubId,
        context: promotionContext,
      });
      const result = await createWarriorPlusTrackingLink(
        request({ productUrl: tagged, promotionContext })
      );

      assert.equal(result.affiliateLink, direct.affiliateLink);
      assert.equal(result.subid, direct.subid);
      assert.equal(params(result.affiliateLink).get("hop_tid"), "vendor-camp");
      assert.equal(params(result.affiliateLink).get("vendor"), "1");
      assert.equal(direct.meta?.hop_tid, promotionContext);
      assert.equal(direct.meta?.hop_sid, routeSubId);
      assert.deepEqual(
        routeBuilderMeta(routeSubId, promotionContext, "campaign-present"),
        direct.meta
      );
    }
  });
});

describe("WarriorPlus save-route source contract", () => {
  it("records the SubID guard and call order without executing HTTP", () => {
    const select = readRoute("app/api/offers/select/route.ts");
    const stableSubId = select.indexOf(
      "const subid = buildStableSubId(userId, source, externalId)"
    );
    const cjBranch = select.indexOf('if (source === "cj")');
    const warriorBranch = select.indexOf('if (source === "warriorplus")');
    const warriorCall = select.indexOf("await warriorPlusAdapter.createTrackingLink");
    const warriorMismatch = select.indexOf("WARRIORPLUS_SID_MISMATCH");
    const matcher = select.indexOf(
      "warriorPlusTrackingMatches(finalAffiliateLink, finalSubId)"
    );
    const unavailable = select.indexOf("WARRIORPLUS_TRACKING_UNAVAILABLE");
    const upsert = select.indexOf('.from("user_offers")');
    const warriorBlock = select.slice(warriorBranch, select.indexOf("const built =", warriorBranch));

    assert.ok(stableSubId >= 0 && stableSubId < cjBranch);
    assert.ok(cjBranch < warriorBranch);
    assert.match(select.slice(cjBranch, warriorBranch), /await cjAdapter\.createTrackingLink/);
    assert.match(select.slice(cjBranch, warriorBranch), /CJ_SID_MISMATCH/);
    assert.match(warriorBlock, /resolved\.subid !== subid/);
    assert.match(warriorBlock, /WARRIORPLUS_SID_MISMATCH/);
    assert.doesNotMatch(warriorBlock, /catch/);
    assert.ok(
      warriorBranch < warriorCall &&
        warriorCall < warriorMismatch &&
        warriorMismatch < matcher &&
        matcher < unavailable &&
        unavailable < upsert
    );
    assert.match(select, /source === "cj" \|\| source === "warriorplus"/);
    assert.match(select, /buildAffiliateLink\(\{/);
    assert.match(select, /BYO_URL_MUST_BE_HTTP/);
    assert.match(select, /BYO_URL_REWRITTEN/);
    assert.match(select, /return `\/go\/offer\/\$\{id\}`/);
    assert.match(select, /mode: "tokenized"/);
    assert.match(select, /hop_sid: subid/);
    assert.match(select, /hop_tid: context \|\| campaign \|\| "affiliate_offers"/);
    assert.doesNotMatch(select, /buildWarriorPlusLink/);
  });
});
