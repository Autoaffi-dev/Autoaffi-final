"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
children,
}: {
children: React.ReactNode;
}) {
const pathname = usePathname();
const isDashboardRoot = pathname === "/login/dashboard";

return (
<SessionProvider>
<div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
{/* Global navbar always visible */}
<Navbar />

<div className="flex flex-1">
{/* Sidebar only visible on dashboard routes */}
<Sidebar />

{/* Main dashboard content */}
<main className="flex-1 p-6 md:p-10 overflow-y-auto">
{children}

{/* Back to Dashboard button if user is inside subpage */}
{!isDashboardRoot && (
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
</SessionProvider>
);
}