import {
  isSubmagicProductionEnabled,
  submagicProductionConfig,
  submagicTestConfig,
  type FirstPromoterProgramConfig,
} from "./firstPromoterProgram";
import {
  acceptScopedPostback,
  syllabyTestSecretMatches,
  type AcceptSyllabyResult,
  type SyllabyInboundStore,
} from "./syllabyPostback";

export type PostbackHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

function httpResult(result: AcceptSyllabyResult): PostbackHttpResult {
  if (result.conflict) return { status: 409, body: { ok: false, error: "EVENT_CONFLICT" } };
  if (result.duplicate) return { status: 200, body: { ok: true, duplicate: true } };
  return {
    status: 200,
    body: { ok: true, duplicate: false, matchStatus: result.matchStatus },
  };
}

export async function acceptSubmagicTestPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
}): Promise<AcceptSyllabyResult> {
  return acceptScopedPostback({
    searchParams: args.searchParams,
    store: args.store,
    config: submagicTestConfig,
  });
}

export async function acceptSubmagicProductionPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
}): Promise<AcceptSyllabyResult> {
  if (!isSubmagicProductionEnabled()) throw new Error("PRODUCTION_NOT_CONFIGURED");
  return acceptScopedPostback({
    searchParams: args.searchParams,
    store: args.store,
    config: submagicProductionConfig,
  });
}

/**
 * Internal server entry. The caller must supply a trusted program configuration.
 * This is not a security boundary against arbitrary server code.
 * HTTP routes must not take the configuration from the request.
 */
export async function acceptFirstPromoterPostback(args: {
  searchParams: URLSearchParams;
  store: SyllabyInboundStore;
  config: FirstPromoterProgramConfig;
}): Promise<AcceptSyllabyResult> {
  return acceptScopedPostback(args);
}

export async function receiveSubmagicTestPostback(args: {
  secret: string;
  expectedSecret: string | null | undefined;
  searchParams: URLSearchParams;
  createStore: () => Promise<SyllabyInboundStore>;
}): Promise<PostbackHttpResult> {
  if (!syllabyTestSecretMatches(args.secret, args.expectedSecret)) {
    return { status: 404, body: { ok: false } };
  }
  try {
    const store = await args.createStore();
    const result = await acceptSubmagicTestPostback({
      searchParams: args.searchParams,
      store,
    });
    return httpResult(result);
  } catch {
    return { status: 500, body: { ok: false, error: "INGRESS_FAILED" } };
  }
}

export async function receiveSubmagicProductionPostback(args: {
  secret: string;
  expectedSecret: string | null | undefined;
  searchParams: URLSearchParams;
  createStore: () => Promise<SyllabyInboundStore>;
}): Promise<PostbackHttpResult> {
  if (!isSubmagicProductionEnabled()) {
    return { status: 404, body: { ok: false, error: "PRODUCTION_NOT_CONFIGURED" } };
  }
  if (!syllabyTestSecretMatches(args.secret, args.expectedSecret)) {
    return { status: 404, body: { ok: false } };
  }
  try {
    const store = await args.createStore();
    const result = await acceptSubmagicProductionPostback({
      searchParams: args.searchParams,
      store,
    });
    return httpResult(result);
  } catch {
    return { status: 500, body: { ok: false, error: "INGRESS_FAILED" } };
  }
}
