import { NextRequest, NextResponse } from "next/server";

/**
 * Unified affiliate network router
 * Next.js 16 compatible (params = Promise)
 */

type Signer = (init: RequestInit) => RequestInit;
type UrlBuilder = (fnName: string) => string;
type ArgEncoder = (args: Record<string, string>) => URLSearchParams;

type NetworkConfig = {
  urlForFn: UrlBuilder;
  sign: Signer;
  encodeArgs: ArgEncoder;
  method?: "GET" | "POST";
};

// ---------- Helpers ----------
const encodeQuery = (args: Record<string, string>) => {
  const sp = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => sp.append(k, v));
  return sp;
};

// ---------- Registry ----------
const REGISTRY: Record<string, NetworkConfig> = {
  digistore24: {
    urlForFn: (fn) => `https://www.digistore24.com/api/call/${fn}`,
    sign: (init) => {
      const key = process.env.DIGISTORE24_API_KEY;
      if (!key) throw new Error("Missing DIGISTORE24_API_KEY");
      return {
        ...init,
        headers: {
          ...(init.headers || {}),
          "X-DS-API-KEY": key,
          Accept: "application/json",
        },
      };
    },
    encodeArgs: encodeQuery,
    method: "GET",
  },

  autoaffi: {
    urlForFn: (fn) =>
      `${process.env.AUTOAFFI_API_BASE?.replace(/\/$/, "")}/${fn.replace(
        /^\//,
        ""
      )}`,
    sign: (init) => {
      const key = process.env.AUTOAFFI_API_KEY;
      if (!key) throw new Error("Missing AUTOAFFI_API_KEY");
      return {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      };
    },
    encodeArgs: encodeQuery,
    method: "GET",
  },
};

// ---------- Request builder ----------
function buildRequest(
  network: string,
  fnName: string,
  args: Record<string, string>
) {
  const cfg = REGISTRY[network];
  if (!cfg) throw new Error(`Unsupported network: ${network}`);

  let url = cfg.urlForFn(fnName);
  const qs = cfg.encodeArgs(args);
  url += `?${qs.toString()}`;

  let init: RequestInit = { method: cfg.method || "GET" };
  init = cfg.sign(init);

  return { url, init };
}

// ---------- GET ----------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ network: string }> }
) {
  try {
    const { network } = await context.params;
    const { searchParams } = new URL(req.url);

    const fn = searchParams.get("fn");
    if (!fn) {
      return NextResponse.json(
        { success: false, error: "Missing fn parameter" },
        { status: 400 }
      );
    }

    const args: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      if (k !== "fn") args[k] = v;
    });

    const { url, init } = buildRequest(network, fn, args);
    const res = await fetch(url, init);
    const text = await res.text();

    try {
      const json = JSON.parse(text);
      return NextResponse.json(
        { success: res.ok, data: json },
        { status: res.status }
      );
    } catch {
      return NextResponse.json(
        { success: false, raw: text },
        { status: res.status }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}