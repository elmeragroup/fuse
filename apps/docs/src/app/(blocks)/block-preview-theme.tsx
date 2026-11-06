"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";

import { parseThemeSlug, ThemeProvider } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";

import {
  BLOCK_SESSION_THEME_KEY,
  encodeBlockPreviewMessage,
  parseBlockPreviewMessage,
} from "../../lib/block-preview";
import type { BlockPreviewMessage } from "../../lib/block-preview";
import { DEFAULT_THEME, docsDensityFor, DOCUMENT_COLOR_SCHEME } from "../../lib/theme";

type BlockPreviewThemeProps = {
  children: ReactNode;
};

/** Whether this document runs in the docs page's preview iframe rather than its own tab. */
function framed(): boolean {
  return window.parent !== window;
}

function post(message: BlockPreviewMessage): void {
  window.parent.postMessage(encodeBlockPreviewMessage(message), window.location.origin);
}

function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * The theme a tab of its own keeps for its session, which the head script stored, or `null` on the
 * server, in the docs page's iframe and before any link named one.
 */
function sessionThemeSlug(): string | null {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- server/browser boundary: the server has no window or session
  if (typeof window === "undefined" || framed()) return null;
  try {
    return window.sessionStorage.getItem(BLOCK_SESSION_THEME_KEY);
  } catch {
    // A browser that refuses storage keeps the default theme.
    return null;
  }
}

/**
 * The standalone tab's theme. "Open in new tab" names it in the address, and the layout's head
 * script stores it for the tab's session and stamps it on `<html>` before the first paint, so the
 * theme outlives the links that drop the query.
 *
 * The hydration snapshot reads the same session in the browser, so ThemeProvider's first commit
 * already carries the theme the head script stamped. Fuse's document writer expects exactly that:
 * its first commit matches the document's attributes, and otherwise it warns and writes its own
 * theme over them, which would paint the default brand and density for a moment. The server's
 * snapshot is the default, and the markup cannot differ between the two, because the theme reaches
 * the page only as `<html>` attributes and CSS custom properties, never as rendered text.
 */
function useSessionTheme(): ThemeInput | null {
  const slug = useSyncExternalStore(subscribeNever, sessionThemeSlug, sessionThemeSlug);
  return slug === null ? null : parseThemeSlug(slug);
}

/**
 * The block's document theme. It opens on the docs' default preview theme. In the docs page's
 * iframe it takes every theme the page posts, and after every navigation it tells the page its path
 * and search, for the preview's address bar. In a tab of its own it keeps the theme "Open in new tab"
 * linked for the whole session. The density is the docs site's density for the identity, as on the docs' demo stages. This
 * file is the docs site's, not the block's: an app sets its theme once in its own root layout.
 */
export function BlockPreviewTheme({ children }: BlockPreviewThemeProps): ReactElement {
  const [posted, setPosted] = useState<ThemeInput | undefined>(undefined);
  const session = useSessionTheme();
  const theme = posted ?? session ?? DEFAULT_THEME;
  const pathname = usePathname();

  useEffect(() => {
    if (!framed()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = parseBlockPreviewMessage(event.data);
      if (message?._tag === "Theme") setPosted(message.theme);
    };
    window.addEventListener("message", onMessage);
    post({ _tag: "Ready" });
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // After the router has written the new URL; the search comes along, a hash does not.
  useEffect(() => {
    if (!framed()) return;
    post({ _tag: "Location", path: `${pathname}${window.location.search}` });
  }, [pathname]);

  // Before paint, so a theme change never shows a frame at the old identity's density.
  const density = docsDensityFor(theme);
  useLayoutEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  return (
    <ThemeProvider
      theme={theme}
      storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
      defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
      enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
      injectColorSchemeScript={false}>
      {children}
    </ThemeProvider>
  );
}
