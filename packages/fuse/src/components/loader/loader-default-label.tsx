"use client";

import type { ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { loaderStrings } from "./intl";

/**
 * The dictionary's "Loading" as visually hidden text, for a Loader that has neither a `label` nor
 * an `aria-label`. It is package-private. Only the client knows the locale, through LocaleProvider,
 * so this child is the only client module in Loader, and Loader itself stays a server component.
 */
export function LoaderDefaultLabel(): ReactElement {
  const strings = useLocalizedStrings(loaderStrings);
  return <span className="sr-only">{strings.format("loading")}</span>;
}
