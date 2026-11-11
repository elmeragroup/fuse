import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { Checkbox } from "@base-ui/react/checkbox";
import type { BaseUIEvent } from "@base-ui/react/types";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill test reads --card and --background.
import "../../../dist/themes.css";
import { checkboxNamed, RowTitle, settled, shellFrom } from "../../../test/selection-row";
import {
  cssVarColor,
  fkasBranded,
  headingNamed,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
  gradientStops,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { CheckboxGroup, CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Field } from "../field";
import { Item } from "../item";
import { Radio, RadioGroup, RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";
import { SelectionItem } from "./index";

describe("SelectionItem", () => {
  describe("isSubSectionSelectable", () => {
    function SelectablePlan({ isSubSectionSelectable }: { isSubSectionSelectable?: boolean }) {
      return (
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed" isSubSectionSelectable={isSubSectionSelectable}>
            <RowTitle>Fixed price</RowTitle>
            <CheckboxItem.SubSection role="region" aria-label="Price details">
              <p>Locked for twelve months.</p>
              <a href="#price-terms">Price terms</a>
            </CheckboxItem.SubSection>
          </CheckboxItem>
        </CheckboxItemGroup>
      );
    }

    it("leaves the SubSection's text outside the click target by default", async () => {
      renderThemed(<SelectablePlan />);

      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");
    });

    it("does not toggle on a click that ends a text selection", () => {
      renderThemed(<SelectablePlan isSubSectionSelectable />);

      const text = textNamed("Locked for twelve months.");
      const selection = window.getSelection();
      selection?.selectAllChildren(text);
      expect(selection?.isCollapsed).toBe(false);
      // A drag that selects text ends in a click on the text, with the selection still made.
      text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");

      selection?.removeAllRanges();
      text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
    });

    it("toggles while text outside the row stays selected", async () => {
      renderThemed(
        <>
          <p>Compare the plans below.</p>
          <SelectablePlan isSubSectionSelectable />
        </>
      );

      const selection = window.getSelection();
      selection?.selectAllChildren(textNamed("Compare the plans below."));
      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
      selection?.removeAllRanges();
    });

    it("selects and focuses a RadioItem from its SubSection's text, so the arrow keys carry on", async () => {
      renderThemed(
        <RadioItemGroup label="Plans">
          <RadioItem value="fixed" isSubSectionSelectable>
            <RowTitle>Fixed price</RowTitle>
            <RadioItem.SubSection>Locked for twelve months.</RadioItem.SubSection>
          </RadioItem>
          <RadioItem value="spot" isSubSectionSelectable>
            <RowTitle>Spot price</RowTitle>
            <RadioItem.SubSection>Follows the market.</RadioItem.SubSection>
          </RadioItem>
        </RadioItemGroup>
      );

      await userEvent.click(textNamed("Locked for twelve months."));
      const fixed = roleNamed("radio", "Fixed price");
      expect(fixed.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(fixed);
      await userEvent.keyboard("{ArrowDown}");
      expect(roleNamed("radio", "Spot price").getAttribute("aria-checked")).toBe("true");
    });

    it("focuses a CheckboxItem's control from its SubSection's text, so Space toggles it back", async () => {
      renderThemed(<SelectablePlan isSubSectionSelectable />);

      await userEvent.click(textNamed("Locked for twelve months."));
      const checkbox = checkboxNamed("Fixed price");
      expect(checkbox.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(checkbox);
      await userEvent.keyboard(" ");
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    });

    it("shows the label row's cursor over the SubSection, and not-allowed while disabled", () => {
      renderThemed(
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed" isSubSectionSelectable>
            <RowTitle>Fixed price</RowTitle>
            <CheckboxItem.SubSection>Locked for twelve months.</CheckboxItem.SubSection>
          </CheckboxItem>
          <CheckboxItem value="variable" isSubSectionSelectable isDisabled>
            <RowTitle>Variable price</RowTitle>
            <CheckboxItem.SubSection>Follows the market.</CheckboxItem.SubSection>
          </CheckboxItem>
        </CheckboxItemGroup>
      );

      expect(getComputedStyle(textNamed("Locked for twelve months.")).cursor).toBe(
        getComputedStyle(headingNamed("Fixed price")).cursor
      );
      expect(getComputedStyle(headingNamed("Fixed price")).cursor).toBe("pointer");
      expect(getComputedStyle(textNamed("Follows the market.")).cursor).toBe("not-allowed");
    });

    it("toggles from the SubSection's text, band and side padding, and leaves a link's click its own", async () => {
      renderThemed(<SelectablePlan isSubSectionSelectable />);

      const shell = shellFrom("Fixed price");
      const checkbox = checkboxNamed("Fixed price");
      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkbox.getAttribute("aria-checked"), "SubSection text").toBe("true");

      // The band's bottom inset, below the SubSection's content.
      const bottom = shell.getBoundingClientRect().bottom - shell.clientTop;
      await clickShellAt(shell, (width) => width / 2, bottom - 7);
      expect(checkbox.getAttribute("aria-checked"), "band padding").toBe("false");

      const details = roleNamed("region", "Price details").getBoundingClientRect();
      await clickShellAt(shell, () => 4, details.top + details.height / 2);
      expect(checkbox.getAttribute("aria-checked"), "side padding beside the SubSection").toBe("true");

      await userEvent.click(roleNamed("link", "Price terms"));
      expect(checkbox.getAttribute("aria-checked"), "link").toBe("true");
      // The name stays the label row's: the SubSection's text does not join it.
      expect(page.getByRole("checkbox", { name: "Fixed price", exact: true }).query()).toBe(checkbox);
    });

    it("sends one click through the row and its ancestors per SubSection click", async () => {
      const rowClicks: string[] = [];
      const ancestorClicks: string[] = [];
      renderThemed(
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- counts bubbling clicks only
        <div onClick={() => ancestorClicks.push("click")}>
          <Field.Root>
            <SelectionItem.Shell
              dataSlot="checkbox-item"
              control={<Checkbox.Root />}
              isSubSectionSelectable
              onClick={() => rowClicks.push("click")}>
              <RowTitle>Fixed price</RowTitle>
              <SelectionItem.SubSection>Locked for twelve months.</SelectionItem.SubSection>
            </SelectionItem.Shell>
          </Field.Root>
        </div>
      );

      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
      expect(rowClicks).toEqual(["click"]);
      expect(ancestorClicks).toEqual(["click"]);
    });

    it("runs a consumer's click handler first and skips the toggle when it prevents it", async () => {
      const clicks: boolean[] = [];
      function onClick(event: BaseUIEvent<ReactMouseEvent<HTMLDivElement>>): void {
        clicks.push(true);
        if (clicks.length === 1) {
          event.preventDefault();
        }
        if (clicks.length === 2) {
          event.preventBaseUIHandler();
        }
      }
      renderThemed(
        <Field.Root>
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            control={<Checkbox.Root />}
            isSubSectionSelectable
            onClick={onClick}>
            <RowTitle>Fixed price</RowTitle>
            <SelectionItem.SubSection>Locked for twelve months.</SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      );

      await userEvent.click(textNamed("Locked for twelve months."));
      expect(clicks).toEqual([true]);
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked"), "preventDefault").toBe("false");
      await userEvent.click(textNamed("Locked for twelve months."));
      expect(clicks).toEqual([true, true]);
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked"), "preventBaseUIHandler").toBe("false");
      await userEvent.click(textNamed("Locked for twelve months."));
      expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("true");
    });
  });

  it("does not toggle a disabled control on row click and shows the not-allowed cursor", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Checkbox.Root disabled />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price");
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(getComputedStyle(shellFrom("Fixed price")).cursor).toBe("not-allowed");

    headingNamed("Fixed price").click();
    expect(checkboxNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
  });

  it("does not paint checked shell state from a checked selection row nested in SubSection", async () => {
    /** Three unchecked rows; the middle one's SubSection holds a checked selection row. */
    const Rows = ({ prefix }: { prefix: string }) => (
      <CheckboxItemGroup label={`${prefix}Plans`}>
        <CheckboxItem value="basic">
          <RowTitle>{`${prefix}Basic`}</RowTitle>
        </CheckboxItem>
        <CheckboxItem value="bundle">
          <RowTitle>{`${prefix}Bundle`}</RowTitle>
          <CheckboxItem.SubSection>
            <CheckboxItemGroup label={`${prefix}Bundle extras`} defaultValue={["router"]}>
              <CheckboxItem value="router">
                <RowTitle>{`${prefix}Router`}</RowTitle>
              </CheckboxItem>
            </CheckboxItemGroup>
          </CheckboxItem.SubSection>
        </CheckboxItem>
        <CheckboxItem value="support">
          <RowTitle>{`${prefix}Support`}</RowTitle>
        </CheckboxItem>
      </CheckboxItemGroup>
    );
    renderThemed(
      <>
        <Rows prefix="" />
        <ThemeScope theme={fkasBranded}>
          <Rows prefix="Branded " />
        </ThemeScope>
      </>
    );

    const shell = shellFrom("Bundle");
    await settled(shell);
    expect(checkboxNamed("Bundle").getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Router").getAttribute("aria-checked")).toBe("true");
    // Oracle sanity: a checked repaint would change each colour asserted below.
    expect(cssVarColor(shell, "--primary")).not.toBe(cssVarColor(shell, "--border"));
    expect(cssVarColor(shell, "--muted")).not.toBe(cssVarColor(shell, "--card"));
    const style = getComputedStyle(shell);
    expect(style.backgroundColor).toBe(cssVarColor(shell, "--card"));
    expect(style.borderBottomColor).toBe(cssVarColor(shell, "--border"));
    expect(style.marginTop).toBe("0px");
    expect(style.borderTopWidth).toBe("0px");

    const branded = shellFrom("Branded Bundle");
    await settled(branded);
    expect(checkboxNamed("Branded Bundle").getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Branded Router").getAttribute("aria-checked")).toBe("true");
    expect(cssVarColor(branded, "--muted")).not.toBe(cssVarColor(branded, "--card"));
    expect(getComputedStyle(branded).backgroundColor).toBe(cssVarColor(branded, "--card"));
    expect(getComputedStyle(branded).marginTop).toBe("0px");
  });

  it.each([
    { item: "CheckboxItem", role: "checkbox", slot: "checkbox-item" },
    { item: "RadioItem", role: "radio", slot: "radio-item" },
  ] as const)(
    "puts root attributes on a $item's row and keeps its own data-slot and list role",
    async ({ role, slot }) => {
      const rowProps = {
        "data-testid": "plan-fixed",
        id: "plan-fixed-row",
        "data-analytics": "plan",
        // The item's own slot names the row; a consumer's does not replace it.
        "data-slot": "consumer-slot",
        // An undefined prop leaves the card list's wiring in place.
        role: undefined,
      };
      renderThemed(
        role === "checkbox" ? (
          <CheckboxItemGroup label="Plans">
            <CheckboxItem value="fixed" {...rowProps}>
              <RowTitle>Fixed price</RowTitle>
            </CheckboxItem>
          </CheckboxItemGroup>
        ) : (
          <RadioItemGroup label="Plans">
            <RadioItem value="fixed" {...rowProps}>
              <RowTitle>Fixed price</RowTitle>
            </RadioItem>
          </RadioItemGroup>
        )
      );

      const row = page.getByTestId("plan-fixed");
      expect(row.element()).toBe(shellFrom("Fixed price"));
      expect(row.element().id).toBe("plan-fixed-row");
      expect(row.element().getAttribute("data-analytics")).toBe("plan");
      expect(row.element().getAttribute("data-slot")).toBe(slot);
      expect(row.element().getAttribute("role")).toBe("listitem");
      await userEvent.click(row.getByRole(role));
      expect(roleNamed(role, "Fixed price").getAttribute("aria-checked")).toBe("true");
    }
  );

  it("toggles from row text and isolates subsection clicks", async () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <SelectionItem.Content>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Content>
          <SelectionItem.SubSection>
            <button type="button">Details</button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();

    await userEvent.click(headingNamed("Fixed price"));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });

  it("renders passed and direct sub-sections outside the label, passed first, without key collisions", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderThemed(
        <Field.Root>
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            control={<Checkbox.Root />}
            subSections={
              <SelectionItem.SubSection>
                <button type="button">Passed details</button>
              </SelectionItem.SubSection>
            }>
            <SelectionItem.SubSection>
              <button type="button">Direct details</button>
            </SelectionItem.SubSection>
            <SelectionItem.Content>
              <RowTitle>Fixed price</RowTitle>
            </SelectionItem.Content>
          </SelectionItem.Shell>
        </Field.Root>
      );

      const passed = page.getByRole("button", { name: "Passed details", exact: true }).element();
      const direct = page.getByRole("button", { name: "Direct details", exact: true }).element();
      expect(passed.closest("label")).toBeNull();
      expect(direct.closest("label")).toBeNull();
      expect(passed.compareDocumentPosition(direct)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      const keyWarnings = error.mock.calls.filter((args) =>
        args.some((arg) => String(arg).includes("same key"))
      );
      expect(keyWarnings).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it("keeps a passed SubSection's button clickable when a wrapper element surrounds it", async () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell
          dataSlot="checkbox-item"
          control={<Checkbox.Root />}
          subSections={
            <div>
              <SelectionItem.SubSection>
                <PressCounter />
              </SelectionItem.SubSection>
            </div>
          }>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    await userEvent.click(roleNamed("button", "Pressed 0 times"));
    expect(roleNamed("button", "Pressed 1 times")).toBeTruthy();
    expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");
  });

  it("keeps a Fragment-wrapped SubSection inside the label", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <>
            <SelectionItem.SubSection>
              <button type="button">Inside fragment</button>
            </SelectionItem.SubSection>
          </>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const button = page.getByRole("button", { name: "Inside fragment", exact: true }).element();
    expect(button.closest("label")).not.toBeNull();
    button.closest("label")?.click();
    const box = page.getByRole("checkbox", { checked: true }).element();
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("passes mode through to Item.Footer: hidden renders the band inert, visible does not", () => {
    // The focus choreography behind `inert` is Item.Footer's, covered in item.browser.test.tsx.
    const { rerender } = renderThemed(<SubSectionTree mode="hidden" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(true);

    rerender(<SubSectionTree mode="visible" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(false);
  });
});

describe("selection row type", () => {
  // Alert's title and description follow density through the label text; alert.browser.test.tsx
  // covers them.
  it("leaves Item titles and descriptions at text-sm when comfortable", () => {
    stampDensity("comfortable");
    renderThemed(
      <Item.Root>
        <Item.Content>
          <Item.Title>Item title</Item.Title>
          <Item.Description>Item description</Item.Description>
        </Item.Content>
      </Item.Root>
    );

    for (const text of ["Item title", "Item description"]) {
      expect(Number.parseFloat(getComputedStyle(textNamed(text)).fontSize), text).toBe(14);
    }
  });
});

describe("selection group names", () => {
  it("gives every member control an accessible name in both the plain and card shapes", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Plain checks" description="Pick some" errorMessage="Check error">
          <CheckboxItem value="a">Plain check</CheckboxItem>
        </CheckboxGroup>
        <CheckboxItemGroup label="Card checks" description="Pick some" errorMessage="Card check error">
          <CheckboxItem value="a">
            <RowTitle>Card check</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioGroup label="Plain radios" description="Pick one" errorMessage="Radio error">
          <Radio value="a">Plain radio</Radio>
        </RadioGroup>
        <RadioItemGroup label="Card radios" description="Pick one" errorMessage="Card radio error">
          <RadioItem value="a">
            <RowTitle>Card radio</RowTitle>
          </RadioItem>
        </RadioItemGroup>
      </>
    );

    // Every control is named, including inside cards: a nested Field.Root
    // would leave these blank.
    for (const name of ["Plain check", "Card check"]) {
      expect(checkboxNamed(name)).toBeTruthy();
    }
    for (const name of ["Plain radio", "Card radio"]) {
      expect(roleNamed("radio", name)).toBeTruthy();
    }
    // The groups keep their legend name, and each frame renders exactly one alert.
    for (const name of ["Plain checks", "Card checks"]) {
      expect(page.getByRole("group", { name, exact: true }).elements().length).toBeGreaterThan(0);
    }
    for (const name of ["Plain radios", "Card radios"]) {
      expect(page.getByRole("radiogroup", { name, exact: true }).element()).toBeTruthy();
    }
    expect(
      page
        .getByRole("alert")
        .elements()
        .map((element) => element.textContent)
    ).toEqual(["Check error", "Card check error", "Radio error", "Card radio error"]);
  });
});

function subsectionHost(from: HTMLElement): HTMLElement {
  const host = from.closest("[data-mode], [aria-hidden='true']");
  if (!(host instanceof HTMLElement)) {
    throw new Error("expected a subsection host");
  }
  return host;
}

function nestedSubsectionButton(label: string): HTMLElement {
  const button = subsectionHost(textNamed(label)).querySelector("button");
  if (!(button instanceof HTMLElement)) {
    throw new Error(`expected a button inside the ${label} subsection`);
  }
  return button;
}

function SubSectionTree({ mode }: { mode: "hidden" | "visible" | "default" }) {
  return (
    <>
      <button type="button">Before</button>
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<span role="img" aria-label="Indicator" />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection mode={mode}>
            <button type="button">Hidden details</button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
      <button type="button">After</button>
    </>
  );
}

/**
 * Click the shell at `x(width)` from the left of its padding box, where `width` is the
 * padding box's width, and at viewport `y`. Playwright measures `position` from the
 * padding box, inside the border.
 */
async function clickShellAt(shell: HTMLElement, x: (width: number) => number, y: number): Promise<void> {
  const top = shell.getBoundingClientRect().top + shell.clientTop;
  await userEvent.click(shell, { position: { x: x(shell.clientWidth), y: y - top } });
}

function PressCounter() {
  const [presses, setPresses] = useState(0);
  return (
    <button type="button" onClick={() => setPresses((count) => count + 1)}>
      {`Pressed ${presses} times`}
    </button>
  );
}

describe("SelectionItem role tokens", () => {
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
