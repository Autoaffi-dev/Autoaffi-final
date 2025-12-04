"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { generateAffiliateLinkAndContent } from "../LinkGenerator";

export default function GeneratedContentPreview({
content,
productTitle,
platform,
userId,
productUrl,
insertIntoPost,
}: {
content: {
hook: string;
caption: string;
body: string;
};
productTitle: string;
platform: string;
userId: string;
productUrl: string;
insertIntoPost: boolean;
}) {
const [currentContent, setCurrentContent] = useState(content);
const [loading, setLoading] = useState(false);

const handleCopy = () => {
const text = `${currentContent.hook}\n\n${currentContent.caption}\n\n${currentContent.body}`;
navigator.clipboard.writeText(text);
};

const handleRegenerate = async () => {
setLoading(true);
try {
const result = await generateAffiliateLinkAndContent({
userId,
platform,
productUrl,
productTitle,
insertIntoPost,
});
if (result?.content) {
setCurrentContent(result.content);
}
} catch (err) {
console.error("Regenerate failed:", err);
} finally {
setLoading(false);
}
};

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg space-y-5"
>
<div className="flex flex-wrap items-center justify-between gap-3">
<h3 className="text-lg font-semibold text-yellow-400">
AI-Generated Content
</h3>
<div className="flex gap-2">
<Button
onClick={handleCopy}
className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-full px-4 py-2 transition-all"
>
Copy all
</Button>
<Button
onClick={handleRegenerate}
disabled={loading}
className="bg-slate-800 hover:bg-slate-700 text-yellow-400 text-sm font-semibold rounded-full px-4 py-2 border border-slate-700 transition-all"
>
{loading ? "Regenerating..." : "Regenerate"}
</Button>
</div>
</div>

<div className="space-y-4 text-slate-200 text-sm">
<div>
<p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
Hook
</p>
<p className="font-semibold">{currentContent.hook}</p>
</div>

<div>
<p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
Caption
</p>
<p className="whitespace-pre-line">{currentContent.caption}</p>
</div>

<div>
<p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
Post Body
</p>
<p className="text-slate-300">{currentContent.body}</p>
</div>
</div>

<p className="text-xs text-slate-500">
Autoaffi’s AI refines hooks and captions based on engagement and
platform data. Regenerate to test new variations.
</p>
</motion.div>
);
}