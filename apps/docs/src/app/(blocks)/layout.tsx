import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { ColorSchemeScript, documentAttributes } from "@elmeragroup/fuse/theme";

import { DocumentRoot } from "../../components/document-root";
import { BLOCK_SESSION_THEME_KEY } from "../../lib/block-preview";
import { siteOrigin } from "../../lib/site-origin";
import { DEFAULT_THEME, docsDensityFor, DOCUMENT_COLOR_SCHEME } from "../../lib/theme";
import { slugAttributesJson, THEME_QUERY } from "../../lib/theme-address";
import "../../styles/globals.css";
import { BlockPreviewTheme } from "./block-preview-theme";

/** Every block preview prerenders whole; the build fails if one starts reading the request. */
export const ensureStatic = "navigation";

/**
 * The block previews render outside the docs chrome, full-viewport, as the apps they stand for.
 * Each is a page of its docs entry, so search engines leave it out, as they do `/private`.
 */
export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { template: "%s · Fuse block", default: "Fuse block" },
  robots: { index: false, follow: false },
};

/** Every slug Fuse's slug parser accepts, mapped to the theme and density attributes it stamps. */
const SLUG_ATTRIBUTES = slugAttributesJson((theme) =>
  documentAttributes({ theme, density: docsDensityFor(theme) })
);

/**
 * Stamps a preview opened in its own tab with its linked theme before the browser can paint. The
 * layout stamps the default theme on the server, which receives no search params. "Open in new tab"
 * names the docs page's theme in `?theme=`: exactly one legal slug is kept for the tab's session,
 * so the pages its links lead to, which drop the query, keep it too. The framed preview takes its
 * theme from the docs page instead. The map's keys are the slugs `parseThemeSlug` accepts, so the
 * script carries no slug grammar of its own.
 */
const SESSION_THEME_SCRIPT = `(function(m,q,k){try{if(window.parent!==window)return;var h=Object.prototype.hasOwnProperty,v=new URLSearchParams(location.search).getAll(q);if(v.length===1&&h.call(m,v[0]))sessionStorage.setItem(k,v[0]);var s=sessionStorage.getItem(k);if(s===null||!h.call(m,s))return;var a=m[s],r=document.documentElement;for(var x in a)r.setAttribute(x,a[x])}catch(e){}})(${SLUG_ATTRIBUTES},${JSON.stringify(THEME_QUERY)},${JSON.stringify(BLOCK_SESSION_THEME_KEY)})`;

export type BlocksLayoutProps = {
  children: ReactNode;
};

/**
 * The document a block preview renders in. It opens on the docs' default preview theme, which the
 * docs page's iframe then keeps in step with the header's picker, or a tab of its own on the theme
 * its address linked. It reads the colour scheme from the docs' own storage key, so the preview
 * and the page around it always share one.
 */
export default function BlocksLayout({ children }: BlocksLayoutProps): ReactElement {
  return (
    <DocumentRoot theme={DEFAULT_THEME} blockPreview suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
          defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
          enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
        />
        <script dangerouslySetInnerHTML={{ __html: SESSION_THEME_SCRIPT }} />
      </head>
      <body className="m-0 min-w-80 bg-background font-sans text-foreground antialiased">
        <BlockPreviewTheme>{children}</BlockPreviewTheme>
      </body>
    </DocumentRoot>
  );
}
