"use client";

export default function XSEOHighlights() {
  const points = [
    "Your tweets with questions get 23% more replies.",
    "Posts with images get +41% engagement.",
    "Threads = strongest discovery growth.",
  ];

  return (
    <ul className="list-disc pl-5 text-slate-300 text-sm">
      {points.map((p, i) => (
        <li key={i} className="mb-2">{p}</li>
      ))}
    </ul>
  );
}