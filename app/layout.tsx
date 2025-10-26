import "./globals.css";

export const metadata = {
  title: "AutoAffi",
  description: "AI-powered affiliate automation for creators"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}