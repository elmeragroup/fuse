import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; without it every row reads the no-theme fallback.
import "../../../dist/themes.css";
import { checkboxNamed, RowTitle, settled, shellFrom } from "../../../test/selection-row";
import {
  cssVarColor,
  gradientStops,
  headingNamed,
  renderThemed,
  textNamed,
} from "../../../test/themed-browser-render";
import { CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Field } from "../field";
import { SelectionItem } from "./index";

describe("SelectionItem", () => {
  describe("disabled row", () => {
    it("shows the disabled row and its cursor when the shell is disabled or its custom control is natively, aria- or data-disabled", async () => {
      /** A custom control's row, with a SubSection whose passive parts toggle it. */
      const row = (name: string, control: ReactElement, isDisabled?: boolean) => (
        <Field.Root>
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            control={control}
            isSubSectionSelectable
            {...(isDisabled ? { isDisabled } : null)}>
            <RowTitle>{name}</RowTitle>
            <SelectionItem.SubSection>{`${name} details`}</SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      );
      // A host colour for the disabled label text, which no theme or page colour produces.
      renderThemed(
        <div style={{ "--selection-disabled-foreground": "#ff0000" }}>
          {row("Native control", <input type="checkbox" disabled />)}
          {row(
            "Aria control",
            <span role="checkbox" aria-checked="false" aria-disabled="true" tabIndex={0} />
          )}
          {row("Data control", <span role="checkbox" aria-checked="false" data-disabled="" tabIndex={0} />)}
          {row("Enabled control", <input type="checkbox" />)}
          {row("Shell-disabled control", <span role="checkbox" aria-checked="false" tabIndex={0} />, true)}
          {row(
            "Data false control",
            <span role="checkbox" aria-checked="false" data-disabled="false" tabIndex={0} />
          )}
        </div>
      );

      for (const [name, disabled] of [
        ["Native control", true],
        ["Aria control", true],
        ["Data control", true],
        ["Enabled control", false],
        ["Shell-disabled control", true],
        ["Data false control", false],
      ] as const) {
        const shell = shellFrom(name);
        await settled(shell);
        const style = getComputedStyle(shell);
        // Oracle: the neutral theme's own --muted for a disabled row and --card otherwise.
        expect(style.backgroundColor, name).toBe(cssVarColor(shell, disabled ? "--muted" : "--card"));
        if (disabled) {
          expect(style.backgroundImage, name).toMatch(/^repeating-linear-gradient\(45deg, /);
        } else {
          expect(style.backgroundImage, name).toBe("none");
        }
        // The label's `::before` is the row's click target, and the band takes its own clicks
        // here, so these two show the cursor a pointer meets.
        // The row label has no role; it wraps the title.
        const label = headingNamed(name).closest("label");
        if (!(label instanceof HTMLElement)) {
          throw new Error(`expected the label around ${name}`);
        }
        const title = getComputedStyle(headingNamed(name)).color;
        if (disabled) {
          expect(title, `${name} title colour`).toBe("rgb(255, 0, 0)");
        } else {
          expect(title, `${name} title colour`).not.toBe("rgb(255, 0, 0)");
        }
        const cursor = disabled ? "not-allowed" : "pointer";
        expect(getComputedStyle(label).cursor, `${name} label`).toBe(cursor);
        expect(getComputedStyle(textNamed(`${name} details`)).cursor, `${name} band`).toBe(cursor);
      }
    });

    it("fills a disabled row with the role over a background class", async () => {
      renderThemed(
        <CheckboxItemGroup label="Surface add-ons">
          <CheckboxItem value="router" isDisabled className="bg-background">
            <RowTitle>Surface router</RowTitle>
          </CheckboxItem>
          <CheckboxItem value="sim" className="bg-background">
            <RowTitle>Surface SIM card</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
      );

      const shell = shellFrom("Surface router");
      await settled(shell);
      // Oracle sanity: the page background differs from the disabled fill, --muted here.
      const background = cssVarColor(shell, "--background");
      expect(background).not.toBe(cssVarColor(shell, "--muted"));
      expect(getComputedStyle(shell).backgroundColor).toBe(cssVarColor(shell, "--muted"));
      // The class still replaces the card fill of an enabled row.
      expect(getComputedStyle(shellFrom("Surface SIM card")).backgroundColor).toBe(background);
    });

    it("fills a checked disabled row with a host's own disabled roles over the checked tint", async () => {
      renderThemed(
        <div
          style={{
            "--selection-disabled-background": "#ffeedd",
            "--selection-disabled-hatch": "oklch(0 0 0 / 0)",
            "--selection-disabled-foreground": "#ff0000",
          }}>
          <CheckboxItemGroup label="Host add-ons" defaultValue={["router"]}>
            <CheckboxItem value="router" isDisabled>
              <RowTitle>Host router</RowTitle>
            </CheckboxItem>
          </CheckboxItemGroup>
        </div>
      );

      const shell = shellFrom("Host router");
      await settled(shell);
      expect(checkboxNamed("Host router").getAttribute("aria-checked")).toBe("true");
      expect(getComputedStyle(shell).backgroundColor).toBe("rgb(255, 238, 221)");
      expect(getComputedStyle(headingNamed("Host router")).color).toBe("rgb(255, 0, 0)");
      expect(gradientStops(getComputedStyle(shell).backgroundImage).map(({ alpha }) => alpha)).toEqual([
        0, 0, 0, 0,
      ]);
    });
  });
});
