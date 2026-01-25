import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next kan ibland ge params som Promise i nyare versioner
async function readTokenFromParams(params: any): Promise<string | null> {
  if (!params) return null;
  if (typeof params?.then === "function") {
    const resolved = await params;
    return (resolved?.token || null) as string | null;
  }
  return (params?.token || null) as string | null;
}

export default async function CheckoutMockPage(props: any) {
  const token = await readTokenFromParams(props?.params);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 p-7 md:p-10">
        <div className="text-xs uppercase tracking-wider text-white/60">Autoaffi</div>

        <h1 className="mt-2 text-3xl font-semibold">Stripe Checkout (Mock)</h1>
        <p className="mt-3 text-white/70">
          This is a preview page for testing the flow. Payments are not enabled yet.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Autoaffi Premium</div>
            <div className="text-sm text-white/60">€ / month</div>
          </div>

          <div className="mt-2 text-xs text-white/60">
            Includes: affiliate tracking + QR engine + contact manager lead flow.
          </div>

          <button
            disabled
            className="mt-5 w-full rounded-full bg-yellow-300 px-5 py-3 text-sm font-semibold text-black opacity-60"
            title="Mock only"
          >
            Continue (disabled in mock)
          </button>

          <div className="mt-3 text-[12px] text-white/45">
            Token: {token || "—"}
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href={token ? `/l/${encodeURIComponent(token)}` : "/"}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Back
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-yellow-300 px-6 py-3 text-sm font-semibold text-black hover:bg-yellow-200 transition"
          >
            Return to Autoaffi
          </Link>
        </div>
      </div>
    </div>
  );
}