// app/api/social/accounts/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaObject = Record<string, unknown>;

type SocialAccountRow = {
  id: string;
  platform: string;
  provider: string;
  status: string;
  username: string | null;
  account_id: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
  meta: MetaObject | null;
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getMetaObject(
  value: unknown
): MetaObject {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as MetaObject;
  }

  return {};
}

function getNestedObject(
  value: unknown
): MetaObject {
  return getMetaObject(value);
}

function getString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed
    ? trimmed
    : null;
}

// -------------------------------------------------------
// Display identity
// -------------------------------------------------------

function resolveDisplayName(
  row: SocialAccountRow
): string | null {
  const meta =
    getMetaObject(
      row.meta
    );

  /*
   * TikTok:
   *
   * user.info.basic returns display_name.
   *
   * This is NOT necessarily TikTok's username/handle,
   * so we deliberately expose it as display_name rather
   * than writing it into the database username column.
   */
  if (
    row.platform === "tiktok"
  ) {
    const directDisplayName =
      getString(
        meta.display_name
      );

    if (
      directDisplayName
    ) {
      return directDisplayName;
    }

    const profile =
      getNestedObject(
        meta.tiktok_profile
      );

    const profileDisplayName =
      getString(
        profile.display_name
      );

    if (
      profileDisplayName
    ) {
      return profileDisplayName;
    }
  }

  /*
   * Generic provider metadata fallbacks.
   *
   * These preserve existing platform behavior and only
   * expose identity information already stored by
   * Autoaffi's provider-specific OAuth flows.
   */
  const directDisplayName =
    getString(
      meta.display_name
    );

  if (
    directDisplayName
  ) {
    return directDisplayName;
  }

  const username =
    getString(
      row.username
    );

  if (
    username
  ) {
    return username;
  }

  return null;
}

function resolveAvatarUrl(
  row: SocialAccountRow
): string | null {
  const meta =
    getMetaObject(
      row.meta
    );

  if (
    row.platform === "tiktok"
  ) {
    const directAvatar =
      getString(
        meta.avatar_url
      );

    if (
      directAvatar
    ) {
      return directAvatar;
    }

    const profile =
      getNestedObject(
        meta.tiktok_profile
      );

    const profileAvatar =
      getString(
        profile.avatar_url
      );

    if (
      profileAvatar
    ) {
      return profileAvatar;
    }
  }

  /*
   * Other providers currently use slightly different
   * metadata keys. These fallbacks do not change any
   * provider-specific storage behavior.
   */
  return (
    getString(
      meta.avatar_url
    ) ||
    getString(
      meta.profile_picture_url
    ) ||
    null
  );
}

function resolveLastSyncedAt(
  row: SocialAccountRow
): string | null {
  const meta =
    getMetaObject(
      row.meta
    );

  const lastSync =
    getNestedObject(
      meta.last_sync
    );

  return (
    getString(
      lastSync.at
    ) ||
    getString(
      row.updated_at
    ) ||
    null
  );
}

// -------------------------------------------------------
// GET
// -------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const session =
    await getServerSession(
      authOptions
    );

  const userIdRaw =
    (
      session as {
        user?: {
          id?: unknown;
        };
      } | null
    )?.user?.id;

  if (
    !userIdRaw
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const userId =
    String(
      userIdRaw
    );

  if (
    !isUuid(
      userId
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_user_id_not_uuid",
        received: userId,
      },
      {
        status: 401,
      }
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .select(
        [
          "id",
          "platform",
          "provider",
          "status",
          "username",
          "account_id",
          "token_expires_at",
          "updated_at",
          "meta",
        ].join(",")
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "platform",
        {
          ascending: true,
        }
      );

  if (
    error
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }

  const rows =
    (data ?? []) as unknown as SocialAccountRow[];

  const platforms =
    rows.map(
      (row) => {
        const displayName =
          resolveDisplayName(
            row
          );

        const avatarUrl =
          resolveAvatarUrl(
            row
          );

        const lastSyncedAt =
          resolveLastSyncedAt(
            row
          );

        return {
          ...row,

          /*
           * Normalized presentation fields.
           *
           * Frontend should prefer display_name for the
           * human-readable account label.
           */
          display_name:
            displayName,

          avatar_url:
            avatarUrl,

          last_synced_at:
            lastSyncedAt,
        };
      }
    );

  const connected =
    platforms.reduce(
      (
        acc: Record<
          string,
          boolean
        >,
        row
      ) => {
        acc[
          String(
            row.platform
          )
        ] =
          String(
            row.status
          ) ===
          "connected";

        return acc;
      },
      {}
    );

  return NextResponse.json(
    {
      ok: true,
      platforms,
      connected,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}