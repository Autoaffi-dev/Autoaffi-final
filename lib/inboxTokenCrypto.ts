import crypto from "node:crypto";

export const INBOX_TOKEN_CIPHER_PREFIX = "v1:";

const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class InboxTokenCryptoError extends Error {
  readonly code = "INBOX_TOKEN_CRYPTO_FAILED";

  constructor() {
    super("INBOX_TOKEN_CRYPTO_FAILED");
    this.name = "InboxTokenCryptoError";
  }
}

function getInboxTokenKey(): Buffer {
  const encoded = process.env.INBOX_TOKEN_ENC_KEY;
  if (!encoded) {
    throw new InboxTokenCryptoError();
  }

  let key: Buffer;
  try {
    key = Buffer.from(encoded, "base64");
  } catch {
    throw new InboxTokenCryptoError();
  }

  if (key.length !== KEY_LENGTH) {
    throw new InboxTokenCryptoError();
  }

  return key;
}

export function encryptInboxToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new InboxTokenCryptoError();
  }

  const key = getInboxTokenKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64");
  return `${INBOX_TOKEN_CIPHER_PREFIX}${payload}`;
}

export function encryptInboxTokenNullable(
  value: string | null | undefined
): string | null {
  if (value == null || value === "") {
    return null;
  }
  return encryptInboxToken(value);
}

export function revealInboxToken(storedValue: string): string {
  if (typeof storedValue !== "string") {
    throw new InboxTokenCryptoError();
  }

  if (!storedValue.startsWith(INBOX_TOKEN_CIPHER_PREFIX)) {
    return storedValue;
  }

  const payloadB64 = storedValue.slice(INBOX_TOKEN_CIPHER_PREFIX.length);
  if (!payloadB64) {
    throw new InboxTokenCryptoError();
  }

  let raw: Buffer;
  try {
    raw = Buffer.from(payloadB64, "base64");
  } catch {
    throw new InboxTokenCryptoError();
  }

  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new InboxTokenCryptoError();
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const key = getInboxTokenKey();
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new InboxTokenCryptoError();
  }
}

export function revealInboxTokenNullable(
  value: string | null | undefined
): string | null {
  if (value == null || value === "") {
    return value ?? null;
  }
  return revealInboxToken(value);
}

export function revealStoredInboxTokens<
  T extends { access_token: string; refresh_token: string | null },
>(row: T): T {
  return {
    ...row,
    access_token: revealInboxToken(row.access_token),
    refresh_token: revealInboxTokenNullable(row.refresh_token),
  };
}
