"use client";

import React from "react";

type SwitchProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export function Switch({
  checked = false,
  onCheckedChange,
  className = "",
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-yellow-500 focus-visible:ring-offset-2
        ${checked ? "bg-yellow-500" : "bg-gray-200"}
        ${className}
      `}
    >
      <span
        className={`
          inline-block h-5 w-5 rounded-full bg-white shadow-lg
          transform transition-transform
          ${checked ? "translate-x-5" : "translate-x-1"}
        `}
      />
    </button>
  );
}