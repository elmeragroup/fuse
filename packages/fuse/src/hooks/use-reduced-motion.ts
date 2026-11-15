"use client";

import { useMediaQuery } from "./use-media-query";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Whether the user asks for reduced motion. The hook is a package-private motion preference probe.
 * The server, and hydration, report `false` until the client reads the query, as `useMediaQuery`
 * explains.
 *
 * @returns Whether `(prefers-reduced-motion: reduce)` matches now.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION);
}
