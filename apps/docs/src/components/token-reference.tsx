import type { ReactElement } from "react";

import { COLOR_TOKENS } from "../generated/token-reference";
import { TokenSwatchList } from "./token-swatch-list";

/**
 * Every colour token the library's utilities resolve to, read at docs build from the
 * library's own `@theme` block rather than listed here. Swatches render inside a
 * `ThemeScope` on the header picker's theme, so the page shows real values for whichever
 * of the twenty themes is selected.
 */
export function TokenReference(): ReactElement {
  return <TokenSwatchList tokens={COLOR_TOKENS.map((name) => ({ name, isColor: true }))} />;
}
