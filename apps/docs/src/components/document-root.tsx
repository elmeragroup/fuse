import type { ReactElement, ReactNode } from "react";

import { defaultDensityForVariant, densityAttributes, themeAttributes } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";

import { DOCUMENT_THEME } from "../lib/theme";
import { inter, roboto } from "./site-fonts";

type DocumentRootProps = {
  children: ReactNode;
  /** The coordinate stamped on `<html>`; its variant also picks the document density. */
  theme?: ThemeInput;
  suppressHydrationWarning?: boolean;
};

export function DocumentRoot({
  children,
  theme = DOCUMENT_THEME,
  suppressHydrationWarning = false,
}: DocumentRootProps): ReactElement {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${roboto.variable} bg-background text-foreground`}
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning={suppressHydrationWarning}>
      {children}
    </html>
  );
}
