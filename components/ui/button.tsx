import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
extends React.ButtonHTMLAttributes<HTMLButtonElement> {
size?: "sm" | "md" | "lg";
variant?: "primary" | "secondary" | "outline";
}

export function Button({
className,
size = "md",
variant = "primary",
...props
}: ButtonProps) {
const sizeClasses = {
sm: "px-3 py-1 text-xs",
md: "px-4 py-2 text-sm",
lg: "px-5 py-3 text-base",
};

const variantClasses = {
primary:
"bg-yellow-400 text-slate-900 hover:bg-yellow-300 font-semibold shadow-md",
secondary:
"bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-600",
outline:
"border border-yellow-400 text-yellow-300 hover:bg-yellow-400/10",
};

return (
<button
className={cn(
"rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-950",
sizeClasses[size],
variantClasses[variant],
className
)}
{...props}
/>
);
}