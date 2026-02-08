"use client";

import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDashboardRoot = pathname === "/login/dashboard";

  // ✅ Visa INTE layout-knappen om vi inte säkert är inloggade
  const showBackToDashboard =
    mounted && status === "authenticated" && !isDashboardRoot;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {children}

          {showBackToDashboard && (
            <div className="mt-10 text-center">
              <a
                href="/login/dashboard"
                className="inline-block rounded-full bg-yellow-400 text-slate-900 font-semibold px-4 py-2 text-sm hover:brightness-110 transition"
              >
                ← Back to Dashboard
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}