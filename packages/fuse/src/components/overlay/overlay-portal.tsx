"use client";

import type { ComponentType, ReactElement, ReactNode } from "react";

import { useResolvedPortalContainer } from "../../theme/theme-scope-container";
import type { OverlayContainerProps } from "./overlay-props";

/**
 * Package-private portal owner. It resolves the target, renders nothing while a scope is
 * unattached, and never falls back to `document.body`.
 */
export function OverlayPortal({
  portal: Portal,
  container,
  children,
}: {
  portal: ComponentType<{ container?: HTMLElement; children?: ReactNode }>;
  container?: OverlayContainerProps["container"];
  children: ReactNode;
}): ReactElement | null {
  const resolved = useResolvedPortalContainer(container);
  return resolved === null ? null : <Portal container={resolved}>{children}</Portal>;
}
