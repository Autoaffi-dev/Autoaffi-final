"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Navbar() {
const pathname = usePathname() || "";
const router = useRouter();
const { data: session, status } = useSession();
const [mounted, setMounted] = useState(false);

useEffect(() => {
// säkerställer att useSession inte triggar hydration-fel
setMounted(true);
}, []);

const isDashboard = pathname.startsWith("/login/dashboard");
const isHome = pathname === "/";

if (!mounted) return null; // väntar tills client är laddad

return (
<motion.nav
initial={{ y: -40, opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
transition={{ duration: 0.5 }}
className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 px-6 py-3 flex items-center justify-between"
>
{/* 🔹 Logo */}
<Link
href="/"
className="text-lg md:text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500"
>
Autoaffi
</Link>

{/* 🔹 Dynamic buttons */}
<div className="flex items-center gap-3">
{/* --- Not logged in (on home page) --- */}
{!session && isHome && (
<>
<Link
href="/login"
className="rounded-full border border-yellow-400 text-yellow-400 px-4 py-1.5 text-sm font-semibold hover:bg-yellow-400 hover:text-slate-900 transition"
>
Login
</Link>
<Link
href="/login"
className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
>
Get Started
</Link>
</>
)}

{/* --- Logged in (on home page) --- */}
{session && isHome && (
<button
onClick={() => router.push("/login/dashboard")}
className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
>
Back to Dashboard
</button>
)}

{/* --- Logged in (on dashboard pages) --- */}
{session && isDashboard && (
<button
onClick={() => signOut({ callbackUrl: "/" })}
className="rounded-full border border-yellow-400 text-yellow-400 px-4 py-1.5 text-sm font-semibold hover:bg-yellow-400 hover:text-slate-900 transition"
>
Log Out
</button>
)}

{/* --- Not logged in (on non-home pages) --- */}
{!session && !isHome && (
<Link
href="/login"
className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
>
Login
</Link>
)}
</div>
</motion.nav>
);
}