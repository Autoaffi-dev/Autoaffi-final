import "./globals.css";
import { Inter } from "next/font/google";
import RootClientLayout from "@/components/RootClientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Autoaffi",
  description: "Affiliate automation and AI tools for creators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="impact-site-verification"
          content="d1d1278d-a7dc-4e19-afc6-192ae570c84a"
        />
      </head>

      <body className={`${inter.className} bg-slate-950 text-white`}>
        <RootClientLayout>{children}</RootClientLayout>
      </body>
    </html>
  );
}