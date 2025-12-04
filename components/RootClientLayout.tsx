"use client";

import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function RootClientLayout({ children }: { children: React.ReactNode }) {
return (
<SessionProvider>
<div className="flex min-h-screen flex-col">
{/* 🔹 Global Navbar */}
<Navbar />

{/* 🔹 Page content */}
<main className="flex-1 pt-16">{children}</main>

{/* 🔹 Footer */}
<Footer />
</div>
</SessionProvider>
);
}