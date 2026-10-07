import type { ReactElement } from "react";

import { expect } from "vitest";

import { innerCornerShell } from "../src/styles/inner-corner";
import { ThemeScope } from "../src/theme/theme-scope";
import { render } from "./browser-render";
import { fkasExternal } from "./theme-fixtures";
import { px, roleNamed } from "./themed-browser-render";

/** An element's top-left corner radius in px, as Chromium computes it. */
export function cornerRadius(element: HTMLElement): number {
  return px(getComputedStyle(element).borderTopLeftRadius);
}

/** A ThemeScope that is also a menu shell, with one inner part directly inside it. */
function SameElementShell(): ReactElement {
  return (
    <ThemeScope theme={fkasExternal} className={innerCornerShell.menuPopup()}>
      <div role="group" aria-label="Scope row" className="rounded-inner" />
    </ThemeScope>
  );
}

/**
 * Render a shell on an element that carries theme attributes and check that the shell's
 * `--inner-corner` wins over the reset those attributes apply. The caller supplies the
 * stylesheet mode and the document theme.
 */
export function expectShellOnThemeElementWins(): void {
  render(<SameElementShell />);
  // fkas: rounded-md is 12px less one 2px step, 10px, and the padding is 4px.
  expect(cornerRadius(roleNamed("group", "Scope row"))).toBe(6);
}
