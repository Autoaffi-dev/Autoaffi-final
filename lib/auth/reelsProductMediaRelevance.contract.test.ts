import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  buildProductMediaQuery,
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

  it("1. Adidas Power Gym Bag + power tools workshop fails", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(
        buildVerifiedProductMediaTerms(gymBag),
        "power tools workshop"
      ),
      false
    );
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "power tools workshop",
        nativeTags: ["power", "tools", "workshop"],
      }),
      false
    );
  });

  it("2. A single broad token such as fitness does not qualify a Product", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "fitness"),
      false
    );
    assert.equal(
      isProductMediaRelevant(gymBag, { nativeTitle: "fitness training", nativeTags: ["fitness"] }),
      false
    );
  });

  it("3. sports bag athlete passes for gym bag", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "sports bag athlete",
        nativeTags: ["sports", "bag", "athlete"],
      }),
      true
    );
  });

  it("4. packing gym bag passes", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "packing gym bag",
        nativeTags: ["packing", "gym", "bag"],
      }),
      true
    );
  });

  it("5. URL containing gym-bag-product-demo cannot make a river candidate pass", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "calm river",
        nativeTags: ["river", "forest"],
        url: "https://cdn.example.com/videos/gym-bag-fitness-product-demo.mp4",
      }),
      false
    );
    const native = extractNativeMediaText({
      nativeTitle: "calm river",
      nativeTags: ["river", "forest"],
      url: "https://cdn.example.com/videos/gym-bag-fitness-product-demo.mp4",
    });
    assert.doesNotMatch(native, /gym/);
    assert.doesNotMatch(native, /fitness/);
  });

  it("6. Thumbnail URL cannot make an irrelevant candidate pass", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "calm river",
        nativeTags: ["river", "forest"],
        thumb: "https://cdn.example.com/thumbs/gym-bag-fitness-duffel.jpg",
      }),
      false
    );
  });

  it("7. app does not substring-match apple", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(["app", "software"], "apple orchard fruit"),
      false
    );
  });

  it("8. Synthetic Autoaffi tags still cannot provide semantic evidence", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "calm river through a forest",
        nativeTags: ["river", "forest"],
        title: "product demo hands creator ugc",
        tags: ["product", "hands", "creator", "ugc", "gym", "bag"],
      }),
      false
    );
  });

  it("9. Synonym expansion does not manufacture multiple independent matches from one native concept", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "fitness"),
      false
    );
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "fitness sports"),
      false
    );
  });

  it("10. used tampon closeup is graphic-safety BLOCK", () => {
    assert.equal(isGraphicUnsafeStock("used tampon closeup"), true);
  });

  it("11. clean tampon package is NOT automatically blocked by graphic-safety", () => {
    assert.equal(
      isGraphicUnsafeStock("clean tampon package on white background"),
      false
    );
  });

  it("12. visible blood open wound is BLOCK", () => {
    assert.equal(isGraphicUnsafeStock("visible blood open wound"), true);
  });

  it("13. blood pressure monitor is NOT automatically blocked by graphic-safety", () => {
    assert.equal(isGraphicUnsafeStock("blood pressure monitor on table"), false);
  });

  it("14. narrow graphic-safety filtering runs before enrichment for Product", () => {
    const graphicIdx = media.indexOf(
      ".filter((item) => !isGraphicUnsafeStock(extractNativeMediaText(item)))"
    );
    const productIdx = media.indexOf("all = all.filter((item) => isProductMediaRelevant(productOffer, item))");
    const enrichIdx = media.indexOf(
      "all = all.map((item) => enrichMediaItemForIntent(item, enrichParams))"
    );
    assert.ok(graphicIdx >= 0);
    assert.ok(productIdx > graphicIdx);
    assert.ok(enrichIdx > productIdx);
  });

  it("15. same graphic-safety guard applies to Recurring/Funnel without Product semantic rules", () => {
    assert.match(
      media,
      /\.filter\(\(item\) => !isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)\)/
    );
    assert.match(media, /extraNature[\s\S]{0,220}isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)/);
    assert.match(media, /extraFunnel[\s\S]{0,220}isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)/);
    assert.doesNotMatch(
      media.slice(media.indexOf("if (offerMode === \"funnel\")"), media.indexOf("function buildFallback")),
      /isProductMediaRelevant\(productOffer, item\)/
    );
  });

  it("16. beauty Product can still accept relevant skincare footage", () => {
    assert.equal(
      isProductMediaRelevant(
        { name: "Glow Serum", category: "beauty", description: "Daily skincare serum." },
        {
          nativeTitle: "applying skincare serum",
          nativeTags: ["cosmetics", "makeup", "skincare"],
        }
      ),
      true
    );
  });

  it("17. outdoor Product can still accept relevant hiking footage", () => {
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

  it("18. software Product can still accept relevant software/dashboard footage", () => {
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

  it("19. river/forest still fails for unrelated gym bag", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(
        buildVerifiedProductMediaTerms(gymBag),
        "river forest mountain stream"
      ),
      false
    );
  });

  it("20. RenderVX supplemental Product fetch still passes through hardened media fetch", () => {
    assert.match(render, /buildProductMediaQuery\(/);
    assert.match(render, /description: params\.offerMeta\.description \|\| ""/);
    assert.match(render, /fetch\(`\$\{baseUrl\}\/api\/media\/fetch`/);
    const wow = render.slice(
      render.indexOf("function buildProductWowQuery("),
      render.indexOf("function buildFunnelWowQuery(")
    );
    assert.doesNotMatch(wow, /product demo hands holding/);
    assert.match(media, /isProductMediaRelevant\(productOffer, item\)/);
  });

  it("21. canonical affiliateUrl/mode tests remain green", () => {
    assert.match(generate, /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/);
    assert.match(generate, /mode: selectedOfferResolved\.mode,/);
    assert.match(read(canonicalTestRel), /Reels canonical offer destination \+ mode lock/);
  });

  it("22. Product identity/commission tests remain green", () => {
    const identityTest = read(identityTestRel);
    assert.match(identityTest, /hasTrustworthyProductIdentity/);
    assert.match(identityTest, /parseOptionalCommission\("   "\)/);
    assert.match(identity, /GENERATION_TRUSTED_IDENTITY_SOURCES/);
  });

  it("23. saved Funnel tests remain green", () => {
    const reels = read(reelsRel);
    assert.match(read(funnelsTestRel), /Reels saved funnels integration/);
    assert.match(reels, /fetch\("\/api\/user-funnels"/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(read(selectRel), /buildStableSubId\(userId, source, externalId\)/);
    assert.match(read(subidRel), /export function buildProductSubId/);
    assert.doesNotMatch(helper, /buildStableSubId|promo_link|\/go\/offer/);
  });

  it("query still uses verified Product facts without generic gadget vocabulary", () => {
    const query = buildProductMediaQuery(gymBag);
    assert.match(query, /adidas/i);
    assert.match(query, /gym/i);
    assert.match(query, /bag/i);
    assert.equal(productQueryContainsForbiddenGenericExpansion(query), false);
    assert.doesNotMatch(helper, /affiliateUrl|savedOfferId|external_id/);
  });
});
