import { Suspense } from "react";
import SocialAccountsClient from "./SocialAccountsClient";

export default function SocialAccountsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SocialAccountsClient />
    </Suspense>
  );
}