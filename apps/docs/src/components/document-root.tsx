import type { ReactElement, ReactNode } from "react";

import { documentAttributes } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";

import { docsDensityFor, DOCUMENT_THEME } from "../lib/theme";
import { inter, roboto } from "./site-fonts";

type DocumentRootProps = {
  children: ReactNode;
  /** The coordinate stamped on `<html>`; the docs site's density for its identity goes with it. */
  theme?: ThemeInput;
  suppressHydrationWarning?: boolean;
  /**
   * Marks a block preview's document. Its root is the theme scope, so `styles/globals.css` draws
   * Roboto there for a branded theme. The docs' own roots draw Inter whatever theme they carry.
   */
  blockPreview?: boolean;
};

export function DocumentRoot({
  children,
  theme = DOCUMENT_THEME,
  suppressHydrationWarning = false,
  blockPreview = false,
}: DocumentRootProps): ReactElement {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${roboto.variable} bg-background text-foreground`}
      {...documentAttributes({ theme, density: docsDensityFor(theme) })}
      {...(blockPreview && { "data-block-preview": "" })}
      suppressHydrationWarning={suppressHydrationWarning}>
      {children}
    </html>
  );
}
