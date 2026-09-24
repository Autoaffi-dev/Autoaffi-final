import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  buildProductDiscoveryTiers,
  buildProductMediaQuery,
  buildProductSearchQueryVariants,
  buildSafeReelFallbackVideo,
  buildVerifiedProductMediaTerms,
  candidateMatchesVerifiedProduct,
  classifyProductMediaRole,
  coerceReelSceneMediaType,
  derivePhysicalProductObjectAnchors,
  extractNativeMediaText,
  finalizeReelScenePool,
  isAcceptableProductPoolItem,
  isContextualProductNative,
  isDigitalProduct,
  isGraphicUnsafeStock,
  isProductMediaRelevant,
  isReelSceneVideo,
  isStrongProductObjectNative,
  isStrongProductVideo,
  isUseCaseProductNative,
  physicalProductScenePoolHasRequiredObjectVideo,
  productQueryContainsForbiddenGenericExpansion,
  productSceneEvidenceCopy,
  productSceneSolutionCopy,
  productStoryArcGuidance,
  productVisibleClaimAllowed,
  selectNextProductSearchStage,
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
const selectorRel = "components/reels/MediaTypeSelector.tsx";
const funnelsTestRel = "lib/auth/reelsSavedFunnels.contract.test.ts";
const canonicalTestRel = "lib/auth/reelsCanonicalOfferAuthority.contract.test.ts";
const identityTestRel = "lib/auth/reelsProductIdentity.contract.test.ts";

function videoItem(nativeTitle: string, extra: Record<string, unknown> = {}) {
  return {
    type: "video" as const,
    url: "https://cdn.example.com/clip.mp4",
    nativeTitle,
    nativeTags: nativeTitle.split(" "),
    ...extra,
  };
}

function imageItem(nativeTitle: string) {
  return {
    type: "image" as const,
    url: "https://cdn.example.com/photo.jpg",
    nativeTitle,
    nativeTags: nativeTitle.split(" "),
  };
}

describe("Reels product media relevance", () => {
  const generate = read(generateRel);
  const media = read(mediaRel);
  const render = read(renderRel);
  const helper = read(helperRel);
  const identity = read(identityRel);
  const selector = read(selectorRel);

  const gymBag = {
    name: "Adidas Power Gym Bag",
    category: "fitness",
    description: "Durable gym bag for carrying workout clothes and shoes.",
  };

  const earbuds = {
    name: "Wireless Noise Cancelling Earbuds",
    category: "audio",
    description: "Wireless earbuds with noise cancelling.",
  };

  const bottle = {
    name: "Stainless Steel Water Bottle",
    category: "outdoors",
    description: "Reusable stainless steel water bottle.",
  };

  const poles = {
    name: "Trail Hiking Poles",
    category: "outdoor",
  };

  const software = {
    name: "TubeMagic",
    category: "software",
    description: "Video software for creators.",
  };

  it("1. fitness workout athlete fails as strong Product media", () => {
    assert.equal(isStrongProductObjectNative(gymBag, "fitness workout athlete"), false);
    assert.equal(isProductMediaRelevant(gymBag, { nativeTitle: "fitness workout athlete" }), false);
  });

  it("2. gym training exercise fails as strong Product media", () => {
    assert.equal(isStrongProductObjectNative(gymBag, "gym training exercise"), false);
    assert.equal(isProductMediaRelevant(gymBag, { nativeTitle: "gym training exercise" }), false);
  });

  it("3. woman street fashion crossbody purse fails", () => {
    assert.equal(
      isStrongProductObjectNative(gymBag, "woman street fashion crossbody purse"),
      false
    );
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "woman street fashion crossbody purse",
        nativeTags: ["woman", "street", "fashion", "crossbody", "purse"],
      }),
      false
    );
  });

  it("4. sports bag athlete passes", () => {
    assert.equal(isStrongProductObjectNative(gymBag, "sports bag athlete"), true);
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "sports bag athlete",
        nativeTags: ["sports", "bag", "athlete"],
      }),
      true
    );
  });

  it("5. gym duffel bag on bench passes", () => {
    assert.equal(isStrongProductObjectNative(gymBag, "gym duffel bag on bench"), true);
  });

  it("6. packing workout clothes into gym bag passes", () => {
    assert.equal(
      isStrongProductObjectNative(gymBag, "packing workout clothes into gym bag"),
      true
    );
  });

  it("7. carrying sports bag into fitness centre passes", () => {
    assert.equal(
      isStrongProductObjectNative(gymBag, "carrying sports bag into fitness centre"),
      true
    );
  });

  it("8. generic fitness/context video cannot satisfy the Product-object requirement", () => {
    assert.equal(
      isStrongProductVideo(gymBag, videoItem("fitness workout athlete")),
      false
    );
    assert.equal(
      physicalProductScenePoolHasRequiredObjectVideo(gymBag, [
        videoItem("fitness workout athlete"),
        videoItem("gym training exercise"),
      ]),
      false
    );
  });

  it("9. contextual B-roll may supplement strong Product-object video", () => {
    assert.equal(classifyProductMediaRole(gymBag, "fitness workout athlete"), "contextual");
    assert.equal(isAcceptableProductPoolItem(gymBag, videoItem("fitness workout athlete")), true);
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("sports bag athlete", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/gym.mp4" }),
    ]);
    assert.equal(pool.length, 2);
  });

  it("10. contextual gym video can ship when no strong Product-object video exists", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/a.mp4" }),
      videoItem("gym training exercise", { url: "https://cdn.example.com/b.mp4" }),
      videoItem("athlete training gym", { url: "https://cdn.example.com/c.mp4" }),
    ]);
    assert.equal(pool.length, 3);
    assert.equal(pool.every((item) => item.mediaRole === "contextual"), true);
    assert.equal(
      physicalProductScenePoolHasRequiredObjectVideo(gymBag, [
        videoItem("fitness workout athlete"),
        videoItem("gym training exercise"),
      ]),
      false
    );
  });

  it("11. Wireless Noise Cancelling Earbuds relevant earbud/headphone VIDEO may pass", () => {
    assert.equal(
      isStrongProductVideo(earbuds, videoItem("wireless earbuds closeup")),
      true
    );
    assert.equal(
      isProductMediaRelevant(earbuds, { nativeTitle: "noise cancelling headphones" }),
      true
    );
  });

  it("12. generic person using laptop does not satisfy physical earbuds Product-object", () => {
    assert.equal(
      isStrongProductObjectNative(earbuds, "generic person using laptop"),
      false
    );
  });

  it("13. Stainless Steel Water Bottle relevant bottle VIDEO may pass", () => {
    assert.equal(
      isStrongProductVideo(bottle, videoItem("stainless steel water bottle on table")),
      true
    );
  });

  it("14. generic fitness footage does not satisfy bottle object requirement", () => {
    assert.equal(isStrongProductObjectNative(bottle, "generic fitness footage gym"), false);
  });

  it("15. Trail Hiking Poles pole/trekking-pole VIDEO may pass", () => {
    assert.equal(isStrongProductVideo(poles, videoItem("trekking poles on a trail")), true);
    assert.equal(isStrongProductVideo(poles, videoItem("hiking poles in forest")), true);
  });

  it("16. generic forest-only footage is contextual only, not strong Product-object", () => {
    assert.equal(isStrongProductObjectNative(poles, "forest trees mountain stream"), false);
    assert.equal(isContextualProductNative(poles, "forest trees mountain stream"), true);
  });

  it("17. verified software Product can accept relevant dashboard/software/laptop VIDEO", () => {
    assert.equal(isDigitalProduct(software), true);
    assert.equal(
      isProductMediaRelevant(software, {
        nativeTitle: "laptop dashboard user interface",
        nativeTags: ["software", "computer", "screen"],
      }),
      true
    );
    assert.equal(
      isStrongProductVideo(software, videoItem("laptop dashboard user interface")),
      false
    );
  });

  it("18. software Product is NOT forced through physical-object anchor logic", () => {
    const anchors = derivePhysicalProductObjectAnchors(software);
    assert.equal(anchors.tokens.length, 0);
    assert.equal(isDigitalProduct(software), true);
    assert.equal(isDigitalProduct(gymBag), false);
  });

  it("19. unrelated physical Product footage still fails for software Product", () => {
    assert.equal(
      isProductMediaRelevant(software, {
        nativeTitle: "gym duffel bag on bench",
        nativeTags: ["gym", "duffel", "bag"],
      }),
      false
    );
  });

  it("20. relevant Product VIDEO can satisfy strong Product media", () => {
    assert.equal(isStrongProductVideo(gymBag, videoItem("sports bag athlete")), true);
  });

  it("21. relevant Product STILL IMAGE cannot satisfy strong Product media", () => {
    assert.equal(isStrongProductVideo(gymBag, imageItem("sports bag athlete")), false);
    assert.equal(isReelSceneVideo(imageItem("sports bag athlete")), false);
  });

  it("22. stills do not enter final Product Reel scene pool", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      imageItem("sports bag athlete"),
      videoItem("sports bag athlete"),
    ]);
    assert.equal(pool.every((item) => item.type === "video"), true);
    assert.equal(pool.some((item) => item.type === "image"), false);
  });

  it("23. stills do not enter final Recurring Reel scene pool", () => {
    const pool = finalizeReelScenePool("recurring", { name: "SaaS" }, [
      imageItem("dashboard software"),
      videoItem("dashboard software"),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].type, "video");
  });

  it("24. stills do not enter final Funnel Reel scene pool", () => {
    const pool = finalizeReelScenePool("funnel", { name: "Lead funnel" }, [
      imageItem("landing page"),
      videoItem("landing page conversion"),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].type, "video");
  });

  it("25. RenderVX supplemental Product path cannot insert stills", () => {
    assert.match(render, /finalizeReelScenePool\(/);
    assert.match(render, /filterReelSceneVideos\(/);
    assert.doesNotMatch(render, /Fallback media stills-first/);
    assert.doesNotMatch(render, /mediaType: "stills"/);
    assert.match(render, /preferVideoClips: true/);
  });

  it("26. no relevant Product video uses safe VIDEO fallback", () => {
    const fallback = buildSafeReelFallbackVideo();
    assert.equal(fallback.type, "video");
    assert.match(fallback.url, /fallback1\.mp4$/);
    assert.match(generate, /buildSafeReelFallbackVideo/);
    assert.match(media, /buildSafeReelFallbackVideo/);
    assert.match(render, /buildSafeReelFallbackVideo/);
  });

  it("27. fallback media is video, not image", () => {
    const fallback = buildSafeReelFallbackVideo();
    assert.equal(fallback.type, "video");
    assert.doesNotMatch(fallback.url, /\.(jpg|png|webp)$/i);
    assert.doesNotMatch(media, /type: "image"[\s\S]{0,80}fallback\/thumb1/);
  });

  it("28. no black-video regression", () => {
    assert.doesNotMatch(helper, /black\.mp4|blank\.mp4|#000000/);
    assert.match(helper, /fallback1\.mp4/);
  });

  it("29. mixed/stills legacy settings cannot cause a slideshow Reel", () => {
    assert.equal(coerceReelSceneMediaType("stills"), "video");
    assert.equal(coerceReelSceneMediaType("mixed"), "video");
    assert.match(generate, /coerceReelSceneMediaType\(body\.mediaType/);
    assert.match(media, /coerceReelSceneMediaType\(normalizeMediaType\(body\?\.type\)\)/);
    assert.match(selector, /Autoaffi Reels always use video clips/);
    assert.doesNotMatch(selector, /Cinematic images with movement/);
    assert.doesNotMatch(selector, /Images \+ video blended/);
    assert.match(generate, /const mediaHint: ExportTimelineScene\["mediaHint"\] = "video"/);
    assert.match(generate, /const mediaHint = "video"/);
  });

  it("30. Adidas Power Gym Bag + power tools workshop → FAIL", () => {
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

  it("31. single fitness token → FAIL", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "fitness"),
      false
    );
    assert.equal(
      isProductMediaRelevant(gymBag, { nativeTitle: "fitness training", nativeTags: ["fitness"] }),
      false
    );
  });

  it("32. fitness + sports from same concept family do not count as two proofs", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(buildVerifiedProductMediaTerms(gymBag), "fitness sports"),
      false
    );
  });

  it("33. URL cannot make river clip relevant", () => {
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

  it("34. thumb URL cannot make river clip relevant", () => {
    assert.equal(
      isProductMediaRelevant(gymBag, {
        nativeTitle: "calm river",
        nativeTags: ["river", "forest"],
        thumb: "https://cdn.example.com/thumbs/gym-bag-fitness-duffel.jpg",
      }),
      false
    );
  });

  it("35. app does not match apple", () => {
    assert.equal(
      candidateMatchesVerifiedProduct(["app", "software"], "apple orchard fruit"),
      false
    );
  });

  it("36. synthetic tags cannot create relevance", () => {
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

  it("37. used tampon closeup → safety BLOCK", () => {
    assert.equal(isGraphicUnsafeStock("used tampon closeup"), true);
  });

  it("38. clean tampon package → not automatically safety-blocked", () => {
    assert.equal(
      isGraphicUnsafeStock("clean tampon package on white background"),
      false
    );
  });

  it("39. visible blood open wound → BLOCK", () => {
    assert.equal(isGraphicUnsafeStock("visible blood open wound"), true);
  });

  it("40. blood pressure monitor → not automatically safety-blocked", () => {
    assert.equal(isGraphicUnsafeStock("blood pressure monitor on table"), false);
  });

  it("41. Recurring gets safety but not Product semantic gate", () => {
    assert.match(
      media,
      /\.filter\(\(item\) => !isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)\)/
    );
    assert.match(media, /extraNature[\s\S]{0,220}isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)/);
    assert.doesNotMatch(
      media.slice(media.indexOf("if (offerMode === \"funnel\")"), media.indexOf("function buildFallback")),
      /isAcceptableProductPoolItem\(productOffer, item\)/
    );
  });

  it("42. Funnel gets safety but not Product semantic gate", () => {
    assert.match(media, /extraFunnel[\s\S]{0,220}isGraphicUnsafeStock\(extractNativeMediaText\(item\)\)/);
  });

  it("43. canonical affiliateUrl/mode tests remain green", () => {
    assert.match(generate, /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/);
    assert.match(generate, /mode: selectedOfferResolved\.mode,/);
    assert.match(read(canonicalTestRel), /Reels canonical offer destination \+ mode lock/);
  });

  it("44. Product identity/commission tests remain green", () => {
    const identityTest = read(identityTestRel);
    assert.match(identityTest, /hasTrustworthyProductIdentity/);
    assert.match(identityTest, /parseOptionalCommission\("   "\)/);
    assert.match(identity, /GENERATION_TRUSTED_IDENTITY_SOURCES/);
  });

  it("45. saved Funnel tests remain green", () => {
    const reels = read(reelsRel);
    assert.match(read(funnelsTestRel), /Reels saved funnels integration/);
    assert.match(reels, /fetch\("\/api\/user-funnels"/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(read(selectRel), /buildStableSubId\(userId, source, externalId\)/);
    assert.match(read(subidRel), /export function buildProductSubId/);
    assert.doesNotMatch(helper, /buildStableSubId|promo_link|\/go\/offer/);
  });

  it("native graphic-safety then Product pool then enrich order remains", () => {
    const graphicIdx = media.indexOf(
      ".filter((item) => !isGraphicUnsafeStock(extractNativeMediaText(item)))"
    );
    const productIdx = media.indexOf("all = all.filter((item) => isAcceptableProductPoolItem(productOffer, item))");
    const enrichIdx = media.indexOf(
      "all = all.map((item) => enrichMediaItemForIntent(item, enrichParams))"
    );
    assert.ok(graphicIdx >= 0);
    assert.ok(productIdx > graphicIdx);
    assert.ok(enrichIdx > productIdx);
  });

  it("query still uses verified Product facts without generic gadget vocabulary", () => {
    const query = buildProductMediaQuery(gymBag);
    assert.equal(query, "gym bag");
    assert.doesNotMatch(query, /adidas/i);
    assert.match(query, /gym/i);
    assert.match(query, /bag/i);
    assert.equal(productQueryContainsForbiddenGenericExpansion(query), false);
    assert.doesNotMatch(helper, /affiliateUrl|savedOfferId|external_id/);
    const anchors = derivePhysicalProductObjectAnchors(gymBag);
    assert.ok(anchors.tokens.includes("bag"));
    assert.ok(anchors.phrases.includes("gym bag"));
  });
});

describe("Reels final product video pool invariant", () => {
  const generate = read(generateRel);
  const render = read(renderRel);
  const helper = read(helperRel);

  const gymBag = {
    name: "Adidas Power Gym Bag",
    category: "fitness",
    description: "Durable gym bag for carrying workout clothes and shoes.",
  };

  const bottle = {
    name: "Stainless Steel Water Bottle",
    category: "outdoors",
    description: "Reusable stainless steel water bottle.",
  };

  it("1. Water Bottle + native bottle alone is NOT strong", () => {
    assert.equal(isStrongProductObjectNative(bottle, "bottle"), false);
    assert.equal(isStrongProductVideo(bottle, videoItem("bottle")), false);
  });

  it("2. Water Bottle + cosmetic bottle fails", () => {
    assert.equal(isStrongProductObjectNative(bottle, "cosmetic bottle"), false);
    assert.equal(isProductMediaRelevant(bottle, { nativeTitle: "cosmetic bottle" }), false);
  });

  it("3. Water Bottle + lotion bottle fails", () => {
    assert.equal(isStrongProductObjectNative(bottle, "lotion bottle"), false);
  });

  it("4. Water Bottle + water bottle passes", () => {
    assert.equal(isStrongProductObjectNative(bottle, "water bottle"), true);
    assert.equal(isStrongProductVideo(bottle, videoItem("reusable water bottle")), true);
  });

  it("5. Water Bottle + verified stainless steel bottle passes", () => {
    assert.equal(isStrongProductObjectNative(bottle, "stainless steel bottle"), true);
    assert.equal(isStrongProductVideo(bottle, videoItem("stainless steel bottle")), true);
  });

  it("6. Gym Bag final pool removes river when a strong gym-bag video exists", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("sports bag athlete", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("calm river forest", { url: "https://cdn.example.com/river.mp4" }),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].nativeTitle, "sports bag athlete");
  });

  it("7. Gym Bag final pool removes lotion video when a strong gym-bag video exists", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("gym duffel bag on bench", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("lotion bottle closeup", { url: "https://cdn.example.com/lotion.mp4" }),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].nativeTitle, "gym duffel bag on bench");
  });

  it("8. Gym Bag final pool may keep valid contextual gym B-roll with a strong object video", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("sports bag athlete", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/gym.mp4" }),
    ]);
    assert.equal(pool.length, 2);
  });

  it("9. Product finalizer cannot retain an unacceptable video merely because another strong video exists", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("sports bag athlete", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("generic unrelated camera", { url: "https://cdn.example.com/camera.mp4" }),
      videoItem("calm river", { url: "https://cdn.example.com/river.mp4" }),
    ]);
    assert.equal(pool.every((item) => isAcceptableProductPoolItem(gymBag, item)), true);
    assert.equal(pool.some((item) => String(item.nativeTitle).includes("river")), false);
    assert.equal(pool.some((item) => String(item.nativeTitle).includes("camera")), false);
  });

  it("10. contextual Product pool survives with zero strong clips", () => {
    const pool = finalizeReelScenePool("product", gymBag, [
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/a.mp4" }),
      videoItem("gym training exercise", { url: "https://cdn.example.com/b.mp4" }),
    ]);
    assert.equal(pool.length, 2);
    assert.equal(pool.every((item) => item.mediaRole === "contextual"), true);
  });

  it("11. Recurring finalizer is video-only and does not apply Product semantic rules", () => {
    const pool = finalizeReelScenePool("recurring", gymBag, [
      videoItem("calm river forest", { url: "https://cdn.example.com/river.mp4" }),
      imageItem("sports bag athlete"),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].type, "video");
    assert.equal(pool[0].nativeTitle, "calm river forest");
  });

  it("12. Funnel finalizer is video-only and does not apply Product semantic rules", () => {
    const pool = finalizeReelScenePool("funnel", gymBag, [
      videoItem("landing page conversion", { url: "https://cdn.example.com/funnel.mp4" }),
      imageItem("gym bag"),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].type, "video");
  });

  it("13. Generate uses the finalizer before final scene media", () => {
    assert.ok(generate.includes("parsed.mediaFiles = finalizeReelScenePool("));
    assert.ok(
      generate.lastIndexOf("finalizeReelScenePool(") < generate.lastIndexOf("parsed.mediaFiles")
    );
  });

  it("14. RenderVX uses the finalizer before final scene media", () => {
    const lastFinalize = render.lastIndexOf("finalizeReelScenePool(");
    const workerMedia = render.indexOf("mediaFiles: workerReadyMediaFiles");
    assert.ok(lastFinalize >= 0);
    assert.ok(workerMedia > lastFinalize);
  });

  it("15. no media is appended after Product finalization without being finalized again", () => {
    const lastFinalize = render.lastIndexOf("finalizeReelScenePool(");
    assert.ok(lastFinalize > render.lastIndexOf("ensureProductWowIncluded("));
    assert.ok(lastFinalize > render.lastIndexOf("fillSelectedMediaToTarget("));
    assert.ok(lastFinalize > render.lastIndexOf("applyStoryRoleSequence("));
    assert.match(render, /lockedSceneMedia = finalizeReelScenePool\(/);
  });

  it("16. still images remain excluded for all modes", () => {
    for (const mode of ["product", "recurring", "funnel"] as const) {
      const pool = finalizeReelScenePool(mode, gymBag, [
        imageItem("sports bag athlete"),
        videoItem("sports bag athlete", { url: "https://cdn.example.com/ok.mp4" }),
      ]);
      assert.equal(pool.some((item) => item.type === "image"), false);
    }
  });

  it("17. fallback remains MP4 video", () => {
    const fallback = buildSafeReelFallbackVideo();
    assert.equal(fallback.type, "video");
    assert.match(fallback.url, /fallback1\.mp4$/);
  });

  it("18. canonical affiliateUrl/mode/SubID/tracking/commission/identity remain untouched", () => {
    assert.doesNotMatch(helper, /affiliateUrl|savedOfferId|buildStableSubId|promo_link|\/go\/offer/);
    assert.match(read(canonicalTestRel), /Reels canonical offer destination \+ mode lock/);
    assert.match(read(identityTestRel), /hasTrustworthyProductIdentity/);
    assert.match(read(subidRel), /export function buildProductSubId/);
  });
});

describe("Always-deliver Product video ladder", () => {
  const gymBag = {
    name: "Adidas Power Gym Bag",
    category: "fitness",
    description: "Durable gym bag for carrying workout clothes and shoes.",
  };
  const tiers = buildProductDiscoveryTiers(gymBag);
  const queries = (tier: "A" | "B" | "C" | "D" | "neutral") =>
    tiers.find((entry) => entry.tier === tier)?.queries || [];

  it("1. first stock query is not the long Adidas string", () => {
    const first = buildProductSearchQueryVariants(gymBag)[0];
    assert.equal(first, "gym bag");
    assert.doesNotMatch(first, /adidas power gym bag fitness durable/i);
  });

  it("2-4. object queries come before context and Adidas is not required", () => {
    assert.deepEqual(queries("A"), ["gym bag", "duffel bag", "sports bag"]);
    const flat = tiers.flatMap((tier) => tier.queries);
    const bagAt = flat.indexOf("gym bag");
    const workoutAt = flat.indexOf("gym workout");
    assert.ok(bagAt >= 0 && bagAt < workoutAt);
    assert.equal(flat.some((query) => /adidas/i.test(query)), false);
  });

  it("5-7. page 1 is first and deeper or lower tiers wait until the pool is thin", () => {
    const first = selectNextProductSearchStage({
      tiers,
      completed: [],
      counts: { strong: 0, useCase: 0, contextual: 0 },
      tierAPage1Count: 0,
    });
    assert.deepEqual(first, { tier: "A", page: 1, queries: queries("A") });

    const enough = selectNextProductSearchStage({
      tiers,
      completed: [{ tier: "A", page: 1 }],
      counts: { strong: 2, useCase: 0, contextual: 2 },
      tierAPage1Count: 8,
    });
    assert.equal(enough, null);

    const needsDepth = selectNextProductSearchStage({
      tiers,
      completed: [{ tier: "A", page: 1 }],
      counts: { strong: 0, useCase: 0, contextual: 0 },
      tierAPage1Count: 1,
    });
    assert.equal(needsDepth?.tier, "A");
    assert.equal(needsDepth?.page, 2);
  });

  it("8-18. roles stay strict and stills stay out", () => {
    assert.equal(classifyProductMediaRole(gymBag, "gym bag"), "strong");
    assert.equal(classifyProductMediaRole(gymBag, "sports bag"), "strong");
    assert.equal(classifyProductMediaRole(gymBag, "duffel bag"), "strong");
    assert.equal(isUseCaseProductNative(gymBag, "packing workout clothes"), true);
    assert.equal(classifyProductMediaRole(gymBag, "preparing gym gear"), "use_case");
    assert.equal(classifyProductMediaRole(gymBag, "fitness workout athlete"), "contextual");
    assert.equal(classifyProductMediaRole(gymBag, "gym training"), "contextual");
    assert.equal(classifyProductMediaRole(gymBag, "calm river"), "none");
    assert.equal(classifyProductMediaRole(gymBag, "lotion bottle"), "none");
    assert.equal(classifyProductMediaRole(gymBag, "fashion handbag crossbody"), "none");
    assert.equal(isReelSceneVideo(imageItem("gym bag")), false);
  });

  it("19-24. URL, query text, and synthetic tags cannot become strong; Pixabay tags can", () => {
    const pexelsUrl = "https://www.pexels.com/video/woman-packing-a-bag-at-the-gym-123/";
    assert.equal(isStrongProductObjectNative(gymBag, pexelsUrl), false);
    assert.equal(classifyProductMediaRole(gymBag, "", { tier: "A" }), "contextual");
    assert.notEqual(classifyProductMediaRole(gymBag, "", { tier: "A" }), "strong");
    assert.equal(
      isStrongProductObjectNative(gymBag, extractNativeMediaText({ tags: ["gym", "bag", "product demo"] })),
      false
    );
    assert.equal(
      classifyProductMediaRole(gymBag, extractNativeMediaText({ nativeTags: ["gym", "bag", "fitness"] })),
      "strong"
    );
    assert.equal(
      classifyProductMediaRole(gymBag, extractNativeMediaText({ nativeTags: ["fitness", "training"] })),
      "contextual"
    );
  });

  it("25-31. ladder keeps lower video roles and does not invent a product error", () => {
    const mixed = finalizeReelScenePool("product", gymBag, [
      videoItem("sports bag athlete", { url: "https://cdn.example.com/bag.mp4" }),
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/gym.mp4" }),
    ]);
    assert.equal(mixed.length, 2);
    assert.equal(mixed[0].mediaRole, "strong");

    const useCase = finalizeReelScenePool("product", gymBag, [
      videoItem("packing workout clothes", { url: "https://cdn.example.com/pack.mp4" }),
    ]);
    assert.equal(useCase.length, 1);
    assert.equal(useCase[0].mediaRole, "use_case");

    const contextual = finalizeReelScenePool("product", gymBag, [
      videoItem("fitness workout athlete", { url: "https://cdn.example.com/gym.mp4" }),
    ]);
    assert.equal(contextual[0].mediaRole, "contextual");

    const neutral = finalizeReelScenePool("product", gymBag, [
      {
        ...videoItem("", { url: "https://cdn.example.com/neutral.mp4", nativeTitle: "", nativeTags: [] }),
        searchTier: "neutral",
      },
    ]);
    assert.equal(neutral.length, 1);
    assert.equal(neutral[0].mediaRole, "neutral");

    const irrelevant = finalizeReelScenePool("product", gymBag, [
      videoItem("calm river forest", { url: "https://cdn.example.com/river.mp4" }),
    ]);
    assert.equal(irrelevant.length, 0);

    const generate = read(generateRel);
    assert.doesNotMatch(generate, /PRODUCT_VIDEO_UNAVAILABLE/);
    assert.match(generate, /getSafeOfferMode\(offerMetaInput\?\.mode\) !== "product"/);
  });

  it("32-36. visible product claims require strong footage", () => {
    assert.equal(productVisibleClaimAllowed("strong"), true);
    assert.equal(productVisibleClaimAllowed("use_case"), false);
    assert.equal(productVisibleClaimAllowed("contextual"), false);
    assert.equal(productVisibleClaimAllowed("neutral"), false);
    assert.match(productSceneSolutionCopy("Adidas Power Gym Bag", "strong").description, /Reveal Adidas Power Gym Bag/);
    assert.doesNotMatch(
      productSceneSolutionCopy("Adidas Power Gym Bag", "contextual").description,
      /Reveal Adidas Power Gym Bag/
    );
    assert.doesNotMatch(
      productSceneSolutionCopy("Adidas Power Gym Bag", "use_case").description,
      /Reveal Adidas Power Gym Bag/
    );
    assert.doesNotMatch(
      productSceneSolutionCopy("Adidas Power Gym Bag", "neutral").description,
      /Reveal Adidas Power Gym Bag/
    );
  });

  it("tight use_case and non-strong scenes avoid product-visible proof", () => {
    assert.equal(classifyProductMediaRole(gymBag, "packing workout clothes"), "use_case");
    assert.equal(classifyProductMediaRole(gymBag, "preparing gym gear"), "use_case");
    assert.equal(classifyProductMediaRole(gymBag, "carrying sports equipment"), "use_case");
    assert.equal(classifyProductMediaRole(gymBag, "using gym equipment"), "contextual");
    assert.equal(classifyProductMediaRole(gymBag, "wearing workout clothes"), "contextual");
    assert.equal(classifyProductMediaRole(gymBag, "ready for gym"), "contextual");
    assert.equal(classifyProductMediaRole(gymBag, "athlete exercising"), "contextual");

    const strongArc = productStoryArcGuidance("strong", "Adidas Power Gym Bag");
    assert.match(strongArc.scene4, /reveal Adidas Power Gym Bag/i);
    assert.match(strongArc.scene5, /visible improvement/);

    for (const role of ["use_case", "contextual", "neutral"] as const) {
      const arc = productStoryArcGuidance(role, "Adidas Power Gym Bag");
      assert.doesNotMatch(arc.scene4, /reveal/i);
      assert.doesNotMatch(arc.scene5, /show proof, visible improvement/);
      assert.match(arc.scene5, /Do not request visual Product proof/);
      const solution = productSceneSolutionCopy("Adidas Power Gym Bag", role);
      const evidence = productSceneEvidenceCopy(role);
      assert.doesNotMatch(solution.description, /Reveal Adidas Power Gym Bag|smarter/i);
      assert.doesNotMatch(evidence.description, /Proof or visible improvement|Reveal/i);
    }

    const generate = read(generateRel);
    assert.match(generate, /productStoryArcGuidance\(/);
    assert.match(generate, /productSceneEvidenceCopy\(/);
    assert.doesNotMatch(generate, /Scene 5 must show proof, visible improvement/);
  });

  it("sparse tier D is neutral and page 2 is skipped when page 1 is already enough", () => {
    assert.equal(classifyProductMediaRole(gymBag, "", { tier: "D" }), "neutral");
    assert.equal(classifyProductMediaRole(gymBag, "calm river", { tier: "A" }), "none");
    const render = read(renderRel);
    assert.doesNotMatch(render, /product demo ugc creator lifestyle result review/);
  });
});
