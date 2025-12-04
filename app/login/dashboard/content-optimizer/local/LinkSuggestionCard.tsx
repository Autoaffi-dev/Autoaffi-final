"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function LinkSuggestionCard({
link,
platform,
}: {
link: string;
platform: string;
}) {
const handleCopy = () => {
navigator.clipboard.writeText(link);
};

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4 }}
className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg"
>
<h3 className="text-lg font-semibold text-yellow-400 mb-3">
Generated {platform.charAt(0).toUpperCase() + platform.slice(1)} Link
</h3>

<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
<code className="break-all text-sm bg-slate-950/70 border border-slate-800 px-3 py-2 rounded-lg text-yellow-300 flex-1">
{link}
</code>
<Button
onClick={handleCopy}
className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-full px-4 py-2 transition-all"
>
Copy link
</Button>
</div>

<p className="text-xs text-slate-400 mt-3">
Your affiliate link is now ready. Share it in your posts or connect it
to a campaign.
</p>
</motion.div>
);
}