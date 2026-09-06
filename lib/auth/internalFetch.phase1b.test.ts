import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { copyCallerAuthHeaders } from "./forwardCallerAuth.ts";
import {
  INTERNAL_ORIGIN_NOT_CONFIGURED,
  requireTrustedInternalOrigin,
  resolveTrustedInternalOrigin,
} from "./internalAppOrigin.ts";

const SESSION_COOKIE = "next-auth.session-token=test-session";
const HEADER_UUID = "22222222-2222-4222-8222-222222222222";

function request(url: string, init?: HeadersInit) {
  return new Request(url, { headers: init });
}

const emptyEnv = {};

describe("Phase 1B trusted internal origin", () => {
  it("1. production authenticated internal fetch does not trust Host", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://www.autoaffi.com/api/reels/generate", {
        host: "evil.example",
      }),
      { nodeEnv: "production", env: emptyEnv }
    );
    assert.equal(origin, null);
  });

  it("2. production authenticated internal fetch does not trust X-Forwarded-Host", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://www.autoaffi.com/api/reels/generate", {
        "x-forwarded-host": "evil.example",
      }),
      { nodeEnv: "production", env: emptyEnv }
    );
    assert.equal(origin, null);
  });

  it("3. production authenticated internal fetch does not trust Origin", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://www.autoaffi.com/api/reels/generate", {
        origin: "https://evil.example",
      }),
      { nodeEnv: "production", env: emptyEnv }
    );
    assert.equal(origin, null);
  });

  it("4. production with a trusted configured base URL uses the trusted URL", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://www.autoaffi.com/api/reels/generate", {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        origin: "https://evil.example",
      }),
      {
        nodeEnv: "production",
        env: {
          NEXT_PUBLIC_APP_URL: "https://www.autoaffi.com/",
        },
      }
    );
    assert.equal(origin, "https://www.autoaffi.com");
  });

  it("production VERCEL_URL without protocol is normalized to https", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://ignored.example/api/reels/generate", {
        host: "evil.example",
      }),
      {
        nodeEnv: "production",
        env: { VERCEL_URL: "autoaffi.vercel.app" },
      }
    );
    assert.equal(origin, "https://autoaffi.vercel.app");
  });

  it("5. production with no trusted configured base URL fails closed", () => {
    assert.equal(
      resolveTrustedInternalOrigin(
        request("https://www.autoaffi.com/api/reels/generate"),
        { nodeEnv: "production", env: emptyEnv }
      ),
      null
    );
    assert.throws(
      () =>
        requireTrustedInternalOrigin(
          request("https://www.autoaffi.com/api/reels/generate"),
          { nodeEnv: "production", env: emptyEnv }
        ),
      (err: unknown) =>
        err instanceof Error && err.message === INTERNAL_ORIGIN_NOT_CONFIGURED
    );
  });

  it("6. non-production localhost remains usable", () => {
    const origin = resolveTrustedInternalOrigin(
      request("http://localhost:3000/api/reels/generate", {
        host: "localhost:3000",
      }),
      { nodeEnv: "development", env: emptyEnv }
    );
    assert.equal(origin, "http://localhost:3000");
  });

  it("7. non-production 127.0.0.1 remains usable", () => {
    const origin = resolveTrustedInternalOrigin(
      request("http://127.0.0.1:3000/api/reels/render-vx", {
        host: "127.0.0.1:3000",
      }),
      { nodeEnv: "development", env: emptyEnv }
    );
    assert.equal(origin, "http://127.0.0.1:3000");
  });

  it("8. non-production arbitrary public host is rejected as internal origin", () => {
    const origin = resolveTrustedInternalOrigin(
      request("https://preview.example.com/api/reels/generate", {
        host: "preview.example.com",
        "x-forwarded-host": "preview.example.com",
        origin: "https://preview.example.com",
      }),
      { nodeEnv: "development", env: emptyEnv }
    );
    assert.equal(origin, null);
  });
});

describe("Phase 1B forwardCallerAuth", () => {
  it("9. production forwards session Cookie where needed", () => {
    const headers = copyCallerAuthHeaders(
      request("https://www.autoaffi.com/api/reels/generate", {
        cookie: SESSION_COOKIE,
        "content-type": "text/plain",
      }),
      { "Content-Type": "application/json" },
      { nodeEnv: "production" }
    );
    assert.equal(headers.cookie, SESSION_COOKIE);
    assert.equal(headers["Content-Type"], "application/json");
  });

  it("10. production does not forward host, forwarded-host, origin, or identity headers", () => {
    const headers = copyCallerAuthHeaders(
      request("https://www.autoaffi.com/api/reels/generate", {
        cookie: SESSION_COOKIE,
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        origin: "https://evil.example",
        "x-autoaffi-user-id": HEADER_UUID,
        "x-user-id": HEADER_UUID,
        authorization: "Bearer stolen",
      }),
      {
        host: "injected.example",
        Authorization: "Bearer extra",
        "x-user-id": HEADER_UUID,
      },
      { nodeEnv: "production" }
    );

    assert.equal(headers.cookie, SESSION_COOKIE);
    assert.equal(headers.host, undefined);
    assert.equal(headers["x-forwarded-host"], undefined);
    assert.equal(headers.origin, undefined);
    assert.equal(headers["x-autoaffi-user-id"], undefined);
    assert.equal(headers["x-user-id"], undefined);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers.Authorization, undefined);
  });

  it("11. local non-production localhost developer header forwarding still works", () => {
    const headers = copyCallerAuthHeaders(
      request("http://localhost:3000/api/reels/generate", {
        host: "localhost:3000",
        "x-autoaffi-user-id": HEADER_UUID,
        "x-user-id": "33333333-3333-4333-8333-333333333333",
        origin: "http://evil.example",
      }),
      { "Content-Type": "application/json" },
      { nodeEnv: "development" }
    );

    assert.equal(headers["x-autoaffi-user-id"], HEADER_UUID);
    assert.equal(headers["x-user-id"], "33333333-3333-4333-8333-333333333333");
    assert.equal(headers.origin, undefined);
    assert.equal(headers.host, undefined);
    assert.equal(headers["Content-Type"], "application/json");
  });
});
