"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
const [formData, setFormData] = useState({
name: "",
email: "",
message: "",
file: null as File | null,
});
const [submitted, setSubmitted] = useState(false);
const [loading, setLoading] = useState(false);

const handleChange = (
e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
) => {
const { name, value } = e.target;
setFormData((prev) => ({ ...prev, [name]: value }));
};

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0] || null;
setFormData((prev) => ({ ...prev, file }));
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);

try {
const res = await fetch("/api/contact", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
name: formData.name,
email: formData.email,
message: formData.message,
}),
});

if (res.ok) {
setSubmitted(true);
} else {
alert("Something went wrong while sending your message.");
}
} catch (err) {
console.error(err);
alert("Unable to connect to the contact server.");
} finally {
setLoading(false);
}
};

return (
<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
<div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
{/* Header */}
<motion.header
initial={{ opacity: 0, y: 24 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6 }}
className="mb-10 text-center"
>
<h1 className="text-3xl md:text-4xl font-extrabold mb-2 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
Contact Us & Support
</h1>
<p className="text-slate-400 max-w-xl mx-auto text-sm">
Have a question about your subscription, billing, or account?
Fill in the form below and we’ll get back to you within 24 hours.
</p>
</motion.header>

{/* Contact Form */}
<motion.section
initial={{ opacity: 0, y: 16 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.2 }}
transition={{ duration: 0.6 }}
className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 mb-10 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
>
{!submitted ? (
<form onSubmit={handleSubmit} className="space-y-4">
<div>
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
Name
</label>
<input
type="text"
name="name"
required
value={formData.name}
onChange={handleChange}
className="w-full rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>
<div>
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
Email Address
</label>
<input
type="email"
name="email"
required
value={formData.email}
onChange={handleChange}
className="w-full rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>
<div>
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
Message
</label>
<textarea
name="message"
required
rows={4}
value={formData.message}
onChange={handleChange}
className="w-full rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
/>
</div>

{/* File Upload */}
<div>
<label className="block text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
Attach file (optional)
</label>
<input
type="file"
accept="image/*,.pdf,.txt"
onChange={handleFileChange}
className="w-full text-sm text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-yellow-500 file:text-slate-900 file:font-semibold file:px-3 hover:file:bg-yellow-400 transition"
/>
{formData.file && (
<p className="mt-1 text-xs text-slate-400">
Selected file:{" "}
<span className="text-yellow-300">{formData.file.name}</span>
</p>
)}
</div>

<button
type="submit"
disabled={loading}
className="mt-2 w-full rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 font-semibold py-2 hover:brightness-110 transition-all duration-200"
>
{loading ? "Sending..." : "Send Message"}
</button>
</form>
) : (
<div className="text-center text-slate-300 py-10">
<p className="text-lg font-semibold text-amber-300 mb-2">
Thank you for your message!
</p>
<p>We’ll get back to you as soon as possible.</p>
</div>
)}
</motion.section>

{/* FAQ */}
<motion.section
initial={{ opacity: 0, y: 16 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.2 }}
transition={{ duration: 0.6 }}
className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
>
<h2 className="text-xl font-semibold mb-4 text-yellow-400">
Frequently Asked Questions
</h2>
<div className="space-y-4 text-sm text-slate-300">
<div>
<p className="font-semibold text-slate-100">
🕓 When will my commissions be paid?
</p>
<p className="text-slate-400">
Commissions are paid on the 25th of each month for the
previous period, provided your payment details are up to date in{" "}
<Link
href="/login/dashboard/payments-integrations"
className="text-yellow-400 hover:underline"
>
Payments & Integrations
</Link>.
</p>
</div>

<div>
<p className="font-semibold text-slate-100">
💳 How can I update my payment details?
</p>
<p className="text-slate-400">
You can update your details under{" "}
<Link
href="/login/dashboard/payments-integrations"
className="text-yellow-400 hover:underline"
>
Payments & Integrations
</Link>.
We recommend checking them at least once a month.
</p>
</div>

<div>
<p className="font-semibold text-slate-100">
❌ How do I cancel my subscription?
</p>
<p className="text-slate-400">
Your plan remains active until the end of the current billing
period. Once it expires, your account will automatically be
closed unless renewed.
</p>
</div>

<div>
<p className="font-semibold text-slate-100">
🧠 I have questions about my plan — who can I contact?
</p>
<p className="text-slate-400">
Reach out through the form above or email{" "}
<span className="text-yellow-400">support@autoaffi.com</span>.
Our team typically replies within 24 hours.
</p>
</div>
</div>
</motion.section>
</div>
</main>
);
}
