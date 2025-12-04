"use client";

export default function LinkedInSEOHighlights() {
  const points = [
    "Posts with carousels get +48% reach.",
    "Using 3–5 industry hashtags gives best results.",
    "Posts with ‘keyword hooks’ boost search visibility.",
  ];

  return (
    <ul className="list-disc pl-5 text-slate-300 text-sm">
      {points.map((p, i) => (
        <li key={i} className="mb-2">{p}</li>
      ))}
    </ul>
  );
}