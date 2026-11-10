"use client";

import { useEffect } from "react";

/**
 * Sets `data-preview-hydrated` on `<html>` once the block preview page it follows is live, and
 * renders nothing. Next hydrates each route segment in a pass of its own after the layouts, so no
 * layout signal covers the page, and the page's Field labels link in effects. The marker is the
 * page's last child, and React runs a commit's passive effects in tree order, so the attribute
 * proves the page's own effects have run. It is written, never rendered, so the server HTML stays
 * without it and hydration stays clean. The docs route sweep waits for it before axe reads the page.
 */
export function PreviewHydrationMarker(): null {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-preview-hydrated", "");
    return () => root.removeAttribute("data-preview-hydrated");
  }, []);
  return null;
}
