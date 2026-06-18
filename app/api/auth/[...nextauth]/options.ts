import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TokenWithAA = {
  sub?: string;
  email?: string | null;
  aa_uid?: string;
};

type IdentityRow = {
  id: string;
  user_id: string | null;
  provider: string;
  provider_account_id: string;
  email: string | null;
};

async function findAuthUserIdByExactEmail(email?: string | null) {
  if (!email) return null;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await (supabaseAdmin as any)
    .schema("auth")
    .from("users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`auth_user_lookup_failed: ${error.message}`);
  }

  return data?.id ? String(data.id) : null;
}

async function getOrCreateAutoaffiUserId(params: {
  provider: string;
  providerAccountId: string;
  email?: string | null;
}) {
  const provider = params.provider;
  const provider_account_id = params.providerAccountId;
  const email = params.email?.trim().toLowerCase() ?? null;

  const existing = await supabaseAdmin
    .from("user_identities")
    .select("id, user_id, provider, provider_account_id, email")
    .eq("provider", provider)
    .eq("provider_account_id", provider_account_id)
    .maybeSingle();

  if (existing.error) {
    throw new Error("identity_lookup_failed: " + existing.error.message);
  }

  const existingRow = existing.data as IdentityRow | null;

  // ✅ Correct behavior:
  // session.user.id must be the canonical Autoaffi/Supabase auth user id.
  // It must NOT be user_identities.id.
  if (existingRow?.user_id) {
    return existingRow.user_id;
  }

  // ✅ Safe auto-link rule:
  // Only link automatically if auth.users has the EXACT same email.
  // Never link different emails automatically.
  const authUserId = await findAuthUserIdByExactEmail(email);

  if (existingRow && !existingRow.user_id) {
    if (!authUserId) {
      throw new Error(
        "identity_missing_user_link: This login identity exists but is not linked to an Autoaffi user_id. Link it in user_identities.user_id before using the dashboard."
      );
    }

    const updated = await supabaseAdmin
      .from("user_identities")
      .update({
        user_id: authUserId,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRow.id)
      .select("id, user_id")
      .single();

    if (updated.error || !updated.data?.user_id) {
      throw new Error(
        "identity_link_update_failed: " + (updated.error?.message || "unknown")
      );
    }

    return updated.data.user_id as string;
  }

  // New identity:
  // Create the identity row. Link only when the same email already exists in auth.users.
  // If no auth user exists, we stop instead of inventing a new customer identity.
  const inserted = await supabaseAdmin
    .from("user_identities")
    .upsert(
      {
        provider,
        provider_account_id,
        email,
        user_id: authUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_account_id" }
    )
    .select("id, user_id")
    .single();

  if (inserted.error) {
    throw new Error(
      "identity_upsert_failed: " + (inserted.error?.message || "unknown")
    );
  }

  if (!inserted.data?.user_id) {
    throw new Error(
      "autoaffi_auth_user_missing: No matching auth.users row found for this login email. The identity was saved, but it must be linked to a real Autoaffi user before dashboard access."
    );
  }

  return inserted.data.user_id as string;
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

    async jwt({ token, account, profile }) {
      const t = token as TokenWithAA;

      const provider = account?.provider || "google";

      const providerAccountId =
        (account as any)?.providerAccountId ||
        t.sub ||
        "";

      const email =
        (profile as any)?.email ||
        t.email ||
        null;

      // Important:
      // Do not return user_identities.id.
      // aa_uid must be the canonical Autoaffi/Supabase auth user id from user_identities.user_id.
      if (!t.aa_uid && provider === "google" && providerAccountId) {
        const aaUid = await getOrCreateAutoaffiUserId({
          provider: "google",
          providerAccountId,
          email,
        });

        t.aa_uid = aaUid;
      }

      return t;
    },

    async session({ session, token }) {
      const t = token as TokenWithAA;

      if (session?.user) {
        // ✅ This must match:
        // social_lead_user_settings.user_id
        // user_recurring_platforms.user_id
        // lead_signals.user_id
        // lead_signal_claims.claimed_by_user_id
        (session.user as any).id = t.aa_uid || "";
      }

      return session;
    },
  },
};