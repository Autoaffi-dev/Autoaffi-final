import React, { Suspense } from "react";
import LeadsPageClient from "./LeadsPageClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LeadsPageClient />
    </Suspense>
  );
}