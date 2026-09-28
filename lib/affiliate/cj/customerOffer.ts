/**
 * Customer payloads for saved CJ offers expose the Autoaffi /go link only.
 */

export function toCustomerSavedOffer<T extends { id?: string | null; source?: string | null }>(
  row: T
): T & { display_link?: string; tracking_label?: string } {
  if (String(row.source || "").trim().toLowerCase() !== "cj") {
    return row;
  }

  const id = String(row.id || "").trim();
  return {
    ...row,
    affiliate_link: null,
    subid: null,
    commission: null,
    epc: null,
    display_link: id ? `/go/offer/${id}` : "",
    tracking_label: "CJ · Instagram",
  };
}
