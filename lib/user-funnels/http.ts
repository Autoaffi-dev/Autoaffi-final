import { UNAUTHORIZED_ERROR } from "../auth/canonicalUserId";
import {
  deleteOwnFunnel,
  insertOwnFunnel,
  listOwnFunnels,
  normalizeExternalFunnelFields,
  type UserFunnelsDb,
} from "./repo";

export type UserFunnelsHttpDeps = {
  requireUserId: (req: Request) => Promise<string>;
  supabase: UserFunnelsDb;
};

function jsonNoStore(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
    },
  });
}

async function requireCanonicalUser(
  req: Request,
  requireUserId: UserFunnelsHttpDeps["requireUserId"]
): Promise<{ userId: string } | { response: Response }> {
  try {
    const userId = await requireUserId(req);
    return { userId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === UNAUTHORIZED_ERROR || msg === "UNAUTHORIZED") {
      return { response: jsonNoStore({ error: "UNAUTHORIZED" }, 401) };
    }
    throw err;
  }
}

function funnelIdFromRequest(req: Request): string {
  const url = new URL(req.url);
  return String(url.searchParams.get("id") || "").trim();
}

export async function handleUserFunnelsGet(
  req: Request,
  deps: UserFunnelsHttpDeps
) {
  const auth = await requireCanonicalUser(req, deps.requireUserId);
  if ("response" in auth) return auth.response;

  const { data, error } = await listOwnFunnels(deps.supabase, auth.userId);
  if (error) {
    return jsonNoStore({ error: "Failed to load funnels" }, 500);
  }
  return jsonNoStore({ funnels: data });
}

export async function handleUserFunnelsPost(
  req: Request,
  deps: UserFunnelsHttpDeps
) {
  const auth = await requireCanonicalUser(req, deps.requireUserId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  void body?.userId;
  void body?.user_id;

  const fields = normalizeExternalFunnelFields(body || {});
  if (!fields.name || !fields.funnel_url) {
    return jsonNoStore({ error: "Name and funnel URL are required" }, 400);
  }

  const inserted = await insertOwnFunnel(deps.supabase, auth.userId, fields);
  if (inserted.error) {
    return jsonNoStore({ error: "Failed to save funnel" }, 500);
  }

  const listed = await listOwnFunnels(deps.supabase, auth.userId);
  if (listed.error) {
    return jsonNoStore({ error: "Failed to load funnels" }, 500);
  }
  return jsonNoStore({ funnels: listed.data });
}

export async function handleUserFunnelsDelete(
  req: Request,
  deps: UserFunnelsHttpDeps
) {
  const auth = await requireCanonicalUser(req, deps.requireUserId);
  if ("response" in auth) return auth.response;

  const funnelId = funnelIdFromRequest(req);
  if (!funnelId) {
    return jsonNoStore({ error: "Missing funnel id" }, 400);
  }

  const deleted = await deleteOwnFunnel(deps.supabase, auth.userId, funnelId);
  if (deleted.error) {
    return jsonNoStore({ error: "Failed to delete funnel" }, 500);
  }
  if (deleted.data.length === 0) {
    return jsonNoStore({ error: "Not found" }, 404);
  }
  return jsonNoStore({ ok: true });
}
