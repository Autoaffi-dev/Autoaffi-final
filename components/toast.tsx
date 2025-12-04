"use client"

import { useEffect, useState } from "react"

interface ToastProps {
  message: string
  type?: "success" | "error" | "info"
}

export function Toast({ message, type = "info" }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-indigo-500",
  }

  return (
    <div
      className={`fixed bottom-6 right-6 text-white px-5 py-3 rounded-lg shadow-lg transition-opacity animate-fade-in-up ${colors[type]}`}
    >
      {message}
    </div>
  )
}