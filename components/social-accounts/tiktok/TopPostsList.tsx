export default function TikTokTopPosts() {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
      <h2 className="text-yellow-300 text-sm font-semibold mb-4 uppercase tracking-wider mb-4">
        Top Posts
      </h2>

      <ul className="space-y-3 text-sm">
        <li className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <p className="font-semibold">How I automate $300/day with AI</p>
          <p className="text-xs text-slate-400">93k views</p>
        </li>

        <li className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <p className="font-semibold">This side hustle is wild…</p>
          <p className="text-xs text-slate-400">71k views</p>
        </li>

        <li className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <p className="font-semibold">Stop posting like this</p>
          <p className="text-xs text-slate-400">55k views</p>
        </li>
      </ul>
    </section>
  );
}