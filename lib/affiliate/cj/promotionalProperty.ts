import {
  CJ_PROMOTIONAL_PROPERTIES_ENDPOINT,
  CjConfigError,
} from "./config";
import { CjGraphqlError, cjGraphql } from "./graphql";

/**
 * CJ Promotional Properties API.
 * Endpoint and enums are the current publisher contract at accounts.api.cj.com/graphql.
 * Phase 1 creates and lists SOCIAL_MEDIA properties. Update is not used:
 * the first flow is create-once and then reuse the returned PID.
 */

export const CJ_SOCIAL_PLATFORM_INSTAGRAM = "INSTAGRAM" as const;

export const CJ_PROPERTY_TYPE_SOCIAL_MEDIA = "SOCIAL_MEDIA" as const;

export const CJ_PROPERTY_STATUSES = ["ACTIVE", "ARCHIVED", "TERMINATED"] as const;

export type CjPropertyStatus = (typeof CJ_PROPERTY_STATUSES)[number];

export type CjSocialMediaProperty = {
  id: string;
  publisherId: string;
  name: string;
  description: string | null;
  status: string;
  isPrimary: boolean;
  socialMediaHandle: string;
  socialMediaPlatform: string;
  propertyType: string;
};

type PropertyNode = {
  id?: unknown;
  publisherId?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  isPrimary?: unknown;
  propertyTypeDetails?: {
    type?: unknown;
    socialMediaHandle?: unknown;
    socialMediaPlatform?: unknown;
  } | null;
};

const PROPERTY_FIELDS = `
  id
  publisherId
  name
  description
  status
  isPrimary
  propertyTypeDetails {
    type
    ... on PromotionalPropertySocialMediaDetails {
      socialMediaHandle
      socialMediaPlatform
    }
  }
`;

const LIST_QUERY = `
query ListCJPromotionalProperties($publisherId: ID!, $limit: Int!, $offset: Int!) {
  promotionalProperties(publisherId: $publisherId, limit: $limit, offset: $offset) {
    totalCount
    resultList {
      ${PROPERTY_FIELDS}
    }
  }
}
`;

const CREATE_MUTATION = `
mutation CreateCJPromotionalProperty($input: CreatePromotionalPropertyInput!) {
  createPromotionalProperty(input: $input) {
    ${PROPERTY_FIELDS}
  }
}
`;

export type CjPropertyClientOptions = {
  pat: string;
  publisherId: string;
  fetchImpl?: typeof fetch;
};

export async function listCJPromotionalProperties(
  options: CjPropertyClientOptions & { pageSize?: number; maxPages?: number }
): Promise<CjSocialMediaProperty[]> {
  assertServerAuth(options);
  const pageSize = clamp(options.pageSize ?? 100, 1, 100);
  const maxPages = clamp(options.maxPages ?? 10, 1, 20);
  const found: CjSocialMediaProperty[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await cjGraphql<{
      promotionalProperties?: { totalCount?: unknown; resultList?: unknown };
    }>({
      endpoint: CJ_PROMOTIONAL_PROPERTIES_ENDPOINT,
      pat: options.pat,
      query: LIST_QUERY,
      variables: {
        publisherId: options.publisherId,
        limit: pageSize,
        offset,
      },
      fetchImpl: options.fetchImpl,
    });

    const connection = data.promotionalProperties;
    const rows = Array.isArray(connection?.resultList) ? connection.resultList : null;
    if (!connection || !rows) {
      throw new CjGraphqlError("CJ_RESPONSE_MALFORMED");
    }

    for (const row of rows) {
      const mapped = mapSocialProperty(row);
      if (mapped) found.push(mapped);
    }

    const total = numberOrNull(connection.totalCount);
    offset += rows.length;
    if (rows.length === 0) break;
    if (total !== null && offset >= total) break;
    if (rows.length < pageSize) break;
  }

  return found;
}

export async function createCJPromotionalProperty(
  options: CjPropertyClientOptions & {
    name: string;
    description?: string | null;
    socialMediaHandle: string;
    socialMediaPlatform: typeof CJ_SOCIAL_PLATFORM_INSTAGRAM;
  }
): Promise<CjSocialMediaProperty> {
  assertServerAuth(options);

  const handle = String(options.socialMediaHandle || "").trim();
  const name = String(options.name || "").trim();
  if (!handle || !name) {
    throw new CjGraphqlError("CJ_PROPERTY_INPUT_INVALID");
  }

  if (options.socialMediaPlatform !== CJ_SOCIAL_PLATFORM_INSTAGRAM) {
    throw new CjGraphqlError("CJ_PLATFORM_UNSUPPORTED");
  }

  const data = await cjGraphql<{ createPromotionalProperty?: unknown }>({
    endpoint: CJ_PROMOTIONAL_PROPERTIES_ENDPOINT,
    pat: options.pat,
    query: CREATE_MUTATION,
    variables: {
      input: {
        name,
        description: options.description ? String(options.description) : "",
        publisherId: options.publisherId,
        isPrimary: false,
        status: "ACTIVE",
        tags: [],
        promotionalModels: [{ type: "INFLUENCER", isPrimary: true }],
        propertyTypeDetails: {
          type: CJ_PROPERTY_TYPE_SOCIAL_MEDIA,
          socialMediaHandle: handle,
          socialMediaPlatform: CJ_SOCIAL_PLATFORM_INSTAGRAM,
        },
      },
    },
    fetchImpl: options.fetchImpl,
  });

  const created = mapSocialProperty(data.createPromotionalProperty);
  assertCreatedInstagramProperty(created, {
    publisherId: options.publisherId,
    socialMediaHandle: handle,
  });
  return created as CjSocialMediaProperty;
}

/**
 * The created CJ property must describe the property we asked for.
 * Local Instagram values are not stored in place of a mismatched response.
 */
export function assertCreatedInstagramProperty(
  created: CjSocialMediaProperty | null,
  expected: { publisherId: string; socialMediaHandle: string }
): asserts created is CjSocialMediaProperty {
  if (!created?.id) {
    throw new CjGraphqlError("CJ_PID_MISSING");
  }

  if (created.status === "ARCHIVED" || created.status === "TERMINATED") {
    throw new CjGraphqlError("CJ_PROPERTY_INACTIVE");
  }

  const expectedHandle = normalizeCjSocialHandle(expected.socialMediaHandle);
  const returnedHandle = normalizeCjSocialHandle(created.socialMediaHandle);
  const publisherId = String(expected.publisherId || "").trim();

  if (
    created.status !== "ACTIVE" ||
    !publisherId ||
    created.publisherId !== publisherId ||
    created.propertyType !== CJ_PROPERTY_TYPE_SOCIAL_MEDIA ||
    created.socialMediaPlatform !== CJ_SOCIAL_PLATFORM_INSTAGRAM ||
    !expectedHandle ||
    returnedHandle !== expectedHandle
  ) {
    throw new CjGraphqlError("CJ_PROPERTY_RESPONSE_MISMATCH");
  }
}

export function normalizeCjSocialHandle(value: string) {
  const trimmed = String(value || "").trim();
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  return withoutAt.toLowerCase();
}

export function mapSocialProperty(row: unknown): CjSocialMediaProperty | null {
  if (!row || typeof row !== "object") return null;
  const node = row as PropertyNode;
  const id = stringOrEmpty(node.id);
  if (!id) return null;

  const details = node.propertyTypeDetails;
  return {
    id,
    publisherId: stringOrEmpty(node.publisherId),
    name: stringOrEmpty(node.name),
    description: stringOrEmpty(node.description) || null,
    status: stringOrEmpty(node.status),
    isPrimary: node.isPrimary === true,
    socialMediaHandle: stringOrEmpty(details?.socialMediaHandle),
    socialMediaPlatform: stringOrEmpty(details?.socialMediaPlatform),
    propertyType: stringOrEmpty(details?.type),
  };
}

function assertServerAuth(options: { pat: string; publisherId: string }) {
  if (!String(options.pat || "").trim()) {
    throw new CjConfigError("CJ_PAT_MISSING");
  }
  if (!String(options.publisherId || "").trim()) {
    throw new CjConfigError("CJ_PUBLISHER_ID_MISSING");
  }
}

function stringOrEmpty(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberOrNull(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
