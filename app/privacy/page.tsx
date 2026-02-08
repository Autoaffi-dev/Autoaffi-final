export const metadata = {
  title: "Privacy Policy | Autoaffi",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 px-6 md:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 md:p-10 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <h1 className="text-4xl font-extrabold text-center mb-3">
            Privacy{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Policy
            </span>
          </h1>

          <p className="text-center text-sm text-slate-500 mb-10">
            Last updated: 13 November 2025
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-yellow-400">1. Who we are</h2>
            <p className="leading-relaxed text-slate-300">
              Autoaffi is a platform for affiliate marketing and content automation.
              We help users connect their social media accounts, affiliate programs
              and AI tools to plan and optimize campaigns.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">
              2. Data we process via connected platforms
            </h2>
            <p className="leading-relaxed text-slate-300">
              When you connect accounts from Meta (Facebook, Instagram), Google, TikTok
              or other social/affiliate networks, we only access data that you explicitly
              authorize through their login and permission flows. Depending on your
              choices, this may include:
            </p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>Basic profile information (name, profile picture, ID).</li>
              <li>Content metadata (captions, posts, engagement metrics, dates).</li>
              <li>Performance data from affiliate networks (clicks, sales, commissions).</li>
              <li>Links and IDs required to generate tracking links and attributions.</li>
            </ul>

            <p className="text-sm text-slate-500">
              We do not attempt to access data outside of what each platform allows via their official APIs.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">3. What we use your data for</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>To generate AI-based hooks, captions and content suggestions.</li>
              <li>To recommend affiliate products and offers that match your niche.</li>
              <li>To generate or manage tracking links on your behalf.</li>
              <li>To show dashboards and statistics so you can follow your progress.</li>
            </ul>

            <p className="text-sm text-slate-500">
              We do not sell your personal data or use it for our own ad targeting outside Autoaffi.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">4. Legal basis</h2>
            <p className="leading-relaxed text-slate-300">
              Our main legal basis is your consent when you connect accounts and authorize data access via each platform.
              In some cases, we may rely on legitimate interest to keep your account secure and to prevent abuse
              (for example logging suspicious login attempts).
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">
              5. Sharing with third-party services
            </h2>
            <p className="leading-relaxed text-slate-300">We share data only with:</p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>
                The platforms you connect (Meta, Google, TikTok, affiliate networks) as part of their normal API usage.
              </li>
              <li>
                Technical providers we need to run Autoaffi (e.g. hosting, logging, analytics), under data-processing agreements.
              </li>
            </ul>

            <p className="text-sm text-slate-500">
              We do not give third parties the right to use your data for their own purposes.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">6. Storage & retention</h2>
            <p className="leading-relaxed text-slate-300">
              We keep data only as long as needed to provide Autoaffi and to comply with legal obligations.
              If you disconnect a platform, we stop updating data from that source.
              You can also request deletion of your Autoaffi account and associated data at any time.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">7. Your rights</h2>
            <p className="leading-relaxed text-slate-300">
              Depending on where you live, you may have the right to:
            </p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>Access a copy of your data.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Limit or object to certain processing.</li>
            </ul>

            <p className="text-sm text-slate-500">
              To exercise these rights, please contact us or use the{" "}
              <a
                href="/data-deletion"
                className="text-yellow-400 font-semibold underline-offset-2 hover:underline hover:text-yellow-300"
              >
                data deletion / export options
              </a>{" "}
              we provide.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">8. Data deletion for Meta</h2>
            <p className="leading-relaxed text-slate-300">
              If you signed up or logged in using Meta (for example Facebook Login, Instagram),
              you can request deletion of your Autoaffi data linked to your Meta account by:
            </p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>Removing Autoaffi from your Apps and Websites settings in your Meta account.</li>
              <li>
                Or submitting a request via our dedicated{" "}
                <a
                  href="/data-deletion"
                  className="text-yellow-400 font-semibold underline-offset-2 hover:underline hover:text-yellow-300"
                >
                  Data Deletion page
                </a>
                .
              </li>
            </ul>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">9. Contact</h2>
            <p className="leading-relaxed text-slate-300">
              For privacy questions or data requests, contact:{" "}
              <a
                href="mailto:support@autoaffi.com"
                className="text-yellow-400 font-semibold underline-offset-2 hover:underline hover:text-yellow-300"
              >
                support@autoaffi.com
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}