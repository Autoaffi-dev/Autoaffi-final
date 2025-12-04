export default function InstagramStats() {
  return (
    <div className="rounded-xl border border-pink-500/40 bg-pink-900/10 p-4">
      <h3 className="text-pink-300 font-semibold mb-2 text-sm">
        Instagram Overview
      </h3>

      <ul className="text-xs text-slate-300 space-y-1">
        <li>• Followers: 12 400</li>
        <li>• Avg. likes: 840</li>
        <li>• Avg. comments: 42</li>
        <li>• Reach (30 days): 128k</li>
      </ul>
    </div>
  );
}