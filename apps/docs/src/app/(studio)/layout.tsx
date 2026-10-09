import type { ReactElement, ReactNode } from "react";

import type { Metadata, Viewport } from "next";

import { DocumentRoot } from "../../components/document-root";
import { siteOrigin } from "../../lib/site-origin";
import "../../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    template: "%s · Fuse",
    default: "Theme studio · Fuse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export type StudioRootLayoutProps = {
  children: ReactNode;
};

/**
 * The studio's document. Its `<html>` stays light and carries no scheme bootstrap: Fuse's dark
 * rules are descendant selectors, so a dark document would darken every artboard on the canvas.
 * The editor chrome and each artboard set their own scheme on their own subtree instead.
 */
export default function StudioRootLayout({ children }: StudioRootLayoutProps): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 min-w-80 overflow-hidden bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </DocumentRoot>
  );
}
