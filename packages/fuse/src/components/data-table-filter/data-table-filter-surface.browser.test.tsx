import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the bar's fills below read them per theme.
import "../../../dist/themes.css";
import { Orders, STATUS_THREE } from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import {
  cssVarColor,
  fkasExternal,
  fkasPrivate,
  guenExternal,
  renderThemed,
  roleNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";

describe("DataTableFilter bar surface", () => {
  it.each([
    ["fkas private external light", fkasExternal, "light"],
    ["guen external light", guenExternal, "light"],
    ["fkas private external dark", fkasExternal, "dark"],
    ["internal dark", fkasPrivate, "dark"],
  ] as const)("rests each chip in the fill of the Trigger beside it, %s", (_name, theme, scheme) => {
    // Unit under test: the chip's fill. Oracle: the Trigger, an outline Button, which sits beside
    // the chips in the same strip and rests on `card`. #423 moved the outline Button off the page
    // fill, which external light pages tint, so a chip left on the page fill no longer matched it.
    const scope = (
      <ThemeScope theme={theme}>
        <Orders initial={STATUS_THREE} />
      </ThemeScope>
    );
    renderThemed(withLocale("en-US", scheme === "dark" ? <div data-theme="dark">{scope}</div> : scope));
    const trigger = roleNamed("button", "Filter");
    const chip = document.querySelector<HTMLElement>('[data-slot="data-table-filter-chip"]');
    if (chip === null) {
      throw new Error("Expected a chip for the Status filter");
    }
    // Oracle sanity: the page fill differs from the Trigger's, so a chip on the page fill fails.
    expect(cssVarColor(chip, "--background")).not.toBe(getComputedStyle(trigger).backgroundColor);
    expect(getComputedStyle(chip).backgroundColor).toBe(getComputedStyle(trigger).backgroundColor);
  });
});
