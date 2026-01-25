"use client";

import { useEffect, useState } from "react";

type SessionApiResponse =
  | { ok: true; dev: boolean; user: { id: string; name?: string; email?: string } }
  | { ok: false; error: string };

export function useAutoaffiUser() {
  const [userId, setUserId] = useState("");
  const [dev, setDev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as SessionApiResponse;

        if (!alive) return;

        if (data.ok) {
          setUserId((data.user?.id || "").trim());
          setDev(!!data.dev);
        } else {
          setUserId("");
          setDev(false);
          setError(data.error || "UNAUTHORIZED");
        }
      } catch (e: any) {
        if (!alive) return;
        setUserId("");
        setDev(false);
        setError(e?.message || "SESSION_FETCH_FAILED");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { userId, dev, loading, error };
}