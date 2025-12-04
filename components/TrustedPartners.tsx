"use client";
import Image from "next/image";

export default function TrustedPartners() {
  const logos = [
    { src: "/logos/mylead.png", alt: "MyLead" },
    { src: "/logos/cpalead.png", alt: "CPAlead" },
    { src: "/logos/mlgs.png", alt: "MLGS" },
    { src: "/logos/stripe.png", alt: "Stripe" },
    { src: "/logos/ssl.png", alt: "SSL Secure" },
  ];

  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold text-blue-900 mb-8">Trusted Partners</h2>
      <div className="flex flex-wrap justify-center gap-10 opacity-80">
        {logos.map((l, i) => (
          <div key={i} className="relative w-32 h-16 grayscale hover:grayscale-0 transition">
            <Image src={l.src} alt={l.alt} fill className="object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
}