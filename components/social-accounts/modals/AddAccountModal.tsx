"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  platform: string;
  onAdd: () => void;
};

export default function AddAccountModal({
  open,
  onClose,
  platform,
  onAdd,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative animate-slideUp">
        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-yellow-400"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold text-yellow-300 mb-2">
          Connect a new {platform} account
        </h2>

        <p className="text-xs text-slate-400 mb-5">
          Choose which account you want to connect. This does not allow Autoaffi
          to post — only to read insights.
        </p>

        <button
          onClick={() => {
            onAdd();
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 font-semibold hover:brightness-110 transition"
        >
          Connect {platform}
        </button>
      </div>
    </div>
  );
}