import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCronAuthorized, timingSafeStringEqual } from "./cronAuth.ts";

const SECRET = "cron-secret-value";

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

describe("Phase 1B cron fail-closed auth", () => {
  it("11. missing CRON_SECRET fails closed", () => {
    const ok = isCronAuthorized({
      headers: headers({ authorization: "Bearer anything" }),
      url: "https://autoaffi.com/api/cron/hourly",
      nodeEnv: "production",
      cronSecret: "",
    });
    assert.equal(ok, false);
  });

  it("12. wrong secret is 401/denied", () => {
    const ok = isCronAuthorized({
      headers: headers({ authorization: "Bearer wrong" }),
      url: "https://autoaffi.com/api/cron/hourly",
      nodeEnv: "production",
      cronSecret: SECRET,
    });
    assert.equal(ok, false);
  });

  it("13. valid Bearer is authorized", () => {
    const ok = isCronAuthorized({
      headers: headers({ authorization: `Bearer ${SECRET}` }),
      url: "https://autoaffi.com/api/cron/hourly",
      nodeEnv: "production",
      cronSecret: SECRET,
    });
    assert.equal(ok, true);
  });

  it("internal x-autoaffi-cron header is authorized", () => {
    const ok = isCronAuthorized({
      headers: headers({ "x-autoaffi-cron": SECRET }),
      url: "https://autoaffi.com/api/cron/product-index",
      nodeEnv: "production",
      cronSecret: SECRET,
    });
    assert.equal(ok, true);
  });

  it("14. production query-string cron secret is rejected", () => {
    const ok = isCronAuthorized({
      headers: headers({}),
      url: `https://autoaffi.com/api/cron/product-index?key=${SECRET}`,
      nodeEnv: "production",
      cronSecret: SECRET,
    });
    assert.equal(ok, false);
  });

  it("non-production query secret remains available for local scripts", () => {
    const ok = isCronAuthorized({
      headers: headers({ host: "localhost:3000" }),
      url: `http://localhost:3000/api/cron/hourly?token=${SECRET}`,
      nodeEnv: "development",
      cronSecret: SECRET,
    });
    assert.equal(ok, true);
  });

  it("timing-safe compare rejects different lengths without throwing", () => {
    assert.equal(timingSafeStringEqual("ab", "abcd"), false);
    assert.equal(timingSafeStringEqual(SECRET, SECRET), true);
  });
});
