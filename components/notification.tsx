"use client";

import { useEffect } from "react";

interface NotificationProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Notification({ message, type = "info", onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-indigo-500 text-white",
  };

  return (
    <div
      className={`fixed bottom-4 right-4 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-opacity duration-500 ${colors[type]}`}
    >
      {message}
    </div>
  );
}