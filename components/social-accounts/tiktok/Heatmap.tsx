export default function TikTokHeatmap() {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
      <h2 className="text-yellow-300 text-sm font-semibold mb-4 uppercase tracking-wider">
        Engagement Heatmap
      </h2>

      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-md bg-gradient-to-br from-slate-700 to-slate-800"
          ></div>
        ))}
      </div>
    </section>
  );
}