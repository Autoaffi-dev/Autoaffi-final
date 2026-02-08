"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useCallback } from "react";

export default function Navbar() {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setMounted(true), []);

  const isHome = pathname === "/";
  const isDashboard = pathname.startsWith("/login/dashboard");

  // ✅ authed = bara om session verkligen finns
  const authed = useMemo(() => {
    return status === "authenticated" && !!session?.user;
  }, [status, session]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await signOut({ redirect: false });
      await fetch("/api/logout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore
    } finally {
      // hard refresh -> rensar UI direkt
      window.location.href = "/";
    }
  }, [loggingOut]);

  if (!mounted) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 h-[56px] bg-slate-950/80 border-b border-slate-800 backdrop-blur-md" />
    );
  }

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 px-6 py-3 flex items-center justify-between"
    >
      <Link
        href="/"
        className="text-lg md:text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500"
      >
        Autoaffi
      </Link>

      <div className="flex items-center gap-3">
        {/* ✅ DASHBOARD: authed -> logout */}
        {authed && isDashboard && (
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-yellow-400 text-yellow-400 px-4 py-1.5 text-sm font-semibold hover:bg-yellow-400 hover:text-slate-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        )}

        {/* ✅ HOME: visa ALDRIG "Back to Dashboard".
            Om authed är true men du är på / så visar vi ändå Login (detta fixar din bug). */}
        {isHome && (
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
          >
            Log in
          </Link>
        )}

        {/* ✅ Non-home & non-dashboard: om inte authed -> login */}
        {!isHome && !isDashboard && !authed && (
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
          >
            Log in
          </Link>
        )}
      </div>
    </motion.nav>
  );
}