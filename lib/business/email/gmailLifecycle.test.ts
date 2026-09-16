import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  disconnectedInboxIds,
  isWorkingGmailConnection,
  mergeInboxOauthAttemptMetadata,
} from "./gmailLifecycle.ts";

describe("gmailLifecycle helpers", () => {
  it("treats only connected+active Gmail rows as a working connection", () => {
    assert.equal(
      isWorkingGmailConnection({
        id: "inbox-1",
        status: "connected",
        is_active: true,
      }),
      true
    );
    assert.equal(
      isWorkingGmailConnection({
        id: "inbox-1",
        status: "pending",
        is_active: false,
      }),
      false
    );
    assert.equal(
      isWorkingGmailConnection({
        id: "inbox-1",
        status: "disconnected",
        is_active: false,
      }),
      false
    );
    assert.equal(
      isWorkingGmailConnection({
        id: "inbox-1",
        status: "connected",
        is_active: false,
      }),
      false
    );
    assert.equal(isWorkingGmailConnection(null), false);
  });

  it("merges oauth attempt fields without wiping existing metadata", () => {
    const merged = mergeInboxOauthAttemptMetadata(
      {
        picture: "https://example.test/a.png",
        oauth_completed_at: "2026-01-01T00:00:00.000Z",
        oauth_state: "old-state",
      },
      {
        oauth_state: "new-state",
        oauth_started_at: "2026-02-01T00:00:00.000Z",
        oauth_redirect_uri: "https://example.test/api/business/email/callback",
      }
    );

    assert.equal(merged.picture, "https://example.test/a.png");
    assert.equal(merged.oauth_completed_at, "2026-01-01T00:00:00.000Z");
    assert.equal(merged.oauth_state, "new-state");
    assert.equal(merged.oauth_started_at, "2026-02-01T00:00:00.000Z");
    assert.equal(
      merged.oauth_redirect_uri,
      "https://example.test/api/business/email/callback"
    );
  });

  it("collects only the inbox ids that were actually disconnected", () => {
    assert.deepEqual(
      disconnectedInboxIds([{ id: "inbox-a" }, { id: "inbox-b" }, { id: "" }]),
      ["inbox-a", "inbox-b"]
    );
    assert.deepEqual(disconnectedInboxIds([]), []);
  });
});
