import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildWarriorPlusLink } from "../affiliate/sources/warriorplus.ts";
import {
  BETA_TRACKING_READY_AUTOMATED_SOURCES,
  customerFacingProductCommission,
  getBetaAutomatedSources,
  isBetaAutomatedSource,
  isBetaManualSource,
  isHttpUrl,
  warriorPlusTrackingMatches,
} from "../affiliate/productSourceReadiness.ts";
import { buildPublicGoOfferUrl } from "./publicAppOrigin.ts";
import { buildStableSubId } from "../affiliate/stableOfferSubId.ts";
import { buildPostsFinalLink } from "../content-optimizer/postsCtaLinks.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Private beta product source policy", () => {
  it("1-2. default automated source is warriorplus and unfinished networks stay out", () => {
    assert.deepEqual(getBetaAutomatedSources(undefined), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources(""), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources("   "), ["warriorplus"]);
    assert.equal(isBetaAutomatedSource("warriorplus", undefined), true);
    for (const source of [
      "cj",
      "awin",
      "aliexpress",
      "digistore",
      "mylead",
      "rakuten",
      "impact",
      "partnerstack",
      "amazon",
      "clickbank",
    ]) {
      assert.equal(isBetaAutomatedSource(source, undefined), false);
    }
  });

  it("3-6. offers search and products search share the beta gate without disabling ingestion", () => {
    const products = read("app/api/products/search/route.ts");
    const offers = read("app/api/offers/search/route.ts");
    const indexer = read("lib/engines/product-indexer/indexer.ts");
    const cron = read("app/api/cron/product-index/route.ts");

    assert.match(products, /\.eq\("is_active", true\)/);
    assert.match(products, /\.eq\("is_approved", true\)/);
    assert.match(products, /getBetaAutomatedSources\(\)/);
    assert.match(products, /const approvedOnly = true/);
    assert.match(offers, /\.eq\("is_active", true\)/);
    assert.match(offers, /\.eq\("is_approved", true\)/);
    assert.match(offers, /getBetaAutomatedSources\(\)/);
    assert.match(offers, /source_not_beta_enabled/);
    assert.match(indexer, /export async function runProductIndexer/);
    assert.match(cron, /runProductIndexer/);
    assert.match(cron, /"warriorplus", "awin", "cj", "aliexpress"/);
  });

  it("1-8. env can only select from the code-owned tracking-ready set", () => {
    assert.deepEqual([...BETA_TRACKING_READY_AUTOMATED_SOURCES], ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources(undefined), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources(null), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources(""), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources("warriorplus"), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources("warriorplus,cj"), ["warriorplus"]);
    assert.deepEqual(getBetaAutomatedSources("cj"), []);
    assert.deepEqual(getBetaAutomatedSources("awin"), []);
    assert.deepEqual(getBetaAutomatedSources("aliexpress"), []);
    assert.equal(isBetaAutomatedSource("cj", "warriorplus,cj"), false);
    assert.equal(isBetaAutomatedSource("awin", "awin"), false);
    assert.equal(isBetaAutomatedSource("aliexpress", "aliexpress,warriorplus"), false);
    assert.equal(isBetaAutomatedSource("warriorplus", "warriorplus,cj"), true);
    assert.equal(isBetaManualSource("byo"), true);
    assert.equal(isBetaAutomatedSource("byo", "byo,warriorplus"), false);
    assert.equal(BETA_TRACKING_READY_AUTOMATED_SOURCES.includes("cj" as "warriorplus"), false);
  });
});

describe("Private beta select authority and WarriorPlus tracking", () => {
  const select = read("app/api/offers/select/route.ts");

  it("7-14. non-BYO save re-reads product_index and ignores client url, title, commission, and userId", () => {
    assert.match(select, /from\("product_index"\)/);
    assert.match(select, /\.eq\("source", source\)/);
    assert.match(select, /\.eq\("external_id", externalId\)/);
    assert.match(select, /indexRow\.is_active !== true/);
    assert.match(select, /indexRow\.is_approved !== true/);
    assert.match(select, /indexRow\.product_url \|\| indexRow\.landing_url/);
    assert.match(select, /safeString\(indexRow\.title\)/);
    assert.match(select, /commission: customerFacingProductCommission\(\)/);
    assert.match(select, /void body\?\.userId/);
    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.match(select, /SOURCE_NOT_BETA_ENABLED/);
    assert.match(select, /requireUserId\(req\)/);
    assert.doesNotMatch(select, /commission: safeNumber\(payload\.commission\)/);
  });

  it("15-20. WarriorPlus destination must carry hop_sid and sid equal to the stable SubID", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const externalId = "wp-offer-9";
    const subid = buildStableSubId(userId, "warriorplus", externalId);
    const again = buildStableSubId(userId, "warriorplus", externalId);
    assert.equal(again, subid);

    const fresh = await buildWarriorPlusLink({
      source: "warriorplus",
      productUrl: "https://warriorplus.com/o2/vendor/offer",
      externalId,
      userId,
      subid,
      context: "reels",
    });
    const freshUrl = new URL(fresh.affiliateLink);
    assert.equal(freshUrl.searchParams.get("hop_sid"), subid);
    assert.equal(freshUrl.searchParams.get("sid"), subid);
    assert.equal(freshUrl.searchParams.get("hop_tid"), "reels");
    assert.equal(warriorPlusTrackingMatches(fresh.affiliateLink, subid), true);

    const preserved = await buildWarriorPlusLink({
      source: "warriorplus",
      productUrl:
        "https://warriorplus.com/o2/vendor/offer?hop_sid=vendor-sid&sid=vendor-sid&hop_tid=vendor-camp",
      externalId,
      userId,
      subid,
      context: "posts",
    });
    const preservedUrl = new URL(preserved.affiliateLink);
    assert.equal(preservedUrl.searchParams.get("hop_sid"), "vendor-sid");
    assert.equal(preservedUrl.searchParams.get("sid"), "vendor-sid");
    assert.equal(preservedUrl.searchParams.get("hop_tid"), "vendor-camp");
    assert.equal(warriorPlusTrackingMatches(preserved.affiliateLink, subid), false);
    assert.match(select, /warriorPlusTrackingMatches\(finalAffiliateLink, finalSubId\)/);
    assert.match(select, /WARRIORPLUS_TRACKING_UNAVAILABLE/);
  });
});

describe("Private beta BYO and content destinations", () => {
  it("21-28. BYO accepts only http(s), keeps the URL, and returns /go/offer", () => {
    assert.equal(isHttpUrl("https://merchant.example/offer?aff=1"), true);
    assert.equal(isHttpUrl("http://merchant.example/offer"), true);
    assert.equal(isHttpUrl("javascript:alert(1)"), false);
    assert.equal(isHttpUrl("data:text/html,hi"), false);
    assert.equal(isHttpUrl("file:///etc/passwd"), false);
    assert.equal(customerFacingProductCommission(), null);

    const select = read("app/api/offers/select/route.ts");
    const go = read("app/go/offer/[savedId]/route.ts");
    assert.match(select, /BYO_URL_MUST_BE_HTTP/);
    assert.match(select, /BYO_URL_REWRITTEN/);
    assert.match(select, /return `\/go\/offer\/\$\{id\}`/);
    assert.match(go, /url\.protocol !== "http:" && url\.protocol !== "https:"/);
    assert.match(go, /offer_click_events/);
    assert.doesNotMatch(go, /if \(clickInsert\.error\) return/);
  });

  it("29-33. Posts and Reels product copy uses /go while recurring and funnel stay direct", () => {
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    const helper = read("lib/content-optimizer/postsCtaLinks.ts");

    assert.match(posts, /buildPublicGoOfferUrl\(savedId\)/);
    assert.doesNotMatch(posts, /https:\/\/autoaffi\.com\/go\/offer\//);
    assert.equal(
      buildPublicGoOfferUrl("saved-1", {
        nodeEnv: "production",
        env: { NEXT_PUBLIC_APP_URL: "https://app.example" },
      }),
      "https://app.example/go/offer/saved-1"
    );
    assert.equal(
      buildPublicGoOfferUrl("saved-1", { nodeEnv: "production", env: {} }),
      ""
    );
    assert.match(posts, /buildDisplayAffiliateLink\(\{/);
    assert.match(reels, /return `\/go\/offer\/\$\{savedId\}`/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /affiliateUrl: funnelUrl/);
    assert.match(helper, /return String\(input\.recurringPromoLink \|\| ""\)\.trim\(\)/);
    assert.match(helper, /return String\(input\.funnelLink \|\| ""\)\.trim\(\)/);

    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "product",
        productAffiliateUrl: "/go/offer/abc",
        recurringPromoLink: "https://example.com/?fp_sid=1",
        funnelLink: "https://funnel.example/optin",
      }),
      "/go/offer/abc"
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "recurring",
        productAffiliateUrl: "/go/offer/abc",
        recurringPromoLink: "https://example.com/?fp_sid=1",
      }),
      "https://example.com/?fp_sid=1"
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
        productAffiliateUrl: "/go/offer/abc",
        funnelLink: "https://funnel.example/optin",
      }),
      "https://funnel.example/optin"
    );
  });
});

describe("Private beta recurring and payout truth", () => {
  it("34-36. Reels recurring UI no longer hardcodes 30, 40, or 50 percent", () => {
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    const panels = read("components/reels/OfferPanels.tsx");
    const mapStart = reels.indexOf("const mapped = all");
    const mapEnd = reels.indexOf("setRecurringPlatforms(mapped)");
    const recurringBlock = reels.slice(mapStart, mapEnd);
    assert.ok(mapStart >= 0 && mapEnd > mapStart);
    assert.doesNotMatch(recurringBlock, /p\.key === "autoaffi"[\s\S]{0,40}\? 50/);
    assert.doesNotMatch(recurringBlock, /\? 40/);
    assert.doesNotMatch(recurringBlock, /\? 30/);
    assert.match(recurringBlock, /commission: null/);
    assert.doesNotMatch(reels, /\$\{p\.commission\}% recurring/);
    assert.doesNotMatch(panels, /\{p\.commission\}% commission/);
    assert.doesNotMatch(panels, /\{p\.commission\}% recurring commission/);
    assert.match(panels, /Commission unavailable/);
    assert.match(panels, /Commission details vary by platform/);

    const recurringPage = read("app/login/dashboard/recurring-income-platforms/page.tsx");
    assert.doesNotMatch(recurringPage, /\d+%/);
    assert.match(recurringPage, /Commission details vary by platform/);
    assert.match(
      read("app/login/dashboard/page.tsx"),
      /badge="Lifetime 50%"/
    );
    assert.match(
      read("app/api/recurring/platforms/route.ts"),
      /requirePublicAppOrigin\(\)/
    );
  });

  it("37-39. missing Systeme and ClickFunnels ids fail closed and valid templates stay", () => {
    const platforms = read("app/api/recurring/platforms/route.ts");
    assert.doesNotMatch(platforms, /\|\| "MASTER_ID_MISSING"/);
    assert.doesNotMatch(platforms, /\|\| "AFF_CODE_MISSING"/);
    assert.match(platforms, /includes\("MASTER_ID_MISSING"\)/);
    assert.match(platforms, /includes\("AFF_CODE_MISSING"\)/);
    assert.match(platforms, /if \(!MASTER\) return null/);
    assert.match(platforms, /if \(!AFF\) return null/);
    assert.match(platforms, /PROMO_LINK_UNAVAILABLE/);
    assert.match(
      platforms,
      /https:\/\/systeme\.io\/\?sa=\$\{encodeURIComponent\(\s*MASTER\s*\)\}&tk=\$\{encodeURIComponent\(tracking\)\}/
    );
    assert.match(platforms, /aff_sub=\$\{encodeURIComponent\(\s*tracking\s*\)\}/);
  });

  it("40-44. payouts page has no mock money and payout plus webhook APIs stay 503", () => {
    const page = read("app/login/dashboard/payouts/page.tsx");
    const payouts = read("app/api/dashboard/payouts/route.ts");
    const webhook = read("app/api/affiliate/webhook/route.ts");
    assert.doesNotMatch(page, /MOCK_PAYOUTS/);
    assert.doesNotMatch(page, /MOCK_INCOMING/);
    assert.doesNotMatch(page, /\$\d/);
    assert.match(page, /Payout tracking is not active yet/);
    assert.match(payouts, /status: 503/);
    assert.match(payouts, /PAYOUTS_DISABLED/);
    assert.match(webhook, /status: 503/);
    assert.match(webhook, /AFFILIATE_WEBHOOK_DISABLED/);
  });

  it("active product discovery does not call fabricated affiliate stub routes", () => {
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

    assert.doesNotMatch(surfaces, /\/api\/affiliate\/(cj|awin|digistore24|impact|partnerstack|rakuten|clickbank|amazon|shareasale|tradedoubler)/);
    assert.match(surfaces, /\/api\/offers\/select/);
    assert.match(surfaces, /\/api\/products\/search/);
    assert.match(read("app/api/offers/select/route.ts"), /buildAffiliateLink\(/);
  });
});
