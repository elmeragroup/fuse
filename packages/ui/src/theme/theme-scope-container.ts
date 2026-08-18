"use client";

import { createContext, use } from "react";
import type { RefObject } from "react";

export const ThemeScopeContainerContext = createContext<HTMLElement | null | undefined>(undefined);

function isElementRef(
  value: HTMLElement | RefObject<HTMLElement | null>
): value is RefObject<HTMLElement | null> {
  return "current" in value && !("nodeType" in value);
}

export function useThemeScopeContainer(
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
