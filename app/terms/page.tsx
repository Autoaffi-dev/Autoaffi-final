export const metadata = {
  title: "Terms of Service | Autoaffi",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 px-6 md:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 md:p-10 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <h1 className="text-4xl font-extrabold text-center mb-3">
            Terms{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              of Service
            </span>
          </h1>

          <p className="text-center text-sm text-slate-500 mb-10">
            Last updated: 13 November 2025
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-yellow-400">1. About Autoaffi</h2>
            <p className="leading-relaxed text-slate-300">
              Autoaffi is a platform that helps creators and affiliates plan, organize and optimize
              content and affiliate marketing across multiple networks. We integrate with partners such
              as Meta (Facebook, Instagram), Google, TikTok and various affiliate networks (for example
              ClickBank, Digistore24, Amazon Associates and others), based on your explicit connections
              and choices.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">2. Accepting these terms</h2>
            <p className="leading-relaxed text-slate-300">By creating an account or using Autoaffi, you confirm that:</p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>You are at least 18 years old.</li>
              <li>You have the right to connect and manage any social media or affiliate accounts you authorize in Autoaffi.</li>
              <li>You will follow the terms and community standards of all connected platforms, including Meta, Google, TikTok and any affiliate networks you use.</li>
            </ul>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">
              3. Platform rules (Meta, Google, TikTok etc.)
            </h2>
            <p className="leading-relaxed text-slate-300">
              Autoaffi does not bypass or override any platform rules. When you use Autoaffi with Meta products
              (such as Facebook Pages or Instagram accounts), Google (e.g. YouTube), TikTok or other social media,
              you must follow their official policies on automation, content and data use.
            </p>

            <p className="leading-relaxed text-slate-300">You may not use Autoaffi to:</p>

            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>Scrape or collect data in a way that violates platform rules.</li>
              <li>Spam users with unwanted messages, comments or DMs (including through automated tools).</li>
              <li>Publish misleading, illegal or harmful content, or content that violates local law or platform community standards.</li>
            </ul>

            <p className="text-sm text-slate-500">
              Autoaffi is designed as a planning and optimization assistant. Any posting, commenting or messaging
              that is automated will only happen after clear opt-in from you and within the limits of each platform&apos;s policies.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">4. Your responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>You are responsible for all content you create, schedule or publish with Autoaffi.</li>
              <li>You are responsible for any affiliate disclosures required by law or by the affiliate networks you work with.</li>
              <li>You must keep your login details and API keys secret and secure.</li>
            </ul>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">5. No guarantee of earnings</h2>
            <p className="leading-relaxed text-slate-300">
              Autoaffi is a tool to help you work more efficiently. We do not guarantee any specific results, sales or income.
              Your performance depends on your content, your audience and the offers you promote.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">6. Data & privacy</h2>
            <p className="leading-relaxed text-slate-300">
              Our use of your data is described in more detail in our{" "}
              <a
                href="/privacy"
                className="text-yellow-400 font-semibold underline-offset-2 hover:underline hover:text-yellow-300"
              >
                Privacy Policy
              </a>
              . By using Autoaffi you also agree to that policy.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">7. Suspension & termination</h2>
            <p className="leading-relaxed text-slate-300">
              We may suspend or terminate access to Autoaffi if we detect abuse, spam, illegal activity, or breaches of these terms
              or the terms of our partners (for example Meta Platform Terms). Serious violations can lead to immediate termination without refund.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">8. Changes to these terms</h2>
            <p className="leading-relaxed text-slate-300">
              We may update these Terms of Service when we add new features or when platform policies change.
              Important changes will be notified via email, in-app messages or both. Continued use of Autoaffi after changes means you accept the new terms.
            </p>
          </section>

          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold text-yellow-400">9. Contact</h2>
            <p className="leading-relaxed text-slate-300">
              If you have questions about these terms, please contact{" "}
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