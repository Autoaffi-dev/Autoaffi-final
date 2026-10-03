import { CJ_PRODUCT_FEED_ENDPOINT } from "./config";
import { CjGraphqlError, cjGraphql } from "./graphql";

/**
 * Official CJ Product Feed click URL for one promotional property.
 * Endpoint: https://ads.api.cj.com/query
 * Schema: products(...) { linkCode(pid, shopperId) { clickUrl } }
 * linkCode does not return a separate AID field. AID stays inside clickUrl.
 * shopperId is the server-computed stable SubID. CJ returns that value as
 * the sid query parameter on clickUrl. Callers must not derive it from
 * browser input, and Autoaffi does not append sid locally.
 */

export const CJ_PRODUCT_CLICK_QUERY = `
query CJProductClickUrl(
  $companyId: ID!,
  $partnerIds: [ID!],
  $productIds: [ID!],
  $pid: ID!,
  $shopperId: ID!
) {
  products(
    companyId: $companyId
    partnerIds: $partnerIds
    productIds: $productIds
    limit: 5
  ) {
    resultList {
      id
      advertiserId
      linkCode(pid: $pid, shopperId: $shopperId) {
        clickUrl
      }
    }
  }
}
`;

export type CjProductClick = {
  productId: string;
  advertiserId: string;
  clickUrl: string;
};

type ProductClickNode = {
  id?: unknown;
  advertiserId?: unknown;
  linkCode?: { clickUrl?: unknown } | null;
};

export async function getCJProductClickUrl(args: {
  pat: string;
  companyId: string;
  advertiserId: string;
  productId: string;
  promotionalPropertyId: string;
  shopperId: string;
  fetchImpl?: typeof fetch;
}): Promise<CjProductClick> {
  const companyId = String(args.companyId || "").trim();
  const advertiserId = String(args.advertiserId || "").trim();
  const productId = String(args.productId || "").trim();
  const promotionalPropertyId = String(args.promotionalPropertyId || "").trim();
  const shopperId = String(args.shopperId || "").trim();

  if (!companyId) throw new CjGraphqlError("CJ_PUBLISHER_ID_MISSING");
  if (!advertiserId || !productId || !promotionalPropertyId) {
    throw new CjGraphqlError("CJ_PRODUCT_MISMATCH");
  }
  if (!shopperId) throw new CjGraphqlError("CJ_TRACKING_URL_INVALID");

  const data = await cjGraphql<{
    products?: { resultList?: unknown };
  }>({
    endpoint: CJ_PRODUCT_FEED_ENDPOINT,
    pat: args.pat,
    query: CJ_PRODUCT_CLICK_QUERY,
    variables: {
      companyId,
      partnerIds: [advertiserId],
      productIds: [productId],
      pid: promotionalPropertyId,
      shopperId,
    },
    fetchImpl: args.fetchImpl,
  });

  const rows = data.products?.resultList;
  if (!Array.isArray(rows)) {
    throw new CjGraphqlError("CJ_RESPONSE_MALFORMED");
  }

  const matches = rows.filter((row) => productNodeMatches(row, advertiserId, productId));
  if (matches.length !== 1) {
    throw new CjGraphqlError("CJ_PRODUCT_MISMATCH");
  }

  const clickUrl = stringOrEmpty(
    (matches[0] as ProductClickNode).linkCode?.clickUrl
  );
  if (!clickUrl) {
    throw new CjGraphqlError("CJ_CLICK_URL_MISSING");
  }

  return {
    productId,
    advertiserId,
    clickUrl,
  };
}

function productNodeMatches(row: unknown, advertiserId: string, productId: string) {
  if (!row || typeof row !== "object") return false;
  const node = row as ProductClickNode;
  return (
    stringOrEmpty(node.id) === productId &&
    stringOrEmpty(node.advertiserId) === advertiserId
  );
}

function stringOrEmpty(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
