import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowDevUserHeaders,
  requireCanonicalUserId,
  resolveCanonicalUserId,
} from "./canonicalUserId.ts";

const SESSION_UUID = "11111111-1111-4111-8111-111111111111";
const HEADER_UUID = "22222222-2222-4222-8222-222222222222";
const CLIENT_UUID = "33333333-3333-4333-8333-333333333333";

function headers(init: Record<string, string>) {
  const map = new Map(
    Object.entries(init).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get(name: string) {
      return map.get(name.toLowerCase()) ?? null;
    },
  };
}

describe("Phase 1A canonical user identity", () => {
  it("1. production-like request with only x-autoaffi-user-id is rejected", () => {
    const userId = resolveCanonicalUserId({
      sessionUserId: null,
      nodeEnv: "production",
      headers: headers({
        host: "autoaffi.com",
        "x-autoaffi-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, null);
  });

  it("2. production-like request with only x-user-id is rejected", () => {
    const userId = resolveCanonicalUserId({
      sessionUserId: null,
      nodeEnv: "production",
      headers: headers({
        host: "autoaffi.com",
        "x-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, null);
  });

  it("3. valid logged-in NextAuth user uses canonical session UUID", () => {
    const userId = resolveCanonicalUserId({
      sessionUserId: SESSION_UUID,
      nodeEnv: "production",
      headers: headers({
        host: "autoaffi.com",
        "x-autoaffi-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, SESSION_UUID);
  });

  it("4. client userId different from session is ignored", () => {
    const userId = resolveCanonicalUserId({
      sessionUserId: SESSION_UUID,
      nodeEnv: "production",
      clientClaimedUserId: CLIENT_UUID,
      headers: headers({
        host: "autoaffi.com",
        "x-autoaffi-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, SESSION_UUID);
    assert.notEqual(userId, CLIENT_UUID);
    assert.notEqual(userId, HEADER_UUID);
  });

  it("5. localhost + non-production developer header remains available", () => {
    const userId = resolveCanonicalUserId({
      sessionUserId: null,
      nodeEnv: "development",
      headers: headers({
        host: "localhost:3000",
        "x-autoaffi-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, HEADER_UUID);
  });

  it("6. non-production but non-local/public host rejects developer header", () => {
    assert.equal(
      allowDevUserHeaders({
        nodeEnv: "development",
        host: "autoaffi-git-preview.vercel.app",
      }),
      false
    );

    const userId = resolveCanonicalUserId({
      sessionUserId: null,
      nodeEnv: "development",
      headers: headers({
        host: "autoaffi-git-preview.vercel.app",
        "x-autoaffi-user-id": HEADER_UUID,
        "x-user-id": HEADER_UUID,
      }),
    });
    assert.equal(userId, null);
  });

  it("NEXT_PUBLIC_DEV_USER_ID is never used as authorization", () => {
    const prev = process.env.NEXT_PUBLIC_DEV_USER_ID;
    process.env.NEXT_PUBLIC_DEV_USER_ID = HEADER_UUID;
    try {
      const userId = resolveCanonicalUserId({
        sessionUserId: null,
        nodeEnv: "production",
        headers: headers({ host: "autoaffi.com" }),
      });
      assert.equal(userId, null);

      const preview = resolveCanonicalUserId({
        sessionUserId: null,
        nodeEnv: "development",
        headers: headers({ host: "preview.example.com" }),
      });
      assert.equal(preview, null);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_DEV_USER_ID;
      else process.env.NEXT_PUBLIC_DEV_USER_ID = prev;
    }
  });

  it("requireCanonicalUserId throws UNAUTHORIZED when logged out", () => {
    assert.throws(
      () =>
        requireCanonicalUserId({
          sessionUserId: null,
          nodeEnv: "production",
          headers: headers({
            host: "autoaffi.com",
            "x-autoaffi-user-id": HEADER_UUID,
          }),
        }),
      /UNAUTHORIZED/
    );
  });
});
