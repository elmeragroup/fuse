import type { ReactElement } from "react";

import { Checkbox } from "@base-ui/react/checkbox";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; without it every row reads the no-theme fallback.
import "../../../dist/themes.css";
import { checkboxNamed, RowTitle, settled, shellFrom } from "../../../test/selection-row";
import {
  cssVarColor,
  effectiveOpacity,
  fkasExternal,
  fkasPrivate,
  gradientStops,
  headingNamed,
  renderThemed,
  roleNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Checkbox as UiCheckbox, CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Field } from "../field";
import { RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";
import { SelectionItem } from "./index";

describe("SelectionItem", () => {
  describe("disabled row", () => {
    /**
     * One scheme's rows: row-level disabling in a vertical stack and in horizontal cards,
     * group-level disabling in both orientations, two standalone shells, and controls nested
     * in SubSections, enabled under a disabled row and disabled under an enabled one.
     */
    function DisabledRows({ scheme }: { scheme: string }) {
      const title = (row: string) => <RowTitle>{`${scheme} ${row}`}</RowTitle>;
      // The page's text colour, as a host's body sets it, so an enabled row's title reads
      // the foreground the test expects.
      return (
        <div style={{ color: "var(--foreground)" }}>
          <RadioItemGroup label={`${scheme} plan`} defaultValue="spot">
            <RadioItem value="fixed">{title("fixed")}</RadioItem>
            <RadioItem value="spot" isDisabled>
              {title("spot")}
            </RadioItem>
            <RadioItem value="hourly" isDisabled>
              {title("hourly")}
            </RadioItem>
          </RadioItemGroup>
          <CheckboxItemGroup
            label={`${scheme} add-ons`}
            orientation="horizontal"
            defaultValue={["router", "modem"]}>
            <CheckboxItem value="router" isDisabled>
              {title("router")}
            </CheckboxItem>
            <CheckboxItem value="sim" isDisabled>
              {title("SIM card")}
            </CheckboxItem>
            <CheckboxItem value="modem">{title("modem")}</CheckboxItem>
            <CheckboxItem value="tv">{title("TV")}</CheckboxItem>
          </CheckboxItemGroup>
          <CheckboxItemGroup label={`${scheme} terms`} isDisabled defaultValue={["terms"]}>
            <CheckboxItem value="terms">{title("terms")}</CheckboxItem>
            <CheckboxItem value="newsletter">{title("newsletter")}</CheckboxItem>
          </CheckboxItemGroup>
          <RadioItemGroup
            label={`${scheme} delivery`}
            orientation="horizontal"
            isDisabled
            defaultValue="post">
            <RadioItem value="post">{title("post")}</RadioItem>
            <RadioItem value="pickup">{title("pickup")}</RadioItem>
          </RadioItemGroup>
          <Field.Root>
            <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<UiCheckbox disabled />}>
              {title("standalone")}
            </SelectionItem.Shell>
          </Field.Root>
          <Field.Root>
            <SelectionItem.Shell
              dataSlot="checkbox-item"
              isDisabled
              control={<UiCheckbox disabled defaultChecked />}>
              {title("standalone checked")}
            </SelectionItem.Shell>
          </Field.Root>
          <CheckboxItemGroup label={`${scheme} bundles`}>
            <CheckboxItem value="bundle" isDisabled>
              {title("bundle")}
              <CheckboxItem.SubSection>
                <p>{`${scheme} bundle details`}</p>
                <CheckboxItemGroup label={`${scheme} bundle extras`}>
                  <CheckboxItem value="free">{title("free extra")}</CheckboxItem>
                </CheckboxItemGroup>
              </CheckboxItem.SubSection>
            </CheckboxItem>
            <CheckboxItem value="extras">
              {title("extras")}
              <CheckboxItem.SubSection>
                <p>{`${scheme} extras details`}</p>
                <CheckboxItemGroup label={`${scheme} extra options`}>
                  <CheckboxItem value="locked" isDisabled>
                    {title("locked extra")}
                  </CheckboxItem>
                </CheckboxItemGroup>
              </CheckboxItem.SubSection>
            </CheckboxItem>
          </CheckboxItemGroup>
          <CheckboxItemGroup label={`${scheme} plain rows`}>
            <CheckboxItem value="plain" isDisabled>{`${scheme} plain row`}</CheckboxItem>
            <CheckboxItem value="described" isDisabled>
              <SelectionItem.Content>
                {title("described")}
                <SelectionItem.Description>{`${scheme} described details`}</SelectionItem.Description>
              </SelectionItem.Content>
            </CheckboxItem>
          </CheckboxItemGroup>
        </div>
      );
    }

    // Each row by title suffix: its control, whether it is checked and disabled, and whether
    // it is a checked non-first row of a vertical stack, which pulls its top edge up one pixel.
    const DISABLED_ROWS = [
      { row: "fixed", control: "radio", checked: false, disabled: false, pulled: false },
      { row: "spot", control: "radio", checked: true, disabled: true, pulled: true },
      { row: "hourly", control: "radio", checked: false, disabled: true, pulled: false },
      { row: "router", control: "checkbox", checked: true, disabled: true, pulled: false },
      { row: "SIM card", control: "checkbox", checked: false, disabled: true, pulled: false },
      { row: "modem", control: "checkbox", checked: true, disabled: false, pulled: false },
      { row: "TV", control: "checkbox", checked: false, disabled: false, pulled: false },
      { row: "terms", control: "checkbox", checked: true, disabled: true, pulled: false },
      { row: "newsletter", control: "checkbox", checked: false, disabled: true, pulled: false },
      { row: "post", control: "radio", checked: true, disabled: true, pulled: false },
      { row: "pickup", control: "radio", checked: false, disabled: true, pulled: false },
      { row: "standalone", control: "checkbox", checked: false, disabled: true, pulled: false },
      { row: "standalone checked", control: "checkbox", checked: true, disabled: true, pulled: false },
      { row: "bundle", control: "checkbox", checked: false, disabled: true, pulled: false },
      { row: "free extra", control: "checkbox", checked: false, disabled: false, pulled: false },
      { row: "extras", control: "checkbox", checked: false, disabled: false, pulled: false },
      { row: "locked extra", control: "checkbox", checked: false, disabled: true, pulled: false },
    ] as const;

    /**
     * Checks every fixture row of one scheme. A disabled row fills with `fill`, the role read
     * where it sits, under stripes of `stripeAlpha` black; an enabled one keeps the card or,
     * checked, the muted fill and no image. A disabled row's label text takes `text`, an
     * enabled row's the foreground. A disabled row's control paints at its own 50%, and the
     * row's title, and any sub-section content, keep full strength.
     */
    async function expectRows(
      scheme: string,
      fill: "--muted" | "--card",
      stripeAlpha: number,
      text: "--foreground" | "--muted-foreground"
    ) {
      for (const { row, control, checked, disabled, pulled } of DISABLED_ROWS) {
        const name = `${scheme} ${row}`;
        // An enabled row's title, a nested one included, keeps the foreground.
        const title = cssVarColor(shellFrom(name), disabled ? text : "--foreground");
        expect(getComputedStyle(headingNamed(name)).color, `${name} title colour`).toBe(title);
        const shell = shellFrom(name);
        await settled(shell);
        const box = roleNamed(control, name);
        expect(box.getAttribute("aria-checked"), name).toBe(String(checked));
        expect(box.hasAttribute("data-disabled"), name).toBe(disabled);
        const style = getComputedStyle(shell);
        const stops = gradientStops(style.backgroundImage);
        if (disabled) {
          expect(style.backgroundColor, name).toBe(cssVarColor(shell, fill));
          expect(style.backgroundImage, name).toMatch(/^repeating-linear-gradient\(45deg, /);
          // Two transparent bands, then two stops of the stripe colour.
          expect(
            stops.map(({ alpha }) => alpha),
            name
          ).toEqual([0, 0, stripeAlpha, stripeAlpha]);
          expect(
            stops.slice(2).map(({ r, g, b }) => [r, g, b]),
            name
          ).toEqual([
            [0, 0, 0],
            [0, 0, 0],
          ]);
          expect(style.cursor, name).toBe("not-allowed");
        } else {
          expect(style.backgroundColor, name).toBe(cssVarColor(shell, checked ? "--muted" : "--card"));
          expect(style.backgroundImage, name).toBe("none");
        }
        expect(effectiveOpacity(headingNamed(name)), `${name} title`).toBe(1);
        expect(effectiveOpacity(box), `${name} control`).toBeCloseTo(disabled ? 0.5 : 1, 5);
        // The checked border, the joins and the pull-up are the checked row's own.
        expect(style.marginTop, name).toBe(pulled ? "-1px" : "0px");
      }
      // A plain-text row's text greys like a title.
      const plain = textNamed(`${scheme} plain row`);
      expect(getComputedStyle(plain).color, `${scheme} plain row`).toBe(cssVarColor(plain, text));
      // A description keeps its own muted text.
      const described = textNamed(`${scheme} described details`);
      expect(getComputedStyle(described).color, `${scheme} description`).toBe(
        cssVarColor(described, "--muted-foreground")
      );
      // A disabled row's SubSection content matches an enabled row's.
      expect(getComputedStyle(textNamed(`${scheme} bundle details`)).color, `${scheme} SubSection`).toBe(
        getComputedStyle(textNamed(`${scheme} extras details`)).color
      );
    }

    it("keeps the card fill without stripes and greys the label text in external themes, at row and group level, in light and dark", async () => {
      renderThemed(
        <>
          <ThemeScope theme={fkasExternal}>
            <DisabledRows scheme="Light" />
          </ThemeScope>
          <div data-theme="dark">
            <ThemeScope theme={fkasExternal}>
              <DisabledRows scheme="Dark" />
            </ThemeScope>
          </div>
        </>
      );

      for (const scheme of ["Light", "Dark"]) {
        const shell = shellFrom(`${scheme} spot`);
        // Oracle sanity: the card differs from the checked row's muted tint, so a checked
        // disabled row that kept `bg-muted` fails, and the schemes differ from each other.
        expect(cssVarColor(shell, "--card"), scheme).not.toBe(cssVarColor(shell, "--muted"));
        // Oracle sanity: the muted foreground differs from the foreground, so an ungreyed
        // title fails.
        expect(cssVarColor(shell, "--muted-foreground"), scheme).not.toBe(cssVarColor(shell, "--foreground"));
        await expectRows(scheme, "--card", 0, "--muted-foreground");
        // The disabled fill leaves the dividers: the checked disabled row between "fixed" and
        // "hourly" draws the grey line above and below it, and the last row no line.
        const spot = shellFrom(`${scheme} spot`);
        const border = cssVarColor(spot, "--border");
        expect(getComputedStyle(spot).borderTopColor, `${scheme} spot top`).toBe(border);
        expect(getComputedStyle(spot).borderBottomColor, `${scheme} spot bottom`).toBe(border);
        expect(
          getComputedStyle(shellFrom(`${scheme} hourly`)).borderBottomColor,
          `${scheme} hourly bottom`
        ).toBe("oklch(0 0 0 / 0)");
      }
      expect(cssVarColor(shellFrom("Dark fixed"), "--card")).not.toBe(
        cssVarColor(shellFrom("Light fixed"), "--card")
      );
    });

    it("keeps the muted fill under black stripes at 2% and the foreground text in internal themes, at row and group level, in light and dark", async () => {
      renderThemed(
        <>
          <DisabledRows scheme="Light" />
          <div data-theme="dark">
            <ThemeScope theme={fkasPrivate}>
              <DisabledRows scheme="Dark" />
            </ThemeScope>
          </div>
        </>
      );

      for (const scheme of ["Light", "Dark"]) {
        await expectRows(scheme, "--muted", 0.02, "--foreground");
        // A checked disabled row keeps the primary box of an internal row, dividers included.
        const spot = shellFrom(`${scheme} spot`);
        expect(getComputedStyle(spot).borderTopColor, scheme).toBe(cssVarColor(spot, "--primary"));
        expect(getComputedStyle(spot).borderBottomColor, scheme).toBe(cssVarColor(spot, "--primary"));
      }
      expect(cssVarColor(shellFrom("Dark fixed"), "--muted")).not.toBe(
        cssVarColor(shellFrom("Light fixed"), "--muted")
      );
    });

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
        // Oracle: the internal theme's own --muted for a disabled row and --card otherwise.
        expect(style.backgroundColor, name).toBe(cssVarColor(shell, disabled ? "--muted" : "--card"));
        if (disabled) {
          expect(style.backgroundImage, name).toMatch(/^repeating-linear-gradient\(45deg, /);
        } else {
          expect(style.backgroundImage, name).toBe("none");
        }
        // The label's `::before` is the row's click target, and the band takes its own clicks
        // here, so these two show the cursor a pointer meets.
        // DOM audit: the row label has no role; it wraps the title.
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

  describe("row edge", () => {
    /**
     * Vertical stacks, each named by where its checked rows sit: three radio rows with the first,
     * the middle or the last checked, and four checkbox rows with the two middle ones checked.
     */
    const STACKS = [
      { stack: "first", control: "radio", rows: 3, checked: [0] },
      { stack: "middle", control: "radio", rows: 3, checked: [1] },
      { stack: "last", control: "radio", rows: 3, checked: [2] },
      { stack: "adjacent", control: "checkbox", rows: 4, checked: [1, 2] },
    ] as const;

    /**
     * Rows that join no other row: a horizontal group's cards, a group of one, and a shell outside
     * any group with a Field.Description after it, which is a sibling but not a row.
     */
    const LONE_ROWS = [
      { row: "router", control: "checkbox", checked: true },
      { row: "SIM card", control: "checkbox", checked: false },
      { row: "terms", control: "checkbox", checked: true },
      { row: "post", control: "radio", checked: false },
      { row: "standalone checked", control: "checkbox", checked: true },
      { row: "standalone unchecked", control: "checkbox", checked: false },
    ] as const;

    type StackRow = {
      name: string;
      control: "radio" | "checkbox";
      checked: boolean;
      first: boolean;
      last: boolean;
    };

    function stackRows(scheme: string): StackRow[] {
      return STACKS.flatMap(({ stack, control, rows, checked }) =>
        Array.from({ length: rows }, (_, index) => ({
          name: `${scheme} ${stack} ${index + 1}`,
          control,
          checked: checked.some((value) => value === index),
          first: index === 0,
          last: index === rows - 1,
        }))
      );
    }

    function EdgeRows({ scheme }: { scheme: string }) {
      return (
        <>
          {STACKS.map(({ stack, control, rows, checked }) => {
            const values = Array.from({ length: rows }, (_, index) => `${stack}-${index + 1}`);
            const items = values.map((value, index) => {
              const title = <RowTitle>{`${scheme} ${stack} ${index + 1}`}</RowTitle>;
              return control === "radio" ? (
                <RadioItem key={value} value={value}>
                  {title}
                </RadioItem>
              ) : (
                <CheckboxItem key={value} value={value}>
                  {title}
                </CheckboxItem>
              );
            });
            const label = `${scheme} ${stack} stack`;
            return control === "radio" ? (
              <RadioItemGroup key={stack} label={label} defaultValue={values[checked[0]]}>
                {items}
              </RadioItemGroup>
            ) : (
              <CheckboxItemGroup
                key={stack}
                label={label}
                defaultValue={checked.map((index) => values[index] ?? "")}>
                {items}
              </CheckboxItemGroup>
            );
          })}
          <CheckboxItemGroup label={`${scheme} add-ons`} orientation="horizontal" defaultValue={["router"]}>
            <CheckboxItem value="router">
              <RowTitle>{`${scheme} router`}</RowTitle>
            </CheckboxItem>
            <CheckboxItem value="sim">
              <RowTitle>{`${scheme} SIM card`}</RowTitle>
            </CheckboxItem>
          </CheckboxItemGroup>
          <CheckboxItemGroup label={`${scheme} terms`} defaultValue={["terms"]}>
            <CheckboxItem value="terms">
              <RowTitle>{`${scheme} terms`}</RowTitle>
            </CheckboxItem>
          </CheckboxItemGroup>
          <RadioItemGroup label={`${scheme} delivery`}>
            <RadioItem value="post">
              <RowTitle>{`${scheme} post`}</RowTitle>
            </RadioItem>
          </RadioItemGroup>
          {[true, false].map((checked) => (
            <Field.Root key={String(checked)}>
              <SelectionItem.Shell
                dataSlot="checkbox-item"
                control={<Checkbox.Root defaultChecked={checked} />}>
                <RowTitle>{`${scheme} standalone ${checked ? "checked" : "unchecked"}`}</RowTitle>
              </SelectionItem.Shell>
              <Field.Description>We send the contract by email.</Field.Description>
            </Field.Root>
          ))}
        </>
      );
    }

    const SIDES = ["top", "right", "bottom", "left"] as const;

    /** The alpha of a colour Chromium computed. */
    function alphaOf(serialized: string): number {
      return getOrThrow(CssColor.parse(serialized)).alpha;
    }

    /** The row's shell, settled, after checking its control's state matches the fixture. */
    async function settledShell(name: string, control: "radio" | "checkbox", checked: boolean) {
      const shell = shellFrom(name);
      await settled(shell);
      expect(roleNamed(control, name).getAttribute("aria-checked"), name).toBe(String(checked));
      return getComputedStyle(shell);
    }

    it("divides external stacked rows in the border colour and draws no outer edge, in light and dark", async () => {
      renderThemed(
        <>
          <ThemeScope theme={fkasExternal}>
            <EdgeRows scheme="Light" />
          </ThemeScope>
          <div data-theme="dark">
            <ThemeScope theme={fkasExternal}>
              <EdgeRows scheme="Dark" />
            </ThemeScope>
          </div>
        </>
      );

      for (const scheme of ["Light", "Dark"]) {
        // Oracle: the theme's own `--border`, read where the rows sit. It is opaque, so a
        // transparent divider fails, and so does an outer edge drawn in it.
        const border = cssVarColor(shellFrom(`${scheme} first 1`), "--border");
        expect(alphaOf(border), scheme).toBe(1);
        for (const { name, control, checked, first, last } of stackRows(scheme)) {
          const style = await settledShell(name, control, checked);
          expect(alphaOf(style.borderLeftColor), name).toBe(0);
          expect(alphaOf(style.borderRightColor), name).toBe(0);
          if (first) {
            expect(alphaOf(style.borderTopColor), name).toBe(0);
          }
          if (last) {
            expect(alphaOf(style.borderBottomColor), name).toBe(0);
          } else {
            expect(style.borderBottomColor, name).toBe(border);
          }
          if (!first && checked) {
            // A checked row pulls up over the row above's bottom and draws that join itself.
            expect(style.borderTopColor, name).toBe(border);
            expect(style.borderTopWidth, name).toBe("1px");
            expect(style.marginTop, name).toBe("-1px");
          } else if (!first) {
            expect(style.borderTopWidth, name).toBe("0px");
          }
          // The 1px geometry stays: the joins and the insets.
          expect(style.borderLeftWidth, name).toBe("1px");
        }
        for (const { row, control, checked } of LONE_ROWS) {
          const name = `${scheme} ${row}`;
          const style = await settledShell(name, control, checked);
          for (const side of SIDES) {
            expect(alphaOf(style.getPropertyValue(`border-${side}-color`)), `${name} ${side}`).toBe(0);
          }
          expect(style.borderTopWidth, name).toBe("1px");
          expect(style.marginTop, name).toBe("0px");
        }
      }
      // The fixture rendered both schemes: light and dark resolve different borders.
      expect(cssVarColor(shellFrom("Dark first 1"), "--border")).not.toBe(
        cssVarColor(shellFrom("Light first 1"), "--border")
      );
    });

    it("keeps the border-role edge and divider and the primary box around checked internal rows", async () => {
      renderThemed(
        <ThemeScope theme={fkasPrivate}>
          <EdgeRows scheme="Internal" />
        </ThemeScope>
      );

      const rows = [
        ...stackRows("Internal"),
        ...LONE_ROWS.map(({ row, control, checked }) => ({ name: `Internal ${row}`, control, checked })),
      ];
      for (const { name, control, checked } of rows) {
        const style = await settledShell(name, control, checked);
        // Oracle: the theme's own `--border` at rest and `--primary` when checked, read where
        // the row sits, on every side the row draws.
        const edge = cssVarColor(shellFrom(name), checked ? "--primary" : "--border");
        for (const side of SIDES) {
          if (style.getPropertyValue(`border-${side}-width`) !== "0px") {
            expect(style.getPropertyValue(`border-${side}-color`), `${name} ${side}`).toBe(edge);
          }
        }
      }
      // A checked row in the middle of a stack is boxed on all four sides.
      const middle = await settledShell("Internal middle 2", "radio", true);
      const primary = cssVarColor(shellFrom("Internal middle 2"), "--primary");
      expect([
        middle.borderTopColor,
        middle.borderRightColor,
        middle.borderBottomColor,
        middle.borderLeftColor,
      ]).toEqual([primary, primary, primary, primary]);
      expect(middle.borderTopWidth).toBe("1px");
    });
  });
});
