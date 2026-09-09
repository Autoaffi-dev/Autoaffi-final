import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function handlerPrefix(src: string, exportName: string) {
  const start = src.indexOf(`export async function ${exportName}`);
  assert.ok(start >= 0, `missing export ${exportName}`);
  return src.slice(start, start + 1600);
}

describe("Phase 1C user_funnels contracts", () => {
  it("route uses requireUserId and existing getSupabaseAdmin only", () => {
    const src = read("app/api/user-funnels/route.ts");
    assert.match(src, /requireUserId/);
    assert.match(src, /from \"@\/lib\/auth\/server\"/);
    assert.match(src, /getSupabaseAdmin/);
    assert.match(src, /from \"@\/lib\/supabase\/server\"/);
    assert.doesNotMatch(src, /createClient\(/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(src, /getServerSession/);
    assert.doesNotMatch(src, /Authorization Bearer/);
    assert.doesNotMatch(src, /headers\.get\([\"']x-autoaffi-user-id[\"']\)/);
    assert.doesNotMatch(src, /headers\.get\([\"']x-user-id[\"']\)/);
  });

  it("GET/POST/DELETE go through canonical handlers before table access", () => {
    const route = read("app/api/user-funnels/route.ts");
    assert.match(handlerPrefix(route, "GET"), /handleUserFunnelsGet/);
    assert.match(handlerPrefix(route, "POST"), /handleUserFunnelsPost/);
    assert.match(handlerPrefix(route, "DELETE"), /handleUserFunnelsDelete/);

    const http = read("lib/user-funnels/http.ts");
    assert.match(http, /requireUserId\(req\)/);
    assert.match(http, /void body\?\.userId/);
    assert.match(http, /void body\?\.user_id/);
    assert.match(http, /insertOwnFunnel\(deps\.supabase, auth\.userId/);
    assert.match(http, /deleteOwnFunnel\(deps\.supabase, auth\.userId, funnelId\)/);
    assert.match(http, /listOwnFunnels\(deps\.supabase, auth\.userId\)/);
  });

  it("repo always scopes user_funnels by canonical user_id", () => {
    const src = read("lib/user-funnels/repo.ts");
    assert.match(src, /\.eq\(\"user_id\", userId\)/);
    assert.match(src, /user_id: userId/);
    assert.match(src, /\.eq\(\"id\", funnelId\)/);
    assert.match(src, /\.eq\(\"user_id\", userId\)/);
    assert.doesNotMatch(src, /USING \(true\)/);
    assert.doesNotMatch(src, /createClient\(/);
  });

  it("18. Funnel clients do not introduce a new browser Supabase auth system", () => {
    const builders = read("app/login/dashboard/funnel-builders/page.tsx");
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");

    assert.match(builders, /fetch\(\"\/api\/user-funnels\"/);
    assert.doesNotMatch(builders, /from\(\"user_funnels\"\)/);
    assert.doesNotMatch(builders, /createClient/);
    assert.doesNotMatch(builders, /supabase\.auth\.getUser/);
    assert.doesNotMatch(builders, /signIn/);

    assert.match(posts, /fetch\(\"\/api\/user-funnels\"/);
    assert.doesNotMatch(posts, /from\(\"user_funnels\"\)/);
    assert.doesNotMatch(posts, /signIn/);
    assert.doesNotMatch(posts, /x-autoaffi-user-id/);
  });

  it("15-17. Funnel Card / Posts / Funnel mode destination behavior is not redesigned", () => {
    const builders = read("app/login/dashboard/funnel-builders/page.tsx");
    const posts = read("app/login/dashboard/content-optimizer/posts/page.tsx");
    const reels = read("app/login/dashboard/content-optimizer/reels/page.tsx");

    assert.match(builders, /Connect your funnel link/);
    assert.match(builders, /funnel_url/);
    assert.match(posts, /Funnel Mode \(optional\)/);
    assert.match(posts, /setFunnelLink\(funnel\.funnel_url/);
    assert.match(posts, /offerType === \"funnel\"/);
    assert.match(reels, /offerMode === \"funnel\" && funnelUrl/);
    assert.match(reels, /affiliateUrl: funnelUrl/);
  });
});

describe("Phase 1C user_funnels RLS migration", () => {
  const sql = read(
    "supabase/migrations/20260909_phase1c_user_funnels_select_policy.sql"
  );
  const sqlBody = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("20-21. Migration retargets Allow read own funnel to authenticated auth.uid()", () => {
    assert.match(sql, /drop policy if exists \"Allow read own funnel\" on public\.user_funnels;/);
    assert.match(sql, /create policy \"Allow read own funnel\"/);
    assert.match(sql, /for select/);
    assert.match(sql, /to authenticated/);
    assert.match(sql, /using \(user_id = auth\.uid\(\)\);/);
  });

  it("22-23. Existing INSERT and UPDATE policies are not modified", () => {
    assert.doesNotMatch(sqlBody, /Allow insert own funnel/);
    assert.doesNotMatch(sqlBody, /Allow update own funnel/);
    assert.doesNotMatch(sqlBody, /for insert/i);
    assert.doesNotMatch(sqlBody, /for update/i);
  });

  it("24-27. RLS stays enabled; no anon SELECT, USING(true), or DELETE policy", () => {
    assert.doesNotMatch(sqlBody, /disable row level security/i);
    assert.doesNotMatch(sqlBody, /to anon/);
    assert.doesNotMatch(sqlBody, /using \(true\)/i);
    assert.doesNotMatch(sqlBody, /for delete/i);
  });
});

describe("Phase 1C winner RPC execute hardening", () => {
  const sql = read(
    "supabase/migrations/20260909_phase1c_winner_policy_execute.sql"
  );
  const original = read("supabase/migrations/20260217_product_index_beast.sql");

  it("28-33. Exact signature revoke PUBLIC/anon/authenticated; grant service_role", () => {
    assert.match(original, /grant execute on function public\.product_index_apply_winner_policy\(int,int,int,int,int\) to service_role;/);
    assert.match(
      sql,
      /revoke execute on function public\.product_index_apply_winner_policy\(int,int,int,int,int\) from public;/
    );
    assert.match(
      sql,
      /revoke execute on function public\.product_index_apply_winner_policy\(int,int,int,int,int\) from anon;/
    );
    assert.match(
      sql,
      /revoke execute on function public\.product_index_apply_winner_policy\(int,int,int,int,int\) from authenticated;/
    );
    assert.match(
      sql,
      /grant execute on function public\.product_index_apply_winner_policy\(int,int,int,int,int\) to service_role;/
    );
    assert.doesNotMatch(sql, /revoke execute[^\n]+from postgres/i);
  });

  it("34-35. Function body and winner logic remain in the original migration only", () => {
    const sqlBody = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.doesNotMatch(sqlBody, /create or replace function/i);
    assert.doesNotMatch(sqlBody, /security definer/i);
    assert.doesNotMatch(sqlBody, /search_path/);
    assert.doesNotMatch(sqlBody, /dead_reason/);
    assert.doesNotMatch(sqlBody, /winner_tier/);
    assert.match(original, /when rn_canon <> 1 then 'dedup_canonical'/);
    assert.match(original, /when s >= 85 then 'A'/);
  });

  it("36. Existing service-role Product Index callers remain compatible", () => {
    const winners = read("app/api/cron/product-winners/route.ts");
    const indexer = read("lib/engines/product-indexer/indexer.ts");
    const productAll = read("app/api/cron/product-all/route.ts");
    const productIndex = read("app/api/cron/product-index/route.ts");

    assert.match(winners, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(winners, /\.rpc\(\"product_index_apply_winner_policy\"/);
    assert.match(indexer, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(indexer, /\.rpc\(\"product_index_apply_winner_policy\"/);
    assert.match(productAll, /\/api\/cron\/product-winners/);
    assert.match(productIndex, /runProductIndexer/);
  });
});
