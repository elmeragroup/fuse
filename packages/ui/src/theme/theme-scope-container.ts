"use client";

import { createContext, use } from "react";
import type { RefObject } from "react";

export const ThemeScopeContainerContext = createContext<HTMLElement | null | undefined>(undefined);

function isElementRef(
  value: HTMLElement | RefObject<HTMLElement | null>
): value is RefObject<HTMLElement | null> {
  return "current" in value && !("nodeType" in value);
}

/**
 * Resolves the portal target for one overlay, in the order theming.md §7.4 fixes:
 * explicit `container` element or ref → nearest `ThemeScope` element → primitive
 * default. The three return arms are the whole contract, and every overlay reads
 * them the same way:
 *
 * - an `HTMLElement` — portal there;
 * - `null` — an explicit ref or an enclosing `ThemeScope` exists but its element is
 *   not attached yet, so the overlay renders nothing and waits. It must never
 *   briefly escape to `document.body`;
 * - `undefined` — no scope and no explicit container, so the primitive's own default
 *   (`document.body`) stays in place.
 *
 * The canonical call site is `if (resolved === null) return null;` followed by
 * forwarding the value to the primitive's portal/container prop. Package-private:
 * neither this hook nor the underlying context is exported (theming.md §7.4).
 */
export function useResolvedPortalContainer(
  container?: HTMLElement | RefObject<HTMLElement | null>
): HTMLElement | null | undefined {
  const scope = use(ThemeScopeContainerContext);
  if (container === undefined) {
    return scope;
  }
  if (isElementRef(container)) {
    return container.current;
  }
  return container;
}
