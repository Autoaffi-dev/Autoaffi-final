"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
LayoutDashboard,
Users,
Brain,
TrendingUp,
Share2,
Wallet,
Settings,
Zap,
Radar,
} from "lucide-react";

const links = [
{ name: "Dashboard", href: "/login/dashboard", icon: LayoutDashboard },
{ name: "Smart Suggestions", href: "/login/dashboard/smart-suggestions", icon: Brain },
{ name: "Lead Detection", href: "/login/dashboard/lead-detection", icon: Radar },
{ name: "Social Accounts", href: "/login/dashboard/social-accounts", icon: Share2 },
{ name: "Campaigns", href: "/login/dashboard/campaigns", icon: TrendingUp },
{ name: "Payments & Integrations", href: "/login/dashboard/payments-integrations", icon: Wallet },
{ name: "Payouts", href: "/login/dashboard/payouts", icon: Zap },
{ name: "Settings", href: "/login/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
const pathname = usePathname();

return (
<aside className="hidden md:flex md:flex-col bg-slate-950 border-r border-slate-800 w-64 min-h-screen text-slate-200 p-6">
<h2 className="text-lg font-bold mb-6 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
Autoaffi
</h2>

<nav className="flex-1 space-y-1">
{links.map((link) => {
const Icon = link.icon;
const active = pathname === link.href;

return (
<Link
key={link.name}
href={link.href}
className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
active
? "bg-yellow-500 text-slate-900"
: "text-slate-300 hover:bg-slate-800 hover:text-white"
}`}
>
<Icon className="w-4 h-4" />
{link.name}
</Link>
);
})}
</nav>

<footer className="mt-auto text-xs text-slate-600 pt-4 border-t border-slate-800">
© {new Date().getFullYear()} Autoaffi
</footer>
</aside>
);
}