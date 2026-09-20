import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const panelsRel = "components/reels/OfferPanels.tsx";
const generateRel = "app/api/reels/generate/route.ts";
const renderRel = "app/api/reels/render-vx/route.ts";
const userFunnelsRouteRel = "app/api/user-funnels/route.ts";
const userFunnelsHttpRel = "lib/user-funnels/http.ts";

describe("Reels saved funnels integration", () => {
  it("1-3. Reels fetches session-scoped /api/user-funnels without browser user identity", () => {
    const reels = read(reelsRel);

    assert.match(reels, /fetch\("\/api\/user-funnels"/);
    assert.match(reels, /cache: "no-store"/);
    assert.doesNotMatch(reels, /from\("user_funnels"\)/);
    assert.doesNotMatch(reels, /x-autoaffi-user-id/);
    assert.doesNotMatch(reels, /x-user-id/);
    assert.doesNotMatch(
      reels,
      /fetch\("\/api\/user-funnels"[\s\S]{0,400}userId/
    );
    assert.doesNotMatch(
      reels,
      /fetch\("\/api\/user-funnels"[\s\S]{0,400}user_id/
    );
  });

  it("4-6. Saved funnel click sets funnelUrl from funnel.funnel_url and selectedFunnelId, with no funnels[0] auto-select", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);

    assert.match(reels, /setSelectedFunnelId\(funnel\.id\)/);
    assert.match(reels, /setFunnelUrl\(funnel\.funnel_url \|\| ""\)/);
    assert.match(panels, /onSelectSavedFunnel\(funnel\)/);
    assert.doesNotMatch(reels, /funnels\[0\]/);
    assert.doesNotMatch(reels, /mapped\[0\]/);
    assert.doesNotMatch(reels, /rows\[0\]/);
    assert.match(
      reels,
      /setSelectedFunnelId\(\(prev\) =>\s*prev && mapped\.some/
    );
  });

  it("7. Selecting Funnel mode alone does not invent or set funnelUrl", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);
    const selector = read("components/reels/OfferTypeSelector.tsx");

    assert.match(reels, /useState\(""\)/);
    assert.match(selector, /setOfferMode\(m\.key\)/);
    assert.doesNotMatch(selector, /setFunnelUrl/);
    assert.match(
      panels,
      /onClick=\{\(\) => setOfferMode\(opt as "product" \| "recurring" \| "funnel"\)\}/
    );
  });

  it("8-10. Manual Funnel URL stays editable; mismatch clears selectedFunnelId but keeps funnelUrl; failed load leaves []", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);

    assert.match(panels, /onChange=\{\(e\) => onFunnelUrlChange\(e\.target\.value\)\}/);
    assert.match(reels, /function handleFunnelUrlChange\(next: string\)/);
    assert.match(reels, /setFunnelUrl\(next\)/);
    assert.match(reels, /setSelectedFunnelId\(null\)/);
    assert.doesNotMatch(reels, /setFunnelUrl\(""\);\s*\n\s*setSelectedFunnelId\(null\)/);
    assert.match(reels, /if \(!res\.ok\) \{[\s\S]*setSavedFunnels\(\[\]\)/);
    assert.match(reels, /catch \(err\) \{[\s\S]*setSavedFunnels\(\[\]\)/);
  });

  it("11-13. Funnel destination still flows through affiliateUrl, finalAffiliateLink, and generate payload", () => {
    const reels = read(reelsRel);

    assert.match(reels, /affiliateUrl: funnelUrl/);
    assert.match(
      reels,
      /const finalAffiliateLink =\s*offerMode === "product"[\s\S]*: funnelUrl \|\| ""/
    );
    assert.match(reels, /fetch\("\/api\/reels\/generate"/);
    assert.match(reels, /selectedOffer,/);
    assert.match(reels, /offerMeta: nextOfferMeta,/);
  });

  it("14-15. render-vx data flow is untouched and no funnel wrapper/SubID is added", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);
    const render = read(renderRel);

    assert.match(reels, /fetch\("\/api\/reels\/render-vx"/);
    assert.match(reels, /affiliateLink=\{finalAffiliateLink\}/);
    assert.match(render, /affiliateUrl: normalizeText\(raw\.affiliateUrl, ""\)/);
    assert.doesNotMatch(reels, /https:\/\/autoaffi\.io\/f\//);
    assert.doesNotMatch(reels, /\/f\/\$\{/);
    assert.doesNotMatch(panels, /\/go\/offer/);
    assert.doesNotMatch(reels, /buildProductSubId/);
    assert.doesNotMatch(reels, /buildStableSubId/);
    assert.doesNotMatch(panels, /\/go\/offer/);
  });

  it("16-17. Product selection and Recurring promo_link consumption remain unchanged", () => {
    const reels = read(reelsRel);

    assert.match(reels, /if \(offerMode === "product" && selectedProduct\)/);
    assert.match(reels, /selectedProductResolvedLink \|\| affiliateLink \|\| ""/);
    assert.match(reels, /fetch\("\/api\/recurring\/platforms"/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
  });

  it("18. Canonical /api/user-funnels auth contracts remain unchanged", () => {
    const route = read(userFunnelsRouteRel);
    const http = read(userFunnelsHttpRel);

    assert.match(route, /requireUserId/);
    assert.match(http, /void body\?\.userId/);
    assert.match(http, /void body\?\.user_id/);
    assert.match(http, /listOwnFunnels\(deps\.supabase, auth\.userId\)/);
  });

  it("19. User-facing Funnel copy no longer claims an ID is synced to affiliate tracking", () => {
    const reels = read(reelsRel);
    const panels = read(panelsRel);

    assert.doesNotMatch(panels, /Funnel URL \(rawid\)/);
    assert.match(panels, />Funnel URL</);
    assert.doesNotMatch(
      panels,
      /sync this funnel ID to hooks, CTA, timeline & affiliate tracking/
    );
    assert.match(
      panels,
      /This exact funnel URL is used as the reel destination\. It is not rewritten\./
    );
    assert.doesNotMatch(reels, /Funnel Tracking Enabled/);
    assert.match(reels, /Funnel destination attached/);
  });

  it("generate route is not modified by this integration", () => {
    const generate = read(generateRel);
    assert.match(
      generate,
      /affiliateUrl: safeString\(parsed\.offerMeta\?\.affiliateUrl, selectedOfferResolved\.affiliateUrl\)/
    );
  });
});
