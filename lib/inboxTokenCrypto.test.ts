import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  InboxTokenCryptoError,
  encryptInboxToken,
  encryptInboxTokenNullable,
  revealInboxToken,
  revealInboxTokenNullable,
} from "./inboxTokenCrypto.ts";

const FAKE_KEY_B64 = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY_B64 = Buffer.alloc(32, 9).toString("base64");
const FAKE_ACCESS_TOKEN = "test-inbox-access-token-aaaa";
const FAKE_REFRESH_TOKEN = "test-inbox-refresh-token-bbbb";

const originalKey = process.env.INBOX_TOKEN_ENC_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.INBOX_TOKEN_ENC_KEY;
  } else {
    process.env.INBOX_TOKEN_ENC_KEY = originalKey;
  }
});

describe("inboxTokenCrypto", () => {
  it("encrypts then decrypts a fake token", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const stored = encryptInboxToken(FAKE_ACCESS_TOKEN);
    assert.equal(revealInboxToken(stored), FAKE_ACCESS_TOKEN);
  });

  it("ciphertext starts with v1:", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const stored = encryptInboxToken(FAKE_ACCESS_TOKEN);
    assert.ok(stored.startsWith("v1:"));
  });

  it("ciphertext is not equal to plaintext", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const stored = encryptInboxToken(FAKE_ACCESS_TOKEN);
    assert.notEqual(stored, FAKE_ACCESS_TOKEN);
    assert.equal(stored.includes(FAKE_ACCESS_TOKEN), false);
  });

  it("same plaintext encrypted twice produces different ciphertext", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const first = encryptInboxToken(FAKE_ACCESS_TOKEN);
    const second = encryptInboxToken(FAKE_ACCESS_TOKEN);
    assert.notEqual(first, second);
    assert.equal(revealInboxToken(first), FAKE_ACCESS_TOKEN);
    assert.equal(revealInboxToken(second), FAKE_ACCESS_TOKEN);
  });

  it("legacy plaintext reveal returns unchanged plaintext", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    assert.equal(revealInboxToken(FAKE_ACCESS_TOKEN), FAKE_ACCESS_TOKEN);
    assert.equal(revealInboxToken("ya29.legacy-looking-prefix"), "ya29.legacy-looking-prefix");
  });

  it("malformed v1 ciphertext fails closed", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    assert.throws(() => revealInboxToken("v1:"), InboxTokenCryptoError);
    assert.throws(() => revealInboxToken("v1:not-valid-payload"), InboxTokenCryptoError);
    assert.throws(
      () => revealInboxToken(`v1:${Buffer.from("short").toString("base64")}`),
      InboxTokenCryptoError
    );

    const valid = encryptInboxToken(FAKE_ACCESS_TOKEN);
    const tampered = `${valid.slice(0, -2)}aa`;
    assert.throws(() => revealInboxToken(tampered), InboxTokenCryptoError);
  });

  it("malformed and non-canonical Base64 encryption keys fail closed", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const stored = encryptInboxToken(FAKE_ACCESS_TOKEN);

    process.env.INBOX_TOKEN_ENC_KEY = `${FAKE_KEY_B64.slice(0, 8)}!${FAKE_KEY_B64.slice(8)}`;
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);
    assert.throws(() => revealInboxToken(stored), InboxTokenCryptoError);

    process.env.INBOX_TOKEN_ENC_KEY = `${FAKE_KEY_B64}\n`;
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);

    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64.replace(/=+$/, "");
    assert.notEqual(process.env.INBOX_TOKEN_ENC_KEY, FAKE_KEY_B64);
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);

    const urlSafeSource = Buffer.from(
      Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 13) & 0xff)
    ).toString("base64");
    const urlSafe = urlSafeSource.replace(/\+/g, "-").replace(/\//g, "_");
    assert.notEqual(urlSafe, urlSafeSource);
    process.env.INBOX_TOKEN_ENC_KEY = urlSafe;
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);

    const nonCanonicalAlphabet = `${FAKE_KEY_B64.slice(0, -2)}AA`;
    if (nonCanonicalAlphabet !== FAKE_KEY_B64) {
      process.env.INBOX_TOKEN_ENC_KEY = nonCanonicalAlphabet;
      assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);
    }
  });

  it("malformed non-canonical v1 payload fails closed even if Node would ignore invalid chars", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const valid = encryptInboxToken(FAKE_ACCESS_TOKEN);
    const payload = valid.slice("v1:".length);
    const malformed = `v1:${payload.slice(0, 8)}!${payload.slice(8)}`;

    assert.notEqual(malformed, valid);
    assert.throws(() => revealInboxToken(malformed), InboxTokenCryptoError);
  });

  it("encrypted token with missing or invalid key fails closed", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    const stored = encryptInboxToken(FAKE_ACCESS_TOKEN);

    delete process.env.INBOX_TOKEN_ENC_KEY;
    assert.throws(() => revealInboxToken(stored), InboxTokenCryptoError);
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);

    process.env.INBOX_TOKEN_ENC_KEY = Buffer.alloc(16, 1).toString("base64");
    assert.throws(() => revealInboxToken(stored), InboxTokenCryptoError);
    assert.throws(() => encryptInboxToken(FAKE_ACCESS_TOKEN), InboxTokenCryptoError);

    process.env.INBOX_TOKEN_ENC_KEY = OTHER_KEY_B64;
    assert.throws(() => revealInboxToken(stored), InboxTokenCryptoError);
  });

  it("nullable refresh-token behavior is preserved", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    assert.equal(encryptInboxTokenNullable(null), null);
    assert.equal(encryptInboxTokenNullable(undefined), null);
    assert.equal(encryptInboxTokenNullable(""), null);
    assert.equal(revealInboxTokenNullable(null), null);
    assert.equal(revealInboxTokenNullable(undefined), null);
    assert.equal(revealInboxTokenNullable(""), "");

    const stored = encryptInboxTokenNullable(FAKE_REFRESH_TOKEN);
    assert.ok(stored && stored.startsWith("v1:"));
    assert.equal(revealInboxTokenNullable(stored), FAKE_REFRESH_TOKEN);
  });

  it("does not treat Google token prefixes as encrypted", () => {
    process.env.INBOX_TOKEN_ENC_KEY = FAKE_KEY_B64;
    assert.equal(revealInboxToken("1//legacy-refresh"), "1//legacy-refresh");
  });
});
