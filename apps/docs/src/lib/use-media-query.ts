import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether `query` matches, kept current as it changes. The server and hydration render
 * `serverValue`, so pick the value whose markup suits the first paint.
 *
 * @param query - A media query, such as `(width < 40rem)`.
 * @param serverValue - The answer before the client can read the viewport.
 * @returns Whether the query matches.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
