import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
* cn – kombinerar Tailwind-klasser på ett smart sätt
* Används överallt där vi gör className={cn(...)}
*/
export function cn(...inputs: ClassValue[]) {
return twMerge(clsx(inputs));
}