import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 1D-B Gmail lifecycle contracts", () => {
  it("disconnect scopes inbox+token deactivation to the canonical user and returned inbox ids", () => {
    const src = read("app/api/business/email/disconnect/route.ts");
    assert.match(src, /requireUserId\(req\)/);
    assert.match(src, /from \"@\/lib\/supabase\/server\"/);
    assert.doesNotMatch(src, /x-autoaffi-user-id/);
    assert.doesNotMatch(src, /body\?\.userId/);

    const inboxFrom = src.indexOf('.from("user_connected_inboxes")');
    const tokenFrom = src.indexOf('.from("user_connected_inbox_tokens")');
    assert.ok(inboxFrom >= 0);
    assert.ok(tokenFrom > inboxFrom);

    const inboxUpdate = src.slice(inboxFrom, tokenFrom);
    assert.match(inboxUpdate, /status: \"disconnected\"/);
    assert.match(inboxUpdate, /is_active: false/);
    assert.match(inboxUpdate, /send_enabled: false/);
    assert.match(inboxUpdate, /sync_replies_enabled: false/);
    assert.match(inboxUpdate, /\.eq\(\"user_id\", userId\)/);
    assert.match(inboxUpdate, /\.eq\(\"is_active\", true\)/);
    assert.match(inboxUpdate, /\.select\(\"id\"\)/);

    const tokenUpdate = src.slice(tokenFrom);
    assert.match(tokenUpdate, /is_active: false/);
    assert.match(tokenUpdate, /\.eq\(\"user_id\", userId\)/);
    assert.match(tokenUpdate, /\.eq\(\"is_active\", true\)/);
    assert.match(tokenUpdate, /\.in\(\"inbox_id\", inboxIds\)/);
    assert.doesNotMatch(tokenUpdate, /\.delete\(/);
    assert.doesNotMatch(src, /oauth2\.googleapis\.com\/revoke/);
    assert.doesNotMatch(src, /\.delete\(/);
    assert.doesNotMatch(src, /revealInboxToken/);
    assert.doesNotMatch(src, /encryptInboxToken/);
  });

  it("reconnect keeps a working Gmail inbox live and only merges oauth attempt metadata", () => {
    const src = read("app/api/business/email/connect/route.ts");
    assert.match(src, /isWorkingGmailConnection\(existingInbox\)/);
    assert.match(src, /mergeInboxOauthAttemptMetadata/);

    const liveBranch = src.slice(
      src.indexOf("if (isWorkingGmailConnection(existingInbox))"),
      src.indexOf("} else {")
    );
    assert.match(liveBranch, /\.update\(/);
    assert.match(liveBranch, /updated_at: nowIso/);
    assert.doesNotMatch(liveBranch, /status: \"pending\"/);
    assert.doesNotMatch(liveBranch, /is_active: false/);
    assert.doesNotMatch(liveBranch, /send_enabled: false/);
    assert.doesNotMatch(liveBranch, /sync_replies_enabled: false/);
    assert.match(liveBranch, /\.eq\(\"id\", existingInbox!\.id\)/);
    assert.match(liveBranch, /\.eq\(\"user_id\", userId\)/);
    assert.match(liveBranch, /\.eq\(\"provider\", \"gmail\"\)/);
  });

  it("first-time or non-working Gmail connect still upserts pending/inactive on the same unique row", () => {
    const src = read("app/api/business/email/connect/route.ts");
    const pendingBranch = src.slice(src.indexOf("} else {"));
    assert.match(pendingBranch, /status: \"pending\"/);
    assert.match(pendingBranch, /is_active: false/);
    assert.match(pendingBranch, /send_enabled: false/);
    assert.match(pendingBranch, /sync_replies_enabled: false/);
    assert.match(pendingBranch, /onConflict: \"user_id,provider\"/);
    assert.doesNotMatch(src, /insert\(\s*\{[\s\S]*provider: \"gmail\"/);
  });

  it("callback resolves oauth_state for pending first-time and connected reconnect only", () => {
    const src = read("app/api/business/email/callback/route.ts");
    const lookup = src.slice(
      src.indexOf('.from("user_connected_inboxes")'),
      src.indexOf("PENDING_INBOX_LOOKUP_FAILED")
    );
    assert.match(lookup, /\.eq\(\"provider\", \"gmail\"\)/);
    assert.match(lookup, /\.in\(\"status\", \[\"pending\", \"connected\"\]\)/);
    assert.match(lookup, /\.contains\(\"metadata\", \{ oauth_state: state \}\)/);
    assert.doesNotMatch(lookup, /\.eq\(\"status\", \"pending\"\)/);
    assert.doesNotMatch(src, /requireUserId\(req\)/);
    assert.doesNotMatch(src, /searchParams\.get\([\"']userId[\"']\)/);
  });

  it("successful callback still encrypts tokens before mutation and rotates token rows", () => {
    const src = read("app/api/business/email/callback/route.ts");
    const encryptAccessIdx = src.indexOf(
      "const encryptedAccessToken = encryptInboxToken(tokenJson.access_token)"
    );
    const firstUpdateIdx = src.indexOf(".update(");
    const firstInsertIdx = src.indexOf(".insert(");
    assert.ok(encryptAccessIdx >= 0);
    assert.ok(encryptAccessIdx < firstUpdateIdx);
    assert.ok(encryptAccessIdx < firstInsertIdx);

    const tokenDeactivate = src.slice(
      src.lastIndexOf('.from("user_connected_inbox_tokens")')
    );
    assert.match(
      src,
      /\.from\(\"user_connected_inbox_tokens\"\)[\s\S]*is_active: false[\s\S]*\.eq\(\"inbox_id\", inbox\.id\)/
    );
    assert.match(src, /access_token:\s*encryptedAccessToken/);
    assert.match(src, /refresh_token:\s*encryptedRefreshToken/);
    assert.doesNotMatch(tokenDeactivate, /\.delete\(/);
  });

  it("does not introduce Google revoke in inbox connect/disconnect/callback", () => {
    for (const rel of [
      "app/api/business/email/connect/route.ts",
      "app/api/business/email/disconnect/route.ts",
      "app/api/business/email/callback/route.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /oauth2\.googleapis\.com\/revoke/);
    }
  });
});
