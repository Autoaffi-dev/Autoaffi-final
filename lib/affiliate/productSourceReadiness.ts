/**
 * Private Beta product-source policy.
 *
 * BETA_TRACKING_READY_AUTOMATED_SOURCES is the only code-owned set that
 * may be shown as an automated Product source. Adding a network later
 * requires a tracking contract, tests, and a code change to this list.
 *
 * PRODUCT_BETA_ENABLED_SOURCES may only select from that set.
 * It cannot promote CJ, Awin, AliExpress, or any other source.
 *
 * Unset or blank env → the full ready set (currently warriorplus).
 * An explicit env whose intersection with the ready set is empty →
 * no automated sources. That never falls back to an unlisted network.
 */

export const BETA_TRACKING_READY_AUTOMATED_SOURCES = ["warriorplus"] as const;

export const BETA_MANUAL_SOURCE = "byo";

export function getBetaAutomatedSources(envValue?: string | null): string[] {
  const ready = BETA_TRACKING_READY_AUTOMATED_SOURCES.map((source) =>
    source.toLowerCase()
  );
  const raw =
    envValue === undefined ? process.env.PRODUCT_BETA_ENABLED_SOURCES : envValue;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return [...ready];
  }

  const requested = new Set(
    String(raw)
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );

  return ready.filter((source) => requested.has(source));
}

export function isBetaAutomatedSource(
  source: string,
  envValue?: string | null
): boolean {
  const key = String(source || "").trim().toLowerCase();
  if (!key || key === BETA_MANUAL_SOURCE) return false;
  return getBetaAutomatedSources(envValue).includes(key);
}

export function isBetaManualSource(source: string): boolean {
  return String(source || "").trim().toLowerCase() === BETA_MANUAL_SOURCE;
}

/**
 * Narrow server-side gate for one controlled CJ customer test.
 * It does not change the global ready list or getBetaAutomatedSources().
 * CJ is added only when both env lists are present and both values match exactly.
 */
const CONTROLLED_CJ_SOURCE = 'cj';
const CONTROLLED_USER_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CONTROLLED_EXTERNAL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ControlledCjBetaEnv = {
  userIds?: string | null;
  externalIds?: string | null;
};

function parseExactTokens(
  raw: string | null | undefined,
  accept: (token: string) => boolean
): string[] {
  if (raw === undefined || raw === null) return [];
  const text = String(raw);
  if (text.trim() === "") return [];

  const tokens: string[] = [];
  for (const part of text.split(",")) {
    const token = part.trim();
    if (!token) continue;
    if (!accept(token)) return [];
    tokens.push(token);
  }
  return tokens;
}

function controlledLists(env?: ControlledCjBetaEnv) {
  const provided = env !== undefined;
  const userRaw = provided ? env.userIds : process.env.CJ_CONTROLLED_BETA_USER_IDS;
  const externalRaw = provided
    ? env.externalIds
    : process.env.CJ_CONTROLLED_BETA_EXTERNAL_IDS;

  return {
    userIds: parseExactTokens(userRaw, (token) => CONTROLLED_USER_ID_PATTERN.test(token)),
    externalIds: parseExactTokens(externalRaw, (token) =>
      CONTROLLED_EXTERNAL_ID_PATTERN.test(token)
    ),
  };
}

export function isControlledCjBetaUser(
  userId: string,
  env?: ControlledCjBetaEnv
): boolean {
  const id = String(userId ?? "").trim();
  if (!CONTROLLED_USER_ID_PATTERN.test(id)) return false;
  const { userIds, externalIds } = controlledLists(env);
  if (userIds.length === 0 || externalIds.length === 0) return false;
  return userIds.includes(id);
}

export function controlledCjExternalIds(
  userId: string,
  env?: ControlledCjBetaEnv
): string[] {
  if (!isControlledCjBetaUser(userId, env)) return [];
  return controlledLists(env).externalIds;
}

export function customerAutomatedSources(
  userId: string,
  globalSources?: readonly string[] | null,
  env?: ControlledCjBetaEnv
): string[] {
  const sources = (
    globalSources === undefined || globalSources === null
      ? getBetaAutomatedSources()
      : globalSources
  )
    .map((source) => String(source || "").trim().toLowerCase())
    .filter(Boolean);

  if (!isControlledCjBetaUser(userId, env)) return [...sources];
  if (sources.includes(CONTROLLED_CJ_SOURCE)) return [...sources];
  return [...sources, CONTROLLED_CJ_SOURCE];
}

export function isCustomerAutomatedSource(
  userId: string,
  source: string,
  env?: ControlledCjBetaEnv
): boolean {
  const key = String(source || "").trim().toLowerCase();
  if (!key || key === BETA_MANUAL_SOURCE) return false;
  if (key === CONTROLLED_CJ_SOURCE) return isControlledCjBetaUser(userId, env);
  return isBetaAutomatedSource(key);
}

export function isControlledCjCatalogItem(
  userId: string,
  source: string,
  externalId: string | null | undefined,
  env?: ControlledCjBetaEnv
): boolean {
  const key = String(source || "").trim().toLowerCase();
  if (key !== CONTROLLED_CJ_SOURCE) return false;
  const external = String(externalId ?? "").trim();
  if (!CONTROLLED_EXTERNAL_ID_PATTERN.test(external)) return false;
  return controlledCjExternalIds(userId, env).includes(external);
}

/** Keep every non-CJ row. Keep a CJ row only when it is the pinned catalog item. */
export function retainCustomerSearchItem(
  userId: string,
  source: string | null | undefined,
  externalId: string | null | undefined,
  env?: ControlledCjBetaEnv
): boolean {
  const key = String(source || "").trim().toLowerCase();
  if (key !== CONTROLLED_CJ_SOURCE) return true;
  return isControlledCjCatalogItem(userId, key, externalId, env);
}

/** Private Beta has no source with verified commission semantics. */
export function customerFacingProductCommission(): null {
  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function warriorPlusTrackingMatches(
  affiliateUrl: string,
  subid: string
): boolean {
  const expected = String(subid || "").trim();
  if (!expected || !isHttpUrl(affiliateUrl)) return false;

  try {
    const url = new URL(affiliateUrl);
    return (
      url.searchParams.get("hop_sid") === expected &&
      url.searchParams.get("sid") === expected
    );
  } catch {
    return false;
  }
}
