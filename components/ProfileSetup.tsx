"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useState } from "react";

type ProfileForm = {
name: string;
niche: string;
mainPlatform: string;
goal: string;
};

type ProfileSetupProps = {
onComplete?: () => void;
};

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
const { data: session } = useSession();

const [form, setForm] = useState<ProfileForm>({
name: session?.user?.name || "",
niche: "",
mainPlatform: "",
goal: "",
});

const [saved, setSaved] = useState(false);

const handleChange = (
e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
const { name, value } = e.target;
setForm((prev) => ({ ...prev, [name]: value }));
setSaved(false);
};

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
// 🔜 Här kopplar vi senare mot backend /api/users/update-profile
console.log("Profile form submitted:", form);
setSaved(true);
if (onComplete) onComplete();
};

return (
<main className="min-h-[70vh] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 rounded-2xl border border-slate-800/80 p-5 md:p-7 shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
<motion.header
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="mb-6"
>
<p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-1">
Profile Setup
</p>
<h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
Tell Autoaffi who you are
</h1>
<p className="mt-2 text-sm text-slate-400 max-w-xl">
We use this to tailor Smart Suggestions, content ideas and recurring
offers to your niche and main platforms.
</p>
</motion.header>

<motion.form
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
onSubmit={handleSubmit}
className="grid gap-4 md:grid-cols-2"
>
{/* Name */}
<div className="md:col-span-1">
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
Namn
</label>
<input
type="text"
name="name"
value={form.name}
onChange={handleChange}
placeholder="Ditt namn eller creator-namn"
className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>

{/* Niche */}
<div className="md:col-span-1">
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
Nisch
</label>
<input
type="text"
name="niche"
value={form.niche}
onChange={handleChange}
placeholder="t.ex. Affiliate / AI tools / Side hustles"
className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>

{/* Main Platform */}
<div className="md:col-span-1">
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
Huvudplattform
</label>
<select
name="mainPlatform"
value={form.mainPlatform}
onChange={handleChange}
className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
>
<option value="">Välj plattform</option>
<option value="tiktok">TikTok</option>
<option value="instagram">Instagram</option>
<option value="youtube-shorts">YouTube Shorts</option>
<option value="facebook-reels">Facebook Reels</option>
<option value="other">Annat / Mix</option>
</select>
</div>

{/* Goal */}
<div className="md:col-span-1">
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1.5">
Största mål kommande 90 dagar
</label>
<textarea
name="goal"
value={form.goal}
onChange={handleChange}
rows={3}
placeholder="t.ex. Nå 10 000 följare, tjäna $500/mån i affiliate, få första recurring-intäkten..."
className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>

{/* Buttons */}
<div className="md:col-span-2 flex flex-col md:flex-row items-start md:items-center gap-3 mt-2">
<button
type="submit"
className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 font-semibold px-5 py-2 text-sm hover:brightness-110 transition-all duration-200"
>
Save profile
</button>

{saved && (
<span className="text-xs text-emerald-400">
✅ Din profil är sparad (placeholder). Backend-koppling läggs till senare.
</span>
)}
</div>
</motion.form>
</main>
);
}