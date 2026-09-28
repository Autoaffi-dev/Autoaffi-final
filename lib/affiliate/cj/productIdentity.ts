/**
 * CJ product identity comes from the product_index row.
 * external_id is cj_{advertiserId}_{productId}. merchant_id is the advertiser id.
 * Client-supplied advertiser and product ids are not read here.
 */

export type CjIndexedProductIdentity = {
  advertiserId: string;
  productId: string;
};

export function parseCjIndexedProduct(row: {
  external_id?: string | null;
  merchant_id?: string | null;
}): CjIndexedProductIdentity | null {
  const externalId = String(row.external_id || "").trim();
  const match = /^cj_([^_]+)_(.+)$/.exec(externalId);
  if (!match) return null;

  const advertiserId = match[1].trim();
  const productId = match[2].trim();
  const merchantId = String(row.merchant_id || "").trim();

  if (!advertiserId || !productId || !merchantId || merchantId !== advertiserId) {
    return null;
  }

  return { advertiserId, productId };
}
