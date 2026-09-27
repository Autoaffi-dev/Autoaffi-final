/**
 * Server-only CJ publisher configuration.
 * CJ_PAT and CJ_COMPANY_ID are read here and must never be sent to the browser.
 */

export const CJ_PROMOTIONAL_PROPERTIES_ENDPOINT =
  "https://accounts.api.cj.com/graphql";

export const CJ_PROGRAM_TERMS_ENDPOINT = "https://programs.api.cj.com/query";

export type CjServerConfig = {
  pat: string;
  publisherId: string;
};

export function readCjServerConfig(
  env: NodeJS.ProcessEnv = process.env
): CjServerConfig {
  const pat = String(env.CJ_PAT || "").trim();
  const publisherId = String(env.CJ_COMPANY_ID || "").trim();

  if (!pat) {
    throw new CjConfigError("CJ_PAT_MISSING");
  }

  if (!publisherId) {
    throw new CjConfigError("CJ_PUBLISHER_ID_MISSING");
  }

  return { pat, publisherId };
}

export class CjConfigError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "CjConfigError";
    this.code = code;
  }
}
