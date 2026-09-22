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
  const identitySrc = read(identityRel);
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

  it("1. SKU + Electronics + no useful description is NOT generation-trustworthy", () => {
    const skuElectronics = deriveProductDisplayIdentity({
      title: "SWV24S2026-09-08614-09-2026",
      category: "Electronics",
      description: "",
    });
    assert.equal(skuElectronics.source, "category");
    assert.equal(skuElectronics.unknown, true);
    assert.equal(hasTrustworthyProductIdentity(skuElectronics), false);
    assert.notEqual(skuElectronics.displayName, "SWV24S2026-09-08614-09-2026");
  });

  it("2. SKU + Electronics + concise description uses description identity, not Electronics", () => {
    const description = "Wireless noise cancelling earbuds for travel.";
    const identified = deriveProductDisplayIdentity({
      title: "SWV24S2026-09-08614-09-2026",
      category: "Electronics",
      description,
    });
    assert.equal(identified.source, "description");
    assert.equal(identified.unknown, false);
    assert.equal(hasTrustworthyProductIdentity(identified), true);
    assert.notEqual(identified.displayName, "Electronics");
    assert.match(identified.displayName, /Wireless/i);
    assert.match(identified.displayName, /earbuds/i);
    for (const word of identified.displayName.split(" ")) {
      assert.match(
        description,
        new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      );
    }
  });

  it("3. category-only Product is not auto-selected as usable", () => {
    const categoryOnly = deriveProductDisplayIdentity({
      title: "",
      category: "Electronics",
    });
    assert.equal(categoryOnly.source, "category");
    assert.equal(hasTrustworthyProductIdentity(categoryOnly), false);
    assert.match(reels, /hasTrustworthyProductIdentity\(/);
    assert.match(reels, /identityUnknown: !trusted/);
    assert.match(reels, /function firstUsableProductForGeneration\(/);
    assert.match(reels, /!p\?\.identityUnknown/);
    assert.match(reels, /return firstUsable;/);
    assert.match(panels, /if \(unavailable\) return;/);
  });

  it("4. merchant + broad category alone does not pass generation authority", () => {
    const merchantCategory = deriveProductDisplayIdentity({
      title: "SKU_43928492",
      merchantName: "Acme Store",
      category: "Electronics",
      description: "",
    });
    assert.equal(merchantCategory.source, "merchant_category");
    assert.equal(merchantCategory.unknown, true);
    assert.equal(hasTrustworthyProductIdentity(merchantCategory), false);
    assert.match(merchantCategory.displayName, /Acme/i);
    assert.match(merchantCategory.displayName, /Electronics/i);
  });

  it("5. title-based identity remains usable", () => {
    const titled = deriveProductDisplayIdentity({
      title: "TubeMagic",
      category: "creator tools",
    });
    assert.equal(titled.source, "title");
    assert.equal(titled.unknown, false);
    assert.equal(titled.displayName, "TubeMagic");
    assert.equal(hasTrustworthyProductIdentity(titled), true);
  });

  it("6. shortened-title identity remains usable", () => {
    const title =
      "Wireless Bluetooth Noise Cancelling Earbuds With Charging Case Black EU";
    const shortened = deriveProductDisplayIdentity({ title });
    assert.equal(shortened.source, "shortened_title");
    assert.equal(shortened.unknown, false);
    assert.equal(hasTrustworthyProductIdentity(shortened), true);
    assert.ok(shortened.displayName.split(" ").length <= 6);
    for (const word of shortened.displayName.split(" ")) {
      assert.match(title, new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    const helperShort = shortenVerifiedProductTitle(title);
    assert.ok(helperShort.split(" ").length <= 6);
  });

  it("7. concise description identity remains usable", () => {
    const description = "Wireless noise cancelling earbuds for travel.";
    const fromDescription = deriveProductDisplayIdentity({
      title: "ABCD-182736-XX",
      description,
      category: "Uncategorized",
    });
    assert.equal(fromDescription.source, "description");
    assert.equal(hasTrustworthyProductIdentity(fromDescription), true);
  });

  it("8. promotional description remains unusable as Product identity", () => {
    const promo =
      "Best choice for anyone who wants amazing quality and fast shipping.";
    const fromPromo = deriveProductDisplayIdentity({
      title: "SKU_43928492",
      description: promo,
      category: "Electronics",
    });
    assert.equal(hasTrustworthyProductIdentity(fromPromo), false);
    assert.notEqual(fromPromo.source, "description");
    assert.doesNotMatch(fromPromo.displayName, /Best choice/i);
    assert.doesNotMatch(fromPromo.displayName, /amazing quality/i);
  });

  it("9. client and server share equivalent trustworthy-identity behavior", () => {
    assert.match(identitySrc, /GENERATION_TRUSTED_IDENTITY_SOURCES/);
    assert.match(identitySrc, /"title"/);
    assert.match(identitySrc, /"shortened_title"/);
    assert.match(identitySrc, /"description"/);
    assert.match(reels, /hasTrustworthyProductIdentity\(identity\)/);
    assert.match(generate, /hasTrustworthyProductIdentity\(identity\)/);
    assert.match(post, /PRODUCT_IDENTITY_INSUFFICIENT_CODE/);
    assert.match(post, /!hasTrustworthyProductIdentity\(identity\)/);
    assert.match(reels, /PRODUCT_IDENTITY_INSUFFICIENT_MESSAGE/);
    assert.equal(
      PRODUCT_IDENTITY_INSUFFICIENT_MESSAGE,
      "Autoaffi does not have enough product information to create a relevant Reel. Choose another product."
    );
    const identityUnknownIdx = post.indexOf("PRODUCT_IDENTITY_INSUFFICIENT_CODE");
    const mediaIdx = post.indexOf("/api/media/fetch");
    assert.ok(mediaIdx > identityUnknownIdx);
  });

  it("10. parseOptionalCommission whitespace is unavailable", () => {
    assert.equal(parseOptionalCommission("   "), null);
    assert.equal(formatCreatorCommissionPercent(parseOptionalCommission("   ")), "");
  });

  it("11. parseOptionalCommission empty string is unavailable", () => {
    assert.equal(parseOptionalCommission(""), null);
    assert.equal(parseOptionalCommission(null), null);
    assert.equal(parseOptionalCommission(undefined), null);
    assert.match(panels, /Commission unavailable/);
    assert.match(meta, /Commission unavailable/);
  });

  it("12. parseOptionalCommission(0) remains verified zero", () => {
    assert.equal(parseOptionalCommission(0), 0);
    assert.equal(formatCreatorCommissionPercent(0), "0%");
  });

  it("13. parseOptionalCommission(\"0\") remains verified zero", () => {
    assert.equal(parseOptionalCommission("0"), 0);
    assert.equal(formatCreatorCommissionPercent(parseOptionalCommission("0")), "0%");
  });

  it("14. public fallback script contains no internal/developer-style instruction", () => {
    assert.doesNotMatch(fallbackScript, /Talk about that, not a premium vibe/);
    assert.doesNotMatch(fallbackScript, /with a clear identity/);
    assert.doesNotMatch(generate, /Talk about that, not a premium vibe/);
    assert.doesNotMatch(generate, /product with a clear identity/);
    assert.match(fallbackScript, /This reel is about \$\{offerName\}/);
    assert.match(fallbackScript, /hasTrustworthyProductIdentity\(identity\)/);
  });

  it("15. affiliateUrl, canonical mode, SubID and tracking remain untouched", () => {
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
    assert.doesNotMatch(identitySrc, /buildStableSubId|promo_link|\/go\/offer/);
    assert.equal(isIdentifierLikeProductTitle("SKU_43928492"), true);
    assert.equal(PRODUCT_IDENTITY_INSUFFICIENT_CODE, "PRODUCT_IDENTITY_INSUFFICIENT");
  });
});
