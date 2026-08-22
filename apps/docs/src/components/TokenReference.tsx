"use client";

import type { ReactElement } from "react";

import { ThemeScope } from "@elmeragroup/ui/theme";

import { COLOR_TOKENS } from "../generated/token-reference";
import { usePreviewTheme } from "./PreviewTheme";
import "./TokensConsumed.css";

/**
 * Every colour token the library's utilities resolve to, read at docs build from the
 * library's own `@theme` block rather than listed here. Swatches render inside a
 * `ThemeScope` on the header picker's theme, so the page shows real values for whichever
 * of the twenty themes is selected.
 */
export function TokenReference(): ReactElement {
  const { theme } = usePreviewTheme();

  return (
    <ThemeScope theme={theme} className="TokenList" render={<ul />}>
      {COLOR_TOKENS.map((token) => (
        <li key={token} className="TokenItem">
          <span className="TokenSwatch" style={{ background: `var(${token})` }} aria-hidden="true" />
          <code>{token}</code>
        </li>
      ))}
    </ThemeScope>
  );
}
