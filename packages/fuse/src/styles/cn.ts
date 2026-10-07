import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// `rounded-inner` is a Fuse utility from fuse.css. Registering `inner` as a radius value puts
// it in the `rounded-*` conflict group, so a consumer's `rounded-*` class replaces it.
const twMerge = extendTailwindMerge({ extend: { theme: { radius: ["inner"] } } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
