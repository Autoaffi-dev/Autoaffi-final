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

/**
 * Finds the canonical Supabase Auth user by exact email.
 *
 * IMPORTANT:
 * We must not query auth.users through PostgREST with:
 *
 *   supabaseAdmin.schema("auth").from("users")
 *
 * The Auth schema is not exposed as a normal Data API schema.
 * Instead, this uses the server-only Supabase Auth Admin API.
 *
 * supabaseAdmin must use the service-role key and must never
 * be imported into a client component.
 */
async function findAuthUserIdByExactEmail(
  email?: string | null
): Promise<string | null> {
  if (!email) return null;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const perPage = 200;
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      throw new Error(
        `auth_user_lookup_failed: ${error.message}`
      );
    }

    const users = data?.users || [];

    const matchingUser = users.find((user) => {
      const userEmail = String(user.email || "")
        .trim()
        .toLowerCase();

      return userEmail === normalizedEmail;
    });

    if (matchingUser?.id) {
      return String(matchingUser.id);
    }

    /*
     * A page containing fewer users than perPage means
     * there are no additional pages to inspect.
     */
    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

async function getOrCreateAutoaffiUserId(params: {
  provider: string;
  providerAccountId: string;
  email?: string | null;
}): Promise<string> {
  const provider = params.provider;
  const providerAccountId =
    params.providerAccountId.trim();

  const email =
    params.email?.trim().toLowerCase() || null;

  if (!providerAccountId) {
    throw new Error(
      "identity_provider_account_id_missing"
    );
  }

  /*
   * Primary lookup:
   * An existing provider identity should already point
   * directly to the canonical Autoaffi/Supabase Auth user.
   */
  const existing = await supabaseAdmin
    .from("user_identities")
    .select(
      "id, user_id, provider, provider_account_id, email"
    )
    .eq("provider", provider)
    .eq("provider_account_id", providerAccountId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(
      `identity_lookup_failed: ${existing.error.message}`
    );
  }

  const existingRow =
    existing.data as IdentityRow | null;

  /*
   * Correct behavior:
   * session.user.id must be the canonical Supabase Auth
   * user id stored in user_identities.user_id.
   *
   * Never return user_identities.id.
   */
  if (existingRow?.user_id) {
    return String(existingRow.user_id);
  }

  /*
   * Safe automatic linking:
   * Only link when an Auth user exists with exactly the
   * same normalized email.
   *
   * Never link two different email addresses.
   */
  const authUserId =
    await findAuthUserIdByExactEmail(email);

  /*
   * The provider identity exists, but has not yet been
   * linked to its canonical Auth user.
   */
  if (existingRow && !existingRow.user_id) {
    if (!authUserId) {
      throw new Error(
        "identity_missing_user_link: This login identity exists but is not linked to an Autoaffi user_id. Link user_identities.user_id to the matching Supabase Auth user before dashboard access."
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
        `identity_link_update_failed: ${
          updated.error?.message || "unknown"
        }`
      );
    }

    return String(updated.data.user_id);
  }

  /*
   * New Google identity:
   * Save the identity and link it only when the same email
   * already exists as a real Supabase Auth user.
   */
  const inserted = await supabaseAdmin
    .from("user_identities")
    .upsert(
      {
        provider,
        provider_account_id: providerAccountId,
        email,
        user_id: authUserId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "provider,provider_account_id",
      }
    )
    .select("id, user_id")
    .single();

  if (inserted.error) {
    throw new Error(
      `identity_upsert_failed: ${
        inserted.error.message || "unknown"
      }`
    );
  }

  if (!inserted.data?.user_id) {
    throw new Error(
      "autoaffi_auth_user_missing: No matching Supabase Auth user was found for this Google email. The identity was saved, but it must be linked to a real Autoaffi user before dashboard access."
    );
  }

  return String(inserted.data.user_id);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      /*
       * Allow relative redirects inside Autoaffi.
       */
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      /*
       * Allow absolute redirects only when they point to
       * the same Autoaffi origin.
       */
      try {
        const parsedUrl = new URL(url);

        if (parsedUrl.origin === baseUrl) {
          return url;
        }
      } catch {
        // Invalid external redirect URL:
        // use the safe dashboard fallback below.
      }

      return `${baseUrl}/login/dashboard`;
    },

    async jwt({ token, account, profile }) {
      const autoaffiToken =
        token as TokenWithAA;

      /*
       * During the initial Google callback, account and
       * profile are available.
       *
       * During later session refreshes, account/profile
       * may be undefined, but aa_uid should already exist.
       */
      const provider =
        account?.provider || "google";

      const providerAccountId =
        String(
          (account as any)?.providerAccountId ||
            autoaffiToken.sub ||
            ""
        ).trim();

      const email =
        (profile as any)?.email ||
        autoaffiToken.email ||
        null;

      /*
       * Only perform the identity lookup when the token
       * does not already contain its canonical Autoaffi id.
       */
      if (
        !autoaffiToken.aa_uid &&
        provider === "google" &&
        providerAccountId
      ) {
        const autoaffiUserId =
          await getOrCreateAutoaffiUserId({
            provider: "google",
            providerAccountId,
            email,
          });

        autoaffiToken.aa_uid =
          autoaffiUserId;
      }

      return autoaffiToken;
    },

    async session({ session, token }) {
      const autoaffiToken =
        token as TokenWithAA;

      if (session?.user) {
        /*
         * This is the shared canonical user id used by:
         *
         * - user_social_accounts.user_id
         * - social_posts.user_id
         * - social_post_metrics.user_id
         * - social_lead_user_settings.user_id
         * - user_recurring_platforms.user_id
         * - lead_signals.user_id
         * - lead_signal_claims.claimed_by_user_id
         * - Contact Manager tables
         * - Growth Hub
         * - other user-owned dashboard data
         */
        (session.user as any).id =
          autoaffiToken.aa_uid || "";
      }

      return session;
    },
  },
};