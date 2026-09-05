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
  return src.slice(start, start + 1800);
}

describe("Phase 1B cost and tracking route contracts", () => {
  it("1. unauth OpenAI route requires canonical user before provider call", () => {
    const src = read("app/api/openai/generate/route.ts");
    const post = handlerPrefix(src, "POST");
    const authAt = post.indexOf("requireUserIdOr401");
    const openaiAt = src.indexOf("api.openai.com");
    assert.ok(authAt >= 0);
    assert.ok(openaiAt > 0);
    assert.ok(src.indexOf("requireUserIdOr401") < openaiAt);
    assert.doesNotMatch(src, /console\.log\([^\n]*OpenAI svar/);
  });

  it("2. unauth Reels generation requires canonical user before OpenAI", () => {
    const src = read("app/api/reels/generate/route.ts");
    const post = handlerPrefix(src, "POST");
    assert.match(post, /requireUserIdOr401/);
    const authAt = src.indexOf("requireUserIdOr401");
    const openaiAt = src.indexOf("openai.chat.completions.create");
    assert.ok(authAt >= 0 && openaiAt > authAt);
  });

  it("3. media/music/pexels/seo cost routes require canonical user first", () => {
    const media = read("app/api/media/fetch/route.ts");
    const music = read("app/api/music/fetch/route.ts");
    const pexels = read("app/api/pexels/search/route.ts");
    const seo = read("app/api/seo/analyze/route.ts");

    for (const src of [media, music, pexels, seo]) {
      const post = handlerPrefix(src, "POST");
      assert.match(post, /requireUserIdOr401/);
      const authAt = src.indexOf("requireUserIdOr401");
      assert.ok(authAt >= 0);
    }

    assert.ok(
      pexels.indexOf("requireUserIdOr401") < pexels.indexOf("api.pexels.com")
    );
    assert.ok(
      seo.indexOf("requireUserIdOr401") < seo.indexOf("openai.chat.completions.create")
    );
  });

  it("4-5. spoofed body/header userId is not used as authorization on cost routes", () => {
    const openai = read("app/api/openai/generate/route.ts");
    const media = read("app/api/media/fetch/route.ts");
    const generate = read("app/api/reels/generate/route.ts");
    assert.match(openai, /void bodyUserId|void body\?\.userId/);
    assert.match(media, /void body\?\.userId/);
    assert.match(generate, /void \(body as \{ userId\?: unknown \}\)\.userId/);
    assert.doesNotMatch(openai, /generic Bearer/);
  });

  it("6. products/event uses session owner and ignores body userId", () => {
    const src = read("app/api/products/event/route.ts");
    assert.match(src, /requireUserIdOr401/);
    assert.match(src, /void body\?\.userId/);
    assert.match(src, /user_id: sessionUserId/);
    assert.doesNotMatch(src, /user_id: userId/);
  });

  it("7. render POST binds canonical owner and ignores client jobId overwrite", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    const post = handlerPrefix(src, "POST");
    assert.match(post, /requireUserIdOr401/);
    assert.match(post, /jobId = createRenderJobId\(\)/);
    assert.match(src, /user_id: params.userId/);
    assert.match(src, /void body.userId/);
    assert.doesNotMatch(
      src,
      /workerMessage: text \|\| null/
    );
  });

  it("8. render status queries jobId AND canonical user_id", () => {
    const src = read("app/api/reels/render-vx/status/route.ts");
    assert.match(src, /requireUserIdOr401/);
    assert.match(src, /\.eq\("job_id", jobId\)/);
    assert.match(src, /\.eq\("user_id", userId\)/);
  });

  it("offers/select uses requireUserId without changing SubID builders", () => {
    const src = read("app/api/offers/select/route.ts");
    assert.match(src, /requireUserId\(req\)/);
    assert.match(src, /void body\?\.userId/);
    assert.match(src, /buildStableSubId\(userId, source, externalId\)/);
    assert.doesNotMatch(src, /getServerSession/);
  });

  it("15. /go remains public", () => {
    const offer = read("app/go/offer/[savedId]/route.ts");
    const token = read("app/go/[token]/route.ts");
    assert.doesNotMatch(offer, /requireUserId/);
    assert.doesNotMatch(token, /requireUserId/);
    assert.match(offer, /offer_click_events/);
  });

  it("16. public Etsy QR lead POST remains public", () => {
    const src = read("app/api/etsy/qr/lead/route.ts");
    const postStart = src.indexOf("export async function POST");
    const post = src.slice(postStart);
    assert.doesNotMatch(post, /requireUserId\(req\)/);
    assert.match(post, /MISSING_TOKEN|TOKEN_NOT_FOUND/);
  });

  it("17. OAuth callbacks remain public as designed", () => {
    const google = read("app/api/oauth/google/callback/route.ts");
    const facebook = read("app/api/oauth/facebook/callback/route.ts");
    assert.doesNotMatch(google, /from \"@\/lib\/auth\/server\"/);
    assert.doesNotMatch(facebook, /from \"@\/lib\/auth\/server\"/);
  });

  it("19. tracking SubID/link builders remain unchanged in this phase surface", () => {
    const subid = read("lib/affiliate/subid.ts");
    const wp = read("lib/affiliate/sources/warriorplus.ts");
    const awin = read("lib/affiliate/sources/awin.ts");
    const byo = read("lib/affiliate/sources/byo.ts");
    assert.match(subid, /aa_p_\$\{h\}/);
    assert.match(wp, /hop_sid/);
    assert.match(awin, /clickref/);
    assert.match(byo, /network: \"byo\"/);
  });

  it("YouTube comments require session before YouTube API", () => {
    const src = read("app/api/social/youtube/comments/route.ts");
    const post = handlerPrefix(src, "POST");
    const authAt = post.indexOf("requireUserId(req)");
    assert.ok(authAt >= 0);
    const youtubeCallAt = post.indexOf("fetchYouTubeVideoMeta");
    assert.ok(authAt >= 0 && youtubeCallAt > authAt);
  });

  it("cron helpers fail closed and media-utils no longer fail-open", () => {
    const helper = read("lib/auth/cronAuth.ts");
    const media = read("app/api/cron/_shared/media-utils.ts");
    const hourly = read("app/api/cron/hourly/route.ts");
    const music = read("app/api/cron/music-bank/route.ts");
    assert.match(helper, /if \(!expected\) return false/);
    assert.match(media, /isCronRequestAuthorized/);
    assert.doesNotMatch(media, /if \(!expected\) return true/);
    assert.match(hourly, /isCronRequestAuthorized/);
    assert.doesNotMatch(hourly, /if \(required && token !== required\)/);
    assert.match(music, /isCronRequestAuthorized/);
    assert.doesNotMatch(music, /hasAuthHeader/);
  });
});
