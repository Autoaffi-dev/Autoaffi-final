"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Account = {
  id: string;
  username: string;
  primary: boolean;
};

type AccountManageModalProps = {
  open: boolean;
  onClose: () => void;
  platform: string;
  accounts: Account[];

  /*
   * Kept in the public prop contract for now because
   * SocialAccountsClient still passes these callbacks.
   *
   * The current Autoaffi data model intentionally supports
   * one canonical connected account per user + platform,
   * so multi-account actions are not exposed in this modal.
   */
  onAdd: () => void;
  onRemove: (
    id: string
  ) =>
    | void
    | Promise<void>;
  onSetPrimary: (
    id: string
  ) => void;
};

export default function AccountManageModal(
  props: AccountManageModalProps
) {
  const {
    open,
    onClose,
    platform,
    accounts,
    onRemove,
  } = props;

  const [
    disconnectingId,
    setDisconnectingId,
  ] = useState<
    string | null
  >(
    null
  );

  if (
    !open
  ) {
    return null;
  }

  const account =
    accounts[0] ??
    null;

  async function handleDisconnect() {
    if (
      !account ||
      disconnectingId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Disconnect ${platform} from Autoaffi? You can connect it again later.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setDisconnectingId(
      account.id
    );

    try {
      await onRemove(
        account.id
      );
    } finally {
      setDisconnectingId(
        null
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* BACKDROP */}

      <button
        type="button"
        aria-label="Close account manager"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={
          onClose
        }
      />

      {/* MODAL */}

      <motion.div
        initial={{
          opacity: 0,
          scale: 0.94,
          y: 18,
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        exit={{
          opacity: 0,
          scale: 0.94,
        }}
        transition={{
          duration: 0.18,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-account-modal-title"
        className="relative z-50 w-full max-w-md rounded-2xl border border-yellow-500/20 bg-slate-900 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      >
        {/* TITLE */}

        <h2
          id="social-account-modal-title"
          className="text-lg font-bold text-slate-50"
        >
          Manage {platform} account
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          View the account currently connected to Autoaffi or disconnect it at any time.
        </p>

        {/* ACCOUNT */}

        <div className="mt-5">
          {!account ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-slate-300">
                No account connected
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Close this window and connect {platform} from Social Accounts.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Connected account
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {account.username}
                  </p>

                  <p className="mt-1 text-[11px] text-emerald-400">
                    Connected
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                  Active
                </span>
              </div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Disconnecting removes Autoaffi&apos;s stored connection to this {platform} account.
                  You can reconnect it later.
                </p>

                <button
                  type="button"
                  disabled={
                    disconnectingId ===
                    account.id
                  }
                  onClick={() => {
                    void handleDisconnect();
                  }}
                  className={`mt-3 w-full rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                    disconnectingId ===
                    account.id
                      ? "cursor-wait border-red-500/20 bg-red-500/5 text-red-300/60"
                      : "border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/60 hover:bg-red-500/15 hover:text-red-200"
                  }`}
                >
                  {disconnectingId ===
                  account.id
                    ? `Disconnecting ${platform}...`
                    : `Disconnect ${platform}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CLOSE */}

        <button
          type="button"
          disabled={
            disconnectingId !==
            null
          }
          onClick={
            onClose
          }
          className={`mt-4 w-full rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold transition ${
            disconnectingId
              ? "cursor-not-allowed text-slate-600"
              : "text-slate-300 hover:border-yellow-400/50 hover:text-yellow-300"
          }`}
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}