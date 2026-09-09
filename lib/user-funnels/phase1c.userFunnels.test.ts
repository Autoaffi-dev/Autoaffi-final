import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UNAUTHORIZED_ERROR } from "../auth/canonicalUserId.ts";
import {
  handleUserFunnelsDelete,
  handleUserFunnelsGet,
  handleUserFunnelsPost,
} from "./http.ts";
import { createMemoryUserFunnelsDb } from "./memoryDb.ts";
import { normalizeExternalFunnelFields } from "./repo.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SPOOFED = "33333333-3333-4333-8333-333333333333";

const HBA_URL =
  "https://www.homebusinessacademy.com/optin?ref=autoaffi-partner";
const OLSP_URL = "https://olsp.com/funnel/published-page";
const OTHER_URL = "https://my-published-funnel.example/lead";

function unauthorizedRequireUserId(): Promise<string> {
  return Promise.reject(new Error(UNAUTHORIZED_ERROR));
}

function sessionRequireUserId(userId: string) {
  return async () => userId;
}

function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}

async function json(res: Response) {
  return res.json();
}

describe("Phase 1C user_funnels canonical API", () => {
  it("1. Unauthenticated GET → 401", async () => {
    const res = await handleUserFunnelsGet(
      request("https://autoaffi.com/api/user-funnels", {
        headers: { "x-autoaffi-user-id": SPOOFED },
      }),
      {
        requireUserId: unauthorizedRequireUserId,
        supabase: createMemoryUserFunnelsDb(),
      }
    );
    assert.equal(res.status, 401);
    assert.equal((await json(res)).error, "UNAUTHORIZED");
  });

  it("2. Unauthenticated POST → 401", async () => {
    const res = await handleUserFunnelsPost(
      request("https://autoaffi.com/api/user-funnels", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-autoaffi-user-id": SPOOFED,
        },
        body: JSON.stringify({
          name: "HBA",
          funnel_url: HBA_URL,
          userId: SPOOFED,
        }),
      }),
      {
        requireUserId: unauthorizedRequireUserId,
        supabase: createMemoryUserFunnelsDb(),
      }
    );
    assert.equal(res.status, 401);
  });

  it("3. Unauthenticated DELETE → 401", async () => {
    const res = await handleUserFunnelsDelete(
      request("https://autoaffi.com/api/user-funnels?id=funnel-1", {
        method: "DELETE",
        headers: { "x-autoaffi-user-id": SPOOFED },
      }),
      {
        requireUserId: unauthorizedRequireUserId,
        supabase: createMemoryUserFunnelsDb(),
      }
    );
    assert.equal(res.status, 401);
  });

  it("4. Spoofed x-autoaffi-user-id without valid session must NOT authorize", async () => {
    const db = createMemoryUserFunnelsDb([
      {
        id: "funnel-a",
        user_id: USER_A,
        name: "HBA Core",
        funnel_url: HBA_URL,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const res = await handleUserFunnelsGet(
      request("https://autoaffi.com/api/user-funnels", {
        headers: { "x-autoaffi-user-id": USER_A },
      }),
      {
        requireUserId: unauthorizedRequireUserId,
        supabase: db,
      }
    );
    assert.equal(res.status, 401);
    assert.equal(db.store.rows.length, 1);
  });

  it("5-6. Valid canonical session GET returns only that user's funnels", async () => {
    const db = createMemoryUserFunnelsDb([
      {
        id: "funnel-a",
        user_id: USER_A,
        name: "HBA Core",
        funnel_url: HBA_URL,
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "funnel-b",
        user_id: USER_B,
        name: "OLSP",
        funnel_url: OLSP_URL,
        created_at: "2026-01-03T00:00:00.000Z",
      },
    ]);

    const res = await handleUserFunnelsGet(
      request("https://autoaffi.com/api/user-funnels"),
      {
        requireUserId: sessionRequireUserId(USER_A),
        supabase: db,
      }
    );
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.funnels.length, 1);
    assert.equal(body.funnels[0].id, "funnel-a");
    assert.equal(body.funnels[0].user_id, USER_A);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(USER_B));
    assert.doesNotMatch(JSON.stringify(body), /funnel-b/);
  });

  it("7-8. POST binds user_id to canonical UUID; client userId cannot change ownership", async () => {
    const db = createMemoryUserFunnelsDb();
    const res = await handleUserFunnelsPost(
      request("https://autoaffi.com/api/user-funnels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Custom published funnel",
          funnel_url: OTHER_URL,
          userId: USER_B,
          user_id: USER_B,
          id: "client-forced-id",
        }),
      }),
      {
        requireUserId: sessionRequireUserId(USER_A),
        supabase: db,
      }
    );
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.funnels.length, 1);
    assert.equal(body.funnels[0].user_id, USER_A);
    assert.notEqual(body.funnels[0].user_id, USER_B);
    assert.notEqual(body.funnels[0].id, "client-forced-id");
    assert.equal(body.funnels[0].funnel_url, OTHER_URL);
  });

  it("9-10. DELETE scopes by funnel id AND canonical user_id; A cannot delete B", async () => {
    const db = createMemoryUserFunnelsDb([
      {
        id: "funnel-b",
        user_id: USER_B,
        name: "OLSP",
        funnel_url: OLSP_URL,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const denied = await handleUserFunnelsDelete(
      request("https://autoaffi.com/api/user-funnels?id=funnel-b", {
        method: "DELETE",
      }),
      {
        requireUserId: sessionRequireUserId(USER_A),
        supabase: db,
      }
    );
    assert.equal(denied.status, 404);
    assert.equal(db.store.rows.length, 1);
    assert.equal(db.store.rows[0].user_id, USER_B);

    const allowed = await handleUserFunnelsDelete(
      request("https://autoaffi.com/api/user-funnels?id=funnel-b", {
        method: "DELETE",
      }),
      {
        requireUserId: sessionRequireUserId(USER_B),
        supabase: db,
      }
    );
    assert.equal(allowed.status, 200);
    assert.equal(db.store.rows.length, 0);
  });

  it("11-14. External funnel URLs are stored unchanged (HBA / OLSP / other)", () => {
    const hba = normalizeExternalFunnelFields({
      name: " HBA Core Funnel ",
      funnel_url: ` ${HBA_URL} `,
      userId: USER_B,
    });
    assert.equal(hba.funnel_url, HBA_URL);
    assert.equal(hba.name, "HBA Core Funnel");

    const olsp = normalizeExternalFunnelFields({
      name: "OLSP published",
      funnel_url: OLSP_URL,
    });
    assert.equal(olsp.funnel_url, OLSP_URL);

    const other = normalizeExternalFunnelFields({
      name: "Other published funnel",
      funnel_url: OTHER_URL,
    });
    assert.equal(other.funnel_url, OTHER_URL);
  });
});
