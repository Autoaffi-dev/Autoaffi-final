import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 1A route contracts", () => {
  it("7. Business Finder search uses canonical requireUserId (logged out → throw/401)", () => {
    const src = read("app/api/business/search/route.ts");
    assert.match(src, /requireUserId\(req\)/);
    assert.doesNotMatch(src, /x-autoaffi-user-id/);
    assert.doesNotMatch(src, /NEXT_PUBLIC_DEV_USER_ID/);
  });

  it("Contact Manager send-email UUID validator accepts canonical 8-4-4-4-12 ids", () => {
    const src = read("app/api/contact-manager/send-email/route.ts");
    const canonical =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const malformedEightFourFourTwelve =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    assert.match(
      src,
      /return \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i\.test/
    );
    assert.doesNotMatch(
      src,
      /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/
    );

    assert.equal(canonical.test("11111111-1111-4111-8111-111111111111"), true);
    assert.equal(
      malformedEightFourFourTwelve.test("11111111-1111-4111-8111-111111111111"),
      false
    );
    assert.equal(canonical.test("11111111-1111-4111-111111111111"), false);
    assert.equal(canonical.test("not-a-uuid"), false);
    assert.equal(canonical.test("contact_123"), false);

    assert.match(src, /const userId = await requireUserId\(req\)/);
    assert.match(src, /\.eq\(\"id\", contactId\)/);
    assert.match(src, /\.eq\(\"user_id\", userId\)/);
    assert.match(src, /error: \"CONTACT_ID_REQUIRED\"/);
  });

  it("8. Contact Manager / Leads Hub use canonical requireUserId", () => {
    const contact = read("app/api/contact-manager/overview/route.ts");
    const leads = read("app/api/leads-hub/overview/route.ts");
    assert.match(contact, /requireUserId\(req\)/);
    assert.match(leads, /requireUserId\(req\)/);
    assert.doesNotMatch(contact, /NEXT_PUBLIC_DEV_USER_ID/);
    assert.doesNotMatch(leads, /NEXT_PUBLIC_DEV_USER_ID/);
    assert.doesNotMatch(contact, /getEffectiveUserId/);
    assert.doesNotMatch(leads, /getEffectiveUserId/);
  });

  it("9. public QR/token POST lead capture is not session-gated", () => {
    const src = read("app/api/etsy/qr/lead/route.ts");
    const postStart = src.indexOf("export async function POST");
    assert.ok(postStart > 0);
    const post = src.slice(postStart);
    assert.match(post, /MISSING_TOKEN|TOKEN_NOT_FOUND/);
    assert.doesNotMatch(post, /requireUserId\(req\)/);
  });

  it("10. OAuth callback routes are not blindly NextAuth-gated at the handler entry", () => {
    const google = read("app/api/oauth/google/callback/route.ts");
    const facebook = read("app/api/oauth/facebook/callback/route.ts");
    assert.doesNotMatch(google, /from \"@\/lib\/auth\/server\"/);
    assert.doesNotMatch(facebook, /from \"@\/lib\/auth\/server\"/);
    assert.match(google, /export async function GET/);
    assert.match(facebook, /export async function GET/);
  });

  it("one canonical requireUserId: supabase/server re-exports auth/server", () => {
    const supabaseServer = read("lib/supabase/server.ts");
    assert.match(
      supabaseServer,
      /export \{ requireUserId \} from \"@\/lib\/auth\/server\"/
    );
    assert.doesNotMatch(supabaseServer, /getUser\(token\)/);
    assert.doesNotMatch(supabaseServer, /async function requireUserId/);
  });

  it("Growth Hub, Social Accounts, Smart Suggestions, Viral Heads-Up stay out of this diff surface in source contracts", () => {
    const growth = read("app/api/growth-hub/overview/route.ts");
    assert.match(growth, /async function getEffectiveUserId/);
  });

  it("WarriorPlus POST does not synthesize GET and ignores body/query userId", () => {
    const src = read("app/api/affiliate/warriorplus/link/route.ts");
    const postStart = src.indexOf("export async function POST");
    assert.ok(postStart > 0);
    const post = src.slice(postStart);

    assert.doesNotMatch(post, /new NextRequest/);
    assert.doesNotMatch(post, /return GET\(/);
    assert.match(post, /requireUserId\(req\)/);
    assert.match(src, /async function buildWarriorPlusAffiliateLink/);
    assert.doesNotMatch(post, /searchParams\.get\([\"']userId[\"']\)/);
    assert.doesNotMatch(
      post,
      /const userId = String\(body\?\.userId/
    );
    assert.match(post, /void body\?\.userId/);
  });

  it("GDPR placeholders fail closed and ignore client userId", () => {
    const exp = read("pages/api/data/export.ts");
    const del = read("pages/api/data/delete.ts");
    assert.match(exp, /NOT_IMPLEMENTED/);
    assert.match(del, /NOT_IMPLEMENTED/);
    assert.match(exp, /No data was exported/);
    assert.match(del, /No data was deleted/);
    assert.doesNotMatch(exp, /req\.query/);
    assert.doesNotMatch(del, /req\.body/);
  });
});
