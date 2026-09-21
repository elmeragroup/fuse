import type { ReactNode } from "react";

import { LocaleProvider } from "../src/intl/locale-context";
import type { SupportedLocale } from "../src/intl/locale-context";

export const SUPPORTED_LOCALES = [
  "nb-NO",
  "sv-SE",
  "en-US",
  "fi-FI",
] as const satisfies readonly SupportedLocale[];

export function withLocale(locale: SupportedLocale, children: ReactNode) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
