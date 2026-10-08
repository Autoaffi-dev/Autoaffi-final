import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  customerFacingProductCommission,
  getBetaAutomatedSources,
} from "../affiliate/productSourceReadiness.ts";
import { buildStableSubId } from "../affiliate/stableOfferSubId.ts";
import { CJ_PRODUCT_FEED_ENDPOINT } from "../affiliate/cj/config.ts";
import { toCustomerSavedOffer } from "../affiliate/cj/customerOffer.ts";
import { CjOfferDestinationError, resolveCjOfferDestination } from "../affiliate/cj/resolveCjOfferDestination.ts";
import { CJ_PRODUCT_CLICK_QUERY, getCJProductClickUrl } from "../affiliate/cj/linkCode.ts";
import { selectCjGoInstagramProperty } from "../affiliate/cj/goProperty.ts";
import {
  eligiblePostsSavedOffer,
  eligiblePostsSearchOffer,
  postsEligibleGoOfferId,
  postsProductSyncKey,
} from "../affiliate/cj/postsOfferEligibility.ts";
import { eligibleInstagramProperties, filterCjSearchItems } from "../affiliate/cj/searchGate.ts";
import { assertStoredCjTrackingUrl, finalizeCjTrackingUrl } from "../affiliate/cj/trackingUrl.ts";
import type { CjAdvertiserContract } from "../affiliate/cj/programTerms.ts";
import { CjPropertyMappingError, type CjPropertyMappingRow } from "../affiliate/cj/propertyMapping.ts";
import type { CjSocialAccountSnapshot } from "../affiliate/cj/socialAccountProperty.ts";

const root = path.resolve(import.meta.dirname, "../..");

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

function property(overrides: Partial<CjPropertyMappingRow> = {}): CjPropertyMappingRow {
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
    ...overrides,
  };
}

function contract(advertiserId = "42", status = "ACTIVE"): CjAdvertiserContract {
  return {
    advertiserId,
    contractStatus: status,
    programTermsId: "pt-1",
    programTermsName: "Default",
    startTime: null,
    endTime: null,
    isActive: status === "ACTIVE",
    commissions: [],
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    advertiser_id: "42",
    status: "allowed",
    permitted_methods: ["social_media"],
    ...overrides,
  };
}

function clickUrl(options: { pid?: string; aid?: string; sid?: string; host?: string; protocol?: string } = {}) {
  const host = options.host || "www.kqzyfj.com";
  const protocol = options.protocol || "https:";
  const url = new URL(`${protocol}//${host}/click-${options.pid || pid}-${options.aid || aid}`);
  if (options.sid) url.searchParams.set("sid", options.sid);
  return url.toString();
}

function feedResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      products: {
        resultList: [
          {
            id: "sku900",
            advertiserId: "42",
            linkCode: {
              clickUrl: clickUrl({ sid: buildStableSubId(userId, "cj", externalId) }),
            },
            ...overrides,
          },
        ],
      },
    },
  };
}

function fetchImpl(body: unknown, onRequest?: (raw: string, init: RequestInit) => void): typeof fetch {
  return async (url, init) => {
    onRequest?.(String(url), init || {});
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    canonicalUserId: userId,
    indexRow: {
      source: "cj",
      external_id: externalId,
      merchant_id: "42",
      product_url: "https://shop.example/item",
      is_active: true,
      is_approved: true,
    },
    promotionContext: "affiliate_offers",
    account: account(),
    properties: [property()],
    contract: contract(),
    review: review(),
    pat: "test-pat",
    companyId: "1111111",
    fetchImpl: fetchImpl(feedResponse()),
    clientAdvertiserId: "999",
    clientPid: "000",
    clientAid: "111",
    clientDestination: "https://evil.example/steal",
    clientSid: "client-sid",
    ...overrides,
  };
}

describe("CJ phase 2 official click foundation", () => {
  it("1-2. CJ stays out of the tracking-ready list and env cannot enable it", () => {
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    assert.equal(getBetaAutomatedSources("cj").includes("cj"), false);
    assert.deepEqual(getBetaAutomatedSources("warriorplus,cj"), ["warriorplus"]);
    const select = read("app/api/offers/select/route.ts");
    const gate = select.indexOf('error: "SOURCE_NOT_BETA_ENABLED"');
    const call = select.indexOf("await cjAdapter.createTrackingLink");
    assert.ok(gate >= 0 && call > gate);
  });

  it("3. Product Feed client uses the official endpoint and bearer PAT", async () => {
    assert.equal(CJ_PRODUCT_FEED_ENDPOINT, "https://ads.api.cj.com/query");
    assert.match(CJ_PRODUCT_CLICK_QUERY, /\$shopperId/);
    assert.match(CJ_PRODUCT_CLICK_QUERY, /linkCode\(pid: \$pid, shopperId: \$shopperId\)/);
    assert.match(CJ_PRODUCT_CLICK_QUERY, /clickUrl/);
    assert.doesNotMatch(CJ_PRODUCT_CLICK_QUERY, /cjsku/);
    const sid = buildStableSubId(userId, "cj", externalId);
    let auth = "";
    let seenUrl = "";
    let variables: any = null;
    await getCJProductClickUrl({
      pat: "test-pat",
      companyId: "1111111",
      advertiserId: "42",
      productId: "sku900",
      promotionalPropertyId: pid,
      shopperId: sid,
      fetchImpl: fetchImpl(feedResponse(), (url, init) => {
        seenUrl = url;
        auth = String((init.headers as Record<string, string>).Authorization || "");
        variables = JSON.parse(String(init.body)).variables;
        assert.equal(String(init.body).includes("test-pat"), false);
      }),
    });
    assert.equal(seenUrl, "https://ads.api.cj.com/query");
    assert.equal(auth, "Bearer test-pat");
    assert.equal(variables.shopperId, sid);
    let fetched = false;
    await assert.rejects(
      getCJProductClickUrl({
        pat: "test-pat",
        companyId: "1111111",
        advertiserId: "42",
        productId: "sku900",
        promotionalPropertyId: pid,
        shopperId: "   ",
        fetchImpl: async () => {
          fetched = true;
          throw new Error("shopperId request must not be sent");
        },
      }),
      (err: unknown) => err instanceof Error && err.message === "CJ_TRACKING_URL_INVALID"
    );
    assert.equal(fetched, false);
  });

  it("4-8. product identity and tracking ids come from the server, not the client", async () => {
    let variables: any = null;
    const resolved = await resolveCjOfferDestination(
      baseArgs({
        fetchImpl: fetchImpl(feedResponse(), (_url, init) => {
          variables = JSON.parse(String(init.body)).variables;
        }),
      }) as any
    );
    const sid = buildStableSubId(userId, "cj", externalId);
    assert.equal(variables.partnerIds[0], "42");
    assert.equal(variables.productIds[0], "sku900");
    assert.equal(variables.pid, pid);
    assert.equal(variables.companyId, "1111111");
    assert.equal(variables.shopperId, sid);
    assert.notEqual(variables.shopperId, "client-sid");
    assert.equal(resolved.subid, sid);
    assert.equal(resolved.advertiserId, "42");
    assert.equal(resolved.productId, "sku900");
    assert.equal(resolved.cjPid, pid);
    assert.deepEqual(new URL(resolved.affiliateLink).searchParams.getAll("sid"), [sid]);
    assert.equal(resolved.affiliateLink.includes("evil.example"), false);
    assert.equal(resolved.affiliateLink.includes("client-sid"), false);
  });

  it("9. user A cannot use user B's property", async () => {
    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({
          properties: [property({ user_id: "user-b", social_account_identifier: "instagram:999" })],
        }) as any
      ),
      (err: unknown) =>
        err instanceof CjPropertyMappingError && err.code === "CJ_PID_OWNED_BY_ANOTHER_USER"
    );
  });

  it("10. zero eligible properties fail", async () => {
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ properties: [] }) as any),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROPERTY_MISSING"
    );
  });

  it("11. an inactive property fails", async () => {
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ properties: [property({ status: "ARCHIVED" })] }) as any),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROPERTY_INACTIVE"
    );
  });

  it("12. more than one eligible property fails", async () => {
    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({
          properties: [property(), property({ id: "map-2", cj_pid: "100125587" })],
        }) as any
      ),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROPERTY_AMBIGUOUS"
    );
  });

  it("13-17. review, method, and contract mismatches fail closed", async () => {
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ review: null }) as any),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROGRAM_NOT_REVIEWED"
    );
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ review: review({ status: "disabled" }) }) as any),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROGRAM_DISABLED"
    );
    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({ review: review({ permitted_methods: ["website"] }) }) as any
      ),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_METHOD_NOT_ALLOWED"
    );
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ contract: contract("42", "EXPIRED") }) as any),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_CONTRACT_NOT_ACTIVE"
    );
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ contract: contract("7") }) as any),
      (err: unknown) =>
        err instanceof CjOfferDestinationError && err.code === "CJ_CONTRACT_ADVERTISER_MISMATCH"
    );
  });

  it("18-19. a Product Feed row must match the indexed product and returns clickUrl", async () => {
    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({
          fetchImpl: fetchImpl(feedResponse({ advertiserId: "99" })),
        }) as any
      ),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PRODUCT_MISMATCH"
    );

    const resolved = await resolveCjOfferDestination(baseArgs() as any);
    assert.match(resolved.affiliateLink, /^https:\/\/www\.kqzyfj\.com\/click-100125586-11470088/);
    assert.equal(customerFacingProductCommission(), null);
  });

  it("20-25. tracking URL validation rejects unsafe hosts, merchants, placeholders, and the wrong PID", () => {
    const sid = buildStableSubId(userId, "cj", externalId);
    assert.throws(() =>
      finalizeCjTrackingUrl({
        clickUrl: clickUrl({ protocol: "http:" }),
        expectedPid: pid,
        expectedSid: sid,
      })
    );
    assert.throws(() =>
      finalizeCjTrackingUrl({
        clickUrl: clickUrl({ host: "evilcj.com" }),
        expectedPid: pid,
        expectedSid: sid,
      })
    );
    assert.throws(() =>
      finalizeCjTrackingUrl({
        clickUrl: "https://shop.example/item",
        expectedPid: pid,
        expectedSid: sid,
        merchantUrl: "https://shop.example/item",
      })
    );
    assert.throws(() =>
      finalizeCjTrackingUrl({
        clickUrl: "https://www.anrdoezrs.net/click-XXXXXXX-123",
        expectedPid: pid,
        expectedSid: sid,
      })
    );
    assert.throws(() =>
      finalizeCjTrackingUrl({
        clickUrl: clickUrl({ aid: "00000000" }),
        expectedPid: pid,
        expectedSid: sid,
      })
    );
    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: clickUrl({ pid: "999" }),
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_TRACKING_PID_MISMATCH"
    );
  });

  it("26-30. official sid is required exactly, and cjsku is not product identity", () => {
    const sid = buildStableSubId(userId, "cj", externalId);
    const official = clickUrl({ sid });
    const kept = finalizeCjTrackingUrl({
      clickUrl: official,
      expectedPid: pid,
      expectedSid: sid,
    });
    assert.equal(kept, official);
    assert.deepEqual(new URL(kept).searchParams.getAll("sid"), [sid]);

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: clickUrl(),
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
    );

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: clickUrl({ sid: "other-sid" }),
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
    );

    for (const duplicate of [
      `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}&sid=other`,
      `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}&sid=${sid}`,
    ]) {
      assert.throws(
        () =>
          finalizeCjTrackingUrl({
            clickUrl: duplicate,
            expectedPid: pid,
            expectedSid: sid,
          }),
        (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
      );
    }

    const resolvedSid = buildStableSubId(userId, "cj", externalId);
    assert.equal(resolvedSid.includes("_"), true);
    assert.equal(resolvedSid.length < 64, true);
    const linkCode = read("lib/affiliate/cj/linkCode.ts");
    const tracking = read("lib/affiliate/cj/trackingUrl.ts");
    assert.doesNotMatch(linkCode, /cjsku/);
    assert.doesNotMatch(linkCode, /shopperId is not the publisher SID/);
    assert.match(tracking, /cjsku is not treated as the product id/);
    assert.doesNotMatch(tracking, /SID is appended/);
  });

  it("31-34. customers receive /go only, and CJ clicks cannot use the merchant URL", () => {
    const offer = toCustomerSavedOffer({
      id: "saved-1",
      source: "cj",
      affiliate_link: clickUrl(),
      subid: "aa_u_secret",
      commission: 12,
      epc: 4,
    });
    assert.equal(offer.display_link, "/go/offer/saved-1");
    assert.equal(offer.affiliate_link, null);
    assert.equal(offer.subid, null);
    assert.equal(offer.commission, null);
    assert.equal(offer.epc, null);

    const affiliate = read("app/login/dashboard/affiliate/page.tsx");
    assert.match(affiliate, /\/go\/offer\/\$\{o\.id\}/);
    assert.match(affiliate, /CJ offers are not available yet/);
    assert.match(affiliate, /CJ · Instagram/);
    assert.doesNotMatch(affiliate, /\/api\/affiliate\/cj/);

    const bridge = read("app/offer/[savedId]/page.tsx");
    assert.match(bridge, /=== "cj" \? null : safeUrl\(offer\.product_url\)/);

    const go = read("app/go/offer/[savedId]/route.ts");
    const goClick = read("lib/affiliate/cj/goClick.ts");
    const cjGo = go.slice(go.indexOf('=== "cj"'), go.indexOf("return normalizeUrl"));
    assert.match(cjGo, /resolveCjGoClick/);
    assert.match(goClick, /assertStoredCjTrackingUrl/);
    assert.doesNotMatch(cjGo, /product_url/);
    assert.doesNotMatch(goClick, /product_url/);
  });

  it("35-38. Posts may request Instagram, and Reels cannot infer a CJ property", async () => {
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    assert.match(posts, /promotionPlatform: platform/);
    assert.match(posts, /buildPublicGoOfferUrl\(savedId\)/);

    const instagram = await resolveCjOfferDestination(
      baseArgs({ promotionContext: "posts", promotionPlatform: "instagram" }) as any
    );
    assert.equal(instagram.trackingLabel, "CJ · Instagram");

    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({ promotionContext: "posts", promotionPlatform: "tiktok" }) as any
      ),
      (err: unknown) =>
        err instanceof CjOfferDestinationError && err.code === "CJ_PROMOTION_PLATFORM_UNSUPPORTED"
    );

    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    assert.doesNotMatch(reels, /promotionPlatform/);
    assert.doesNotMatch(reels, /synced product tracking/);
    await assert.rejects(
      resolveCjOfferDestination(baseArgs({ promotionContext: "reels" }) as any),
      (err: unknown) =>
        err instanceof CjOfferDestinationError && err.code === "CJ_PROMOTION_PLATFORM_REQUIRED"
    );
  });

  it("39-42. commission and EPC stay unavailable, and the stub and buildCJLink are not the save path", () => {
    assert.equal(customerFacingProductCommission(), null);
    const select = read("app/api/offers/select/route.ts");
    assert.match(select, /commission: customerFacingProductCommission\(\)/);
    assert.match(select, /epc: null/);
    assert.doesNotMatch(select, /buildCJLink/);
    assert.match(select, /source === "cj"[\s\S]{0,900}cjAdapter\.createTrackingLink/);
    assert.doesNotMatch(select, /resolveStoredCjOfferDestination/);
    const surfaces = [
      "app/login/dashboard/affiliate/page.tsx",
      "app/api/offers/select/route.ts",
      "app/api/products/search/route.ts",
      "app/login/dashboard/content-optimizer/posts/page.tsx",
      "app/login/dashboard/content-optimizer/reels/page.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(surfaces, /\/api\/affiliate\/cj/);
    const affiliate = read("app/login/dashboard/affiliate/page.tsx");
    assert.match(affiliate, /EPC: Unavailable/);
    assert.match(affiliate, /Commission: Unavailable/);
  });

  it("43-45. WarriorPlus, BYO, and conversion/payout paths stay unchanged", () => {
    const select = read("app/api/offers/select/route.ts");
    assert.match(select, /warriorPlusTrackingMatches/);
    assert.match(select, /BYO_URL_MUST_BE_HTTP/);
    assert.match(select, /buildAffiliateLink\(\{/);
    const webhook = read("app/api/affiliate/webhook/route.ts");
    assert.match(webhook, /AFFILIATE_WEBHOOK_DISABLED/);
    const payouts = read("app/api/dashboard/payouts/route.ts");
    assert.match(payouts, /PAYOUTS_DISABLED/);
  });

  it("A-P. index, property metadata, port, SID, click path, and unknown errors fail closed", async () => {
    const sid = buildStableSubId(userId, "cj", externalId);
    const index = baseArgs().indexRow as Record<string, unknown>;

    for (const isActive of [undefined, null, false, "true"]) {
      await assert.rejects(
        resolveCjOfferDestination(baseArgs({ indexRow: { ...index, is_active: isActive } }) as any),
        (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PRODUCT_MISMATCH"
      );
    }
    for (const isApproved of [undefined, null, false, "yes"]) {
      await assert.rejects(
        resolveCjOfferDestination(
          baseArgs({ indexRow: { ...index, is_approved: isApproved } }) as any
        ),
        (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PRODUCT_MISMATCH"
      );
    }

    const approved = await resolveCjOfferDestination(
      baseArgs({ indexRow: { ...index, is_active: true, is_approved: true } }) as any
    );
    assert.equal(approved.productId, "sku900");

    const propertyArgs = {
      canonicalUserId: userId,
      account: account(),
      properties: [property()],
    };
    assert.equal(eligibleInstagramProperties(propertyArgs).length, 1);
    assert.equal(
      eligibleInstagramProperties({
        ...propertyArgs,
        properties: [property({ property_type: "WEBSITE" })],
      }).length,
      0
    );
    assert.equal(
      eligibleInstagramProperties({
        ...propertyArgs,
        properties: [property({ cj_social_platform: "TIKTOK" })],
      }).length,
      0
    );
    assert.equal(
      eligibleInstagramProperties({
        ...propertyArgs,
        properties: [property({ social_media_handle: "other.creator" })],
      }).length,
      0
    );
    assert.equal(
      eligibleInstagramProperties({
        ...propertyArgs,
        properties: [property({ social_media_handle: "@Linus.Creator" })],
      }).length,
      1
    );

    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({ properties: [property({ property_type: "WEBSITE" })] }) as any
      ),
      (err: unknown) => err instanceof CjOfferDestinationError && err.code === "CJ_PROPERTY_MISSING"
    );

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: `https://www.kqzyfj.com:8443/click-${pid}-${aid}`,
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_TRACKING_URL_INVALID"
    );

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: `https://www.kqzyfj.com/click-${pid}-${aid}`,
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
    );
    assert.throws(
      () => assertStoredCjTrackingUrl(`https://www.kqzyfj.com/click-${pid}-${aid}`, sid),
      (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
    );

    const official = `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}`;
    const kept = finalizeCjTrackingUrl({
      clickUrl: official,
      expectedPid: pid,
      expectedSid: sid,
    });
    assert.equal(kept, official);
    assert.deepEqual(new URL(kept).searchParams.getAll("sid"), [sid]);
    assert.equal(assertStoredCjTrackingUrl(kept, sid).pid, pid);

    for (const duplicate of [
      `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}&sid=other`,
      `https://www.kqzyfj.com/click-${pid}-${aid}?sid=${sid}&sid=${sid}`,
    ]) {
      assert.throws(
        () =>
          finalizeCjTrackingUrl({
            clickUrl: duplicate,
            expectedPid: pid,
            expectedSid: sid,
          }),
        (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
      );
      assert.throws(
        () => assertStoredCjTrackingUrl(duplicate, sid),
        (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
      );
    }

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: `https://www.kqzyfj.com/click-${pid}-${aid}?sid=other-sid`,
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_SID_MISMATCH"
    );

    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: `https://www.kqzyfj.com/click-${pid}-${aid}-123`,
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_TRACKING_URL_INVALID"
    );
    assert.throws(
      () =>
        finalizeCjTrackingUrl({
          clickUrl: `https://www.kqzyfj.com/click-${pid}-00000000`,
          expectedPid: pid,
          expectedSid: sid,
        }),
      (err: unknown) => err instanceof Error && err.message === "CJ_TRACKING_URL_INVALID"
    );

    await assert.rejects(
      resolveCjOfferDestination(
        baseArgs({
          fetchImpl: async () => {
            throw new Error("secret upstream detail");
          },
        }) as any
      ),
      (err: unknown) =>
        err instanceof CjOfferDestinationError &&
        err.code === "CJ_TRACKING_URL_INVALID" &&
        err.message === "CJ_TRACKING_URL_INVALID" &&
        !err.message.includes("secret")
    );
  });

  it("go accepts one ACTIVE SOCIAL_MEDIA Instagram property and rejects the rest", () => {
    const row = {
      user_id: userId,
      platform: "instagram",
      status: "ACTIVE",
      cj_pid: pid,
      property_type: "SOCIAL_MEDIA",
      cj_social_platform: "INSTAGRAM",
    };
    assert.equal(
      selectCjGoInstagramProperty({ userId, expectedPid: pid, rows: [row] })?.cj_pid,
      pid
    );
    assert.equal(
      selectCjGoInstagramProperty({
        userId,
        expectedPid: pid,
        rows: [{ ...row, property_type: "WEBSITE" }],
      }),
      null
    );
    assert.equal(
      selectCjGoInstagramProperty({
        userId,
        expectedPid: pid,
        rows: [{ ...row, cj_social_platform: "TIKTOK" }],
      }),
      null
    );
    assert.equal(
      selectCjGoInstagramProperty({
        userId,
        expectedPid: pid,
        rows: [{ ...row, status: "ARCHIVED" }],
      }),
      null
    );
    assert.equal(
      selectCjGoInstagramProperty({
        userId,
        expectedPid: pid,
        rows: [{ ...row, cj_pid: "999" }],
      }),
      null
    );
    assert.equal(
      selectCjGoInstagramProperty({
        userId,
        expectedPid: pid,
        rows: [row, { ...row, cj_pid: "100125587" }],
      }),
      null
    );

    const go = read("app/go/offer/[savedId]/route.ts");
    const cjGo = go.slice(go.indexOf('=== "cj"'), go.indexOf("return normalizeUrl"));
    assert.match(cjGo, /property_type,cj_social_platform/);
    assert.match(cjGo, /resolveCjGoClick/);
    assert.match(cjGo, /cj_program_reviews/);
    assert.doesNotMatch(cjGo, /selectCjGoInstagramProperty/);
    assert.doesNotMatch(cjGo, /product_url/);
    assert.doesNotMatch(cjGo, /getCJProductClickUrl|getCJAdvertiserContract|buildCJLink/);
    assert.match(
      go,
      /return normalizeUrl\(data\.affiliate_link\) \|\| normalizeUrl\(data\.product_url\)/
    );
  });

  it("A-O. Affiliate Offers, Posts, and Reels fail closed on the client", () => {
    const affiliate = read("app/login/dashboard/affiliate/page.tsx");
    const disabled = affiliate.slice(
      affiliate.indexOf('reason === "source_not_beta_enabled"'),
      affiliate.indexOf("const items: SearchItem[]")
    );
    assert.match(disabled, /CJ offers are not available yet/);
    const emptyStart = affiliate.indexOf("if (!items.length)");
    const empty = affiliate.slice(
      emptyStart,
      affiliate.indexOf("} catch (e: any)", emptyStart)
    );
    assert.match(
      empty,
      /No results found\. Try another keyword or switch source\/category\./
    );
    assert.doesNotMatch(empty, /not available yet/);

    const externalId = "cj_42_sku900";
    assert.equal(
      postsProductSyncKey({ source: "CJ", externalId, platform: "instagram" }),
      `cj:${externalId}:instagram`
    );
    assert.notEqual(
      postsProductSyncKey({ source: "cj", externalId, platform: "instagram" }),
      postsProductSyncKey({ source: "cj", externalId, platform: "tiktok" })
    );
    assert.equal(
      postsProductSyncKey({
        source: "WarriorPlus",
        externalId: "wp-1",
        platform: "tiktok",
      }),
      "WarriorPlus:wp-1"
    );

    const cjOffer = { id: "saved-cj", source: "cj" };
    const warriorOffer = { id: "saved-wp", source: "warriorplus" };
    assert.equal(eligiblePostsSavedOffer(cjOffer, "instagram")?.id, "saved-cj");
    assert.equal(eligiblePostsSearchOffer(cjOffer, { platform: "Instagram" }), null);
    for (const platform of ["tiktok", "facebook", "youtube"]) {
      assert.equal(eligiblePostsSavedOffer(cjOffer, platform), null);
      assert.equal(eligiblePostsSearchOffer(cjOffer, { platform })?.id, undefined);
      assert.equal(
        postsEligibleGoOfferId({
          selectedSearchSavedOffer: cjOffer,
          platform,
        }),
        ""
      );
      assert.equal(
        postsEligibleGoOfferId({
          activeVaultOffer: cjOffer,
          platform,
        }),
        ""
      );
    }
    assert.equal(
      postsEligibleGoOfferId({
        selectedSearchSavedOffer: cjOffer,
        platform: "instagram",
      }),
      ""
    );
    assert.equal(
      postsEligibleGoOfferId({
        activeVaultOffer: cjOffer,
        platform: "instagram",
      }),
      "saved-cj"
    );
    assert.equal(
      postsEligibleGoOfferId({
        selectedSearchSavedOffer: warriorOffer,
        activeVaultOffer: cjOffer,
        platform: "youtube",
      }),
      ""
    );
    assert.equal(eligiblePostsSavedOffer(warriorOffer, "facebook")?.id, "saved-wp");
    assert.equal(
      postsEligibleGoOfferId({
        selectedSearchSavedOffer: warriorOffer,
        selectedProductSource: "cj",
        platform: "tiktok",
      }),
      ""
    );

    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    const syncStart = posts.indexOf("const syncSelectedProductToOfferCenter");
    const syncEnd = posts.indexOf("useEffect(() => {\n    if (", syncStart);
    const sync = posts.slice(syncStart, syncEnd);
    const syncCatch = sync.slice(sync.lastIndexOf("} catch"));
    assert.match(sync, /postsProductSyncKey/);
    assert.match(syncCatch, /setSelectedSearchSavedOffer\(null\)/);
    assert.match(syncCatch, /setLastSyncedProductKey\(""\)/);
    assert.match(syncCatch, /cjCustomerMessage/);
    assert.match(posts, /eligibleActiveVaultOffer/);
    assert.match(posts, /eligibleSelectedSearchOffer/);
    assert.match(posts, /productAffiliateUrl/);
    assert.match(posts, /trackingReady: Boolean\(eligibleSelectedSearchOffer\?\.id\)/);
    assert.match(posts, /CJ_PROMOTION_PLATFORM_UNSUPPORTED/);

    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    const reelsStart = reels.indexOf("const syncSelectedProductForReels");
    const reelsEnd = reels.indexOf("let isMounted", reelsStart);
    const reelsSync = reels.slice(reelsStart, reelsEnd);
    const reelsCatch = reelsSync.slice(reelsSync.lastIndexOf("} catch"));
    assert.match(reelsCatch, /setSelectedSearchSavedOffer\(null\)/);
    assert.match(reelsCatch, /setLastSyncedProductKey\(""\)/);
    assert.match(reelsSync, /from: "reels"/);
    assert.doesNotMatch(reels, /promotionPlatform/);
    assert.doesNotMatch(reels, /pickPreferredTrackingLink/);
    assert.doesNotMatch(reels, /synced product tracking/);
  });

  it("search offer must match the selected product before it can drive a link", () => {
    const warriorA = { id: "saved-wp-a", source: "warriorplus", external_id: "wp-a" };
    const cjA = { id: "saved-cj-a", source: "cj", external_id: "cj-a" };
    const cjB = { id: "saved-cj-b", source: "CJ", external_id: "cj-b" };

    assert.equal(
      eligiblePostsSearchOffer(warriorA, {
        platform: "instagram",
        selectedProductSource: "cj",
        selectedProductExternalId: "cj-b",
      }),
      null
    );
    assert.equal(
      eligiblePostsSearchOffer(cjA, {
        platform: "instagram",
        selectedProductSource: "cj",
        selectedProductExternalId: "cj-b",
      }),
      null
    );
    assert.equal(
      eligiblePostsSearchOffer(cjB, {
        platform: "instagram",
        selectedProductSource: "cj",
        selectedProductExternalId: "cj-b",
      })?.id,
      "saved-cj-b"
    );
    assert.equal(
      eligiblePostsSearchOffer(cjB, {
        platform: "tiktok",
        selectedProductSource: "cj",
        selectedProductExternalId: "cj-b",
      }),
      null
    );
    assert.equal(
      eligiblePostsSearchOffer(warriorA, {
        platform: "tiktok",
        selectedProductSource: "WarriorPlus",
        selectedProductExternalId: "wp-a",
      })?.id,
      "saved-wp-a"
    );
    assert.equal(
      eligiblePostsSearchOffer(warriorA, {
        platform: "instagram",
        selectedProductSource: "warriorplus",
        selectedProductExternalId: "wp-b",
      }),
      null
    );

    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    assert.match(posts, /selectedProductExternalId: selectedProduct\?\.external_id/);
    assert.match(posts, /setSelectedSearchSavedOffer\(null\)/);
  });

  it("a search offer with no selected product cannot drive a link", () => {
    const warriorA = { id: "saved-wp-a", source: "warriorplus", external_id: "wp-a" };
    const cjB = { id: "saved-cj-b", source: "cj", external_id: "cj-b" };

    assert.equal(
      eligiblePostsSearchOffer(warriorA, { platform: "instagram" }),
      null
    );
    assert.equal(
      eligiblePostsSearchOffer(cjB, { platform: "instagram", selectedProductSource: "   " }),
      null
    );
    assert.equal(
      postsEligibleGoOfferId({
        selectedSearchSavedOffer: warriorA,
        platform: "instagram",
      }),
      ""
    );
    assert.equal(
      postsEligibleGoOfferId({
        selectedSearchSavedOffer: cjB,
        platform: "instagram",
      }),
      ""
    );
    assert.equal(
      eligiblePostsSearchOffer(warriorA, {
        platform: "youtube",
        selectedProductSource: "warriorplus",
        selectedProductExternalId: "wp-a",
      })?.id,
      "saved-wp-a"
    );
    assert.equal(
      eligiblePostsSearchOffer(cjB, {
        platform: "instagram",
        selectedProductSource: "cj",
        selectedProductExternalId: "cj-b",
      })?.id,
      "saved-cj-b"
    );
    assert.equal(eligiblePostsSavedOffer(warriorA, "facebook")?.id, "saved-wp-a");
    assert.equal(eligiblePostsSavedOffer(cjB, "instagram")?.id, "saved-cj-b");
    assert.equal(eligiblePostsSavedOffer(cjB, "tiktok"), null);
    assert.equal(
      postsEligibleGoOfferId({
        activeVaultOffer: cjB,
        platform: "instagram",
      }),
      "saved-cj-b"
    );
  });

  it("search hides CJ unless the advertiser is allowed and one Instagram property is eligible", () => {
    const items = [
      { source: "warriorplus", merchant_id: "wp" },
      { source: "cj", merchant_id: "42" },
      { source: "cj", merchant_id: "7" },
    ];
    const visible = filterCjSearchItems(items, {
      canonicalUserId: userId,
      account: account(),
      properties: [property()],
      reviews: [review()],
    });
    assert.deepEqual(
      visible.map((item) => item.merchant_id),
      ["wp", "42"]
    );

    const hidden = filterCjSearchItems(items, {
      canonicalUserId: userId,
      account: account(),
      properties: [],
      reviews: [review()],
    });
    assert.deepEqual(hidden.map((item) => item.source), ["warriorplus"]);
  });
});
