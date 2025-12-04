import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
return (
<div
className={cn(
"rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all p-6",
className
)}
{...props}
/>
)
}

export function CardHeader({ className, ...props }: CardProps) {
return (
<div className={cn("mb-4", className)} {...props} />
)
}

export function CardTitle({ className, ...props }: CardProps) {
return (
<h3
className={cn(
"text-xl font-semibold text-gray-900 tracking-tight",
className
)}
{...props}
/>
)
}

export function CardContent({ className, ...props }: CardProps) {
return (
<div className={cn("text-gray-600 text-sm", className)} {...props} />
)
}

export function CardFooter({ className, ...props }: CardProps) {
return (
<div className={cn("mt-4 pt-4 border-t border-gray-100", className)} {...props} />
)
}