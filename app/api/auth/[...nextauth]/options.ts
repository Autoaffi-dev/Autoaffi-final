import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      // Behåll din gamla intention: alltid till dashboard efter login
      // + skydda mot open-redirect
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl) return url;
      } catch {}
      return `${baseUrl}/login/dashboard`;
    },

    async session({ session, token }) {
      // Lägg in userId på session.user.id (utan att kräva type-augmentation)
      if (session?.user) {
        (session.user as any).id = token?.sub || "";
      }
      return session;
    },
  },
};