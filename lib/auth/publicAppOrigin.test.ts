import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_ORIGIN_NOT_CONFIGURED,
  requirePublicAppOrigin,
  resolvePublicAppOrigin,
} from "./publicAppOrigin.ts";

const emptyEnv = {};

describe("Phase 1B Recurring public origin", () => {
  it("production + valid NEXT_PUBLIC_APP_URL uses configured origin", () => {
    const origin = resolvePublicAppOrigin({
      nodeEnv: "production",
      env: { NEXT_PUBLIC_APP_URL: "https://autoaffi-final.vercel.app/" },
    });
    assert.equal(origin, "https://autoaffi-final.vercel.app");
  });

  it("production prefers NEXT_PUBLIC_APP_URL over QR_PUBLIC_BASE_URL", () => {
    const origin = resolvePublicAppOrigin({
      nodeEnv: "production",
      env: {
        NEXT_PUBLIC_APP_URL: "https://autoaffi-final.vercel.app",
        QR_PUBLIC_BASE_URL: "https://other.example",
      },
    });
    assert.equal(origin, "https://autoaffi-final.vercel.app");
  });

  it("production can use QR_PUBLIC_BASE_URL when NEXT_PUBLIC_APP_URL is absent", () => {
    const origin = resolvePublicAppOrigin({
      nodeEnv: "production",
      env: { QR_PUBLIC_BASE_URL: "https://autoaffi-final.vercel.app" },
    });
    assert.equal(origin, "https://autoaffi-final.vercel.app");
  });

  it("production + missing public origin fails closed and never emits localhost", () => {
    assert.equal(
      resolvePublicAppOrigin({ nodeEnv: "production", env: emptyEnv }),
      null
    );
    assert.throws(
      () => requirePublicAppOrigin({ nodeEnv: "production", env: emptyEnv }),
      (err: unknown) =>
        err instanceof Error && err.message === PUBLIC_ORIGIN_NOT_CONFIGURED
    );
  });

  it("production + configured localhost/127.0.0.1 is rejected", () => {
    assert.equal(
      resolvePublicAppOrigin({
        nodeEnv: "production",
        env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
      }),
      null
    );
    assert.equal(
      resolvePublicAppOrigin({
        nodeEnv: "production",
        env: { NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" },
      }),
      null
    );
  });

  it("non-production local development allows localhost", () => {
    assert.equal(
      resolvePublicAppOrigin({ nodeEnv: "development", env: emptyEnv }),
      "http://localhost:3000"
    );
  });

  it("ref encoding keeps /?ref= and encodeURIComponent(code)", () => {
    const origin = resolvePublicAppOrigin({
      nodeEnv: "production",
      env: { NEXT_PUBLIC_APP_URL: "https://autoaffi-final.vercel.app" },
    });
    const code = "EXISTING_CODE";
    assert.equal(
      `${origin}/?ref=${encodeURIComponent(code)}`,
      "https://autoaffi-final.vercel.app/?ref=EXISTING_CODE"
    );
    const encoded = "a/b?x=1";
    assert.equal(
      `${origin}/?ref=${encodeURIComponent(encoded)}`,
      "https://autoaffi-final.vercel.app/?ref=a%2Fb%3Fx%3D1"
    );
  });

  it("does not consult Host, X-Forwarded-Host, Origin, request.url, or VERCEL_URL", () => {
    const origin = resolvePublicAppOrigin({
      nodeEnv: "production",
      env: {
        VERCEL_URL: "evil.vercel.app",
        NEXTAUTH_URL: "http://localhost:3000",
        NEXT_PUBLIC_BASE_URL: "https://spoofed.example",
      },
    });
    assert.equal(origin, null);
  });
});
