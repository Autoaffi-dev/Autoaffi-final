export type ProfileConnectMode = "lead" | "bridge";

export type ProfileConnectDestination = {
  mode: ProfileConnectMode;
  label: string;
  path: string;
  description: string;
};

function getBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://www.autoaffi.com";

  return base.replace(/\/+$/, "");
}

/**
 * Profile Setup public routes:
 * - lead   => /profile/lead/[token]
 * - bridge => /profile/bridge/[token]
 *
 * We use token consistently here so the route structure matches
 * the live pages already created for Profile Setup.
 */
export function getProfileConnectDestination(
  mode: ProfileConnectMode,
  params?: {
    offerKey?: string | null;
    slug?: string | null;
    userCode?: string | null;
  }
): ProfileConnectDestination {
  const base = getBaseUrl();
  const offerKey = (params?.offerKey || "autoaffi").trim();
  const token = (params?.slug || offerKey).trim();
  const userCode = (params?.userCode || "").trim();

  if (mode === "lead") {
    return {
      mode,
      label: "Lead Page",
      path: `${base}/profile/lead/${encodeURIComponent(token)}${
        userCode ? `?u=${encodeURIComponent(userCode)}` : ""
      }`,
      description:
        "Lead-first path designed to capture interest quickly and later connect directly into the customer's leads flow.",
    };
  }

  return {
    mode,
    label: "Personal Bridge Page",
    path: `${base}/profile/bridge/${encodeURIComponent(token)}${
      userCode ? `?u=${encodeURIComponent(userCode)}` : ""
    }`,
    description:
      "Personal bridge page connected to the customer first, then continues to the premium/offer page.",
    };
}