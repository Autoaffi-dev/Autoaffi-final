export default function TopIGPosts() {
  const posts = [
    { title: "Carousel – Passive income tips", likes: 2100 },
    { title: "Reel – AI side hustle", likes: 4500 },
    { title: "Photo – Motivation quote", likes: 1800 },
  ];

  return (
    <div className="rounded-xl border border-pink-500/40 bg-pink-900/10 p-4">
      <h3 className="text-pink-300 font-semibold mb-3 text-sm">
        Top Posts (last 30 days)
      </h3>

      <ul className="text-xs text-slate-300 space-y-2">
        {posts.map((p, i) => (
          <li key={i} className="flex justify-between">
            <span>{p.title}</span>
            <span className="text-pink-300">{p.likes} ❤</span>
          </li>
        ))}
      </ul>
    </div>
  );
}