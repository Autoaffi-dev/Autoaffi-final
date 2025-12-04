"use client";
import Image from "next/image";

export default function SocialProof() {
  return (
    <section className="bg-white py-12" id="partners">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="text-lg font-semibold text-gray-600 uppercase tracking-wide mb-8">
          Trusted Integrations & Secure Payments
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-10">
          <Image
            src="/logos/mylead.png"
            alt="MyLead"
            width={120}
            height={50}
            className="h-12 w-auto object-contain opacity-80 grayscale hover:grayscale-0 transition"
          />
          <Image
            src="/logos/cpalead.png"
            alt="CPAlead"
            width={120}
            height={50}
            className="h-12 w-auto object-contain opacity-80 grayscale hover:grayscale-0 transition"
          />
          <Image
            src="/logos/mlgs.png"
            alt="MLGS"
            width={120}
            height={50}
            className="h-12 w-auto object-contain opacity-80 grayscale hover:grayscale-0 transition"
          />
          <Image
            src="/logos/stripe.png"
            alt="Stripe Secure Payments"
            width={110}
            height={40}
            className="h-12 w-auto object-contain opacity-80 grayscale hover:grayscale-0 transition"
          />
          <Image
            src="/logos/ssl.png"
            alt="SSL Encrypted"
            width={110}
            height={40}
            className="h-12 w-auto object-contain opacity-80 grayscale hover:grayscale-0 transition"
          />
        </div>
      </div>
    </section>
  );
}