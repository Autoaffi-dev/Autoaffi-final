"use client";

import { motion } from "framer-motion";

export default function AccountManageModal({
  open,
  onClose,
  platform,
  accounts,
  onAdd,
  onRemove,
  onSetPrimary,
}: {
  open: boolean;
  onClose: () => void;
  platform: string;
  accounts: { id: string; username: string; primary: boolean }[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative z-50 w-full max-w-md rounded-2xl border border-yellow-500/20 bg-slate-900 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      >
        {/* TITLE */}
        <h2 className="text-lg font-bold mb-2">
          Manage {platform} Accounts
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Add, remove or set a primary account for this platform.
        </p>

        {/* ACCOUNTS LIST */}
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {accounts.length === 0 && (
            <p className="text-sm text-slate-500">No accounts connected.</p>
          )}

          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  @{a.username}
                </p>
                <p className="text-[10px] text-slate-500">
                  {a.primary ? "Primary account" : "Secondary"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!a.primary && (
                  <button
                    onClick={() => onSetPrimary(a.id)}
                    className="text-[10px] text-yellow-400 hover:text-yellow-200"
                  >
                    Set primary
                  </button>
                )}

                <button
                  onClick={() => onRemove(a.id)}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ADD BUTTON */}
        <button
          onClick={onAdd}
          className="w-full mt-5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 py-2 font-semibold hover:brightness-110 transition"
        >
          + Add new account
        </button>

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}