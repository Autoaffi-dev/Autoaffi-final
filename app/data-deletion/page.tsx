export const metadata = {
  title: "Data Deletion | Autoaffi",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 py-20 px-6 md:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl font-extrabold text-center mb-4">
          Data Deletion Instructions
        </h1>
        <p className="text-center text-sm text-gray-500 mb-10">
          This page explains how users can request deletion of data stored by
          Autoaffi, including for Meta (Facebook / Instagram) integrations.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            1. Remove Autoaffi from your Meta account
          </h2>
          <p className="leading-relaxed">
            If you logged in or connected Autoaffi using Facebook Login or
            another Meta product, you can revoke access by:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to your Facebook account settings.</li>
            <li>Open the section &quot;Apps and Websites&quot;.</li>
            <li>Find &quot;Autoaffi&quot; in the list of apps.</li>
            <li>Click &quot;Remove&quot; to revoke access.</li>
          </ol>
          <p className="text-sm text-gray-600">
            This prevents Autoaffi from accessing new data from your Meta
            account going forward.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            2. Request deletion of stored data
          </h2>
          <p className="leading-relaxed">
            To delete data that Autoaffi has already stored, please send an
            email with your request to:
          </p>
          <p className="font-semibold">
            <a
              href="mailto:support@autoaffi.com?subject=Data%20Deletion%20Request"
              className="text-yellow-600 underline-offset-2 hover:underline"
            >
              support@autoaffi.com
            </a>
          </p>
          <p className="leading-relaxed">
            Include the following information so we can locate your account:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your Autoaffi account email address.</li>
            <li>
              Any connected Meta accounts (e.g. link to your Facebook Page or
              Instagram profile).
            </li>
          </ul>
          <p className="text-sm text-gray-600">
            Once we receive your request, we will delete your Autoaffi account
            data (and connected social API data) within a reasonable time and
            in accordance with applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            3. Optional: Delete your Autoaffi account from inside the app
          </h2>
          <p className="leading-relaxed">
            In future versions of Autoaffi, you will be able to initiate data
            deletion directly from your account settings. Until that feature is
            live, please use the email method described above.
          </p>
        </section>
      </section>
    </main>
  );
}