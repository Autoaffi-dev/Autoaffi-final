import "./globals.css";
import { Inter } from "next/font/google";
import RootClientLayout from "@/components/RootClientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
title: "Autoaffi",
description: "Affiliate automation and AI tools for creators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className={`${inter.className} bg-slate-950 text-white`}>
<RootClientLayout>{children}</RootClientLayout>
</body>
</html>
);
}