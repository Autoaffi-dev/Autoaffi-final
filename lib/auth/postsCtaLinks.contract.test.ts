import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildPostsFinalLink,
  resolvePostsCtaOfferType,
} from "../content-optimizer/postsCtaLinks.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const postsRel = "app/login/dashboard/content-optimizer/posts/page.tsx";
const helperRel = "lib/content-optimizer/postsCtaLinks.ts";
const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const offersSelectRel = "app/api/offers/select/route.ts";
const subidRel = "lib/affiliate/subid.ts";
const platformsRel = "app/api/recurring/platforms/route.ts";
const funnelsRepoRel = "lib/user-funnels/repo.ts";

describe("Posts CTA link correctness", () => {
  it("1. Product final-link path copies /go/offer and not the raw affiliate URL", () => {
    const posts = read(postsRel);
    const helper = read(helperRel);

    assert.match(posts, /productAffiliateUrl/);
    assert.match(posts, /buildDisplayAffiliateLink\(\{/);
    assert.match(posts, /buildPublicGoOfferUrl\(savedId\)/);
    assert.doesNotMatch(posts, /https:\/\/autoaffi\.com\/go\/offer\//);
    assert.doesNotMatch(
      posts,
      /activeVaultOffer\?\.affiliate_link \|\|\s*\n\s*activeVaultOffer\?\.product_url/
    );
    assert.match(helper, /if \(input\.offerType === "product"\)/);
    assert.match(helper, /return input\.productAffiliateUrl \|\| ""/);

    const goUrl = "https://app.example/go/offer/saved-1";
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "product",
        productAffiliateUrl: goUrl,
        recurringPromoLink: "https://systeme.io/?sa=x&tk=y",
        funnelLink: "https://my-funnel.example/optin",
      }),
      goUrl
    );
  });

  it("2-3. Posts no longer fabricates /f/ and funnel destination is funnelLink/funnel_url", () => {
    const posts = read(postsRel);
    const helper = read(helperRel);

    assert.doesNotMatch(posts, /https:\/\/autoaffi\.io\/f\//);
    assert.doesNotMatch(helper, /https:\/\/autoaffi\.io\/f\//);
    assert.doesNotMatch(posts, /\/f\/\$\{/);
    assert.match(posts, /setFunnelLink\(funnel\.funnel_url/);
    assert.match(posts, /funnelLink,/);
    assert.match(helper, /if \(input\.offerType === "funnel"\)/);
    assert.match(helper, /return String\(input\.funnelLink \|\| ""\)\.trim\(\)/);

    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
        productAffiliateUrl: "https://product.example",
        funnelLink: " https://hba.example/funnel ",
      }),
      "https://hba.example/funnel"
    );
  });

  it("4. An auto-selected selectedFunnelId alone cannot activate Funnel destination", () => {
    const posts = read(postsRel);

    assert.match(posts, /useState<PostsCtaDestinationMode>\("product"\)/);
    assert.match(posts, /setDestinationMode\("funnel"\)/);
    assert.doesNotMatch(
      posts,
      /selectedFunnelId\s*\n\s*\?\s*"funnel"/
    );
    assert.match(
      posts,
      /if \(prev && rows\.some\(\(row\) => row\.id === prev\)\) return prev;\s*\n\s*return null;/
    );
    assert.equal(
      resolvePostsCtaOfferType({
        destinationMode: "product",
        hasProduct: true,
      }),
      "product"
    );
  });

  it("5-7. Posts loads /api/recurring/platforms, uses promo_link, and does not fabricate platform.com/?ref=", () => {
    const posts = read(postsRel);
    const helper = read(helperRel);

    assert.match(posts, /fetch\("\/api\/recurring\/platforms"/);
    assert.doesNotMatch(posts, /from\("user_recurring_platforms"\)/);
    assert.match(posts, /promo_link: p\.promo_link/);
    assert.match(posts, /recurringPromoLink/);
    assert.match(helper, /return String\(input\.recurringPromoLink \|\| ""\)\.trim\(\)/);
    assert.doesNotMatch(posts, /https:\/\/\$\{recurringPlatform\}\.com\/\?ref=/);
    assert.doesNotMatch(helper, /https:\/\/\$\{.*\}\.com\/\?ref=/);

    const promo =
      "https://www.submagic.co/?via=autoaffi&fp_sid=track1";
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "recurring",
        productAffiliateUrl: "https://product.example",
        recurringPromoLink: promo,
      }),
      promo
    );
  });

  it("8. Missing funnel_url yields empty destination, never a fabricated URL", () => {
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
        funnelLink: "",
      }),
      ""
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
        funnelLink: "   ",
      }),
      ""
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
      }),
      ""
    );
  });

  it("9. Missing promo_link yields empty destination, never a fabricated URL", () => {
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "recurring",
        recurringPromoLink: "",
      }),
      ""
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "recurring",
        recurringPromoLink: null as unknown as string,
      }),
      ""
    );
  });

  it("10-11. Explicit Funnel/Recurring selection overrides implicit Product default for finalLink", () => {
    const productUrl = "https://network.example/tracked";
    const funnelUrl = "https://olsp.example/optin";
    const promo = "https://syllaby.io/?via=autoaffi31&fp_sid=abc";

    assert.equal(
      resolvePostsCtaOfferType({
        destinationMode: "funnel",
        hasProduct: true,
      }),
      "funnel"
    );
    assert.equal(
      resolvePostsCtaOfferType({
        destinationMode: "recurring",
        hasProduct: true,
      }),
      "recurring"
    );

    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "funnel",
        productAffiliateUrl: productUrl,
        funnelLink: funnelUrl,
        recurringPromoLink: promo,
      }),
      funnelUrl
    );
    assert.equal(
      buildPostsFinalLink({
        mode: "content_and_offer",
        offerType: "recurring",
        productAffiliateUrl: productUrl,
        funnelLink: funnelUrl,
        recurringPromoLink: promo,
      }),
      promo
    );
  });

  it("12. Product remains the default path when Funnel/Recurring was not explicitly chosen", () => {
    const posts = read(postsRel);
    assert.match(posts, /useState<PostsCtaDestinationMode>\("product"\)/);
    assert.equal(
      resolvePostsCtaOfferType({
        destinationMode: "product",
        hasProduct: true,
      }),
      "product"
    );
    assert.equal(
      resolvePostsCtaOfferType({
        destinationMode: "product",
        hasProduct: false,
      }),
      undefined
    );
  });

  it("13. Existing Product SubID/buildAffiliateLink contracts remain unchanged in Posts wiring", () => {
    const posts = read(postsRel);
    const select = read(offersSelectRel);
    const subid = read(subidRel);

    assert.doesNotMatch(posts, /buildAffiliateLink/);
    assert.doesNotMatch(posts, /buildProductSubId/);
    assert.doesNotMatch(posts, /buildStableSubId/);
    assert.match(select, /const subid = buildStableSubId\(userId, source, externalId\)/);
    assert.match(select, /buildAffiliateLink\(/);
    assert.match(subid, /export function buildProductSubId/);
    assert.match(posts, /from: "posts"/);
  });

  it("14. Reels still consumes p.promo_link unchanged", () => {
    const reels = read(reelsRel);
    assert.match(reels, /fetch\("\/api\/recurring\/platforms"/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /promo_link: string \| null/);
  });

  it("15. No new /f route, /go wrapper, schema change, or tracking builder is added", () => {
    const posts = read(postsRel);
    const helper = read(helperRel);
    const platforms = read(platformsRel);
    const funnelsRepo = read(funnelsRepoRel);

    assert.equal(fs.existsSync(path.join(root, "app/f")), false);
    assert.doesNotMatch(posts, /\/go\/offer\/\$\{.*funnel/);
    assert.doesNotMatch(posts, /\/go\/\$\{/);
    assert.doesNotMatch(helper, /\/go\/offer/);
    assert.match(funnelsRepo, /No provider rewrite/);
    assert.match(platforms, /function buildPromoLink/);
    assert.match(posts, /copyToClipboard\(finalLink\)/);
    assert.match(posts, /\$\{finalLink \? `Link: \$\{finalLink\}` : ""\}/);
  });
});
