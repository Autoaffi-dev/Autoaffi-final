"use client";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const copy = () => navigator.clipboard.writeText(text);

  return (
    <button
      onClick={copy}
      className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition"
    >
      {label}
    </button>
  );
}