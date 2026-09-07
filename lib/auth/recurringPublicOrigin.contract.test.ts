import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 1B Recurring Autoaffi public origin contracts", () => {
  it("both Recurring Autoaffi URL builders use public origin and keep ?ref= encoding", () => {
    const link = read("app/api/recurring/autoaffi/link/route.ts");
    const platforms = read("app/api/recurring/platforms/route.ts");

    for (const src of [link, platforms]) {
      assert.match(src, /requirePublicAppOrigin/);
      assert.match(src, /\/\?ref=\$\{encodeURIComponent\(/);
      assert.doesNotMatch(src, /"http:\/\/localhost:3000"/);
      assert.doesNotMatch(src, /req\.headers\.get\("host"\)/);
      assert.doesNotMatch(src, /x-forwarded-host/);
      assert.doesNotMatch(src, /VERCEL_URL/);
      assert.doesNotMatch(src, /requireTrustedInternalOrigin/);
      assert.doesNotMatch(src, /internalAppOrigin/);
    }
  });

  it("existing autoaffi_user_code is reused; only origin helper is new", () => {
    const link = read("app/api/recurring/autoaffi/link/route.ts");
    const platforms = read("app/api/recurring/platforms/route.ts");

    assert.match(link, /let code = existing\?\.autoaffi_user_code/);
    assert.match(link, /if \(!code\)/);
    assert.match(platforms, /let tracking = existing\?\.autoaffi_user_code \?\? null/);
    assert.match(platforms, /if \(!tracking\)/);
    assert.match(platforms, /tracking_code: tracking/);
    assert.match(link, /requireUserId\(req\)/);
    assert.match(platforms, /requireUserId\(req\)/);
  });

  it("unauthenticated Recurring routes stay session-gated", () => {
    const link = read("app/api/recurring/autoaffi/link/route.ts");
    const platforms = read("app/api/recurring/platforms/route.ts");
    assert.match(link, /if \(msg === "UNAUTHORIZED"\)/);
    assert.match(platforms, /if \(!resolvedUserId\) return jsonNoStore\(\{ error: "Unauthorized" \}, 401\)/);
    assert.doesNotMatch(link, /x-autoaffi-user-id/);
    assert.doesNotMatch(platforms, /x-autoaffi-user-id/);
  });

  it("non-Autoaffi platform promo URLs remain hardcoded provider destinations", () => {
    const src = read("app/api/recurring/platforms/route.ts");
    assert.match(src, /https:\/\/syllaby\.io\/\?via=autoaffi31&fp_sid=\$\{tracking\}/);
    assert.match(src, /https:\/\/www\.submagic\.co\/\?via=autoaffi&fp_sid=\$\{tracking\}/);
    assert.match(src, /https:\/\/justcall\.io\/\?aa=\$\{tracking\}/);
    assert.match(src, /case "autoaffi": \{[\s\S]*requirePublicAppOrigin\(\)/);
  });

  it("Reels still consumes Autoaffi promo_link in the existing field shape", () => {
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    assert.match(reels, /fetch\("\/api\/recurring\/platforms"/);
    assert.match(reels, /affiliateUrl: p\.promo_link/);
    assert.match(reels, /promo_link: string \| null/);
  });

  it("fail-closed origin errors return a stable code without env names", () => {
    const link = read("app/api/recurring/autoaffi/link/route.ts");
    const platforms = read("app/api/recurring/platforms/route.ts");
    assert.match(link, /error: PUBLIC_ORIGIN_NOT_CONFIGURED/);
    assert.match(platforms, /error: PUBLIC_ORIGIN_NOT_CONFIGURED/);
    assert.doesNotMatch(link, /affiliate_link[\s\S]{0,80}localhost/);
    assert.doesNotMatch(platforms, /return `\$\{base\.replace/);
  });
});
