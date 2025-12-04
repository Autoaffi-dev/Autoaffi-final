import { NextRequest, NextResponse } from "next/server";

/**
 * Enhetlig nätverks-router för alla affiliate-nätverk.
 * Stödjer GET (args via query) och POST (args i body { args: {...} }).
 * Parametrar:
 *  - [network]: t.ex. "digistore24", "clickbank", "awin", "autoaffi" (intern)
 *  - fn: funktions-/endpoint-namn. Ex:
 *      - digistore24: productList, transactionsList, affiliateStatsList, accountBalance
 *      - clickbank: account/info, products/list, orders/list, analytics/sales (REST-likn.)
 *      - autoaffi: valfritt, proxas vidare till ert interna API
 *  - övriga query-parametrar mappas till args (arg1/arg2 eller namngivna)
 */

type Signer = (init: RequestInit) => RequestInit;
type UrlBuilder = (fnName: string) => string;
type ArgEncoder = (args: Record<string, string>) => URLSearchParams | string;

type NetworkConfig = {
  // Bas-URL och hur vi bygger URL per nätverk
  urlForFn: UrlBuilder;
  // Hur vi signerar auth-headers
  sign: Signer;
  // Hur vi skickar args (querystring / body)
  encodeArgs: ArgEncoder;
  // GET eller POST (default GET)
  method?: "GET" | "POST";
};

// ---------- Hjälp: encoders ----------
const encodeQuery = (args: Record<string, string>) => {
  const sp = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => sp.append(k, v));
  return sp;
};
const encodeNone = (_args: Record<string, string>) => new URLSearchParams(); // no-op

// ---------- Nätverksregister ----------
const REGISTRY: Record<string, NetworkConfig> = {
  // Digistore24 – enligt docs: https://www.digistore24.com/api/call/{FUNCTION}
  // Header: X-DS-API-KEY
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
    encodeArgs: encodeQuery, // args som querystring
    method: "GET",
  },

  // ClickBank – REST 1.3 (OBS: faktiska endpoints varierar per konto/behörighet)
  // Header: Authorization: api-XXXXXXXX (din full/developer key)
  clickbank: {
    urlForFn: (fn) => `https://api.clickbank.com/rest/1.3/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.CLICKBANK_API_KEY;
      if (!key) throw new Error("Missing CLICKBANK_API_KEY");
      return {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: key, // t.ex. "api-ABCD123..."
          Accept: "application/json",
        },
      };
    },
    encodeArgs: encodeQuery, // vi skickar args i query när vi kör GET
    method: "GET",
  },

  // PartnerStack – exempel (kräver Bearer token)
  partnerstack: {
    urlForFn: (fn) => `https://api.partnerstack.com/v1/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.PARTNERSTACK_API_KEY;
      if (!key) throw new Error("Missing PARTNERSTACK_API_KEY");
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

  // Impact – exempel (Basic auth eller Bearer beroende på setup)
  impact: {
    urlForFn: (fn) =>
      `https://api.impact.com/${fn.replace(/^\//, "")}`, // justera till rätt base per konto
    sign: (init) => {
      const key = process.env.IMPACT_API_KEY;
      if (!key) throw new Error("Missing IMPACT_API_KEY");
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

  // Awin – exempel
  awin: {
    urlForFn: (fn) => `https://api.awin.com/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.AWIN_API_KEY;
      if (!key) throw new Error("Missing AWIN_API_KEY");
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

  // CJ (Commission Junction) – exempel
  cj: {
    urlForFn: (fn) => `https://commission-detail.api.cj.com/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.CJ_API_KEY;
      if (!key) throw new Error("Missing CJ_API_KEY");
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

  // ShareASale – exempel (många endpoints kräver signature params)
  shareasale: {
    urlForFn: (fn) => `https://api.shareasale.com/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.SHAREASALE_API_KEY;
      if (!key) throw new Error("Missing SHAREASALE_API_KEY");
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

  // Tradedoubler – exempel
  tradedoubler: {
    urlForFn: (fn) => `https://api.tradedoubler.com/1.0/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.TRADEDOUBLER_API_KEY;
      if (!key) throw new Error("Missing TRADEDOUBLER_API_KEY");
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

  // Rakuten – exempel
  rakuten: {
    urlForFn: (fn) => `https://api.rakutenmarketing.com/${fn.replace(/^\//, "")}`,
    sign: (init) => {
      const key = process.env.RAKUTEN_API_KEY;
      if (!key) throw new Error("Missing RAKUTEN_API_KEY");
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

  // Eget internt API som ni äger (kan ligga i Vercel Function eller separat tjänst)
  autoaffi: {
    urlForFn: (fn) => `${process.env.AUTOAFFI_API_BASE?.replace(/\/$/, "")}/${fn.replace(/^\//, "")}`,
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

// ---- Hjälpfunktion för att bygga slutlig URL + init ----
function buildRequest(
  network: string,
  fnName: string,
  method: "GET" | "POST",
  args: Record<string, string | number>
) {
  const cfg = REGISTRY[network];
  if (!cfg) throw new Error(`Unsupported network: ${network}`);

  // Bygg URL
  const baseUrl = cfg.urlForFn(fnName);
  let url = baseUrl;

  // En del nätverk (ex Digistore24) vill ha args i query. POST kan också förekomma.
  let init: RequestInit = { method: method || cfg.method || "GET" };

  // Encoda args
  const stringArgs: Record<string, string> = {};
  Object.entries(args || {}).forEach(([k, v]) => (stringArgs[k] = String(v)));

  if ((method || cfg.method || "GET") === "GET") {
    const qs = cfg.encodeArgs(stringArgs) as URLSearchParams;
    const hasQ = url.includes("?");
    url = hasQ ? `${url}&${qs.toString()}` : `${url}?${qs.toString()}`;
  } else {
    // POST: vi skickar JSON body
    init = {
      ...init,
      headers: {
        ...(init.headers || {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stringArgs),
    };
  }

  // Signera
  init = cfg.sign(init);

  return { url, init };
}

// ---- GET handler ----
export async function GET(req: NextRequest, context: { params: { network: string } }) {
  try {
    const network = context.params.network;
    const { searchParams } = new URL(req.url);
    const fn = searchParams.get("fn") || "";
    if (!fn) {
      return NextResponse.json(
        { success: false, error: "Missing 'fn' (function) query parameter." },
        { status: 400 }
      );
    }

    // Plocka args från query (allt utom fn)
    const args: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (key !== "fn") args[key] = val;
    });

    const method = (REGISTRY[network]?.method || "GET") as "GET" | "POST";
    const { url, init } = buildRequest(network, fn, method, args);

    const r = await fetch(url, init);
    const text = await r.text();
    // försök JSON först, annars returnera text
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // inte JSON – returnera råtext så vi kan felsöka
      return NextResponse.json(
        {
          success: false,
          status: r.status,
          statusText: r.statusText,
          note: "Non-JSON response (often login page / permission issue)",
          body: text,
        },
        { status: r.ok ? 200 : r.status }
      );
    }

    return NextResponse.json(
      {
        success: r.ok,
        status: r.status,
        statusText: r.statusText,
        data: json,
      },
      { status: r.ok ? 200 : r.status }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ---- POST handler (args i body: { args: {...}, fn: "..." }) ----
export async function POST(req: NextRequest, context: { params: { network: string } }) {
  try {
    const network = context.params.network;
    const body = await req.json().catch(() => ({}));
    const fn = body.fn || "";
    const args = (body.args || {}) as Record<string, string | number>;

    if (!fn) {
      return NextResponse.json(
        { success: false, error: "Body must include 'fn'." },
        { status: 400 }
      );
    }

    const method: "GET" | "POST" = "POST";
    const { url, init } = buildRequest(network, fn, method, args);

    const r = await fetch(url, init);
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: r.status,
          statusText: r.statusText,
          note: "Non-JSON response (often login page / permission issue)",
          body: text,
        },
        { status: r.ok ? 200 : r.status }
      );
    }

    return NextResponse.json(
      {
        success: r.ok,
        status: r.status,
        statusText: r.statusText,
        data: json,
      },
      { status: r.ok ? 200 : r.status }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}