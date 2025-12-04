"use client";

import { motion } from "framer-motion";

export default function WhyChoose() {
const transition = { duration: 0.8, ease: ["easeInOut" as const] };

const features = [
{
title: "Affiliate Sync Engine",
desc: "Seamlessly connected with ClickBank, CPAlead, MyLead, and PartnerStack — your offers stay updated and relevant.",
},
{
title: "Recurring Income Focus",
desc: "Autoaffi prioritizes programs that pay recurring commissions, ensuring consistent passive income growth.",
},
{
title: "Smart Offer Matching",
desc: "Our AI recommends affiliate offers that match your content style, niche, and audience engagement.",
},
{
title: "High-Ticket Opportunity (Elite)",
desc: "Unlock exclusive high-value campaigns with products priced at $500+ for maximum profit potential.",
},
{
title: "AI Content Review & Optimization",
desc: "Analyzes your latest 6 months of posts to suggest improved hooks, captions, and links based on top-performing content.",
},
{
title: "Cross-Platform Scheduling",
desc: "Post across Instagram, TikTok, YouTube, and Facebook — all synced through your Autoaffi dashboard.",
},
{
title: "Automatic Link Creation",
desc: "Creates optimized affiliate links matching your niche and trending categories, updated automatically.",
},
];

return (
<section
id="why-choose"
className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
>
<motion.h2
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
transition={transition}
className="text-4xl md:text-5xl font-extrabold text-center mb-6"
>
Why Choose{" "}
<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
Autoaffi
</span>
</motion.h2>

<p className="text-center text-slate-300 max-w-2xl mx-auto mb-16">
Built for affiliates who want automation, smarter content, and a real chance at sustainable income.
</p>

<div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto">
{features.map((f, i) => (
<motion.div
key={i}
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ delay: i * 0.1, duration: 0.8, ease: ["easeInOut"] }}
className="flex items-start space-x-4"
>
<div className="text-yellow-500 text-2xl mt-1">⚡</div>
<div>
<h3 className="text-xl font-bold mb-1 text-white">{f.title}</h3>
<p className="text-slate-300">{f.desc}</p>
</div>
</motion.div>
))}
</div>
</section>
);
}