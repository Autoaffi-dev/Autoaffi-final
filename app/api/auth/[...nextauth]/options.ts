import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TokenWithAA = {
  sub?: string;
  aa_uid?: string; // ✅ vår interna uuid
};

async function getOrCreateAutoaffiUserId(params: {
  provider: string;
  providerAccountId: string;
  email?: string | null;
}) {
  const provider = params.provider;
  const provider_account_id = params.providerAccountId;
  const email = params.email ?? null;

  // 1) försök hämta befintlig
  const existing = await supabaseAdmin
    .from("user_identities")
    .select("id")
    .eq("provider", provider)
    .eq("provider_account_id", provider_account_id)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id as string;

  // 2) skapa ny (upsert om race)
  const inserted = await supabaseAdmin
    .from("user_identities")
    .upsert(
      {
        provider,
        provider_account_id,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_account_id" }
    )
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error("identity_upsert_failed: " + (inserted.error?.message || "unknown"));
  }

  return inserted.data.id as string;
}

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
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl) return url;
      } catch {}
      return `${baseUrl}/login/dashboard`;
    },

    // ✅ viktigast: skapa intern uuid och spara i token
    async jwt({ token, account, profile }) {
      const t = token as TokenWithAA;

      // kör bara när vi faktiskt loggar in / refreshar account
      if (account?.provider === "google") {
        const providerAccountId =
          // NextAuth brukar sätta detta
          (account as any).providerAccountId ||
          // fallback: token.sub brukar vara google-sub när ingen adapter finns
          t.sub ||
          "";

        if (providerAccountId) {
          const email =
            (profile as any)?.email ||
            (token as any)?.email ||
            null;

          const aaUid = await getOrCreateAutoaffiUserId({
            provider: "google",
            providerAccountId,
            email,
          });

          t.aa_uid = aaUid;
        }
      }

      return token;
    },

    // ✅ session.user.id = vår interna uuid
    async session({ session, token }) {
      const t = token as TokenWithAA;
      if (session?.user) {
        (session.user as any).id = t.aa_uid || "";
      }
      return session;
    },
  },
};