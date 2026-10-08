import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  toCustomerSavedOffer,
  toCustomerTrackingEventMeta,
} from "../affiliate/cj/customerOffer.ts";
import { cjReviewAllowsSocial } from "../affiliate/cj/eligibility.ts";
import { resolveCjGoClick } from "../affiliate/cj/goClick.ts";
import type { CjPropertyMappingRow } from "../affiliate/cj/propertyMapping.ts";
import {
  filterCjSearchItems,
  prepareCjCustomerSearchItems,
} from "../affiliate/cj/searchGate.ts";
import type { CjSocialAccountSnapshot } from "../affiliate/cj/socialAccountProperty.ts";
import { BETA_TRACKING_READY_AUTOMATED_SOURCES } from "../affiliate/productSourceReadiness.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const userId = "11111111-1111-4111-8111-111111111111";
const advertiserId = "5357356";
const pid = "101896828";
const aid = "12345678";
const subid = "aa_u_abc123__src_cj__of_def456";
const CJ_HOSTS = ["www.jdoqocy.com", "www.kqzyfj.com", "www.tkqlhce.com"] as const;

function account(overrides: Partial<CjSocialAccountSnapshot> = {}): CjSocialAccountSnapshot {
  return {
    id: "social-1",
    user_id: userId,
    platform: "instagram",
    status: "connected",
    username: null,
    meta: { username: "rexing.creator", instagram_id: "1789001" },
    ...overrides,
  };
}

function property(overrides: Partial<CjPropertyMappingRow> = {}): CjPropertyMappingRow {
  return {
    id: "map-1",
    user_id: userId,
    platform: "instagram",
    social_account_id: "social-1",
    social_account_identifier: "instagram:1789001",
    social_media_handle: "rexing.creator",
    cj_social_platform: "INSTAGRAM",
    cj_pid: pid,
    property_type: "SOCIAL_MEDIA",
    status: "ACTIVE",
    ...overrides,
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    advertiser_id: advertiserId,
    status: "allowed",
    permitted_methods: ["social_media"],
    reviewed_by: "ops",
    ...overrides,
  };
}

function storedUrl(options: { host?: string; pid?: string; sid?: string } = {}) {
  const url = new URL(
    `https://${options.host || "www.jdoqocy.com"}/click-${options.pid || pid}-${aid}`
  );
  url.searchParams.set("sid", options.sid || subid);
  return url.toString();
}

function goArgs(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    merchantId: advertiserId,
    affiliateLink: storedUrl(),
    subid,
    account: account(),
    properties: [property()],
    review: review(),
    ...overrides,
  };
}

function searchItems() {
  return [
    { source: "warriorplus", merchant_id: "wp-1", external_id: "wp-offer" },
    { source: "cj", merchant_id: advertiserId, external_id: "cj_5357356_42979911696574" },
    { source: "cj", merchant_id: "999", external_id: "cj_999_1" },
  ];
}

function gateArgs() {
  return {
    canonicalUserId: userId,
    account: account(),
    properties: [property()],
    reviews: [review()],
  };
}

function visibleSearch(context: string | null | undefined) {
  const prepared = prepareCjCustomerSearchItems(searchItems(), context);
  if (!prepared.applyReviewGate) return prepared;
  return {
    applyReviewGate: true,
    items: filterCjSearchItems(prepared.items, gateArgs()),
  };
}

function assertNoCjSecrets(payload: unknown) {
  const json = JSON.stringify(payload);
  for (const host of CJ_HOSTS) {
    assert.equal(json.includes(host), false, host);
  }
  assert.equal(/aa_u_[a-z0-9]+__src_cj__of_[a-z0-9]+/i.test(json), false);
}

describe("CJ beta hardening", () => {
  it("keeps CJ out of the customer-ready source list", () => {
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    const readiness = read("lib/affiliate/productSourceReadiness.ts");
    assert.match(readiness, /BETA_TRACKING_READY_AUTOMATED_SOURCES = \["warriorplus"\]/);
  });

  it("passes CJ into the existing review gate only for posts and affiliate offers", () => {
    for (const context of ["posts", "affiliate_offers", " Posts ", "AFFILIATE_OFFERS"]) {
      const visible = visibleSearch(context);
      assert.equal(visible.applyReviewGate, true);
      assert.deepEqual(
        visible.items.map((item) => `${item.source}:${item.merchant_id}`),
        ["warriorplus:wp-1", `cj:${advertiserId}`]
      );
    }

    const hiddenByGate = filterCjSearchItems(searchItems(), {
      ...gateArgs(),
      reviews: [],
    });
    assert.deepEqual(
      hiddenByGate.map((item) => item.source),
      ["warriorplus"]
    );
  });

  it("strips CJ for reels, a missing context, and an unsupported context", () => {
    for (const context of ["reels", "REELS", null, undefined, "", "tiktok", "facebook"]) {
      const visible = visibleSearch(context);
      assert.equal(visible.applyReviewGate, false);
      assert.deepEqual(
        visible.items.map((item) => item.source),
        ["warriorplus"]
      );
    }
  });

  it("wires search routes and Posts without opening Reels", () => {
    const products = read("app/api/products/search/route.ts");
    const offers = read("app/api/offers/search/route.ts");
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");

    assert.match(products, /const rawSearchContext = searchParams\.get\("context"\)/);
    assert.match(products, /prepareCjCustomerSearchItems\(results, rawSearchContext\)/);
    assert.match(products, /preparedCjSearch\.applyReviewGate/);
    assert.match(products, /applyCjSearchGate\(searchUserId, preparedCjSearch\.items\)/);
    assert.match(offers, /const contextParam = url\.searchParams\.get\("context"\)/);
    assert.match(offers, /prepareCjCustomerSearchItems\(items, contextParam\)/);
    assert.match(offers, /preparedCjSearch\.applyReviewGate/);
    assert.match(offers, /applyCjSearchGate\(userId, preparedCjSearch\.items\)/);
    assert.match(offers, /contextParam \|\| "affiliate_offers"/);
    assert.match(posts, /\/api\/products\/search\?q=/);
    assert.match(posts, /context=posts/);
    assert.doesNotMatch(reels, /context=posts/);
    assert.match(reels, /from: "reels"/);
  });

  it("allows /go only for an allowed review and one matching connected Instagram property", () => {
    const href = storedUrl();
    assert.equal(resolveCjGoClick(goArgs()), href);
    assert.equal(cjReviewAllowsSocial(review(), advertiserId), true);
  });

  it("refuses /go when the review is disabled, missing, mismatched, or not social", () => {
    assert.equal(
      resolveCjGoClick(goArgs({ review: review({ status: "disabled" }) })),
      null
    );
    assert.equal(resolveCjGoClick(goArgs({ review: null })), null);
    assert.equal(
      resolveCjGoClick(
        goArgs({ review: review({ permitted_methods: ["website"] }) })
      ),
      null
    );
    assert.equal(
      resolveCjGoClick(
        goArgs({ review: review({ advertiser_id: "other-advertiser" }) })
      ),
      null
    );
    assert.equal(resolveCjGoClick(goArgs({ merchantId: "" })), null);
  });

  it("refuses /go when Instagram is disconnected, renamed, inactive, ambiguous, or the PID differs", () => {
    assert.equal(resolveCjGoClick(goArgs({ account: null })), null);
    assert.equal(
      resolveCjGoClick(goArgs({ account: account({ status: "disconnected" }) })),
      null
    );
    assert.equal(
      resolveCjGoClick(
        goArgs({
          properties: [property({ social_media_handle: "someone.else" })],
        })
      ),
      null
    );
    assert.equal(
      resolveCjGoClick(goArgs({ properties: [property({ status: "ARCHIVED" })] })),
      null
    );
    assert.equal(
      resolveCjGoClick(goArgs({ properties: [property({ status: "TERMINATED" })] })),
      null
    );
    assert.equal(
      resolveCjGoClick(
        goArgs({
          properties: [property(), property({ id: "map-2", cj_pid: "100125587" })],
        })
      ),
      null
    );
    assert.equal(
      resolveCjGoClick(goArgs({ properties: [property({ cj_pid: "999999" })] })),
      null
    );
  });

  it("refuses an invalid stored CJ URL and never falls back to a merchant URL", () => {
    assert.equal(
      resolveCjGoClick(
        goArgs({ affiliateLink: "https://merchant.example/rexing-m1s" })
      ),
      null
    );
    assert.equal(resolveCjGoClick(goArgs({ affiliateLink: "" })), null);

    const goClick = read("lib/affiliate/cj/goClick.ts");
    const go = read("app/go/offer/[savedId]/route.ts");
    assert.doesNotMatch(goClick, /product_url/);
    assert.doesNotMatch(goClick, /getCJAdvertiserContract|getCJProductClickUrl|fetch\(/);
    assert.match(goClick, /cjReviewAllowsSocial/);
    assert.match(goClick, /eligibleInstagramProperties/);
    const cjGo = go.slice(go.indexOf('=== "cj"'), go.indexOf("return normalizeUrl"));
    assert.doesNotMatch(cjGo, /product_url/);
    assert.doesNotMatch(go, /getCJAdvertiserContract|getCJProductClickUrl|programTerms/);
    assert.match(
      go,
      /return normalizeUrl\(data\.affiliate_link\) \|\| normalizeUrl\(data\.product_url\)/
    );
  });

  it("keeps the successful /go write as one last_used_at update, one click insert, and the stored URL", () => {
    const href = resolveCjGoClick(goArgs());
    assert.equal(href, storedUrl());

    const go = read("app/go/offer/[savedId]/route.ts");
    const destinationAt = go.indexOf("const destination = await resolveGoDestination");
    const updateAt = go.indexOf("last_used_at: now");
    const insertAt = go.indexOf('from("offer_click_events").insert');
    const redirectAt = go.lastIndexOf("NextResponse.redirect(destination");
    assert.ok(destinationAt > 0 && updateAt > destinationAt);
    assert.ok(insertAt > updateAt);
    assert.ok(redirectAt > insertAt);
    assert.equal(go.split('from("offer_click_events").insert').length - 1, 1);
    assert.match(go, /affiliate_link: destination/);
    assert.match(go, /merchant_id/);
    assert.doesNotMatch(go, /if \(clickInsert\.error\) return/);
    assert.doesNotMatch(go, /requireUserId/);
  });

  it("redacts CJ affiliate URLs and SubIDs from primary, pin, and Leads Hub payloads", () => {
    for (const host of CJ_HOSTS) {
      const sid = "aa_u_abc123__src_cj__of_def456";
      const saved = toCustomerSavedOffer({
        id: "saved-cj",
        source: "cj",
        affiliate_link: `https://${host}/click-${pid}-${aid}?sid=${sid}`,
        subid: sid,
        commission: 10,
        epc: 2,
      });
      assertNoCjSecrets(saved);
      assert.equal(saved.affiliate_link, null);
      assert.equal(saved.subid, null);
      assert.equal(saved.commission, null);
      assert.equal(saved.epc, null);
      assert.equal(saved.display_link, "/go/offer/saved-cj");

      const meta = toCustomerTrackingEventMeta({
        source: "cj",
        subid: sid,
        affiliate_link: `https://${host}/click-${pid}-${aid}?sid=${sid}`,
        offer_id: "saved-cj",
      });
      assertNoCjSecrets(meta);
      assert.equal("subid" in meta, false);
      assert.equal("affiliate_link" in meta, false);
      assert.equal(meta.offer_id, "saved-cj");
    }

    const warrior = toCustomerSavedOffer({
      id: "saved-wp",
      source: "warriorplus",
      affiliate_link: "https://warriorplus.com/o/offer?sid=keep-me",
      subid: "keep-me",
      commission: 10,
      epc: 2,
    });
    assert.equal(warrior.affiliate_link, "https://warriorplus.com/o/offer?sid=keep-me");
    assert.equal(warrior.subid, "keep-me");
    assert.equal(warrior.commission, 10);

    const warriorMeta = toCustomerTrackingEventMeta({
      source: "warriorplus",
      subid: "keep-me",
      affiliate_link: "https://warriorplus.com/o/offer",
    });
    assert.equal(warriorMeta.subid, "keep-me");
    assert.equal(warriorMeta.affiliate_link, "https://warriorplus.com/o/offer");

    const primary = read("app/api/offers/primary/route.ts");
    const pin = read("app/api/affiliate/products/pin/route.ts");
    const leads = read("app/api/leads-hub/overview/route.ts");
    assert.match(primary, /toCustomerSavedOffer\(data as/);
    assert.match(primary, /toCustomerSavedOffer\(\s*setRes\.data as/);
    assert.match(pin, /toCustomerSavedOffer\(\s*updateRes\.data as/);
    assert.match(leads, /toCustomerTrackingEventMeta\(/);
  });
});
