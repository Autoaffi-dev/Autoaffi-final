import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";

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

const generateRel = "app/api/reels/generate/route.ts";
const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const panelsRel = "components/reels/OfferPanels.tsx";
const offersSelectRel = "app/api/offers/select/route.ts";
const subidRel = "lib/affiliate/subid.ts";
const affiliateBuilderRel = "lib/affiliate/buildAffiliateLink.ts";
const platformsRel = "app/api/recurring/platforms/route.ts";
const goOfferRel = "app/go/offer/[savedId]/route.ts";

describe("Reels canonical offer destination + mode lock", () => {
  const generate = read(generateRel);
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

  it("1-2. Non-empty LLM affiliateUrl cannot override Product /go/offer canonical URL", () => {
    const reels = read(reelsRel);

    assert.match(reels, /affiliateUrl: selectedProductResolvedLink \|\| affiliateLink \|\| ""/);
    assert.match(reels, /return `\/go\/offer\/\$\{savedId\}`/);
    assert.match(
      offerMetaAssign,
      /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.doesNotMatch(
      offerMetaAssign,
      /parsed\.offerMeta\?\.affiliateUrl/
    );
    assert.equal(
      (harden.match(/affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/g) || [])
        .length,
      2
    );
  });

  it("3-4. Non-empty LLM affiliateUrl cannot override Recurring promo_link tracking params", () => {
    const reels = read(reelsRel);
    const platforms = read(platformsRel);

    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(platforms, /function buildPromoLink/);
    assert.match(platforms, /fp_sid=\$\{tracking\}/);
    assert.match(platforms, /tk=\$\{encodeURIComponent\(\s*tracking/);
    assert.match(platforms, /aff_sub=\$\{encodeURIComponent\(\s*tracking/);
    assert.doesNotMatch(
      generate,
      /affiliateUrl: safeString\(parsed\.offerMeta\?\.affiliateUrl/
    );
    assert.doesNotMatch(
      renderHintsAssign,
      /parsed\.offerMeta\?\.affiliateUrl/
    );
  });

  it("5. Non-empty LLM affiliateUrl cannot override Funnel URL", () => {
    const reels = read(reelsRel);

    assert.match(reels, /affiliateUrl: funnelUrl/);
    assert.match(reels, /setFunnelUrl\(funnel\.funnel_url \|\| ""\)/);
    assert.doesNotMatch(
      offerMetaAssign,
      /parsed\.offerMeta\?\.affiliateUrl/
    );
  });

  it("6-7. Empty canonical affiliateUrl stays empty; no LLM URL fallback exists", () => {
    assert.match(
      offerMetaAssign,
      /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.match(
      renderHintsAssign,
      /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.doesNotMatch(
      harden,
      /safeString\(parsed\.offerMeta\?\.affiliateUrl/
    );
    assert.doesNotMatch(
      harden,
      /parsed\.offerMeta\?\.affiliateUrl\s*\|\|/
    );
    assert.doesNotMatch(
      generate,
      /affiliateUrl: safeString\(parsed\.offerMeta\?\.affiliateUrl, selectedOfferResolved\.affiliateUrl\)/
    );
  });

  it("8. LLM cannot change canonical product/recurring/funnel mode", () => {
    assert.match(offerMetaAssign, /mode: selectedOfferResolved\.mode,/);
    assert.doesNotMatch(
      offerMetaAssign,
      /safeString\(parsed\.offerMeta\?\.mode, selectedOfferResolved\.mode\)/
    );
    assert.match(renderHintsAssign, /offerMode: selectedOfferResolved\.mode,/);
    assert.match(
      renderHintsAssign,
      /mode: selectedOfferResolved\.mode,/
    );
    assert.match(
      renderHintsAssign,
      /selectedOfferResolved\.mode === "product"/
    );
    assert.match(
      renderHintsAssign,
      /selectedOfferResolved\.mode === "funnel"/
    );
    assert.doesNotMatch(
      renderHintsAssign,
      /parsed\.offerMeta\?\.mode \|\| selectedOfferResolved\.mode/
    );
    assert.doesNotMatch(
      renderHintsAssign,
      /parsed\.offerMeta\?\.mode === "product"/
    );
  });

  it("9-11. offerMeta, selectedOffer, and renderHints.selectedOffer all lock canonical affiliateUrl + mode", () => {
    assert.match(
      harden,
      /parsed\.selectedOffer = \{ \.\.\.parsed\.offerMeta \};/
    );
    assert.match(
      offerMetaAssign,
      /mode: selectedOfferResolved\.mode,[\s\S]*affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.match(
      renderHintsAssign,
      /selectedOffer: \{[\s\S]*mode: selectedOfferResolved\.mode,[\s\S]*affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
  });

  it("12. No parsed.offerMeta subId/tracking_code/trackingId becomes authoritative", () => {
    const resolvedOffer = sliceBetween(
      generate,
      "function offerMetaToResolvedOffer(",
      "function getTargetSceneCount("
    );

    assert.doesNotMatch(offerMetaAssign, /subId|tracking_code|trackingId/);
    assert.doesNotMatch(renderHintsAssign, /subId|tracking_code|trackingId/);
    assert.doesNotMatch(resolvedOffer, /subId|tracking_code|trackingId/);
    assert.doesNotMatch(
      harden,
      /parsed\.offerMeta\?\.subId|parsed\.offerMeta\?\.tracking_code|parsed\.offerMeta\?\.trackingId/
    );
  });

  it("13. Product SubID / buildAffiliateLink / offers select /go/offer remain unchanged", () => {
    const select = read(offersSelectRel);
    const subid = read(subidRel);
    const builder = read(affiliateBuilderRel);
    const goOffer = read(goOfferRel);

    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.match(select, /buildAffiliateLink\(/);
    assert.match(select, /return `\/go\/offer\/\$\{id\}`/);
    assert.match(subid, /export function buildProductSubId/);
    assert.match(builder, /export async function buildAffiliateLink/);
    assert.match(goOffer, /affiliate_link/);
    assert.doesNotMatch(generate, /buildStableSubId/);
    assert.doesNotMatch(generate, /buildAffiliateLink/);
  });

  it("14. Reels Recurring still consumes p.promo_link", () => {
    const reels = read(reelsRel);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /subId: p\.tracking_code/);
    assert.match(reels, /fetch\("\/api\/recurring\/platforms"/);
  });

  it("15. Saved Funnel flow remains unchanged", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);

    assert.match(reels, /fetch\("\/api\/user-funnels"/);
    assert.match(reels, /setSelectedFunnelId\(funnel\.id\)/);
    assert.match(reels, /setFunnelUrl\(funnel\.funnel_url \|\| ""\)/);
    assert.match(panels, /onSelectSavedFunnel\(funnel\)/);
    assert.doesNotMatch(reels, /https:\/\/autoaffi\.io\/f\//);
    assert.doesNotMatch(reels, /buildProductSubId/);
  });

  it("16. Creative hook/caption/script/CTA generation remains untouched", () => {
    assert.match(generate, /function buildFallbackScript\(/);
    assert.match(generate, /function buildFallbackCta\(/);
    assert.match(generate, /function getHookExamples\(/);
    assert.match(harden, /parsed\.script = compressScriptToDuration\(parsed\.script, videoLength\);/);
    assert.match(harden, /if \(!parsed\.cta \|\| typeof parsed\.cta !== "string"/);
    assert.match(harden, /parsed\.thumbnailIntelligence = parsed\.thumbnailIntelligence \|\|/);
    assert.match(harden, /ensureMinSocialHints\(parsed, offerMetaInput\?\.mode\);/);
    assert.doesNotMatch(
      harden,
      /parsed\.script = selectedOfferResolved/
    );
  });
});
