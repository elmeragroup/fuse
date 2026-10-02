import type { ReactElement, ReactNode } from "react";

import { defaultDensityForVariant, densityAttributes, themeAttributes } from "@elmeragroup/fuse/theme";

import { DOCUMENT_THEME } from "../lib/theme";

type DocumentRootProps = {
  children: ReactNode;
  suppressHydrationWarning?: boolean;
};

export function DocumentRoot({
  children,
  suppressHydrationWarning = false,
}: DocumentRootProps): ReactElement {
  return (
    <html
      lang="en"
      className="bg-background text-foreground"
      {...themeAttributes(DOCUMENT_THEME)}
      {...densityAttributes(defaultDensityForVariant(DOCUMENT_THEME.variant))}
      suppressHydrationWarning={suppressHydrationWarning}>
      {children}
    </html>
  );
}
