import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  deriveProductDisplayIdentity,
  formatCreatorCommissionPercent,
  hasTrustworthyProductIdentity,
  isIdentifierLikeProductTitle,
  parseOptionalCommission,
  PRODUCT_IDENTITY_INSUFFICIENT_CODE,
  PRODUCT_IDENTITY_INSUFFICIENT_MESSAGE,
  shortenVerifiedProductTitle,
} from "../content-optimizer/reelsProductIdentity.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function sliceBetween(src: string, startMarker: string, endMarker: string) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return src.slice(start, end);
}

const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const panelsRel = "components/reels/OfferPanels.tsx";
const metaRel = "components/reels/OfferMetaPanel.tsx";
const generateRel = "app/api/reels/generate/route.ts";
const identityRel = "lib/content-optimizer/reelsProductIdentity.ts";
const selectRel = "app/api/offers/select/route.ts";
const subidRel = "lib/affiliate/subid.ts";

describe("Reels product identity and creator commission", () => {
  const generate = read(generateRel);
  const reels = read(reelsRel);
  const panels = read(panelsRel);
  const meta = read(metaRel);
  const identity = read(identityRel);
  const normalize = sliceBetween(
    generate,
    "function normalizeOfferMetaInput(",
    "function offerMetaToResolvedOffer("
  );
  const resolvedOffer = sliceBetween(
    generate,
    "function offerMetaToResolvedOffer(",
    "function getTargetSceneCount("
  );
  const harden = sliceBetween(
    generate,
    "function hardenParsedResponse(",
    "export async function POST(req: Request)"
  );
  const offerMetaAssign = sliceBetween(
    harden,
    "parsed.offerMeta = offerMetaToResolvedOffer({",
    "parsed.selectedOffer = { ...parsed.offerMeta };"
  );
  const renderHintsAssign = sliceBetween(
    harden,
    "parsed.renderHints = {",
    "return parsed;"
  );
  const post = sliceBetween(
    generate,
    "export async function POST(req: Request) {",
    "const completion = await openai.chat.completions.create({"
  );
  const fallbackScript = sliceBetween(
    generate,
    "function buildFallbackScript(",
    "function buildFallbackStoryboard("
  );

  it("1. description survives into the canonical Product context used by generation", () => {
    assert.match(normalize, /const description = safeString\(\(raw as any\)\?\.description, ""\)/);
    assert.match(resolvedOffer, /description: safeString\(offerMetaInput\.description, ""\)/);
    assert.match(offerMetaAssign, /description: selectedOfferResolved\.description \|\| ""/);
    assert.match(
      renderHintsAssign,
      /description: selectedOfferResolved\.description \|\| ""/
    );
    assert.match(generate, /OfferMeta=\$\{JSON\.stringify\(offerMetaInput, null, 2\)\}/);
    assert.match(fallbackScript, /description: params\.offerMeta\?\.description/);
    assert.match(reels, /description: meta\.description \?\? ""/);
  });

  it("2. identityUnknown survives into the actual generation gate", () => {
    assert.match(normalize, /const identityUnknown =/);
    assert.match(normalize, /Boolean\(\(raw as any\)\?\.identityUnknown\)/);
    assert.match(resolvedOffer, /identityUnknown: Boolean\(offerMetaInput\.identityUnknown\)/);
    assert.match(
      offerMetaAssign,
      /identityUnknown: Boolean\(selectedOfferResolved\.identityUnknown\)/
    );
    assert.match(
      renderHintsAssign,
      /identityUnknown: Boolean\(selectedOfferResolved\.identityUnknown\)/
    );
    assert.match(post, /Boolean\(offerMetaInput\.identityUnknown\)/);
    assert.match(post, /Boolean\(selectedOfferResolved\.identityUnknown\)/);
    assert.match(post, /PRODUCT_IDENTITY_INSUFFICIENT_CODE/);
    assert.match(reels, /identityUnknown: Boolean\(meta\.identityUnknown\)/);
  });

  it("3. Product category cannot be replaced by parsed/LLM category", () => {
    assert.match(
      harden,
      /const productCategory =\s*selectedOfferResolved\.mode === "product"\s*\? selectedOfferResolved\.category \|\| ""\s*: safeString\(parsed\.offerMeta\?\.category, selectedOfferResolved\.category\)/
    );
    assert.doesNotMatch(
      offerMetaAssign,
      /safeString\(\s*parsed\.offerMeta\?\.category,\s*selectedOfferResolved\.category\s*\)/
    );
  });

  it("4. offerMeta / selectedOffer / renderHints.selectedOffer use canonical Product category", () => {
    assert.match(offerMetaAssign, /category: productCategory/);
    assert.match(harden, /parsed\.selectedOffer = \{ \.\.\.parsed\.offerMeta \}/);
    assert.match(
      renderHintsAssign,
      /offerCategory:\s*selectedOfferResolved\.mode === "product"\s*\? selectedOfferResolved\.category \|\| ""/
    );
    assert.match(
      renderHintsAssign,
      /category:\s*selectedOfferResolved\.mode === "product"\s*\? selectedOfferResolved\.category \|\| ""/
    );
  });

  it("5. promotional description is NOT used as a Product display name", () => {
    const promo =
      "Best choice for anyone who wants amazing quality and fast shipping.";
    const identityFromPromo = deriveProductDisplayIdentity({
      title: "SKU_43928492",
      description: promo,
      category: "Uncategorized",
    });
    assert.equal(identityFromPromo.unknown, true);
    assert.equal(identityFromPromo.displayName, "");
    assert.doesNotMatch(identityFromPromo.displayName, /Best choice/i);
    assert.doesNotMatch(identityFromPromo.displayName, /amazing quality/i);

    const promoTitle = deriveProductDisplayIdentity({
      title: promo,
      category: "Uncategorized",
    });
    assert.equal(promoTitle.unknown, true);
    assert.equal(promoTitle.displayName, "");
  });

  it("6. concise verified Product description may support understanding without invented words", () => {
    const description = "Wireless noise cancelling earbuds for travel.";
    const identityFromDescription = deriveProductDisplayIdentity({
      title: "SWV24S2026-09-08614-09-2026",
      description,
      category: "Uncategorized",
    });
    assert.equal(identityFromDescription.unknown, false);
    assert.equal(identityFromDescription.source, "description");
    assert.match(identityFromDescription.displayName, /Wireless/i);
    assert.match(identityFromDescription.displayName, /earbuds/i);
    for (const word of identityFromDescription.displayName.split(" ")) {
      assert.match(
        description,
        new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      );
    }
    assert.doesNotMatch(identityFromDescription.displayName, /premium|invented|brand/i);
    assert.match(
      generate,
      /Only use facts present in OfferMeta name, description, and category/
    );
  });

  it("7. unknown Product identity is rejected before OpenAI and media generation", () => {
    const identityUnknownIdx = post.indexOf("PRODUCT_IDENTITY_INSUFFICIENT_CODE");
    const mediaIdx = post.indexOf("/api/media/fetch");
    const openaiIdx = generate.indexOf("openai.chat.completions.create(");
    assert.ok(identityUnknownIdx >= 0);
    assert.ok(mediaIdx > identityUnknownIdx, "identity gate must run before media fetch");
    assert.ok(openaiIdx > mediaIdx, "OpenAI must run after the identity gate");
    assert.match(post, new RegExp(PRODUCT_IDENTITY_INSUFFICIENT_CODE));
    assert.match(post, /status: 400/);
    assert.equal(
      PRODUCT_IDENTITY_INSUFFICIENT_MESSAGE,
      "Autoaffi does not have enough product information to create a relevant Reel. Choose another product."
    );
    assert.match(reels, /PRODUCT_IDENTITY_INSUFFICIENT_MESSAGE/);

    const unknown = deriveProductDisplayIdentity({
      title: "ABCD-182736-XX",
      merchantName: "",
      category: "unknown",
    });
    assert.equal(unknown.unknown, true);
    assert.equal(hasTrustworthyProductIdentity(unknown), false);
  });

  it("8. unknown Product is not silently auto-selected for generation", () => {
    assert.match(reels, /function firstUsableProductForGeneration\(/);
    assert.match(reels, /!p\?\.identityUnknown/);
    assert.match(reels, /\.filter\(\(p: any\) => p\.id\)/);
    assert.doesNotMatch(reels, /\.filter\(\(p: any\) => p\.id && p\.name\)/);
    assert.match(reels, /return firstUsable;/);
    assert.match(panels, /if \(unavailable\) return;/);
    assert.match(panels, /Unavailable for Reels/);
    assert.match(reels, /selectedProduct\.identityUnknown/);
    assert.match(reels, /generateBlocked=\{\s*offerMode === "product" && Boolean\(selectedProduct\?\.identityUnknown\)/);
  });

  it("9. long Product titles shorten using source words only", () => {
    const title =
      "Wireless Bluetooth Noise Cancelling Earbuds With Charging Case Black EU";
    const shortened = shortenVerifiedProductTitle(title);
    assert.match(shortened, /Wireless/i);
    assert.match(shortened, /Earbuds/i);
    assert.ok(shortened.split(" ").length <= 6);
    for (const word of shortened.split(" ")) {
      assert.match(title, new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.doesNotMatch(shortened, /Invented|Premium|ProMax/i);

    const stuffed =
      "Cheap Best Buy Wireless Bluetooth Headphones Headphones Headphones Sale Hot Deal Black EU Fast Shipping Extra Bonus Gift";
    const stuffedShort = shortenVerifiedProductTitle(stuffed);
    assert.ok(stuffedShort.split(" ").length <= 6);
    for (const word of stuffedShort.split(" ")) {
      assert.match(
        stuffed,
        new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      );
    }
    assert.doesNotMatch(stuffedShort, /Studio|AirPods|Sony|Invented/i);

    const fromTitle = deriveProductDisplayIdentity({ title });
    assert.equal(fromTitle.unknown, false);
    assert.equal(fromTitle.source, "shortened_title");
    for (const word of fromTitle.displayName.split(" ")) {
      assert.match(title, new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });

  it("10. missing commission remains unavailable, not 0%", () => {
    assert.equal(formatCreatorCommissionPercent(null), "");
    assert.equal(formatCreatorCommissionPercent(undefined), "");
    assert.equal(parseOptionalCommission(null), null);
    assert.equal(parseOptionalCommission(""), null);
    assert.doesNotMatch(
      reels,
      /Number\.isFinite\(Number\(p\?\.commission\)\)[\s\S]{0,40}: 0/
    );
    assert.match(panels, /Commission unavailable/);
    assert.match(meta, /Commission unavailable/);
    assert.equal(formatCreatorCommissionPercent(parseOptionalCommission(null)), "");
  });

  it("11. real zero commission remains 0%", () => {
    assert.equal(parseOptionalCommission(0), 0);
    assert.equal(parseOptionalCommission("0"), 0);
    assert.equal(formatCreatorCommissionPercent(0), "0%");
    assert.match(
      generate,
      /Do NOT mention affiliate commission, payout percent, or creator earnings/
    );
  });

  it("12. canonical affiliateUrl / mode / SubID / tracking remain untouched", () => {
    const select = read(selectRel);
    const subid = read(subidRel);

    assert.match(
      offerMetaAssign,
      /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.match(offerMetaAssign, /mode: selectedOfferResolved\.mode,/);
    assert.match(
      renderHintsAssign,
      /selectedOffer: \{[\s\S]*mode: selectedOfferResolved\.mode,[\s\S]*affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.match(subid, /export function buildProductSubId/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /setFunnelUrl\(funnel\.funnel_url \|\| ""\)/);
    assert.doesNotMatch(identity, /buildStableSubId|promo_link|\/go\/offer/);
    assert.equal(isIdentifierLikeProductTitle("SKU_43928492"), true);
  });
});
