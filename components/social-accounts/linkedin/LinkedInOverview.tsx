"use client";

export default function LinkedInOverview() {
  return (
    <div className="text-sm text-slate-300">
      <p className="text-[11px] text-slate-500 mb-2">
        Overview of your LinkedIn profile.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Connections" value="1,920" />
        <Stat label="Profile Views" value="384" />
        <Stat label="Search Appearances" value="112" />
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-yellow-300">{value}</p>
    </div>
  );
}