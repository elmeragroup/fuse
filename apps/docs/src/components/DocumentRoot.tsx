import type { ReactElement, ReactNode } from "react";

import { themeAttributes } from "@elmeragroup/ui/theme";

import { DOCUMENT_THEME } from "../lib/theme";

export type DocumentRootProps = {
  children: ReactNode;
  lang?: string;
  suppressHydrationWarning?: boolean;
};

export function DocumentRoot({
  children,
  lang = "en",
  suppressHydrationWarning = false,
}: DocumentRootProps): ReactElement {
  return (
    <html
      lang={lang}
      {...themeAttributes(DOCUMENT_THEME)}
      suppressHydrationWarning={suppressHydrationWarning}>
      {children}
    </html>
  );
}
