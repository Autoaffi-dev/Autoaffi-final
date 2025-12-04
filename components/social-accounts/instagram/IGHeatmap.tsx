export default function IGHeatmap() {
  return (
    <div className="rounded-xl border border-pink-500/40 bg-pink-900/10 p-4">
      <h3 className="text-pink-300 font-semibold mb-2 text-sm">
        Posting Heatmap
      </h3>

      <p className="text-xs text-slate-400">
        (Mocked placeholder — real heatmap will load via API)
      </p>

      <div className="grid grid-cols-7 gap-1 mt-3">
        {Array.from({ length: 21 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full rounded bg-pink-600/20"
          />
        ))}
      </div>
    </div>
  );
}