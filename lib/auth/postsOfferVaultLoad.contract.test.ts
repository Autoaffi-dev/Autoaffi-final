import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Posts offer vault loads through NextAuth", () => {
  it("A-H. Posts loads vault, funnels, and recurring without browser Supabase auth", () => {
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");

    assert.doesNotMatch(posts, /createClient/);
    assert.doesNotMatch(posts, /supabase\.auth\.getUser/);
    assert.doesNotMatch(posts, /@supabase\/supabase-js/);
    assert.doesNotMatch(posts, /if \(!user\?\.id\) return/);

    const vaultStart = posts.indexOf("async function loadVaultOffers()");
    const vaultEnd = posts.indexOf("useEffect(() => {\n    void loadVaultOffers();", vaultStart);
    const vaultLoader = posts.slice(vaultStart, vaultEnd);
    assert.match(vaultLoader, /\/api\/affiliate\/products\/list/);

    const mountVault = posts.slice(vaultEnd, posts.indexOf("const refreshAll", vaultEnd));
    assert.match(mountVault, /void loadVaultOffers\(\)/);
    assert.match(mountVault, /\}, \[\]\);/);
    assert.doesNotMatch(mountVault, /user\?\.id/);

    const recurring = posts.slice(
      posts.indexOf("useEffect(() => {\n    void loadRecurringPlatforms();"),
      posts.indexOf("const hasRecurringStack")
    );
    assert.match(recurring, /void loadRecurringPlatforms\(\)/);
    assert.match(recurring, /\}, \[\]\);/);
    assert.doesNotMatch(recurring, /user\?\.id/);

    const refreshStart = posts.indexOf("const refreshAll = async () => {");
    const refreshEnd = posts.indexOf("const primaryVaultOffer", refreshStart);
    const refresh = posts.slice(refreshStart, refreshEnd);
    assert.match(refresh, /loadVaultOffers\(\)/);
    assert.match(refresh, /loadFunnels\(\)/);
    assert.match(refresh, /loadRecurringPlatforms\(\)/);
    assert.match(refresh, /setInterval\(refreshAll, 10000\)/);
    assert.match(refresh, /addEventListener\("focus"/);
    assert.match(refresh, /addEventListener\("visibilitychange"/);
    assert.match(refresh, /\}, \[\]\);/);
    assert.doesNotMatch(refresh, /user\?\.id/);
  });

  it("I. product list stays authenticated by the NextAuth session user", () => {
    const route = read("app/api/affiliate/products/list/route.ts");
    assert.match(route, /getServerSession\(authOptions/);
    assert.match(route, /session as any\)\?\.user\?\.id/);
    assert.match(route, /error: "Unauthorized"/);
    assert.match(route, /\.eq\("user_id", userId\)/);
    assert.doesNotMatch(route, /searchParams\.get\("userId"\)/);
    assert.doesNotMatch(route, /searchParams\.get\("user_id"\)/);
  });
});
