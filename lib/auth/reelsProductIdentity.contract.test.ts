import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  deriveProductDisplayIdentity,
  formatCreatorCommissionPercent,
  isIdentifierLikeProductTitle,
  parseOptionalCommission,
  shortenVerifiedProductTitle,
} from "../content-optimizer/reelsProductIdentity.ts";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const reelsRel = "app/login/dashboard/content-optimizer/reels/page.tsx";
const panelsRel = "components/reels/OfferPanels.tsx";
const metaRel = "components/reels/OfferMetaPanel.tsx";
const generateRel = "app/api/reels/generate/route.ts";
const identityRel = "lib/content-optimizer/reelsProductIdentity.ts";
const selectRel = "app/api/offers/select/route.ts";
const subidRel = "lib/affiliate/subid.ts";

describe("Reels product identity and creator commission", () => {
  it("1. SKU/identifier is not used as a meaningful Product name", () => {
    assert.equal(isIdentifierLikeProductTitle("SWV24S2026-09-08614-09-2026"), true);
    assert.equal(isIdentifierLikeProductTitle("SKU_43928492"), true);
    assert.equal(isIdentifierLikeProductTitle("ABCD-182736-XX"), true);

    const sku = deriveProductDisplayIdentity({
      title: "SWV24S2026-09-08614-09-2026",
      category: "Uncategorized",
    });
    assert.equal(sku.unknown, true);
    assert.equal(sku.displayName, "");
    assert.notEqual(sku.displayName, "SWV24S2026-09-08614-09-2026");
  });

  it("2. Excessively long titles can be shortened using verified source words only", () => {
    const title =
      "Wireless Bluetooth Noise Cancelling Earbuds With Charging Case Black EU";
    const shortened = shortenVerifiedProductTitle(title);
    assert.match(shortened, /Wireless/i);
    assert.match(shortened, /Earbuds/i);
    assert.ok(shortened.split(" ").length <= 6);
    for (const word of shortened.split(" ")) {
      assert.match(title, new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.doesNotMatch(shortened, /Invented/i);
  });

  it("3. No invented Product identity is created", () => {
    const identity = deriveProductDisplayIdentity({
      title: "SKU_43928492",
      description: "",
      category: "Uncategorized",
    });
    assert.equal(identity.unknown, true);
    assert.equal(identity.displayName, "");
    assert.doesNotMatch(identity.displayName, /earbuds|premium|wireless/i);
  });

  it("4. Human-readable verified Product names remain intact", () => {
    const identity = deriveProductDisplayIdentity({
      title: "TubeMagic",
      category: "creator tools",
    });
    assert.equal(identity.unknown, false);
    assert.equal(identity.displayName, "TubeMagic");
    assert.equal(identity.source, "title");
  });

  it("5. Useful descriptions can strengthen Product identity", () => {
    const identity = deriveProductDisplayIdentity({
      title: "SWV24S2026-09-08614-09-2026",
      description: "Wireless noise cancelling earbuds for travel and commuting.",
      category: "Uncategorized",
    });
    assert.equal(identity.unknown, false);
    assert.equal(identity.source, "description");
    assert.match(identity.displayName, /Wireless/i);
    assert.match(identity.displayName, /earbuds/i);
    assert.doesNotMatch(identity.displayName, /SWV24S/);
  });

  it("6. Unknown Product identity remains unknown instead of fabricated", () => {
    const identity = deriveProductDisplayIdentity({
      title: "ABCD-182736-XX",
      merchantName: "",
      category: "unknown",
    });
    assert.equal(identity.unknown, true);
    assert.equal(identity.displayName, "");
    assert.equal(identity.categoryLabel, "");
  });

  it("7-8. Verified commission is kept; missing commission is not rendered as 0%", () => {
    assert.equal(formatCreatorCommissionPercent(12), "12%");
    assert.equal(formatCreatorCommissionPercent(0), "0%");
    assert.equal(formatCreatorCommissionPercent(null), "");
    assert.equal(formatCreatorCommissionPercent(undefined), "");
    assert.equal(parseOptionalCommission(null), null);
    assert.equal(parseOptionalCommission(""), null);
    assert.equal(parseOptionalCommission(25), 25);
    assert.equal(parseOptionalCommission("0"), 0);

    const reels = read(reelsRel);
    const panels = read(panelsRel);
    const meta = read(metaRel);

    assert.match(reels, /parseOptionalCommission\(/);
    assert.match(reels, /formatCreatorCommissionPercent\(/);
    assert.doesNotMatch(
      reels,
      /Number\.isFinite\(Number\(p\?\.commission\)\)[\s\S]{0,40}: 0/
    );
    assert.match(panels, /Commission unavailable/);
    assert.match(meta, /Commission unavailable/);
  });

  it("9. Public Reel script does not automatically advertise affiliate commission", () => {
    const generate = read(generateRel);
    assert.match(
      generate,
      /Do NOT mention affiliate commission, payout percent, or creator earnings/
    );
    assert.doesNotMatch(
      generate,
      /\$\{offerName\}[^\n]{0,80}commission/i
    );
  });

  it("10. Product script uses verified Product facts where available instead of generic invented benefits", () => {
    const generate = read(generateRel);
    assert.match(generate, /deriveProductDisplayIdentity\(/);
    assert.match(generate, /this product/);
    assert.doesNotMatch(
      generate,
      /gives \$\{category\} a cleaner, smarter and more premium feel/
    );
    assert.match(
      generate,
      /Only use facts present in OfferMeta name, description, and category/
    );
  });

  it("11. Existing canonical affiliateUrl, mode, SubID and tracking contracts remain untouched", () => {
    const generate = read(generateRel);
    const select = read(selectRel);
    const subid = read(subidRel);
    const reels = read(reelsRel);
    const identity = read(identityRel);

    assert.match(
      generate,
      /affiliateUrl: selectedOfferResolved\.affiliateUrl \|\| ""/
    );
    assert.match(generate, /mode: selectedOfferResolved\.mode,/);
    assert.match(select, /buildStableSubId\(userId, source, externalId\)/);
    assert.match(subid, /export function buildProductSubId/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /setFunnelUrl\(funnel\.funnel_url \|\| ""\)/);
    assert.doesNotMatch(identity, /buildStableSubId|promo_link|\/go\/offer/);
  });
});
