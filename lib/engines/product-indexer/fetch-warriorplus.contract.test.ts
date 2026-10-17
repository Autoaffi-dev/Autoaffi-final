import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  fetchProducts,
  WARRIORPLUS_FETCH_BUDGET_MS,
  WARRIORPLUS_MAX_PAGE_REQUESTS,
  WARRIORPLUS_PAGE_SIZE,
  WARRIORPLUS_REQUEST_TIMEOUT_MS,
  WarriorPlusImportError,
} from "./fetch-warriorplus.ts";
import { runWarriorPlusIndexCron } from "./warriorPlusIndexCron.ts";

const root = path.resolve(import.meta.dirname, "../../..");
const previousKey = process.env.WARRIORPLUS_API_KEY;

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function offerRow(input?: {
  requestId?: string;
  status?: string;
  offerId?: string | null;
  name?: string | null;
  offerStatus?: string;
  promoteUrl?: string | null;
}) {
  return {
    object: "affiliate_request",
    id: input?.requestId ?? "affreq_1",
    status: input?.status ?? "ACTIVE",
    contact_email: "affiliate@example.com",
    notes: "secret note",
    promote_url:
      input && "promoteUrl" in input
        ? input.promoteUrl
        : "https://example.com/promote",
    offer: {
      id: input && "offerId" in input ? input.offerId : "offer_1",
      name: input && "name" in input ? input.name : "Example Offer",
      status: input?.offerStatus ?? "active",
      public: true,
      vendor_name: "Vendor",
      vendor_username: "vendor",
    },
  };
}

function envelope(data: unknown[], hasMore: "true" | "false" | boolean) {
  return {
    success: 1,
    object: "list",
    has_more: hasMore,
    total_count: data.length,
    data,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function withKey<T>(run: () => Promise<T>) {
  process.env.WARRIORPLUS_API_KEY = "test-key";
  try {
    return await run();
  } finally {
    if (previousKey === undefined) delete process.env.WARRIORPLUS_API_KEY;
    else process.env.WARRIORPLUS_API_KEY = previousKey;
  }
}

describe("WarriorPlus affiliate_requests import", { concurrency: 1 }, () => {
  it("sends as=affiliate on the unslashed endpoint and keeps the page size at 100", async () => {
    const seen: URL[] = [];
    await withKey(async () => {
      const rows = await fetchProducts({
        limit: 1,
        fetchImpl: async (input) => {
          seen.push(new URL(String(input)));
          return jsonResponse(
            envelope(
              [
                offerRow({ requestId: "affreq_1", offerId: "offer_1" }),
                offerRow({ requestId: "affreq_2", offerId: "offer_2", name: "Second" }),
              ],
              "true"
            )
          );
        },
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].external_id, "offer_1");
      assert.equal(rows[0].title, "Example Offer");
      assert.equal(rows[0].product_url, "https://example.com/promote");
    });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].pathname, "/api/v2/affiliate_requests");
    assert.equal(seen[0].pathname.endsWith("/"), false);
    assert.equal(seen[0].searchParams.get("as"), "affiliate");
    assert.equal(seen[0].searchParams.get("status"), "ACTIVE");
    assert.equal(seen[0].searchParams.get("limit"), String(WARRIORPLUS_PAGE_SIZE));
    assert.equal(seen[0].searchParams.get("starting_after"), null);
  });

  it("accepts only ACTIVE and uses offer.id, not the request id", async () => {
    const rows = await withKey(() =>
      fetchProducts({
        limit: 20,
        fetchImpl: async () =>
          jsonResponse(
            envelope(
              [
                offerRow({ requestId: "affreq_ok", offerId: "offer_ok", name: "Kept" }),
                offerRow({ status: "REQUEST", requestId: "affreq_req", offerId: "offer_req" }),
                offerRow({ status: "DENIED", requestId: "affreq_den", offerId: "offer_den" }),
                offerRow({ status: "BANNED", requestId: "affreq_ban", offerId: "offer_ban" }),
                offerRow({ status: "PAUSED", requestId: "affreq_pause", offerId: "offer_pause" }),
                offerRow({ status: "UNKNOWN", requestId: "affreq_unk", offerId: "offer_unk" }),
                offerRow({
                  status: "REQUEST",
                  offerStatus: "active",
                  requestId: "affreq_offer_status",
                  offerId: "offer_status_trap",
                }),
                offerRow({
                  requestId: "affreq_missing_offer",
                  offerId: null,
                  name: "No id",
                }),
                offerRow({
                  requestId: "affreq_bad_url",
                  offerId: "offer_bad_url",
                  promoteUrl: "javascript:alert(1)",
                }),
                offerRow({
                  requestId: "affreq_ftp",
                  offerId: "offer_ftp",
                  promoteUrl: "ftp://example.com/file",
                }),
              ],
              "false"
            )
          ),
      })
    );

    assert.deepEqual(
      rows.map((row) => row.external_id),
      ["offer_ok"]
    );
    assert.equal(rows[0].title, "Kept");
    assert.equal(JSON.stringify(rows).includes("affiliate@example.com"), false);
    assert.equal(JSON.stringify(rows).includes("affreq_ok"), false);
  });

  it("follows starting_after and stops when has_more is the string false", async () => {
    const cursors: Array<string | null> = [];
    const rows = await withKey(() =>
      fetchProducts({
        limit: 10,
        fetchImpl: async (input) => {
          const url = new URL(String(input));
          cursors.push(url.searchParams.get("starting_after"));
          if (cursors.length === 1) {
            return jsonResponse(
              envelope(
                [offerRow({ requestId: "affreq_page_1", offerId: "offer_page_1", name: "Page 1" })],
                "true"
              )
            );
          }
          return jsonResponse(
            envelope(
              [offerRow({ requestId: "affreq_page_2", offerId: "offer_page_2", name: "Page 2" })],
              "false"
            )
          );
        },
      })
    );

    assert.deepEqual(cursors, [null, "affreq_page_1"]);
    assert.deepEqual(
      rows.map((row) => row.external_id),
      ["offer_page_1", "offer_page_2"]
    );
  });

  it("treats a valid empty list as success and rejects malformed or failed responses", async () => {
    const empty = await withKey(() =>
      fetchProducts({
        limit: 10,
        fetchImpl: async () => jsonResponse(envelope([], "false")),
      })
    );
    assert.deepEqual(empty, []);

    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () =>
              jsonResponse({ success: 0, data: [], has_more: "false" }),
          })
        ),
      (err: unknown) => err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_INVALID_RESPONSE"
    );

    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () => jsonResponse(envelope([], false as unknown as "false")),
          })
        ),
      (err: unknown) => err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_INVALID_RESPONSE"
    );

    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () =>
              new Response("contact affiliate@example.com apiKey=test-key", { status: 500 }),
          })
        ),
      (err: unknown) => {
        assert.ok(err instanceof WarriorPlusImportError);
        assert.equal(err.code, "WARRIORPLUS_HTTP_ERROR");
        assert.equal(err.message.includes("affiliate@example.com"), false);
        assert.equal(err.message.includes("test-key"), false);
        return true;
      }
    );
  });

  it("reports an empty has_more page, a missing cursor, and a repeated cursor without returning earlier rows", async () => {
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async (input) => {
              const url = new URL(String(input));
              if (!url.searchParams.get("starting_after")) {
                return jsonResponse(
                  envelope(
                    [offerRow({ requestId: "affreq_kept", offerId: "offer_kept" })],
                    "true"
                  )
                );
              }
              return jsonResponse(envelope([], "true"));
            },
          })
        ),
      (err: unknown) => err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_PAGINATION_EMPTY_PAGE"
    );

    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () =>
              jsonResponse(
                envelope(
                  [offerRow({ requestId: "", offerId: "offer_no_cursor" })],
                  "true"
                )
              ),
          })
        ),
      (err: unknown) =>
        err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_PAGINATION_MISSING_CURSOR"
    );

    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () =>
              jsonResponse(
                envelope(
                  [offerRow({ requestId: "affreq_repeat", offerId: "offer_repeat" })],
                  "true"
                )
              ),
          })
        ),
      (err: unknown) =>
        err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_PAGINATION_REPEATED_CURSOR"
    );
  });

  it("does not return the first page when a later page fails", async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            fetchImpl: async () => {
              calls += 1;
              if (calls === 1) {
                return jsonResponse(
                  envelope(
                    [offerRow({ requestId: "affreq_first", offerId: "offer_first" })],
                    "true"
                  )
                );
              }
              throw new Error("https://example.com/promote?apiKey=test-key");
            },
          })
        ),
      (err: unknown) => {
        assert.ok(err instanceof WarriorPlusImportError);
        assert.equal(err.code, "WARRIORPLUS_HTTP_ERROR");
        assert.equal(err.message.includes("apiKey"), false);
        assert.equal(err.message.includes("offer_first"), false);
        return true;
      }
    );
    assert.equal(calls, 2);
  });

  it("stops at the caller limit and fails separately at the ten-request safety cap", async () => {
    let callerCalls = 0;
    const limited = await withKey(() =>
      fetchProducts({
        limit: 1,
        fetchImpl: async () => {
          callerCalls += 1;
          return jsonResponse(
            envelope(
              [
                offerRow({ requestId: "affreq_a", offerId: "offer_a" }),
                offerRow({ requestId: "affreq_b", offerId: "offer_b", name: "Other" }),
              ],
              "true"
            )
          );
        },
      })
    );
    assert.equal(callerCalls, 1);
    assert.equal(limited.length, 1);
    assert.equal(limited[0].external_id, "offer_a");

    let safetyCalls = 0;
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 500,
            fetchImpl: async () => {
              safetyCalls += 1;
              return jsonResponse(
                envelope(
                  [
                    offerRow({
                      requestId: `affreq_${safetyCalls}`,
                      offerId: `offer_${safetyCalls}`,
                      name: `Offer ${safetyCalls}`,
                    }),
                  ],
                  "true"
                )
              );
            },
          })
        ),
      (err: unknown) =>
        err instanceof WarriorPlusImportError && err.code === "WARRIORPLUS_PAGINATION_REQUEST_CAP"
    );
    assert.equal(safetyCalls, WARRIORPLUS_MAX_PAGE_REQUESTS);
  });

  it("keeps a 10 second request ceiling and a 30 second shared budget", () => {
    assert.equal(WARRIORPLUS_REQUEST_TIMEOUT_MS, 10_000);
    assert.equal(WARRIORPLUS_FETCH_BUDGET_MS, 30_000);
  });

  it("aborts a hung request on the remaining budget and returns no rows", async () => {
    const started = Date.now();
    let calls = 0;
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            requestTimeoutMs: 10_000,
            budgetMs: 300,
            fetchImpl: (_input, init) =>
              new Promise<Response>((_resolve, reject) => {
                calls += 1;
                const signal = init?.signal;
                const fail = () =>
                  reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
                if (!signal || signal.aborted) {
                  fail();
                  return;
                }
                signal.addEventListener("abort", fail, { once: true });
              }),
          })
        ),
      (err: unknown) => {
        assert.ok(err instanceof WarriorPlusImportError);
        assert.equal(err.code, "WARRIORPLUS_TIMEOUT");
        assert.equal(err.message, "WARRIORPLUS_TIMEOUT");
        assert.equal(err.message.includes("test-key"), false);
        return true;
      }
    );
    assert.equal(calls, 1);
    assert.ok(Date.now() - started < 2_000);
  });

  it("drops the first page when a later response body fails or is aborted", async () => {
    const poison = "apiKey=test-key affiliate@example.com https://secret.example/promote";
    let bodyCalls = 0;
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            requestTimeoutMs: 5_000,
            budgetMs: 5_000,
            fetchImpl: async () => {
              bodyCalls += 1;
              if (bodyCalls === 1) {
                return jsonResponse(
                  envelope(
                    [offerRow({ requestId: "affreq_body_1", offerId: "offer_body_1" })],
                    "true"
                  )
                );
              }
              return {
                ok: true,
                body: null,
                text: async () => {
                  throw new Error(poison);
                },
              } as unknown as Response;
            },
          })
        ),
      (err: unknown) => {
        assert.ok(err instanceof WarriorPlusImportError);
        assert.equal(err.code, "WARRIORPLUS_HTTP_ERROR");
        assert.equal(err.message, "WARRIORPLUS_HTTP_ERROR");
        assert.equal(err.message.includes("test-key"), false);
        assert.equal(err.message.includes("secret.example"), false);
        assert.equal(err.message.includes("offer_body_1"), false);
        return true;
      }
    );
    assert.equal(bodyCalls, 2);

    let abortCalls = 0;
    await assert.rejects(
      () =>
        withKey(() =>
          fetchProducts({
            limit: 10,
            requestTimeoutMs: 50,
            budgetMs: 5_000,
            fetchImpl: (_input, init) => {
              abortCalls += 1;
              if (abortCalls === 1) {
                return Promise.resolve(
                  jsonResponse(
                    envelope(
                      [offerRow({ requestId: "affreq_abort_1", offerId: "offer_abort_1" })],
                      "true"
                    )
                  )
                );
              }
              const signal = init?.signal;
              const stream = new ReadableStream({
                start(controller) {
                  const abort = () =>
                    controller.error(new DOMException("The operation was aborted", "AbortError"));
                  if (!signal || signal.aborted) {
                    abort();
                    return;
                  }
                  signal.addEventListener("abort", abort, { once: true });
                },
              });
              return Promise.resolve(
                new Response(stream, {
                  status: 200,
                  headers: { "content-type": "application/json" },
                })
              );
            },
          })
        ),
      (err: unknown) => {
        assert.ok(err instanceof WarriorPlusImportError);
        assert.equal(err.code, "WARRIORPLUS_TIMEOUT");
        assert.equal(err.message, "WARRIORPLUS_TIMEOUT");
        assert.equal(err.message.includes("offer_abort_1"), false);
        assert.equal(err.message.includes("test-key"), false);
        return true;
      }
    );
    assert.equal(abortCalls, 2);
  });
});

describe("WarriorPlus index cron", () => {
  it("does not load the indexer without authorization", async () => {
    let loaded = 0;
    const result = await runWarriorPlusIndexCron({
      authorized: false,
      limit: 20,
      loadRunner: async () => {
        loaded += 1;
        throw new Error("indexer should not load");
      },
    });

    assert.equal(loaded, 0);
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { ok: false, error: "Unauthorized" });
  });

  it("asks an authorized run for warriorplus only and skips winner policy", async () => {
    let args: unknown = null;
    const result = await runWarriorPlusIndexCron({
      authorized: true,
      limit: 25,
      loadRunner: async () => async (input) => {
        args = input;
        return {
          ok: true,
          tookMs: 1,
          triggeredAt: "2026-10-17T00:00:00.000Z",
          sources: {
            warriorplus: { fetched: 2, normalized: 2, upserted: 2, skipped: 0, errors: [] },
          },
        } as never;
      },
    });

    assert.deepEqual(args, {
      sources: ["warriorplus"],
      limit: 25,
      skipWinnerPolicy: true,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.source, "warriorplus");
    assert.equal(result.body.upserted, 2);
  });

  it("returns a sanitized failure and drops raw import details", async () => {
    const poison = "apiKey=test-key affiliate@example.com https://example.com/promote";
    const failed = await runWarriorPlusIndexCron({
      authorized: true,
      limit: 10,
      loadRunner: async () => async () =>
        ({
          ok: false,
          sources: { warriorplus: { errors: [poison], fetched: 1, upserted: 0 } },
        }) as never,
    });
    const thrown = await runWarriorPlusIndexCron({
      authorized: true,
      limit: 10,
      loadRunner: async () => async () => {
        throw new Error(poison);
      },
    });

    for (const result of [failed, thrown]) {
      const body = JSON.stringify(result.body);
      assert.equal(result.status, 500);
      assert.equal(result.body.error, "WARRIORPLUS_IMPORT_FAILED");
      assert.equal(body.includes("test-key"), false);
      assert.equal(body.includes("affiliate@example.com"), false);
      assert.equal(body.includes("example.com"), false);
    }
  });
});

describe("WarriorPlus browse source text", () => {
  it("checks search and UI source text and does not execute those HTTP paths", () => {
    const offers = read("app/api/offers/search/route.ts");
    const page = read("app/login/dashboard/affiliate/page.tsx");
    const indexer = read("lib/engines/product-indexer/indexer.ts");
    const productIndex = read("app/api/cron/product-index/route.ts");
    const cronRoute = read("app/api/cron/warriorplus-index/route.ts");
    const vercel = read("vercel.json");

    const unauthorized = offers.indexOf('error: "Unauthorized"');
    const browse = offers.indexOf("const warriorPlusBrowse");
    const active = offers.indexOf('.eq("is_active", true)');
    const approved = offers.indexOf('.eq("is_approved", true)');
    assert.ok(unauthorized >= 0 && unauthorized < browse);
    assert.ok(browse < active && active < approved);
    assert.match(offers, /source === "warriorplus" && \(!q \|\| q\.length < 2\)/);
    assert.match(offers, /if \(\(!q \|\| q\.length < 2\) && !warriorPlusBrowse\)/);
    assert.match(offers, /reason: "missing_query"/);
    assert.match(offers, /reason: "source_not_beta_enabled"/);
    assert.match(offers, /if \(!warriorPlusBrowse\)/);

    assert.match(page, /const \[keyword, setKeyword\] = useState\(""\)/);
    assert.match(page, /const searchGen = useRef\(0\)/);
    assert.match(page, /searchGen\.current \+= 1/);
    assert.match(page, /if \(next === "warriorplus"\)/);
    assert.match(page, /void runSearch\(\{ source: next \}\)/);
    const sourceChange = page.slice(
      page.indexOf("const next = e.target.value as ProductSource;"),
      page.indexOf("{SOURCES.map")
    );
    const clearResults = sourceChange.indexOf("setResults([])");
    const clearError = sourceChange.indexOf("setSearchError(null)");
    const warriorBranch = sourceChange.indexOf('if (next === "warriorplus")');
    assert.ok(sourceChange.indexOf("searchGen.current += 1") >= 0);
    assert.ok(clearResults > 0 && clearError > 0);
    assert.ok(clearResults < warriorBranch && clearError < warriorBranch);
    assert.ok(warriorBranch < sourceChange.indexOf("void runSearch({ source: next })"));
    assert.ok(sourceChange.indexOf("setSearching(false)") > warriorBranch);
    assert.equal(sourceChange.includes("setSavedOffers"), false);
    assert.match(
      page,
      /const filteredResults = useMemo\(\(\) => \{\s*if \(!globalNeedle\) return results;/
    );
    assert.match(
      page,
      /const recommendedItems = useMemo\(\(\) => \{\s*const base = \[\.\.\.filteredResults\];/
    );
    assert.match(page, /if \(keywordValue\.length >= 2\) qs\.set\("keyword", keywordValue\)/);
    assert.equal(page.split("gen !== searchGen.current").length - 1, 2);
    assert.match(page, /if \(gen === searchGen\.current\) setSearching\(false\)/);

    const fetchCall = indexer.indexOf("await fetcher({ limit })");
    const upsert = indexer.indexOf('.upsert(batch, { onConflict: "source,external_id" })');
    const skip = indexer.indexOf("if (!args?.skipWinnerPolicy)");
    const winner = indexer.indexOf("await applyWinnerPolicyIfEnabled()");
    assert.ok(fetchCall > 0 && fetchCall < upsert);
    assert.ok(skip > 0 && skip < winner);
    assert.equal(productIndex.includes("skipWinnerPolicy"), false);

    const authCall = cronRoute.indexOf("isCronRequestAuthorized(req)");
    const indexerImport = cronRoute.indexOf('import("@/lib/engines/product-indexer/indexer")');
    assert.ok(authCall >= 0 && authCall < indexerImport);
    assert.match(vercel, /\/api\/cron\/autoaffi/);
    assert.match(vercel, /\/api\/cron\/warriorplus-index/);
  });
});
