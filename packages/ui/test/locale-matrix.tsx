import type { ReactNode } from "react";

import { ElmeraGroupUiProvider } from "../src/theme/elmera-group-ui";
import type { SupportedLocale } from "../src/theme/elmera-group-ui";

export const SUPPORTED_LOCALES = [
  "nb-NO",
  "sv-SE",
  "en-US",
  "fi-FI",
] as const satisfies readonly SupportedLocale[];

export function withLocale(locale: SupportedLocale, children: ReactNode) {
  return <ElmeraGroupUiProvider locale={locale}>{children}</ElmeraGroupUiProvider>;
}
