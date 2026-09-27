import { CJ_PROGRAM_TERMS_ENDPOINT, CjConfigError } from "./config";
import { CjGraphqlError, cjGraphql } from "./graphql";

/**
 * CJ Program Terms API.
 * Endpoint: https://programs.api.cj.com/query
 * Commission rows stay structured. They are not a customer-facing product rate.
 */

export const CJ_CONTRACT_STATUSES = [
  "ACTIVE",
  "PENDING_OFFER",
  "PENDING_REVERSION",
  "CANCELLED",
  "EXPIRED",
] as const;

export type CjContractStatus = (typeof CJ_CONTRACT_STATUSES)[number];

export const CJ_COMMISSION_RATE_TYPES = [
  "PERCENT",
  "FIXED",
  "FIXED_PER_ORDER",
] as const;

export type CjCommissionRateType = (typeof CJ_COMMISSION_RATE_TYPES)[number];

export type CjCommissionRate = {
  type: string;
  value: number | null;
  currency: string | null;
};

export type CjNamedRef = {
  id: string;
  name: string | null;
};

export type CjStructuredCommission = {
  rank: number | null;
  isViewThrough: boolean;
  situation: CjNamedRef | null;
  itemList: CjNamedRef | null;
  promotionalProperties: CjNamedRef[];
  rate: CjCommissionRate;
};

export type CjAdvertiserContract = {
  advertiserId: string;
  contractStatus: string;
  programTermsId: string | null;
  programTermsName: string | null;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
  commissions: CjStructuredCommission[];
};

const CONTRACT_QUERY = `
query CJAdvertiserContract($publisherId: ID!, $advertiserId: ID!) {
  publisher {
    contracts(
      publisherId: $publisherId
      limit: 20
      filters: { advertiserId: $advertiserId }
    ) {
      totalCount
      count
      resultList {
        advertiserId
        status
        startTime
        endTime
        programTerms {
          id
          name
          actionTerms {
            id
            commissions {
              rank
              isViewThrough
              situation { id name }
              itemList { id name }
              promotionalProperties { id name }
              rate { type value currency }
            }
          }
        }
      }
    }
  }
}
`;

export function isActiveCjContractStatus(status: string | null | undefined) {
  return String(status || "").trim().toUpperCase() === "ACTIVE";
}

export function isKnownCjCommissionRateType(
  value: string
): value is CjCommissionRateType {
  return (CJ_COMMISSION_RATE_TYPES as readonly string[]).includes(value);
}

export function classifyCjCommission(commission: CjStructuredCommission) {
  return {
    rateType: commission.rate.type,
    itemListSpecific: commission.itemList !== null,
    situationSpecific: commission.situation !== null,
    promotionalPropertySpecific: commission.promotionalProperties.length > 0,
  };
}

export async function getCJAdvertiserContract(args: {
  pat: string;
  publisherId: string;
  advertiserId: string;
  fetchImpl?: typeof fetch;
}): Promise<CjAdvertiserContract | null> {
  const pat = String(args.pat || "").trim();
  const publisherId = String(args.publisherId || "").trim();
  const advertiserId = String(args.advertiserId || "").trim();

  if (!pat) throw new CjConfigError("CJ_PAT_MISSING");
  if (!publisherId) throw new CjConfigError("CJ_PUBLISHER_ID_MISSING");
  if (!advertiserId) throw new CjGraphqlError("CJ_ADVERTISER_ID_MISSING");

  const data = await cjGraphql<{
    publisher?: { contracts?: { resultList?: unknown } };
  }>({
    endpoint: CJ_PROGRAM_TERMS_ENDPOINT,
    pat,
    query: CONTRACT_QUERY,
    variables: { publisherId, advertiserId },
    fetchImpl: args.fetchImpl,
  });

  const resultList = data.publisher?.contracts?.resultList;
  if (!Array.isArray(resultList)) {
    throw new CjGraphqlError("CJ_RESPONSE_MALFORMED");
  }

  const contracts = resultList
    .map((row) => normalizeContract(row, advertiserId))
    .filter((row): row is CjAdvertiserContract => row !== null);

  if (contracts.length === 0) return null;

  return contracts.find((row) => row.isActive) || contracts[0];
}

function normalizeContract(
  row: unknown,
  requestedAdvertiserId: string
): CjAdvertiserContract | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const status = stringOrEmpty(record.status);
  if (!status) return null;

  const terms =
    record.programTerms && typeof record.programTerms === "object"
      ? (record.programTerms as Record<string, unknown>)
      : null;

  return {
    advertiserId: stringOrEmpty(record.advertiserId) || requestedAdvertiserId,
    contractStatus: status,
    programTermsId: terms ? stringOrEmpty(terms.id) || null : null,
    programTermsName: terms ? stringOrEmpty(terms.name) || null : null,
    startTime: stringOrEmpty(record.startTime) || null,
    endTime: stringOrEmpty(record.endTime) || null,
    isActive: isActiveCjContractStatus(status),
    commissions: terms ? collectCommissions(terms.actionTerms) : [],
  };
}

function collectCommissions(actionTerms: unknown): CjStructuredCommission[] {
  if (!Array.isArray(actionTerms)) return [];
  const commissions: CjStructuredCommission[] = [];

  for (const term of actionTerms) {
    if (!term || typeof term !== "object") continue;
    const rows = (term as { commissions?: unknown }).commissions;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const mapped = normalizeCommission(row);
      if (mapped) commissions.push(mapped);
    }
  }

  return commissions;
}

function normalizeCommission(row: unknown): CjStructuredCommission | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const rate =
    record.rate && typeof record.rate === "object"
      ? (record.rate as Record<string, unknown>)
      : null;
  if (!rate) return null;

  const type = stringOrEmpty(rate.type);
  if (!type) return null;

  return {
    rank: numberOrNull(record.rank),
    isViewThrough: record.isViewThrough === true,
    situation: namedRef(record.situation),
    itemList: namedRef(record.itemList),
    promotionalProperties: namedRefList(record.promotionalProperties),
    rate: {
      type,
      value: numberOrNull(rate.value),
      currency: stringOrEmpty(rate.currency) || null,
    },
  };
}

function namedRef(value: unknown): CjNamedRef | null {
  if (!value || typeof value !== "object") return null;
  const id = stringOrEmpty((value as { id?: unknown }).id);
  if (!id) return null;
  return {
    id,
    name: stringOrEmpty((value as { name?: unknown }).name) || null,
  };
}

function namedRefList(value: unknown): CjNamedRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => namedRef(item))
    .filter((item): item is CjNamedRef => item !== null);
}

function stringOrEmpty(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
