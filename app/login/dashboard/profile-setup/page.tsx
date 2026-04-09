import ProfileConnectCard from "@/components/dashboard/cards/ProfileConnectCard";

export default function ProfileSetupPage() {
  return (
    <main className="min-h-screen bg-[#07070a] px-6 pb-16 pt-24 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
            Core Setup
          </div>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Profile Setup
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 md:text-[15px]">
            Autoaffi helps you optimize your social profiles to increase trust, clicks, leads and
            commissions. Complete the setup once, then reuse the same system across more platforms.
          </p>
        </div>

        <ProfileConnectCard />
      </div>
    </main>
  );
}