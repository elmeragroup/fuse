import type { ReactNode } from "react";

import { FuseProvider } from "../src/theme/fuse";
import type { SupportedLocale } from "../src/theme/fuse";

export const SUPPORTED_LOCALES = [
  "nb-NO",
  "sv-SE",
  "en-US",
  "fi-FI",
] as const satisfies readonly SupportedLocale[];

export function withLocale(locale: SupportedLocale, children: ReactNode) {
  return <FuseProvider locale={locale}>{children}</FuseProvider>;
}
