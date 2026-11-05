"use client";

import { useMediaQuery } from "./use-media-query";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Package-private motion preference probe: whether the reader asks for reduced motion. The
 * server, and hydration, report `false` until the client reads the query, as `useMediaQuery`
 * explains.
 *
 * @returns Whether `(prefers-reduced-motion: reduce)` matches now.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION);
}
