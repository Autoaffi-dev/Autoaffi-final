"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import AccountManageModal from "@/components/social-accounts/modals/AccountManageModal";

// -------------------------------------------------------
// PLATFORM TYPES
// -------------------------------------------------------

type PlatformKey =
  | "tiktok"
  | "instagram"
  | "facebook"
  | "youtube"
  | "threads"
  | "linkedin";

type Plan =
  | "Basic"
  | "Pro"
  | "Elite";

type Account = {
  id: string;
  username: string;
  primary: boolean;
};

type PlatformState = {
  accounts: Account[];
  lastSynced?: string;
};

type PlatformRow = {
  platform:
    | PlatformKey
    | string;

  status:
    | "connected"
    | "disconnected"
    | "reconnect_required"
    | string;

  username?:
    | string
    | null;

  /*
   * Human-readable profile name returned by
   * /api/social/accounts.
   *
   * TikTok user.info.basic gives us display_name,
   * which is intentionally kept separate from username.
   */
  display_name?:
    | string
    | null;

  avatar_url?:
    | string
    | null;

  account_id?:
    | string
    | null;

  token_expires_at?:
    | string
    | null;

  updated_at?:
    | string
    | null;

  last_synced_at?:
    | string
    | null;
};

type BannerState = {
  type:
    | "success"
    | "error";

  title: string;
  message: string;
};

// -------------------------------------------------------
// PLATFORM CONFIG
// -------------------------------------------------------

const PLATFORM_LABELS: Record<
  PlatformKey,
  string
> = {
  tiktok:
    "TikTok",

  instagram:
    "Instagram",

  facebook:
    "Facebook",

  youtube:
    "YouTube",

  threads:
    "Threads",

  linkedin:
    "LinkedIn",
};

const PLATFORM_PLAN: Record<
  PlatformKey,
  Plan
> = {
  tiktok:
    "Basic",

  instagram:
    "Basic",

  facebook:
    "Basic",

  youtube:
    "Basic",

  threads:
    "Pro",

  linkedin:
    "Elite",
};

const PLATFORM_DESCRIPTION: Record<
  PlatformKey,
  string
> = {
  tiktok:
    "Connect TikTok to help Autoaffi understand which short-form content performs best with your audience.",

  instagram:
    "You don’t need a Facebook Page to connect Instagram. Your Instagram account just needs to be a Professional account — Creator or Business.",

  facebook:
    "You don’t need an Instagram account to connect Facebook. You just need a published Facebook Page you manage.",

  youtube:
    "Connect YouTube to bring real channel, video and audience performance into your Autoaffi recommendations.",

  threads:
    "Connect Threads to help Autoaffi understand which conversations, topics and posts are gaining traction with your audience.",

  linkedin:
    "Connect LinkedIn to bring your professional profile into Autoaffi. Deeper content analytics will only appear when LinkedIn gives Autoaffi access to those signals.",
};

/*
 * TEMPORARY:
 *
 * This is intentionally left as the existing plan source
 * until Autoaffi's real subscription/plan state is wired
 * into this page.
 *
 * Do not treat this as the final launch plan implementation.
 */
const ACTIVE_PLAN: Plan =
  "Elite";

const INITIAL_STATE: Record<
  PlatformKey,
  PlatformState
> = {
  tiktok: {
    accounts: [],
  },

  instagram: {
    accounts: [],
  },

  facebook: {
    accounts: [],
  },

  youtube: {
    accounts: [],
  },

  threads: {
    accounts: [],
  },

  linkedin: {
    accounts: [],
  },
};

// -------------------------------------------------------
// API
// -------------------------------------------------------

async function fetchAccounts(): Promise<
  PlatformRow[]
> {
  const response =
    await fetch(
      "/api/social/accounts",
      {
        cache:
          "no-store",
      }
    );

  if (
    !response.ok
  ) {
    return [];
  }

  const json =
    await response
      .json()
      .catch(
        () => ({})
      );

  return Array.isArray(
    json?.platforms
  )
    ? (json.platforms as PlatformRow[])
    : [];
}

// -------------------------------------------------------
// ACCOUNT PRESENTATION
// -------------------------------------------------------

function resolveAccountLabel(
  row: PlatformRow,
  platform: PlatformKey
): string {
  const displayName =
    typeof row.display_name ===
      "string"
      ? row.display_name.trim()
      : "";

  if (
    displayName
  ) {
    return displayName;
  }

  const username =
    typeof row.username ===
      "string"
      ? row.username.trim()
      : "";

  if (
    username
  ) {
    return username;
  }

  return `${PLATFORM_LABELS[platform]} account`;
}

// -------------------------------------------------------
// USER-FRIENDLY MESSAGES
// -------------------------------------------------------

function getConnectionSuccessMessage(
  platform: PlatformKey
): string {
  if (
    platform ===
    "linkedin"
  ) {
    return "LinkedIn is connected. You can refresh your available profile data whenever needed.";
  }

  if (
    platform ===
    "threads"
  ) {
    return "Threads is connected. Sync analytics to bring your real Threads performance into Autoaffi.";
  }

  return `${PLATFORM_LABELS[platform]} is connected. Sync analytics to load your latest real performance data.`;
}

function getReadableOAuthError(
  errorCode: string | null,
  platform:
    | PlatformKey
    | null
): string {
  const label =
    platform
      ? PLATFORM_LABELS[
          platform
        ]
      : "your social account";

  switch (
    errorCode
  ) {
    case "oauth_state_expired":
      return "The connection session expired before it was completed. Please press Connect and try again.";

    case "bad_oauth_state":
      return "Autoaffi could not securely verify the connection request. Please start the connection again.";

    case "oauth_user_mismatch":
      return "The social connection did not match your current Autoaffi session. Please sign in again and retry.";

    case "session_expired":
      return "Your Autoaffi session expired during the connection. Please sign in again and retry.";

    case "instagram_access_denied":
    case "threads_access_denied":
      return `You cancelled the ${label} connection. Nothing was changed.`;

    case "instagram_code_exchange_failed":
    case "instagram_long_lived_token_failed":
    case "instagram_account_lookup_failed":
      return "Instagram could not finish the connection. Make sure you are connecting a Creator or Business account, then try again.";

    case "threads_code_exchange_failed":
    case "threads_long_lived_token_failed":
    case "threads_profile_lookup_failed":
      return "Threads could not finish the connection. Please try Connect again.";

    default:
      return `Autoaffi could not finish connecting ${label}. Please try again.`;
  }
}

function getReadableSyncError(
  platform: PlatformKey,
  rawMessage: unknown
): string {
  const raw =
    String(
      rawMessage ??
        ""
    )
      .trim()
      .toLowerCase();

  if (
    raw.includes(
      "reconnect"
    ) ||
    raw.includes(
      "expired"
    ) ||
    raw.includes(
      "invalid_token"
    ) ||
    raw.includes(
      "invalid oauth"
    )
  ) {
    return `${PLATFORM_LABELS[platform]} needs to be reconnected before Autoaffi can sync it again.`;
  }

  if (
    raw.includes(
      "no_connected_account"
    )
  ) {
    return `${PLATFORM_LABELS[platform]} is not currently connected. Connect the account first.`;
  }

  return `Autoaffi could not refresh ${PLATFORM_LABELS[platform]} right now. Please try again in a moment.`;
}

// -------------------------------------------------------
// UI HELPERS
// -------------------------------------------------------

function Toast({
  open,
  type,
  title,
  message,
}: {
  open: boolean;

  type:
    | "success"
    | "error";

  title: string;
  message: string;
}) {
  if (
    !open
  ) {
    return null;
  }

  const base =
    "fixed right-4 top-4 z-[60] w-[min(420px,calc(100vw-2rem))] rounded-2xl border px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur";

  const skin =
    type ===
    "success"
      ? "border-yellow-500/40 bg-slate-950/90"
      : "border-red-500/40 bg-slate-950/90";

  return (
    <div
      className={`${base} ${skin}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {type ===
        "success"
          ? "Success"
          : "Error"}
      </p>

      <p className="mt-1 text-sm font-extrabold text-slate-50">
        {title}
      </p>

      <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
        {message}
      </p>
    </div>
  );
}

function Banner({
  open,
  type,
  title,
  message,
}: {
  open: boolean;

  type:
    | "success"
    | "error";

  title: string;
  message: string;
}) {
  if (
    !open
  ) {
    return null;
  }

  const skin =
    type ===
    "success"
      ? "border-yellow-500/40 bg-yellow-500/10"
      : "border-red-500/40 bg-red-500/10";

  return (
    <div
      className={`mb-6 rounded-2xl border ${skin} px-4 py-3`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
        {title}
      </p>

      <p className="mt-1 text-[12px] leading-relaxed text-slate-200">
        {message}
      </p>
    </div>
  );
}

function AnalyticsSignals({
  platform,
  connected,
}: {
  platform:
    PlatformKey;

  connected:
    boolean;
}) {
  /*
   * LinkedIn intentionally has NO posting-time
   * recommendation here.
   *
   * We currently do not have the LinkedIn
   * performance access required to calculate it
   * honestly.
   */
  if (
    platform ===
    "linkedin"
  ) {
    return (
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Profile
          </p>

          <p className="mt-1 text-[11px] font-semibold text-slate-100">
            {connected
              ? "Connected"
              : "Available after connect"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Content analytics
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            Limited until LinkedIn provides broader analytics access.
          </p>
        </div>
      </div>
    );
  }

  if (
    platform ===
    "threads"
  ) {
    return (
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Performance
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            {connected
              ? "Built from real synced posts"
              : "Available after connect"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Conversations
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            Replies and engagement when the Threads API provides them.
          </p>
        </div>

        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
            Recommended publish time
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            Calculated from real activity — about 30 minutes before your audience peak.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Audience
        </p>

        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          {connected
            ? "Uses real audience signals from sync"
            : "Available after connect"}
        </p>
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
          Recommended publish time
        </p>

        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          About 30 minutes before your real audience peak — once Autoaffi has enough activity to calculate it.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Content performance
        </p>

        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          {connected
            ? "Based only on real synced content"
            : "Available after connect"}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// COMPONENT
// -------------------------------------------------------

export default function SocialAccountsClient() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const pathname =
    usePathname();

  const safePath =
    pathname ??
    "/login/dashboard/social-accounts";

  const [
    platforms,
    setPlatforms,
  ] = useState<
    Record<
      PlatformKey,
      PlatformState
    >
  >(
    INITIAL_STATE
  );

  const [
    manageOpen,
    setManageOpen,
  ] = useState(
    false
  );

  const [
    managePlatform,
    setManagePlatform,
  ] = useState<
    PlatformKey | null
  >(
    null
  );

  const [
    toastVisible,
    setToastVisible,
  ] = useState(
    false
  );

  const [
    bannerVisible,
    setBannerVisible,
  ] = useState(
    false
  );

  const [
    runtimeBanner,
    setRuntimeBanner,
  ] = useState<
    BannerState | null
  >(
    null
  );

  const [
    syncing,
    setSyncing,
  ] = useState<
    Record<
      PlatformKey,
      boolean
    >
  >({
    tiktok:
      false,

    instagram:
      false,

    facebook:
      false,

    youtube:
      false,

    threads:
      false,

    linkedin:
      false,
  });

  const connected =
    searchParams?.get(
      "connected"
    );

  const error =
    searchParams?.get(
      "error"
    );

  const platformParam =
    searchParams?.get(
      "platform"
    );

  const normalizedPlatformParam =
    platformParam &&
    Object.prototype.hasOwnProperty.call(
      PLATFORM_LABELS,
      platformParam.toLowerCase()
    )
      ? (platformParam.toLowerCase() as PlatformKey)
      : null;

  const banner =
    useMemo<
      BannerState | null
    >(() => {
      if (
        runtimeBanner
      ) {
        return runtimeBanner;
      }

      if (
        error
      ) {
        return {
          type:
            "error",

          title:
            "Connection failed",

          message:
            getReadableOAuthError(
              error,
              normalizedPlatformParam
            ),
        };
      }

      if (
        connected
      ) {
        const normalized =
          connected.toLowerCase();

        if (
          Object.prototype.hasOwnProperty.call(
            PLATFORM_LABELS,
            normalized
          )
        ) {
          const platform =
            normalized as PlatformKey;

          return {
            type:
              "success",

            title:
              "Connected!",

            message:
              getConnectionSuccessMessage(
                platform
              ),
          };
        }

        return {
          type:
            "success",

          title:
            "Connected!",

          message:
            "Your social account is now connected to Autoaffi.",
        };
      }

      return null;
    }, [
      connected,
      error,
      normalizedPlatformParam,
      runtimeBanner,
    ]);

  // -----------------------------------------------------
  // PLAN LOCKING
  // -----------------------------------------------------

  function isLocked(
    platform: PlatformKey
  ): boolean {
    const neededPlan =
      PLATFORM_PLAN[
        platform
      ];

    if (
      ACTIVE_PLAN ===
      "Elite"
    ) {
      return false;
    }

    if (
      ACTIVE_PLAN ===
      "Pro"
    ) {
      return (
        neededPlan ===
        "Elite"
      );
    }

    return (
      neededPlan ===
        "Pro" ||
      neededPlan ===
        "Elite"
    );
  }

  // -----------------------------------------------------
  // HYDRATE FROM DB
  // -----------------------------------------------------

  async function hydrate() {
    const rows =
      await fetchAccounts();

    setPlatforms(
      () => {
        const next:
          Record<
            PlatformKey,
            PlatformState
          > = {
          tiktok: {
            accounts: [],
          },

          instagram: {
            accounts: [],
          },

          facebook: {
            accounts: [],
          },

          youtube: {
            accounts: [],
          },

          threads: {
            accounts: [],
          },

          linkedin: {
            accounts: [],
          },
        };

        for (
          const row of rows
        ) {
          const rawPlatform =
            String(
              row.platform
            )
              .toLowerCase()
              .trim();

          if (
            !Object.prototype.hasOwnProperty.call(
              next,
              rawPlatform
            )
          ) {
            /*
             * Example:
             *
             * Legacy X rows can still exist in DB
             * while backend cleanup is ongoing.
             *
             * They are intentionally ignored by
             * the new customer-facing UI.
             */
            continue;
          }

          const platform =
            rawPlatform as PlatformKey;

          if (
            row.status ===
            "connected"
          ) {
            const syncDate =
              row.last_synced_at ??
              null;

            /*
             * Prefer the provider's real human-readable
             * display name.
             *
             * TikTok user.info.basic gives Autoaffi
             * display_name but not necessarily the actual
             * @username/handle, so display_name is used
             * for presentation while username remains
             * semantically separate in storage.
             */
            const accountLabel =
              resolveAccountLabel(
                row,
                platform
              );

            next[
              platform
            ] = {
              accounts: [
                {
                  id:
                    row.account_id ||
                    `acc-${platform}-1`,

                  username:
                    accountLabel,

                  primary:
                    true,
                },
              ],

              lastSynced:
                syncDate
                  ? new Date(
                      syncDate
                    ).toLocaleString()
                  : undefined,
            };
          }
        }

        return next;
      }
    );
  }

  useEffect(
    () => {
      void hydrate();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  // -----------------------------------------------------
  // TOAST / BANNER LIFECYCLE
  // -----------------------------------------------------

  useEffect(
    () => {
      if (
        !banner
      ) {
        return;
      }

      setToastVisible(
        true
      );

      setBannerVisible(
        true
      );

      const toastTimer =
        setTimeout(
          () =>
            setToastVisible(
              false
            ),
          4500
        );

      const bannerTimer =
        setTimeout(
          () =>
            setBannerVisible(
              false
            ),
          6500
        );

      if (
        searchParams
      ) {
        const params =
          new URLSearchParams(
            searchParams.toString()
          );

        params.delete(
          "connected"
        );

        params.delete(
          "error"
        );

        params.delete(
          "platform"
        );

        const query =
          params.toString();

        const target =
          query.length > 0
            ? `${safePath}?${query}`
            : safePath;

        router.replace(
          target
        );
      }

      void hydrate();

      return () => {
        clearTimeout(
          toastTimer
        );

        clearTimeout(
          bannerTimer
        );
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [banner]
  );

  // -----------------------------------------------------
  // CONNECT REDIRECTS
  // -----------------------------------------------------

  function goConnect(
    platform: PlatformKey
  ) {
    if (
      isLocked(
        platform
      )
    ) {
      return;
    }

    if (
      platform ===
      "instagram"
    ) {
      /*
       * Direct Instagram Login.
       *
       * No Facebook Page required.
       */
      window.location.href =
        "/api/oauth/instagram";

      return;
    }

    if (
      platform ===
      "facebook"
    ) {
      window.location.href =
        "/api/oauth/facebook?platform=facebook";

      return;
    }

    if (
      platform ===
      "tiktok"
    ) {
      window.location.href =
        "/api/oauth/tiktok";

      return;
    }

    if (
      platform ===
      "youtube"
    ) {
      window.location.href =
        "/api/oauth/google?platform=youtube";

      return;
    }

    if (
      platform ===
      "threads"
    ) {
      window.location.href =
        "/api/oauth/threads";

      return;
    }

    if (
      platform ===
      "linkedin"
    ) {
      window.location.href =
        "/api/oauth/linkedin";
    }
  }

  // -----------------------------------------------------
  // SYNC
  // -----------------------------------------------------

  async function runSync(
    platform: PlatformKey
  ) {
    setRuntimeBanner(
      null
    );

    setSyncing(
      (previous) => ({
        ...previous,

        [platform]:
          true,
      })
    );

    try {
      const response =
        await fetch(
          "/api/social/sync",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify({
                platform,
              }),
          }
        );

      const json =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        json?.ok ===
          false
      ) {
        const rawMessage =
          json?.error ??
          json?.message ??
          null;

        setRuntimeBanner(
          {
            type:
              "error",

            title:
              "Sync failed",

            message:
              getReadableSyncError(
                platform,
                rawMessage
              ),
          }
        );

        setToastVisible(
          true
        );

        setBannerVisible(
          true
        );

        return;
      }

      const mode =
        json?.mode
          ? String(
              json.mode
            )
          : "ok";

      const synced =
        typeof json?.synced ===
        "number"
          ? json.synced
          : undefined;

      let message:
        string;

      if (
        platform ===
        "linkedin"
      ) {
        message =
          "LinkedIn profile updated.";
      } else if (
        synced !==
        undefined
      ) {
        message =
          `${PLATFORM_LABELS[platform]} updated (${mode}). Items: ${synced}.`;
      } else {
        message =
          `${PLATFORM_LABELS[platform]} updated (${mode}).`;
      }

      setRuntimeBanner(
        {
          type:
            "success",

          title:
            "Synced!",

          message,
        }
      );

      setToastVisible(
        true
      );

      setBannerVisible(
        true
      );

      await hydrate();
    } catch {
      setRuntimeBanner(
        {
          type:
            "error",

          title:
            "Sync failed",

          message:
            `Autoaffi could not refresh ${PLATFORM_LABELS[platform]} right now. Please try again.`,
        }
      );

      setToastVisible(
        true
      );

      setBannerVisible(
        true
      );
    } finally {
      setSyncing(
        (previous) => ({
          ...previous,

          [platform]:
            false,
        })
      );
    }
  }

  // -----------------------------------------------------
  // CONNECT / SYNC ACTION
  // -----------------------------------------------------

  async function handleConnect(
    platform: PlatformKey
  ) {
    if (
      isLocked(
        platform
      )
    ) {
      return;
    }

    const current =
      platforms[
        platform
      ];

    const hasAccounts =
      current.accounts
        .length > 0;

    if (
      !hasAccounts
    ) {
      goConnect(
        platform
      );

      return;
    }

    await runSync(
      platform
    );
  }

  // -----------------------------------------------------
  // MULTI ACCOUNT
  // -----------------------------------------------------

  /*
   * The current DB model stores one canonical connection
   * per user + platform.
   *
   * We therefore do NOT create fake local accounts here.
   *
   * AccountManageModal will get its own cleanup pass next.
   */
  function handleAddAccount(
    platform: PlatformKey
  ) {
    if (
      isLocked(
        platform
      )
    ) {
      return;
    }

    setRuntimeBanner(
      {
        type:
          "error",

        title:
          "One account per platform",

        message:
          `Autoaffi currently supports one connected ${PLATFORM_LABELS[platform]} account here. Additional-account support will only be shown when it is fully available.`,
      }
    );

    setToastVisible(
      true
    );

    setBannerVisible(
      true
    );
  }

  // -----------------------------------------------------
  // MANAGE MODAL
  // -----------------------------------------------------

  function handleManage(
    platform: PlatformKey
  ) {
    const state =
      platforms[
        platform
      ];

    if (
      state.accounts
        .length === 0
    ) {
      return;
    }

    setManagePlatform(
      platform
    );

    setManageOpen(
      true
    );
  }

  function closeManage() {
    setManageOpen(
      false
    );

    setManagePlatform(
      null
    );
  }

  function handleModalAdd() {
    if (
      !managePlatform
    ) {
      return;
    }

    handleAddAccount(
      managePlatform
    );
  }

  async function handleModalRemove(
    id: string
  ) {
    if (
      !managePlatform
    ) {
      return;
    }

    const current =
      platforms[
        managePlatform
      ];

    const filtered =
      current.accounts.filter(
        (account) =>
          account.id !==
          id
      );

    if (
      filtered.length ===
      0
    ) {
      const response =
        await fetch(
          "/api/social/disconnect",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify({
                platform:
                  managePlatform,
              }),
          }
        );

      if (
        !response.ok
      ) {
        setRuntimeBanner(
          {
            type:
              "error",

            title:
              "Disconnect failed",

            message:
              `Autoaffi could not disconnect ${PLATFORM_LABELS[managePlatform]} right now. Please try again.`,
          }
        );

        setToastVisible(
          true
        );

        setBannerVisible(
          true
        );

        return;
      }

      await hydrate();

      closeManage();

      return;
    }

    /*
     * Defensive UI fallback only.
     *
     * Real multi-account persistence is not enabled.
     */
    setPlatforms(
      (previous) => ({
        ...previous,

        [managePlatform]: {
          ...previous[
            managePlatform
          ],

          accounts:
            filtered,
        },
      })
    );
  }

  function handleModalSetPrimary(
    id: string
  ) {
    if (
      !managePlatform
    ) {
      return;
    }

    setPlatforms(
      (previous) => {
        const current =
          previous[
            managePlatform
          ];

        const updated =
          current.accounts.map(
            (account) => ({
              ...account,

              primary:
                account.id ===
                id,
            })
          );

        return {
          ...previous,

          [managePlatform]: {
            ...current,

            accounts:
              updated,
          },
        };
      }
    );
  }

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black px-4 py-10 text-slate-50">
      <Toast
        open={
          toastVisible &&
          !!banner
        }
        type={
          (
            banner?.type ??
            "success"
          ) as
            | "success"
            | "error"
        }
        title={
          banner?.title ??
          ""
        }
        message={
          banner?.message ??
          ""
        }
      />

      <div className="mx-auto max-w-6xl">
        <Banner
          open={
            bannerVisible &&
            !!banner
          }
          type={
            (
              banner?.type ??
              "success"
            ) as
              | "success"
              | "error"
          }
          title={
            banner?.title ??
            ""
          }
          message={
            banner?.message ??
            ""
          }
        />

        {/* ------------------------------------------------ */}
        {/* HERO                                             */}
        {/* ------------------------------------------------ */}

        <header className="mb-8 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/30 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="grid items-center gap-4 md:grid-cols-[1.08fr_0.92fr]">
            {/* HERO COPY */}

            <div className="px-5 py-7 md:px-7 md:py-9">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400/80">
                Social connections
              </p>

              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                  Connect your socials
                </span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
                Autoaffi never auto-DMs, never auto-likes and never posts without your consent.
                We use the real social performance data you choose to connect to help you understand
                what works and make smarter content decisions.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-yellow-500/25 bg-yellow-500/[0.06] px-3 py-1.5 text-yellow-200">
                  Your data stays private
                </span>

                <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300">
                  Real analytics only
                </span>

                <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300">
                  You stay in control
                </span>
              </div>
            </div>

            {/* HERO IMAGE */}

            <div className="relative min-h-[250px] overflow-hidden md:min-h-[320px]">
              <Image
                src="/images/social-accounts/social-accounts-hero-v2.png"
                alt="Autoaffi connected to TikTok, Instagram, Facebook, YouTube, Threads and LinkedIn"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 44vw"
                className="object-contain object-center"
              />
            </div>
          </div>
        </header>

        {/* ------------------------------------------------ */}
        {/* 3 STEP GUIDE                                     */}
        {/* ------------------------------------------------ */}

        <section className="mb-10 rounded-2xl border border-yellow-500/30 bg-slate-900/70 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-yellow-300">
            Start here — 3 steps
          </h2>

          <div className="grid gap-4 text-xs text-slate-200 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 1 — Connect your core channels
              </p>

              <p className="leading-relaxed">
                Start with{" "}
                <span className="font-semibold text-slate-100">
                  TikTok, Instagram, Facebook &amp; YouTube
                </span>
                . These give Autoaffi the strongest foundation for understanding your content performance.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 2 — Add extra channels
              </p>

              <p className="leading-relaxed">
                Add{" "}
                <span className="font-semibold text-slate-100">
                  Threads
                </span>{" "}
                on Pro and{" "}
                <span className="font-semibold text-slate-100">
                  LinkedIn
                </span>{" "}
                on Elite to give Autoaffi an even broader view of your audience and content.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-1 text-[11px] font-semibold text-yellow-300">
                Step 3 — Let Autoaffi guide you
              </p>

              <p className="leading-relaxed">
                Your real performance helps Autoaffi recommend what to create,
                when to post and where to focus next.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* PLATFORM CARDS                                   */}
        {/* ------------------------------------------------ */}

        <section className="mb-12">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
            Platforms &amp; plans
          </h2>

          <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
            See every channel at a glance. Your plan decides which extra connections you can activate.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              Object.keys(
                PLATFORM_LABELS
              ) as PlatformKey[]
            ).map(
              (
                platform
              ) => {
                const label =
                  PLATFORM_LABELS[
                    platform
                  ];

                const plan =
                  PLATFORM_PLAN[
                    platform
                  ];

                const state =
                  platforms[
                    platform
                  ];

                const locked =
                  isLocked(
                    platform
                  );

                const hasAccounts =
                  state.accounts
                    .length > 0;

                const isSyncing =
                  syncing[
                    platform
                  ];

                const connectLabel =
                  locked
                    ? `Unlock with ${plan}`
                    : hasAccounts
                      ? platform ===
                        "linkedin"
                        ? isSyncing
                          ? "Syncing profile..."
                          : "Sync profile"
                        : isSyncing
                          ? "Syncing..."
                          : "Sync analytics"
                      : `Connect ${label}`;

                const statusLabel =
                  hasAccounts
                    ? `${state.accounts.length} account${state.accounts.length > 1 ? "s" : ""} connected`
                    : "Not connected";

                const lastSyncedLabel =
                  hasAccounts
                    ? state.lastSynced
                      ? `Last synced: ${state.lastSynced}`
                      : platform ===
                        "linkedin"
                        ? "Profile not synced yet"
                        : "Analytics not synced yet"
                    : null;

                return (
                  <article
                    key={
                      platform
                    }
                    className={`flex flex-col rounded-2xl border bg-slate-900/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.6)] transition-all ${
                      locked
                        ? "border-slate-800 opacity-90"
                        : "border-slate-800 hover:border-yellow-400/60 hover:bg-slate-900/90"
                    }`}
                  >
                    {/* TOP */}

                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-50">
                          {label}
                        </h3>

                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Included from {plan}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {locked && (
                          <span className="rounded-full border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
                            {plan}
                          </span>
                        )}

                        <span
                          className={`text-[11px] font-medium ${
                            hasAccounts
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* COPY */}

                    <p className="mb-4 min-h-[48px] text-xs leading-relaxed text-slate-300">
                      {PLATFORM_DESCRIPTION[
                        platform
                      ]}
                    </p>

                    {/* FACEBOOK META HELP */}

                    {platform ===
                      "facebook" && (
                      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                        Meta may ask you to select your business portfolio, Facebook Page and related assets during connection.
                      </div>
                    )}

                    {/* REAL / HONEST SIGNAL AREA */}

                    <AnalyticsSignals
                      platform={
                        platform
                      }
                      connected={
                        hasAccounts
                      }
                    />

                    {/* BUTTONS */}

                    <div className="mt-auto flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          locked ||
                          (
                            hasAccounts &&
                            isSyncing
                          )
                        }
                        onClick={() =>
                          handleConnect(
                            platform
                          )
                        }
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                          locked
                            ? "cursor-not-allowed border border-slate-700 text-slate-500"
                            : hasAccounts &&
                                isSyncing
                              ? "cursor-wait border border-yellow-500/40 bg-slate-900 text-yellow-200"
                              : "border border-yellow-500 bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-950 hover:brightness-110"
                        }`}
                      >
                        {connectLabel}
                      </button>

                      <button
                        type="button"
                        disabled={
                          !hasAccounts
                        }
                        onClick={() =>
                          handleManage(
                            platform
                          )
                        }
                        className={`rounded-full border px-3 py-2 text-[11px] font-medium transition ${
                          !hasAccounts
                            ? "cursor-not-allowed border-slate-700 text-slate-600"
                            : "border-slate-700 text-slate-200 hover:border-yellow-400 hover:text-yellow-300"
                        }`}
                      >
                        Manage
                      </button>
                    </div>

                    {lastSyncedLabel && (
                      <p className="mt-2 text-[10px] text-slate-500">
                        {lastSyncedLabel}
                      </p>
                    )}
                  </article>
                );
              }
            )}
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* PRIVACY / TRUST                                  */}
        {/* ------------------------------------------------ */}

        <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
            Your accounts stay under your control
          </h2>

          <div className="grid gap-4 text-[11px] text-slate-300 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-1 font-semibold text-yellow-300">
                What Autoaffi can use
              </p>

              <p className="leading-relaxed">
                Available performance signals such as views, engagement,
                publishing activity and audience data when each platform provides them.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-1 font-semibold text-yellow-300">
                What Autoaffi never does
              </p>

              <p className="leading-relaxed">
                No automatic DMs, likes, follows, comments or publishing without your consent.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-1 font-semibold text-yellow-300">
                Why connect
              </p>

              <p className="leading-relaxed">
                Your real performance gives Autoaffi better evidence for content ideas,
                timing recommendations and what you should focus on next.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- */}
      {/* MANAGE MODAL                                       */}
      {/* -------------------------------------------------- */}

      {managePlatform && (
        <AccountManageModal
          open={
            manageOpen
          }
          onClose={
            closeManage
          }
          platform={
            PLATFORM_LABELS[
              managePlatform
            ]
          }
          accounts={
            platforms[
              managePlatform
            ].accounts
          }
          onAdd={
            handleModalAdd
          }
          onRemove={
            handleModalRemove
          }
          onSetPrimary={
            handleModalSetPrimary
          }
        />
      )}
    </main>
  );
}