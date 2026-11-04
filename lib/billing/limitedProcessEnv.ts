export const PROCESS_ENV_ALLOWLIST: readonly string[] = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LD_LIBRARY_PATH",
];

export function limitedProcessEnv(source: { readonly [key: string]: string | undefined }): NodeJS.ProcessEnv {
  const env: { [key: string]: string } = {};
  for (const key of PROCESS_ENV_ALLOWLIST) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  return env as NodeJS.ProcessEnv;
}
