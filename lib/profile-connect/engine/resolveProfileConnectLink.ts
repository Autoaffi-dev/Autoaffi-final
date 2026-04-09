import {
  getProfileConnectDestination,
  type ProfileConnectMode,
} from "./getProfileConnectDestination";

export type ProfileConnectRouteMode = ProfileConnectMode;

export type ResolveProfileConnectLinkInput = {
  /**
   * Customer's real Autoaffi recurring / sub-ID base link.
   * Kept for future tracking logic, but V1 profile pages should not depend
   * on /go redirects being ready.
   */
  baseAutoaffiLink: string;

  /**
   * Which routing mode the customer selected in Profile Setup.
   * New model:
   * - lead
   * - bridge
   */
  mode: ProfileConnectRouteMode;

  /**
   * Optional external/custom destination if the user chose their own funnel/page.
   */
  customDestinationUrl?: string | null;

  /**
   * If true, use Autoaffi's hosted public profile pages.
   * If false, use the user's custom destination directly.
   */
  useAutoaffiRouting: boolean;

  /**
   * Optional offer key / token used to resolve the internal Autoaffi destination.
   */
  offerKey?: string | null;
  slug?: string | null;
  userCode?: string | null;
};

export type ResolvedProfileConnectLink = {
  finalUrl: string;
  mode: ProfileConnectRouteMode;
  destinationLabel: string;
  destinationPath: string;
  destinationDescription: string;
  publicCta: string;
  bioCta: string;
  replyCta: string;
};

function appendQueryParam(url: string, key: string, value: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function normalizeUrl(url: string): string {
  return (url || "").trim();
}

function getPublicCta(mode: ProfileConnectRouteMode): string {
  if (mode === "lead") return "Start here";
  return "See how this works first";
}

function getBioCta(mode: ProfileConnectRouteMode): string {
  if (mode === "lead") {
    return "Use the link below to start with the easiest first step ↓";
  }
  return "Use the link below to see how this works first ↓";
}

function getReplyCta(mode: ProfileConnectRouteMode, url: string): string {
  if (mode === "lead") {
    return `Here’s the easiest first step: ${url}`;
  }
  return `Here’s the personal page first: ${url}`;
}

function getAppBaseUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function buildHostedProfilePath(
  mode: ProfileConnectRouteMode,
  token: string
) {
  if (mode === "lead") {
    return `/profile/lead/${encodeURIComponent(token)}`;
  }

  return `/profile/bridge/${encodeURIComponent(token)}`;
}

/**
 * V1 logic:
 *
 * - Autoaffi-hosted profile pages should open directly
 * - no dependency on /go token redirect existing yet
 * - keep userCode in URL so we preserve identity / attribution context
 *
 * Later, a deeper tracking layer can be added on top again.
 */
export function resolveProfileConnectLink(
  input: ResolveProfileConnectLinkInput
): ResolvedProfileConnectLink {
  const {
    mode,
    customDestinationUrl,
    useAutoaffiRouting,
    offerKey,
    slug,
    userCode,
  } = input;

  const safeCustomUrl = normalizeUrl(customDestinationUrl || "");
  const appBaseUrl = getAppBaseUrl();

  const token = normalizeUrl(slug || userCode || offerKey || "autoaffi");

  const destination = getProfileConnectDestination(mode, {
    offerKey,
    slug: token,
    userCode,
  });

  let finalUrl = "";

  if (useAutoaffiRouting) {
    const hostedPath = buildHostedProfilePath(mode, token);

    finalUrl = `${appBaseUrl}${hostedPath}`;

    if (userCode) {
      finalUrl = appendQueryParam(finalUrl, "u", userCode);
    }

    if (offerKey) {
      finalUrl = appendQueryParam(finalUrl, "offer", offerKey);
    }

    finalUrl = appendQueryParam(finalUrl, "platform", "instagram");
  } else {
    if (!safeCustomUrl) {
      throw new Error("Missing custom destination URL.");
    }

    finalUrl = appendQueryParam(safeCustomUrl, "profile_mode", mode);

    if (userCode) {
      finalUrl = appendQueryParam(finalUrl, "u", userCode);
    }

    if (offerKey) {
      finalUrl = appendQueryParam(finalUrl, "offer", offerKey);
    }
  }

  return {
    finalUrl,
    mode,
    destinationLabel: destination.label,
    destinationPath: useAutoaffiRouting
      ? buildHostedProfilePath(mode, token)
      : safeCustomUrl,
    destinationDescription: useAutoaffiRouting
      ? destination.description
      : "Custom destination chosen by the customer.",
    publicCta: getPublicCta(mode),
    bioCta: getBioCta(mode),
    replyCta: getReplyCta(mode, finalUrl),
  };
}