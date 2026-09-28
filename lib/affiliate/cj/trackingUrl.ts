import { CjGraphqlError } from "./graphql";

/**
 * Finalizes an official CJ clickUrl.
 * Hosts are the exact hosts in current CJ Product Feed, Link Search,
 * and publisher-parameter examples. Comparison is exact, never a suffix.
 * Only the default HTTPS port is accepted.
 * The private-beta click path is exactly /click-{pid}-{aid}.
 * SID is appended only when no sid parameter exists.
 * One sid must equal the expected stable SID. Two or more fail closed.
 * Documented click URL length limit is 1000 characters.
 *
 * cjsku is not treated as the product id. The Product Feed schema describes
 * clickUrl as the product click URL and does not define cjsku as product id.
 */

export const CJ_TRACKING_HOSTS = [
  "www.kqzyfj.com",
  "www.tkqlhce.com",
  "www.jdoqocy.com",
] as const;

export const CJ_TRACKING_URL_MAX_LENGTH = 1000;

const CLICK_PATH = /^\/click-(\d+)-(\d+)$/;

export function finalizeCjTrackingUrl(args: {
  clickUrl: string;
  expectedPid: string;
  expectedSid: string;
  merchantUrl?: string | null;
}): string {
  const expectedPid = String(args.expectedPid || "").trim();
  const expectedSid = String(args.expectedSid || "").trim();
  if (!expectedPid || !expectedSid) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }

  const url = parseHttpsUrl(args.clickUrl);
  assertOfficialHost(url);
  assertNotMerchant(url, args.merchantUrl);

  const identity = readClickIdentity(url.pathname);
  if (!identity || identity.pid !== expectedPid || !isLegitimateAid(identity.aid)) {
    throw new CjGraphqlError(
      identity && identity.pid !== expectedPid
        ? "CJ_TRACKING_PID_MISMATCH"
        : "CJ_TRACKING_URL_INVALID"
    );
  }

  applyExpectedSid(url, expectedSid, "append");

  const finalized = url.toString();
  if (finalized.length > CJ_TRACKING_URL_MAX_LENGTH) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }

  return finalized;
}

/**
 * Re-check a URL already stored on user_offers.
 * Does not construct a new CJ link and does not fall back to a merchant URL.
 */
export function assertStoredCjTrackingUrl(affiliateLink: string, expectedSid: string) {
  const expected = String(expectedSid || "").trim();
  const url = parseHttpsUrl(affiliateLink);
  assertOfficialHost(url);
  const identity = readClickIdentity(url.pathname);
  if (!identity || !isLegitimateAid(identity.aid)) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  applyExpectedSid(url, expected, "require");
  if (url.toString().length > CJ_TRACKING_URL_MAX_LENGTH) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  return {
    href: url.toString(),
    pid: identity.pid,
  };
}

export function readCjClickPid(affiliateLink: string) {
  const url = parseHttpsUrl(affiliateLink);
  return readClickIdentity(url.pathname)?.pid || "";
}

function parseHttpsUrl(value: string) {
  const raw = String(value || "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  if (url.protocol !== "https:") {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  if (url.username || url.password) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  if (url.port || hasExplicitPort(raw)) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
  return url;
}

function hasExplicitPort(raw: string) {
  const match = /^https:\/\/([^/?#]+)/i.exec(raw);
  if (!match) return true;
  const authority = match[1];
  const host = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;
  return host.includes(":");
}

function applyExpectedSid(url: URL, expectedSid: string, mode: "append" | "require") {
  const sids = url.searchParams.getAll("sid");
  if (sids.length > 1) {
    throw new CjGraphqlError("CJ_SID_MISMATCH");
  }
  if (sids.length === 1) {
    if (sids[0] !== expectedSid) {
      throw new CjGraphqlError("CJ_SID_MISMATCH");
    }
    return;
  }
  if (mode === "require") {
    throw new CjGraphqlError("CJ_SID_MISMATCH");
  }
  url.searchParams.append("sid", expectedSid);
}

function assertOfficialHost(url: URL) {
  const host = url.hostname.toLowerCase();
  if (!CJ_TRACKING_HOSTS.includes(host as (typeof CJ_TRACKING_HOSTS)[number])) {
    throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
  }
}

function assertNotMerchant(url: URL, merchantUrl?: string | null) {
  const merchant = String(merchantUrl || "").trim();
  if (!merchant) return;
  try {
    const merchantHost = new URL(merchant).hostname.toLowerCase();
    if (merchantHost && merchantHost === url.hostname.toLowerCase()) {
      throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");
    }
  } catch (err) {
    if (err instanceof CjGraphqlError) throw err;
  }
}

function readClickIdentity(pathname: string) {
  const match = CLICK_PATH.exec(pathname);
  if (!match) return null;
  return { pid: match[1], aid: match[2] };
}

function isLegitimateAid(aid: string) {
  if (!/^\d+$/.test(aid)) return false;
  if (/^0+$/.test(aid)) return false;
  return true;
}
