import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "coverage",
  "dist",
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const TOKEN_TABLE_FILES = [
  "app/api/business/email/callback/route.ts",
  "app/api/business/email/disconnect/route.ts",
  "app/api/business/email/send/route.ts",
  "app/api/contact-manager/send-email/route.ts",
  "lib/business/services/emailReplySyncService.ts",
] as const;

describe("Phase 1D-A inbox token encryption contracts", () => {
  it("OAuth callback encrypts tokens before inbox/token DB mutation", () => {
    const src = read("app/api/business/email/callback/route.ts");
    const encryptAccessIdx = src.indexOf(
      "const encryptedAccessToken = encryptInboxToken(tokenJson.access_token)"
    );
    const encryptRefreshIdx = src.indexOf(
      "const encryptedRefreshToken = encryptInboxTokenNullable("
    );
    const firstUpdateIdx = src.indexOf(".update(");
    const firstInsertIdx = src.indexOf(".insert(");

    assert.ok(encryptAccessIdx >= 0, "missing encryptedAccessToken");
    assert.ok(encryptRefreshIdx >= 0, "missing encryptedRefreshToken");
    assert.ok(firstUpdateIdx >= 0, "missing inbox/token update");
    assert.ok(firstInsertIdx >= 0, "missing token insert");
    assert.ok(
      encryptAccessIdx < firstUpdateIdx,
      "encryptedAccessToken must be computed before the first DB update"
    );
    assert.ok(
      encryptRefreshIdx < firstUpdateIdx,
      "encryptedRefreshToken must be computed before the first DB update"
    );
    assert.ok(
      encryptAccessIdx < firstInsertIdx,
      "encryptedAccessToken must be computed before token INSERT"
    );

    const insertBlock = src.slice(firstInsertIdx, firstInsertIdx + 700);
    assert.match(insertBlock, /access_token:\s*encryptedAccessToken/);
    assert.match(insertBlock, /refresh_token:\s*encryptedRefreshToken/);
    assert.doesNotMatch(insertBlock, /access_token:\s*tokenJson\.access_token/);
    assert.doesNotMatch(insertBlock, /refresh_token:\s*encryptInboxTokenNullable/);
    assert.doesNotMatch(
      src,
      /insert\(\{[\s\S]*access_token:\s*tokenJson\.access_token/
    );
  });

  it("Business Finder send reveals before provider use and encrypts refreshed access token", () => {
    const src = read("app/api/business/email/send/route.ts");
    assert.match(src, /revealStoredInboxTokens\(data as TokenRow\)/);
    assert.match(src, /encryptInboxToken\(json\.access_token\)/);
    assert.match(src, /oauth2\.googleapis\.com\/token/);
    const refreshFn = src.slice(src.indexOf("async function refreshGoogleAccessToken"));
    assert.match(refreshFn, /refresh_token: tokenRow\.refresh_token/);
    assert.match(refreshFn, /encryptInboxToken\(json\.access_token\)/);
    assert.doesNotMatch(
      refreshFn.slice(refreshFn.indexOf(".update(")),
      /access_token:\s*json\.access_token/
    );
  });

  it("Contact Manager send reveals before provider use and encrypts refreshed access token", () => {
    const src = read("app/api/contact-manager/send-email/route.ts");
    assert.match(src, /revealStoredInboxTokens\(data as TokenRow\)/);
    assert.match(src, /encryptInboxToken\(json\.access_token\)/);
    const refreshFn = src.slice(src.indexOf("async function refreshGoogleAccessToken"));
    assert.match(refreshFn, /encryptInboxToken\(json\.access_token\)/);
    assert.doesNotMatch(
      refreshFn.slice(refreshFn.indexOf(".update(")),
      /access_token:\s*json\.access_token/
    );
  });

  it("Reply Sync reveals before Gmail use and encrypts refreshed access token", () => {
    const src = read("lib/business/services/emailReplySyncService.ts");
    assert.match(src, /revealStoredInboxTokens\(data as ActiveTokenRow\)/);
    assert.match(src, /encryptInboxToken\(json\.access_token\)/);
    const refreshFn = src.slice(src.indexOf("async function refreshGoogleAccessToken"));
    assert.match(refreshFn, /encryptInboxToken\(json\.access_token\)/);
    assert.doesNotMatch(
      refreshFn.slice(refreshFn.indexOf(".update(")),
      /access_token:\s*json\.access_token/
    );
  });

  it("no browser code gains token-table access", () => {
    const browserRoots = [
      path.join(root, "app", "login"),
      path.join(root, "components"),
      path.join(root, "app", "components"),
    ];
    const files = browserRoots.flatMap((dir) =>
      fs.existsSync(dir) ? walk(dir) : []
    );

    for (const file of files) {
      if (file.includes(`${path.sep}api${path.sep}`)) continue;
      const src = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /user_connected_inbox_tokens/,
        file.replace(root + path.sep, "")
      );
      assert.doesNotMatch(src, /inboxTokenCrypto/, file.replace(root + path.sep, ""));
    }
  });

  it("token table access stays limited to the live Gmail consumers plus disconnect", () => {
    const files = walk(root);
    const hits = files.filter((file) => {
      const rel = file.replace(root + path.sep, "");
      if (rel.endsWith(".test.ts")) return false;
      const src = fs.readFileSync(file, "utf8");
      return src.includes("user_connected_inbox_tokens");
    });

    const rels = hits
      .map((file) => file.replace(root + path.sep, "").replaceAll("\\", "/"))
      .sort();
    assert.deepEqual(rels, [...TOKEN_TABLE_FILES]);
  });

  it("public.leads is untouched", () => {
    for (const rel of TOKEN_TABLE_FILES) {
      const src = read(rel);
      assert.doesNotMatch(src, /from\([\"']leads[\"']\)/);
      assert.doesNotMatch(src, /public\.leads/);
    }
    assert.equal(fs.existsSync(path.join(root, "supabase/schema.sql")), true);
  });

  it("encryption key is server-only and never NEXT_PUBLIC", () => {
    const crypto = read("lib/inboxTokenCrypto.ts");
    assert.match(crypto, /process\.env\.INBOX_TOKEN_ENC_KEY/);
    assert.doesNotMatch(crypto, /NEXT_PUBLIC_/);
    assert.match(crypto, /aes-256-gcm/);
    assert.match(crypto, /randomBytes\(IV_LENGTH\)/);
    assert.match(crypto, /IV_LENGTH = 12/);
    assert.match(crypto, /INBOX_TOKEN_CIPHER_PREFIX = \"v1:\"/);
    assert.match(crypto, /decoded\.toString\(\"base64\"\) !== encoded/);
    assert.match(crypto, /STANDARD_BASE64/);

    const pkg = read("package.json");
    assert.doesNotMatch(pkg, /\"type\"\s*:\s*\"module\"/);

    for (const file of walk(root)) {
      const rel = file.replace(root + path.sep, "");
      if (rel.endsWith(".test.ts")) continue;
      const src = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(src, /NEXT_PUBLIC_INBOX_TOKEN_ENC_KEY/, rel);
    }
  });

  it("no token or key logging is introduced", () => {
    const watched = [
      "lib/inboxTokenCrypto.ts",
      ...TOKEN_TABLE_FILES,
    ];
    for (const rel of watched) {
      const src = read(rel);
      assert.doesNotMatch(src, /console\.(log|debug|info|warn|error)/);
      assert.doesNotMatch(src, /INBOX_TOKEN_ENC_KEY\)/);
    }
  });

  it("does not change social token encryption or schema", () => {
    const social = read("lib/socialCrypto.ts");
    assert.match(social, /SOCIAL_TOKEN_ENC_KEY/);
    assert.match(social, /createHash\(\"sha256\"\)/);
    assert.doesNotMatch(social, /INBOX_TOKEN_ENC_KEY/);
    assert.doesNotMatch(social, /v1:/);

    const migrationsDir = path.join(root, "supabase", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const names = fs.readdirSync(migrationsDir);
      assert.equal(
        names.some((name) => /inbox.?token|user_connected_inbox_tokens/i.test(name)),
        false
      );
    }
  });
});
