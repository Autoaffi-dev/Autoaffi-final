"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PayoutsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Payouts
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-slate-600">
            Payout tracking is not active yet. Autoaffi does not show balances,
            paid commissions, or payout history until that system exists.
          </p>
        </header>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Not active</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Clicks are not conversions, and conversions are not payouts. There
            is nothing to pay out from this page.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
