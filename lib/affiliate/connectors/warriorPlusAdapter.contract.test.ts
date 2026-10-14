import assert from "node:assert/strict";
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
