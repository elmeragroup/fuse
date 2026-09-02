"use client";

import { useEffect, useEffectEvent, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Package-private viewport probe for Sidebar (sidebar.md §2 "Private useIsMobile"):
 * a `(max-width: 767px)` media query against the 768px breakpoint. State starts
 * `undefined` and is coerced with `Boolean`, so SSR and the first client render both
 * report `false`; the real value lands after mount and follows MQL change events.
 * Observable only through `useSidebar().isMobile` — never a public export.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  const setIsMobileEvent = useEffectEvent((value: boolean) => {
    setIsMobile(value);
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);

    setIsMobileEvent(window.innerWidth < MOBILE_BREAKPOINT);

    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return Boolean(isMobile);
}
