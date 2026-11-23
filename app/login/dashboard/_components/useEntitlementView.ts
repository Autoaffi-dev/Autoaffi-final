"use client";

import { useEffect, useState } from "react";
import { entitlementViewFromResponse, type EntitlementView } from "@/lib/billing/entitlementView";

export function useEntitlementView(): EntitlementView {
  const [view, setView] = useState<EntitlementView>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/api/billing/entitlement", { cache: "no-store" });
        const body: unknown = await response.json().catch(() => null);
        if (!mounted) return;
        setView(entitlementViewFromResponse(response.status, body));
      } catch {
        if (mounted) setView({ status: "error" });
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return view;
}
