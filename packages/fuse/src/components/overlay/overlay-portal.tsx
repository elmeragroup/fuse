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
  keepMounted,
  children,
}: {
  portal: ComponentType<{ container?: HTMLElement; keepMounted?: boolean; children?: ReactNode }>;
  container?: OverlayContainerProps["container"];
  /**
   * Keep the portal's node mounted while the popup is closed, so a close moves no node after the
   * scope's last child and restyles nothing beside the popup.
   */
  keepMounted?: boolean;
  children: ReactNode;
}): ReactElement | null {
  const resolved = useResolvedPortalContainer(container);
  if (resolved === null) return null;
  // Only a portal asked to stay mounted gets the prop, so no portal sees one it doesn't take.
  if (keepMounted === true) {
    return (
      <Portal container={resolved} keepMounted>
        {children}
      </Portal>
    );
  }
  return <Portal container={resolved}>{children}</Portal>;
}
