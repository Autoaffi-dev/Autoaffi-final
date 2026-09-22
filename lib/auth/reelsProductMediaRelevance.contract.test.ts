import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  buildProductMediaQuery,
  buildProductSearchQueryVariants,
  buildVerifiedProductMediaTerms,
  candidateMatchesVerifiedProduct,
  extractNativeMediaText,
  isGraphicUnsafeStock,
  isProductMediaRelevant,
  productQueryContainsForbiddenGenericExpansion,
} from "../content-optimizer/reelsProductMediaRelevance.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const generateRel = "app/api/reels/generate/route.ts";
const mediaRel = "app/api/media/fetch/route.ts";
const renderRel = "app/api/reels/render-vx/route.ts";
const identityRel = "lib/content-optimizer/reelsProductIdentity.ts";
const helperRel = "lib/content-optimizer/reelsProductMediaRelevance.ts";
const selectRel = "app/api/offers/select/route.ts";
const subidRel = "lib/affiliate/subid.ts";
const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const funnelsTestRel = "lib/auth/reelsSavedFunnels.contract.test.ts";
const canonicalTestRel = "lib/auth/reelsCanonicalOfferAuthority.contract.test.ts";
const identityTestRel = "lib/auth/reelsProductIdentity.contract.test.ts";

describe("Reels product media relevance", () => {
  const generate = read(generateRel);
  const media = read(mediaRel);
  const render = read(renderRel);
  const helper = read(helperRel);
  const identity = read(identityRel);

  const gymBag = {
    name: "Adidas Power Gym Bag",
    category: "fitness",
    description: "Durable gym bag for carrying workout clothes and shoes.",
  };

  it("1. Adidas Power Gym Bag produces Product-specific media semantics", () => {
    const query = buildProductMediaQuery(gymBag);
    const terms = buildVerifiedProductMediaTerms(gymBag);
    assert.match(query, /adidas/i);
    assert.match(query, /gym/i);
    assert.match(query, /bag/i);
    assert.ok(terms.includes("adidas"));
    assert.ok(terms.includes("gym"));
    assert.ok(terms.includes("bag"));
    assert.match(generate, /buildProductMediaQuery\(/);
  });

  it("2. Product query does not automatically add generic gadget vocabulary", () => {
    const query = buildProductMediaQuery(gymBag);
    assert.equal(productQueryContainsForbiddenGenericExpansion(query), false);
    assert.doesNotMatch(query, /digital tool/);
    assert.doesNotMatch(query, /creator setup/);
    assert.doesNotMatch(query, /workflow/);
    assert.doesNotMatch(query, /hands using tool/);
    assert.doesNotMatch(query, /before after/);
    const productQueryFn = generate.slice(
      generate.indexOf("if (mode === \"product\") {"),
      generate.indexOf("if (mode === \"funnel\") {")
    );
    assert.doesNotMatch(productQueryFn, /modern workflow/);
    assert.doesNotMatch(productQueryFn, /digital tool/);
    assert.doesNotMatch(productQueryFn, /hands using tool/);
  });

  it("3. Uncategorized is never used as visual semantics", () => {
    const terms = buildVerifiedProductMediaTerms({
      name: "Adidas Power Gym Bag",
      category: "Uncategorized",
    });
    assert.ok(!terms.includes("uncategorized"));
    const query = buildProductMediaQuery({
      name: "Adidas Power Gym Bag",
      category: "Uncategorized",
    });
    assert.doesNotMatch(query, /uncategorized/i);
  });

  it("4. SKU/external IDs are never used as media semantics", () => {
    const terms = buildVerifiedProductMediaTerms({
      title: undefined,
      name: "SWV24S2026-09-08614-09-2026",
      category: "Electronics",
      description: "",
    });
    assert.ok(!terms.some((term) => /swv24|08614/.test(term)));
    assert.doesNotMatch(helper, /affiliateUrl/);
    assert.doesNotMatch(helper, /savedOfferId/);
    assert.doesNotMatch(helper, /external_id|tracking/);
  });

  it("5. Verified Product description can contribute meaningful search terms", () => {
    const terms = buildVerifiedProductMediaTerms({
      name: "SWV24S2026-09-08614-09-2026",
      category: "Uncategorized",
      description: "Wireless noise cancelling earbuds for travel.",
    });
    assert.ok(terms.includes("wireless"));
    assert.ok(terms.includes("earbuds"));
    assert.ok(terms.includes("travel"));
  });

  it("6. Promotional/noise description language does not dominate search", () => {
    const query = buildProductMediaQuery({
      name: "SKU_43928492",
      category: "Electronics",
      description: "Best choice for anyone who wants amazing quality and fast shipping.",
    });
    assert.doesNotMatch(query, /best choice/);
    assert.doesNotMatch(query, /amazing quality/);
    assert.doesNotMatch(query, /fast shipping/);
  });

  it("7. Provider-native metadata is evaluated before synthetic enrichment", () => {
    assert.match(media, /nativeTitle/);
    assert.match(media, /nativeDescription/);
    assert.match(media, /nativeTags/);
    const productAccept = media.slice(
      media.indexOf("if (offerMode === \"product\" && !freedomRecurring)"),
      media.indexOf("enrichMediaItemForIntent(item, enrichParams)")
    );
    assert.match(productAccept, /isProductMediaRelevant\(productOffer, item\)/);
    assert.ok(
      media.indexOf("isProductMediaRelevant(productOffer, item)") <
        media.indexOf("all = all.map((item) => enrichMediaItemForIntent(item, enrichParams));")
    );
  });

  it("8. Synthetic product/hands/creator tags cannot make a river clip relevant", () => {
    const relevant = isProductMediaRelevant(gymBag, {
      nativeTitle: "calm river through a forest",
      nativeDescription: "nature landscape river",
      nativeTags: ["river", "forest"],
      title: "product demo hands creator ugc",
      tags: ["product", "hands", "creator", "ugc", "gym"],
    });
    assert.equal(relevant, false);
    const native = extractNativeMediaText({
      nativeTitle: "calm river through a forest",
      nativeTags: ["river", "forest"],
      title: "product demo",
      tags: ["product", "hands", "creator"],
    });
    assert.match(native, /river/);
    assert.doesNotMatch(native, /product demo/);
  });

  it("9. River/forest fails for unrelated gym bag Product", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "river forest mountain stream"),
      false
    );
  });

  it("10. Gym bag / sports bag footage can pass for gym bag Product", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "athlete packing a sports bag",
        nativeTags: ["gym bag", "duffel", "fitness"],
      }),
      true
    );
  });

  it("11. Cosmetics fail for unrelated Product", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "applying lipstick and skin lotion",
        nativeTags: ["cosmetics", "makeup", "beauty cream"],
      }),
      false
    );
  });

  it("12. Cosmetics can still pass for verified beauty Product", () => {
    assert.equal(
      isProductMediaRelevant(
        { name: "Glow Serum", category: "beauty", description: "Daily skincare serum." },
        {
          nativeTitle: "applying lipstick and skin lotion",
          nativeTags: ["cosmetics", "makeup", "skincare"],
        }
      ),
      true
    );
  });

  it("13. Nature can still pass for verified outdoor Product", () => {
    assert.equal(
      isProductMediaRelevant(
        { name: "Trail Hiking Poles", category: "outdoor" },
        {
          nativeTitle: "hiker on a forest trail",
          nativeTags: ["nature", "hiking", "mountain"],
        }
      ),
      true
    );
  });

  it("14. Used-hygiene / graphic body-fluid footage is universally rejected", () => {
    assert.equal(isGraphicUnsafeStock("used tampon closeup"), true);
    assert.equal(isGraphicUnsafeStock("visible blood open wound"), true);
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "used tampon",
        nativeTags: ["gym", "bag"],
      }),
      false
    );
    assert.match(media, /isGraphicUnsafeStock/);
  });

  it("15. Generic keyboard does not pass for unrelated physical Product", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "office keyboard and mouse on a desk",
        nativeTags: ["keyboard", "computer", "office"],
      }),
      false
    );
  });

  it("16. Real software Product can still use relevant software/laptop/UI footage", () => {
    assert.equal(
      isProductMediaRelevant(
        {
          name: "TubeMagic",
          category: "software",
          description: "Video software for creators.",
        },
        {
          nativeTitle: "laptop dashboard user interface",
          nativeTags: ["software", "computer", "screen"],
        }
      ),
      true
    );
  });

  it("17. Recurring freedom mode still allows intended nature footage", () => {
    assert.match(media, /intent === "freedom_lifestyle"/);
    assert.match(media, /buildStrictNatureFreedomQueries/);
    assert.match(generate, /digital nomad/);
    assert.match(generate, /mountain remote work/);
    assert.match(generate, /if \(params\.freedomRecurring\)/);
  });

  it("18. Funnel mode still uses topic/problem/audience visuals", () => {
    assert.match(generate, /landing page/);
    assert.match(generate, /sales funnel/);
    assert.match(generate, /conversion dashboard/);
    assert.match(media, /offerMode === "funnel"/);
  });

  it("19. Product mode is not misclassified as ai_saas from generic injected terms", () => {
    assert.match(media, /function detectIntent\(query: string, offerMode\?: OfferMode\)/);
    assert.match(media, /if \(offerMode === "product"\) return "product_generic";/);
    const productQuery = buildProductMediaQuery(gymBag);
    assert.doesNotMatch(productQuery, /digital tool|workflow|online business/);
  });

  it("20. RenderVX supplemental Product fetch cannot bypass relevance gate", () => {
    assert.match(render, /buildProductMediaQuery\(/);
    assert.match(render, /description: params\.offerMeta\.description \|\| ""/);
    const wow = render.slice(
      render.indexOf("function buildProductWowQuery("),
      render.indexOf("function buildFunnelWowQuery(")
    );
    assert.doesNotMatch(wow, /product demo hands holding/);
    assert.doesNotMatch(wow, /creator ugc lifestyle/);
    assert.match(render, /if \(offerMeta\.mode === "product"\)/);
    assert.match(media, /isProductMediaRelevant\(productOffer, item\)/);
  });

  it("21. If no relevant Product stock exists, safe fallback remains and no black video occurs", () => {
    assert.match(generate, /Using fallback media/);
    assert.match(generate, /https:\/\/public\.autoaffi\.com\/fallback\/fallback1\.mp4/);
    assert.match(media, /if \(combined\.length === 0\)/);
    assert.match(media, /combined = buildFallback\(type\);/);
    assert.doesNotMatch(generate, /black video/);
  });

  it("22-25. Canonical offer, mode, identity/commission, and saved funnel contracts remain in suite", () => {
    const identityTest = read(identityTestRel);
    const funnels = read(funnelsTestRel);
    const select = read(selectRel);
    const subid = read(subidRel);
    const reels = read(reelsRel);

    assert.match(generate, /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/);
    assert.match(generate, /mode: selectedOfferResolved\.mode,/);
    assert.match(reels, /fetch\("\/api\/user-funnels"/);
    assert.match(identityTest, /hasTrustworthyProductIdentity/);
    assert.match(identityTest, /parseOptionalCommission\("   "\)/);
    assert.match(funnels, /Reels saved funnels integration/);
    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.match(subid, /export function buildProductSubId/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(identity, /GENERATION_TRUSTED_IDENTITY_SOURCES/);
    assert.doesNotMatch(helper, /buildStableSubId|promo_link|\/go\/offer/);
    assert.match(read(canonicalTestRel), /Reels canonical offer destination \+ mode lock/);
  });
});
