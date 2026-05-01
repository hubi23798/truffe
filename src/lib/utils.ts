import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose className strings with conflict-resolution. Used by every
 * shadcn/ui primitive and any component that conditionally toggles
 * Tailwind utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
