import { CjConfigError } from "./config";

export class CjGraphqlError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "CjGraphqlError";
    this.code = code;
  }
}

type CjGraphqlArgs = {
  endpoint: string;
  pat: string;
  query: string;
  variables?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
};

export async function cjGraphql<T>(args: CjGraphqlArgs): Promise<T> {
  const pat = String(args.pat || "").trim();
  if (!pat) {
    throw new CjConfigError("CJ_PAT_MISSING");
  }

  const fetchImpl = args.fetchImpl || fetch;
  const response = await fetchImpl(args.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: args.query,
      variables: args.variables ?? {},
    }),
  });

  const text = await response.text().catch(() => "");
  const json = parseJson(text);

  if (!response.ok) {
    throw new CjGraphqlError(
      response.status === 401 || response.status === 403
        ? "CJ_UPSTREAM_UNAUTHORIZED"
        : "CJ_UPSTREAM_FAILED"
    );
  }

  if (!json || typeof json !== "object") {
    throw new CjGraphqlError("CJ_RESPONSE_MALFORMED");
  }

  const errors = (json as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    throw new CjGraphqlError("CJ_GRAPHQL_ERROR");
  }

  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    throw new CjGraphqlError("CJ_RESPONSE_MALFORMED");
  }

  return data as T;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
