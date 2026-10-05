import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { BETA_TRACKING_READY_AUTOMATED_SOURCES } from "../productSourceReadiness.ts";
import { buildStableSubId } from "../stableOfferSubId.ts";
import { resolveCjOfferDestination } from "../cj/resolveCjOfferDestination.ts";
import type { CjAdvertiserContract } from "../cj/programTerms.ts";
import type { CjPropertyMappingRow } from "../cj/propertyMapping.ts";
import type { CjSocialAccountSnapshot } from "../cj/socialAccountProperty.ts";
import { cjAdapter, CJ_CONNECTOR_CAPABILITIES, createCjTrackingLink } from "./cjAdapter.ts";

const root = path.resolve(import.meta.dirname, "../../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const userId = "user-a";
const externalId = "cj_42_sku900";
const pid = "100125586";
const aid = "11470088";

function account(): CjSocialAccountSnapshot {
  return {
    id: "social-1",
    user_id: userId,
    platform: "instagram",
    status: "connected",
    username: null,
    meta: { username: "linus.creator", instagram_id: "1789001" },
  };
}

function property(): CjPropertyMappingRow {
  return {
    id: "map-1",
    user_id: userId,
    platform: "instagram",
    social_account_id: "social-1",
    social_account_identifier: "instagram:1789001",
    social_media_handle: "linus.creator",
    cj_social_platform: "INSTAGRAM",
    cj_pid: pid,
    property_type: "SOCIAL_MEDIA",
    status: "ACTIVE",
  };
}

function contract(): CjAdvertiserContract {
  return {
    advertiserId: "42",
    contractStatus: "ACTIVE",
    programTermsId: "pt-1",
    programTermsName: "Default",
    startTime: null,
    endTime: null,
    isActive: true,
    commissions: [],
  };
}

function review() {
  return {
    advertiser_id: "42",
    status: "allowed",
    permitted_methods: ["social_media"],
  };
}

function fetchImpl(body: unknown, onRequest?: (init: RequestInit) => void): typeof fetch {
  return async (_url, init) => {
    onRequest?.(init || {});
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("CJ connector stage 1 passive adapter", () => {
  it("declares source cj and only proven capabilities", () => {
    assert.equal(cjAdapter.source, "cj");
    assert.deepEqual(cjAdapter.capabilities, {
      offerSync: false,
      productFeed: true,
      advertiserSync: false,
      deepLinks: true,
      subId: true,
      transactions: false,
      reporting: false,
      promotionalProperties: true,
    });
    assert.equal(CJ_CONNECTOR_CAPABILITIES.transactions, false);
    assert.equal(CJ_CONNECTOR_CAPABILITIES.reporting, false);
    assert.equal("syncOffers" in cjAdapter, false);
    assert.equal("syncTransactions" in cjAdapter, false);
    assert.equal("syncAdvertisers" in cjAdapter, false);
  });

  it("delegates to the verified CJ resolver and returns that resolver SubID", async () => {
    const sid = buildStableSubId(userId, "cj", externalId);
    let variables: { shopperId?: string } | null = null;

    const result = await createCjTrackingLink(
      {
        userId,
        externalId,
        indexRow: {
          merchant_id: "42",
          product_url: "https://shop.example/item",
          is_active: true,
          is_approved: true,
        },
        promotionContext: "affiliate_offers",
        clientSid: "client-sid",
        clientPid: "000",
        clientDestination: "https://evil.example/steal",
      } as any,
      async (args) => {
        assert.equal(args.canonicalUserId, userId);
        assert.equal(args.indexRow.source, "cj");
        assert.equal(args.indexRow.external_id, externalId);
        assert.equal(args.indexRow.merchant_id, "42");
        assert.equal(Object.hasOwn(args, "clientSid"), false);
        assert.equal(Object.hasOwn(args, "clientPid"), false);
        assert.equal(Object.hasOwn(args, "clientDestination"), false);
        assert.equal(args.clientSid, undefined);
        return resolveCjOfferDestination({
          canonicalUserId: args.canonicalUserId,
          indexRow: args.indexRow,
          promotionContext: args.promotionContext,
          promotionPlatform: args.promotionPlatform,
          account: account(),
          properties: [property()],
          contract: contract(),
          review: review(),
          pat: "test-pat",
          companyId: "1111111",
          fetchImpl: fetchImpl(
            {
              data: {
                products: {
                  resultList: [
                    {
                      id: "sku900",
                      advertiserId: "42",
                      linkCode: {
                        clickUrl: `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}`,
                      },
                    },
                  ],
                },
              },
            },
            (init) => {
              variables = JSON.parse(String(init.body)).variables;
            }
          ),
          clientSid: "client-sid",
          clientPid: "000",
          clientDestination: "https://evil.example/steal",
        });
      }
    );

    assert.equal(result.subid, sid);
    assert.equal(variables?.shopperId, sid);
    assert.notEqual(result.subid, "client-sid");
    assert.equal(result.affiliateLink.includes("client-sid"), false);
    assert.deepEqual(new URL(result.affiliateLink).searchParams.getAll("sid"), [sid]);
  });

  it("does not mint a SubID and does not use legacy CJ link builders", () => {
    const adapter = read("lib/affiliate/connectors/cjAdapter.ts");
    const types = read("lib/affiliate/connectors/types.ts");
    const combined = `${adapter}\n${types}`;
    assert.doesNotMatch(combined, /buildStableSubId/);
    assert.doesNotMatch(combined, /buildCJLink/);
    assert.doesNotMatch(combined, /deeplink/);
    assert.doesNotMatch(combined, /networkClient/);
    assert.doesNotMatch(combined, /CJ_API_KEY/);
    assert.match(adapter, /resolveStoredCjOfferDestination/);
    assert.match(adapter, /return createCjTrackingLink\(input\)/);
  });

  it("save path delegates CJ tracking through cjAdapter and keeps the rest unchanged", () => {
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    const select = read("app/api/offers/select/route.ts");
    const indexer = read("lib/engines/product-indexer/indexer.ts");
    const go = read("app/go/offer/[savedId]/route.ts");
    const adapter = read("lib/affiliate/connectors/cjAdapter.ts");
    const cjStart = select.indexOf('if (source === "cj")');
    const cjBranch = select.slice(cjStart, select.indexOf("const built", cjStart));

    assert.match(cjBranch, /await cjAdapter\.createTrackingLink\(/);
    assert.doesNotMatch(select, /resolveStoredCjOfferDestination/);
    assert.doesNotMatch(cjBranch, /clientSid|clientPid|clientAid|clientDestination|clientAdvertiserId/);
    assert.match(cjBranch, /userId,/);
    assert.match(cjBranch, /externalId,/);
    assert.match(cjBranch, /merchant_id: merchantId/);
    assert.match(cjBranch, /product_url: productUrl/);
    assert.match(cjBranch, /is_active: true/);
    assert.match(cjBranch, /is_approved: true/);
    assert.match(cjBranch, /promotionContext: context/);
    assert.match(cjBranch, /resolved\.subid !== subid/);
    assert.match(cjBranch, /CJ_SID_MISMATCH/);
    assert.match(cjBranch, /CjOfferDestinationError/);
    assert.match(cjBranch, /CjPropertyMappingError/);
    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.doesNotMatch(adapter, /buildStableSubId/);
    assert.match(adapter, /resolveStoredCjOfferDestination/);
    assert.match(select, /warriorPlusTrackingMatches/);
    assert.match(select, /BYO_URL_MUST_BE_HTTP/);
    assert.doesNotMatch(indexer, /cjAdapter|connectors\/cjAdapter|createCjTrackingLink/);
    assert.doesNotMatch(go, /cjAdapter/);
    assert.match(go, /assertStoredCjTrackingUrl/);
  });
});
