import type { ProductIndexerReport } from "./types";

type WarriorPlusRunner = (args: {
  sources: Array<"warriorplus">;
  limit: number;
  skipWinnerPolicy: true;
}) => Promise<ProductIndexerReport>;

export type WarriorPlusIndexCronResult = {
  status: number;
  body: {
    ok: boolean;
    error?: string;
    source?: "warriorplus";
    limit?: number;
    fetched?: number;
    upserted?: number;
  };
};

/**
 * Auth is the caller's boolean, evaluated before loadRunner.
 * The runner is loaded only after authorization. It always asks for
 * warriorplus only and skips the global winner policy.
 * Failure responses stay on fixed codes.
 */
export async function runWarriorPlusIndexCron(input: {
  authorized: boolean;
  limit: number;
  loadRunner: () => Promise<WarriorPlusRunner>;
}): Promise<WarriorPlusIndexCronResult> {
  if (!input.authorized) {
    return { status: 401, body: { ok: false, error: "Unauthorized" } };
  }

  const limit = Math.max(1, Math.min(Math.floor(Number(input.limit) || 1), 500));

  try {
    const run = await input.loadRunner();
    const result = await run({
      sources: ["warriorplus"],
      limit,
      skipWinnerPolicy: true,
    });

    if (!result?.ok) {
      return { status: 500, body: { ok: false, error: "WARRIORPLUS_IMPORT_FAILED" } };
    }

    return {
      status: 200,
      body: {
        ok: true,
        source: "warriorplus",
        limit,
        fetched: result.sources?.warriorplus?.fetched ?? 0,
        upserted: result.sources?.warriorplus?.upserted ?? 0,
      },
    };
  } catch {
    return { status: 500, body: { ok: false, error: "WARRIORPLUS_IMPORT_FAILED" } };
  }
}
