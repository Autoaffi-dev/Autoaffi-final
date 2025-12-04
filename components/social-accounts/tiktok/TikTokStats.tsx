export default function TikTokStats() {
  return (
    <section className="rounded-2xl border border-yellow-500/20 bg-slate-900/70 p-6 shadow-xl">
      <h2 className="text-yellow-300 text-sm font-semibold mb-4 uppercase tracking-wider">
        TikTok Overview
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold">12.4k</p>
          <p className="text-xs text-slate-400">Followers</p>
        </div>

        <div>
          <p className="text-2xl font-bold">1.3M</p>
          <p className="text-xs text-slate-400">Views last 30d</p>
        </div>

        <div>
          <p className="text-2xl font-bold">248k</p>
          <p className="text-xs text-slate-400">Likes last 30d</p>
        </div>

        <div>
          <p className="text-2xl font-bold">312</p>
          <p className="text-xs text-slate-400">Comments</p>
        </div>
      </div>
    </section>
  );
}