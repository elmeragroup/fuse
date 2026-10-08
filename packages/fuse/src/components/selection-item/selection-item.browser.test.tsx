import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { Checkbox } from "@base-ui/react/checkbox";
import type { BaseUIEvent } from "@base-ui/react/types";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill test reads --card and --background.
import "../../../dist/themes.css";
import { focusRingClippers } from "../../../test/assert-focus-ring";
import { assertHorizontalItemList, radiusToken } from "../../../test/assert-selection-item-group-layout";
import {
  cssVarColor,
  fkasExternal,
  headingNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { disabledHatch } from "../../styles/utils";
import { ThemeScope } from "../../theme";
import { Alert } from "../alert/alert";
import { CheckboxCard } from "../checkbox-card/checkbox-card";
import { Checkbox as UiCheckbox, CheckboxGroup, CheckboxItemGroup } from "../checkbox/checkbox";
import { CheckboxItem } from "../checkbox/checkbox-item";
import { Field } from "../field";
import { Item } from "../item";
import { Radio, RadioGroup, RadioItemGroup } from "../radio-group/radio-group";
import { RadioItem } from "../radio-group/radio-item";
import { SelectionItem } from "./index";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function shellFrom(name: string): HTMLElement {
  const heading = headingNamed(name);
  const shell = heading.closest("[data-selection-item]");
  if (shell instanceof HTMLElement) {
    return shell;
  }
  const article = heading.closest("article");
  if (article instanceof HTMLElement) {
    return article;
  }
  throw new Error(`expected checkbox-item shell around ${name}`);
}

function controlSlot(shell: HTMLElement): HTMLElement {
  const control = [
    ...page.getByRole("checkbox").elements(),
    ...page.getByRole("radio").elements(),
    ...page.getByRole("img").elements(),
  ].find((element) => shell.contains(element));
  const media = control?.parentElement;
  if (!(media instanceof HTMLElement)) {
    throw new Error("expected selection-item-control slot");
  }
  return media;
}

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

function subsectionSpacer(label: string): HTMLElement {
  const footer = roleNamed("region", label).parentElement;
  let current = footer?.parentElement ?? null;
  while (current) {
    const spacer = [...current.children].find((child) => child.getAttribute("aria-hidden") === "true");
    if (spacer instanceof HTMLElement) {
      return spacer;
    }
    current = current.parentElement;
  }
  throw new Error(`expected aria-hidden subsection spacer beside ${label}`);
}

function tokenBackgroundColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

function tokenBackgroundImage(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const image = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return image;
}

/** Let the shell's color transition settle, so computed colors are the end state. */
async function settled(element: HTMLElement): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished));
}

function RowTitle({ children }: { children: string }) {
  return (
    <SelectionItem.Title role="heading" aria-level={3}>
      {children}
    </SelectionItem.Title>
  );
}

/** The viewport y of the middle of the label row that holds `title`. */
function labelRowCentre(title: HTMLElement): number {
  const label = title.closest("label");
  if (!(label instanceof HTMLElement)) {
    throw new Error("expected the row label around the title");
  }
  // The label lays its cells out in the shell's grid without a box of its own.
  const cells = [...label.children].map((cell) => cell.getBoundingClientRect());
  const top = Math.min(...cells.map((cell) => cell.top));
  const bottom = Math.max(...cells.map((cell) => cell.bottom));
  return (top + bottom) / 2;
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

describe("SelectionItem", () => {
  it.each([
    { host: "the default host", title: "Fixed price", render: undefined, tag: "DIV" },
    { host: "a render host", title: "Article row", render: <article />, tag: "ARTICLE" },
  ])("renders data-slot from the dataSlot prop on $host", ({ title, render, tag }) => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />} render={render}>
          <RowTitle>{title}</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(shellFrom(title).getAttribute("data-slot")).toBe("checkbox-item");
    expect(controlSlot(shellFrom(title)).getAttribute("data-slot")).toBe("selection-item-control");
    expect(shellFrom(title).tagName).toBe(tag);
    expect(checkboxNamed(title).getAttribute("aria-checked")).toBe("false");
  });

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

  it.each([
    { edge: "left", x: () => 4 },
    { edge: "right", x: (width: number) => width - 4 },
  ] as const)("selects a RadioItem from 4px inside the $edge edge", async ({ x }) => {
    renderThemed(
      <RadioItemGroup label="Radio cards">
        <RadioItem value="a">
          <RowTitle>Radio card</RowTitle>
        </RadioItem>
      </RadioItemGroup>
    );

    await clickShellAt(shellFrom("Radio card"), x, labelRowCentre(headingNamed("Radio card")));
    expect(roleNamed("radio", "Radio card").getAttribute("aria-checked")).toBe("true");
  });

  it.each([
    { item: "CheckboxItem", role: "checkbox", controlPosition: "start" },
    { item: "CheckboxItem", role: "checkbox", controlPosition: "end" },
    { item: "RadioItem", role: "radio", controlPosition: "start" },
    { item: "RadioItem", role: "radio", controlPosition: "end" },
  ] as const)(
    "leaves the whole focus ring of a $item control at the $controlPosition edge of a px-0 card unclipped",
    async ({ role, controlPosition }) => {
      renderThemed(
        <div style={{ padding: 32 }}>
          <button type="button">Before</button>
          {role === "checkbox" ? (
            <CheckboxItemGroup label="Cards">
              <CheckboxItem value="a" className="px-0" controlPosition={controlPosition}>
                <RowTitle>Fixed price</RowTitle>
              </CheckboxItem>
            </CheckboxItemGroup>
          ) : (
            <RadioItemGroup label="Cards">
              <RadioItem value="a" className="px-0" controlPosition={controlPosition}>
                <RowTitle>Fixed price</RowTitle>
              </RadioItem>
            </RadioItemGroup>
          )}
        </div>
      );

      const control = roleNamed(role, "Fixed price");
      roleNamed("button", "Before").focus();
      await userEvent.keyboard("{Tab}");
      expect(control.matches(":focus-visible")).toBe(true);

      // The shared ring is a 2px ring outside a 2px offset, so it paints 4px past the control.
      const style = getComputedStyle(control);
      expect(style.getPropertyValue("--tw-ring-offset-width")).toBe("2px");
      const rect = control.getBoundingClientRect();
      const shell = shellFrom("Fixed price");
      const shellRect = shell.getBoundingClientRect();
      const edgeGap =
        controlPosition === "start"
          ? rect.left - (shellRect.left + shell.clientLeft)
          : shellRect.right - shell.clientLeft - rect.right;
      expect(edgeGap, "the control touches the shell's inner edge").toBeCloseTo(0, 0);

      expect(focusRingClippers(control), "no ancestor clips the ring's box").toEqual([]);
    }
  );

  it("keeps clicks beside the card, level with its label row, outside the click target", async () => {
    renderThemed(
      // The test CSS only holds the package's own utilities, so the frame pads itself inline.
      <div data-testid="frame" style={{ paddingInline: 32 }}>
        <CheckboxItemGroup label="Cards">
          <CheckboxItem value="a">
            <RowTitle>Fixed price</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
      </div>
    );

    const frame = page.getByTestId("frame").element();
    const checkbox = checkboxNamed("Fixed price");
    for (const x of [(shell: DOMRect) => shell.left - 2, (shell: DOMRect) => shell.right + 2]) {
      // Both boxes move together if a click scrolls the page, so the offset holds.
      const box = frame.getBoundingClientRect();
      const shell = shellFrom("Fixed price").getBoundingClientRect();
      await userEvent.click(frame, {
        position: { x: x(shell) - box.left, y: labelRowCentre(headingNamed("Fixed price")) - box.top },
      });
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("keeps the sub-section side padding outside the click target and an action's click its own", async () => {
    renderThemed(
      <CheckboxItemGroup label="Cards">
        <CheckboxItem value="a">
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.Actions>
            <PressCounter />
          </SelectionItem.Actions>
          <SelectionItem.SubSection role="region" aria-label="Price details">
            Price details
          </SelectionItem.SubSection>
        </CheckboxItem>
      </CheckboxItemGroup>
    );

    const shell = shellFrom("Fixed price");
    const details = roleNamed("region", "Price details").getBoundingClientRect();
    const detailsCentre = details.top + details.height / 2;
    // The label also names the checkbox by the action text, so match the one checkbox by role.
    const checkbox = page.getByRole("checkbox").element();
    await clickShellAt(shell, () => 4, detailsCentre);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await clickShellAt(shell, (width) => width - 4, detailsCentre);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(roleNamed("button", "Pressed 0 times"));
    expect(roleNamed("button", "Pressed 1 times")).toBeTruthy();
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it.each([
    { row: "a plain row", mode: undefined },
    { row: "a row whose SubSection is hidden", mode: "hidden" },
  ] as const)("toggles $row from its bottom inset", async ({ mode }) => {
    renderThemed(
      <CheckboxItemGroup label="Cards">
        <CheckboxItem value="a">
          <RowTitle>Fixed price</RowTitle>
          {mode ? <SelectionItem.SubSection mode={mode}>Price details</SelectionItem.SubSection> : null}
        </CheckboxItem>
      </CheckboxItemGroup>
    );

    const shell = shellFrom("Fixed price");
    const checkbox = checkboxNamed("Fixed price");
    let checked = false;
    for (const offset of [3, 7, 10, 13]) {
      // Read the edge before each click: a click can scroll the page.
      const bottom = shell.getBoundingClientRect().bottom - shell.clientTop;
      await clickShellAt(shell, (width) => width / 2, bottom - offset);
      checked = !checked;
      expect(checkbox.getAttribute("aria-checked"), `${offset}px above the bottom`).toBe(String(checked));
    }
  });

  it("gives a revealed SubSection's bottom inset back to the band once it shows", async () => {
    function RevealOnCheck() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <CheckboxItemGroup label="Cards" value={value} onChange={setValue}>
          <CheckboxItem value="a">
            <RowTitle>Fixed price</RowTitle>
            <SelectionItem.SubSection
              mode={value.includes("a") ? "visible" : "hidden"}
              role="region"
              aria-label="Price details">
              Price details
            </SelectionItem.SubSection>
          </CheckboxItem>
        </CheckboxItemGroup>
      );
    }
    renderThemed(<RevealOnCheck />);

    const shell = shellFrom("Fixed price");
    const checkbox = checkboxNamed("Fixed price");
    const clickBottomInset = async () => {
      const bottom = shell.getBoundingClientRect().bottom - shell.clientTop;
      await clickShellAt(shell, (width) => width / 2, bottom - 7);
    };

    await clickBottomInset();
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    const details = roleNamed("region", "Price details");
    await settled(details);
    expect(details.getBoundingClientRect().height).toBeGreaterThan(0);

    // The shown band sits under the bottom inset now, so the click stays the band's.
    await clickBottomInset();
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(headingNamed("Fixed price"));
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

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

    it("sends one click through the row and its ancestors per SubSection click", async () => {
      const rowClicks: string[] = [];
      const ancestorClicks: string[] = [];
      renderThemed(
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- counts bubbling clicks only
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
  });

  it.each([
    { inset: 16, className: undefined },
    // The standalone sheet carries only the classes the library uses, so the override is one it ships.
    { inset: 12, className: "px-3" },
    { inset: 0, className: "px-0" },
  ] as const)(
    "insets the row content $inset px for className $className and toggles from the label row's edges",
    async ({ inset, className }) => {
      renderThemed(
        <CheckboxItemGroup label="Cards">
          <CheckboxItem value="a" className={className}>
            <RowTitle>Fixed price</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
      );

      const shell = shellFrom("Fixed price");
      const inner = shell.getBoundingClientRect();
      // The test CSS has no preflight, so this also checks the card's own box sizing.
      expect(inner.width).toBeCloseTo(shell.parentElement?.getBoundingClientRect().width ?? Number.NaN, 0);
      const border = Number.parseFloat(getComputedStyle(shell).borderLeftWidth);
      const rowCluster = headingNamed("Fixed price").parentElement;
      if (!(rowCluster instanceof HTMLElement)) {
        throw new Error("expected the row cluster around the title");
      }
      expect(controlSlot(shell).getBoundingClientRect().left - (inner.left + border)).toBeCloseTo(inset, 0);
      expect(inner.right - border - rowCluster.getBoundingClientRect().right).toBeCloseTo(inset, 0);

      const checkbox = checkboxNamed("Fixed price");
      // Read the row centre before each click: a click can scroll the page.
      await clickShellAt(shell, () => 1, labelRowCentre(headingNamed("Fixed price")));
      expect(checkbox.getAttribute("aria-checked")).toBe("true");
      await clickShellAt(shell, (width) => width - 1, labelRowCentre(headingNamed("Fixed price")));
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
    }
  );

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

  it("renders nothing for a childless SubSection", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection />
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(page.getByRole("region").query()).toBeNull();
    expect(page.getByRole("region", { name: "Hidden extra", exact: true }).query()).toBeNull();
  });

  it("passes mode through to Item.Footer: hidden renders the band inert, visible does not", () => {
    // The focus choreography behind `inert` is Item.Footer's, covered in item.browser.test.tsx.
    const { rerender } = renderThemed(<SubSectionTree mode="hidden" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(true);

    rerender(<SubSectionTree mode="visible" />);
    expect(subsectionHost(nestedSubsectionButton("Hidden details")).inert).toBe(false);
  });

  it("places the control after the row at end and matches spacer width in both positions", () => {
    renderThemed(
      <div>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Start row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Start extra">
              Start extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell dataSlot="checkbox-item" controlPosition="end" control={<Checkbox.Root />}>
            <RowTitle>End row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="End extra">
              End extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root style={{ display: "contents" }}>
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            controlPosition="end"
            control={
              // Inline, not utility classes: the browser suite loads `styles.css`, which is
              // compiled from `dist/**/*.js` only, so a class spelled solely in a test never
              // reaches the sheet.
              <span
                role="img"
                aria-label="Wide indicator"
                style={{ display: "block", height: "1rem", width: "3rem" }}
              />
            }>
            <RowTitle>Wide row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Wide extra">
              Wide extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      </div>
    );

    const start = shellFrom("Start row");
    const end = shellFrom("End row");
    const wide = shellFrom("Wide row");
    const startControl = checkboxNamed("Start row").getBoundingClientRect();
    const startTitle = headingNamed("Start row").getBoundingClientRect();
    expect(startControl.left).toBeLessThan(startTitle.left);

    const endControl = checkboxNamed("End row").getBoundingClientRect();
    const endTitle = headingNamed("End row").getBoundingClientRect();
    expect(endControl.left).toBeGreaterThan(endTitle.left);

    expect(getComputedStyle(start).display).toBe("grid");
    expect(getComputedStyle(end).display).toBe("grid");
    expect(getComputedStyle(wide).display).toBe("grid");

    const startSpacer = subsectionSpacer("Start extra");
    const endSpacer = subsectionSpacer("End extra");
    const wideSpacer = subsectionSpacer("Wide extra");
    expect(startSpacer.getAttribute("style")).toBeNull();
    expect(endSpacer.getAttribute("style")).toBeNull();
    expect(wideSpacer.getAttribute("style")).toBeNull();
    expect(startSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().left,
      0
    );
    expect(endSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().left,
      0
    );
    expect(wideSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().left,
      0
    );
    expect(startSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().width,
      0
    );
    expect(endSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeGreaterThan(
      startSpacer.getBoundingClientRect().width
    );

    const endExtra = roleNamed("region", "End extra").getBoundingClientRect();
    expect(endSpacer.getBoundingClientRect().left).toBeGreaterThan(endExtra.left);
    const startExtra = roleNamed("region", "Start extra").getBoundingClientRect();
    expect(startSpacer.getBoundingClientRect().left).toBeLessThan(startExtra.left);
  });

  it("does not toggle a disabled control on row click and hatches the surface", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Checkbox.Root disabled />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price");
    expect(box.getAttribute("aria-checked")).toBe("false");
    const shell = shellFrom("Fixed price");
    const shellStyle = getComputedStyle(shell);
    expect(shellStyle.cursor).toBe("not-allowed");
    expect(shellStyle.backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
    // Oracle: the shared hatch, which utils.test.ts pins by hand.
    expect(shellStyle.backgroundImage).toBe(tokenBackgroundImage(shell, disabledHatch));
    expect(shellStyle.backgroundImage).not.toBe("none");

    headingNamed("Fixed price").click();
    expect(checkboxNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
  });

  it("does not paint checked shell state from a nested checked control in SubSection", async () => {
    renderThemed(
      <Field.Root className="gap-0">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>First</RowTitle>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Shell row</RowTitle>
          <SelectionItem.SubSection>
            <Field.Root>
              <Field.Label>Nested extra</Field.Label>
              <UiCheckbox defaultChecked />
            </Field.Root>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const first = shellFrom("First");
    const shell = shellFrom("Shell row");
    expect(checkboxNamed("Shell row", false).getAttribute("aria-checked")).toBe("false");
    expect(checkboxNamed("Nested extra", true).getAttribute("aria-checked")).toBe("true");
    expect(getComputedStyle(shell).marginTop).toBe(getComputedStyle(first).marginTop);
    expect(getComputedStyle(shell).borderTopWidth).toBe("0px");
    expect(getComputedStyle(shell).marginTop).not.toBe("-1px");

    await userEvent.click(headingNamed("Shell row"));
    expect(checkboxNamed("Shell row", true).getAttribute("aria-checked")).toBe("true");
    await settled(shell);
    expect(getComputedStyle(shell).backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
    // Internal themes keep the `--primary` edge through `--selection-checked-border`.
    expect(getComputedStyle(shell).borderTopColor).toBe(cssVarColor(shell, "--primary"));
    expect(getComputedStyle(shell).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(shell).marginTop).toBe("-1px");
  });

  it("keeps a checked row's resting border in an external theme, in light and dark", async () => {
    renderThemed(
      <>
        <ThemeScope theme={fkasExternal}>
          <RadioItemGroup label="Light plan" defaultValue="light-spot">
            <RadioItem value="light-fixed">
              <RowTitle>Light fixed</RowTitle>
            </RadioItem>
            <RadioItem value="light-spot">
              <RowTitle>Light spot</RowTitle>
            </RadioItem>
          </RadioItemGroup>
        </ThemeScope>
        <div data-theme="dark">
          <ThemeScope theme={fkasExternal}>
            <RadioItemGroup label="Dark plan" defaultValue="dark-spot">
              <RadioItem value="dark-fixed">
                <RowTitle>Dark fixed</RowTitle>
              </RadioItem>
              <RadioItem value="dark-spot">
                <RowTitle>Dark spot</RowTitle>
              </RadioItem>
            </RadioItemGroup>
          </ThemeScope>
        </div>
      </>
    );

    for (const name of ["Light spot", "Dark spot"]) {
      const shell = shellFrom(name);
      await settled(shell);
      // Oracle: the theme's own `--border`, read where the row sits. It must differ from
      // `--primary`, or a primary edge would pass as the resting one.
      const border = cssVarColor(shell, "--border");
      expect(border, name).not.toBe(cssVarColor(shell, "--primary"));
      // The checked non-first row still pulls its top edge over the row above's, so the
      // shared edge is the checked row's own colour.
      expect(getComputedStyle(shell).marginTop, name).toBe("-1px");
      expect(getComputedStyle(shell).borderTopColor, name).toBe(border);
      expect(getComputedStyle(shell).borderLeftColor, name).toBe(border);
    }
    // Light and dark resolve different borders, so the dark row read its own scheme.
    expect(cssVarColor(shellFrom("Dark spot"), "--border")).not.toBe(
      cssVarColor(shellFrom("Light spot"), "--border")
    );
  });

  it("fills rows with the theme's card, like CheckboxCard, where the card and page background differ", async () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <CheckboxItemGroup label="Add-ons">
          <CheckboxItem value="router">
            <RowTitle>Router</RowTitle>
          </CheckboxItem>
          <CheckboxItem value="sim">
            <RowTitle>SIM card</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label="Plan">
          <RadioItem value="fixed">
            <RowTitle>Fixed price</RowTitle>
          </RadioItem>
          <RadioItem value="spot" className="bg-background">
            <RowTitle>See-through row</RowTitle>
          </RadioItem>
        </RadioItemGroup>
        <CheckboxGroup label="Cards">
          <CheckboxCard value="card" title="Card beside" description="Filled like the rows." />
        </CheckboxGroup>
      </ThemeScope>
    );

    const router = shellFrom("Router");
    // The oracle is the theme's own --card, read where the rows sit; the external theme
    // tints --background, so a row painting the page surface would show a different colour.
    const card = cssVarColor(router, "--card");
    const background = cssVarColor(router, "--background");
    expect(card).not.toBe(background);
    expect(getComputedStyle(router).backgroundColor).toBe(card);
    expect(getComputedStyle(shellFrom("Fixed price")).backgroundColor).toBe(card);
    // DOM audit: the CheckboxCard fill is on Card.Root, which exposes its `card` slot.
    const cardRoot = textNamed("Card beside").closest("[data-slot=card]");
    if (!(cardRoot instanceof HTMLElement)) {
      throw new Error("expected the CheckboxCard's card root");
    }
    expect(getComputedStyle(cardRoot).backgroundColor).toBe(card);

    // Checked steps from the card to muted, so selection reads as a tint of the card.
    await userEvent.click(headingNamed("SIM card"));
    await settled(shellFrom("SIM card"));
    const checked = getComputedStyle(shellFrom("SIM card")).backgroundColor;
    expect(checked).toBe(cssVarColor(router, "--muted"));
    expect(checked).not.toBe(card);

    // A background class merges after the fill, for a list that should show its surface.
    expect(getComputedStyle(shellFrom("See-through row")).backgroundColor).toBe(background);
  });

  it("shows every line of a long title and description on a phone-width row", () => {
    const title = "Mobile broadband with a fixed monthly price and no binding period";
    const description = "We send you a SIM card by post. You can easily insert it in your phone.";
    renderThemed(
      <div style={{ width: "260px" }}>
        <CheckboxItemGroup label="Delivery">
          <CheckboxItem value="sim">
            <SelectionItem.Content>
              <RowTitle>{title}</RowTitle>
              <SelectionItem.Description>{description}</SelectionItem.Description>
            </SelectionItem.Content>
          </CheckboxItem>
        </CheckboxItemGroup>
      </div>
    );

    // Both wrap past two lines at this width, so a one- or two-line clamp would cap the box
    // and leave the rest of the control's label hidden.
    for (const element of [headingNamed(title), textNamed(description)]) {
      const lineHeight = px(getComputedStyle(element).lineHeight);
      expect(element.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 2);
      expect(element.scrollHeight).toBe(element.clientHeight);
    }
    // The control's accessible name still carries the whole description.
    expect(checkboxNamed(`${title} ${description}`).getAttribute("aria-checked")).toBe("false");
  });

  it("toggles from the keyboard on the plugged-in control", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Shell>
        </Field.Root>
      </>
    );

    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Fixed price"));
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });
});

/**
 * The row's type per density, written out by hand: dense keeps today's `text-sm`, and
 * comfortable is the customer-facing reference card's 16px. The title keeps `leading-snug`
 * (1.375) and the description `leading-normal` (1.5); plain text in Actions and a SubSection
 * takes the row's own line height.
 */
const ROW_TYPE = {
  dense: { title: [14, 19.25], description: [14, 21], plain: [14, 20] },
  comfortable: { title: [16, 22], description: [16, 24], plain: [16, 24] },
} as const;

function fontAndLeading(element: HTMLElement): [number, number] {
  const style = getComputedStyle(element);
  return [Number.parseFloat(style.fontSize), Number.parseFloat(style.lineHeight)];
}

describe("selection row type", () => {
  it.each([
    { item: "CheckboxItem", role: "checkbox", density: "dense" },
    { item: "CheckboxItem", role: "checkbox", density: "comfortable" },
    { item: "RadioItem", role: "radio", density: "dense" },
    { item: "RadioItem", role: "radio", density: "comfortable" },
  ] as const)(
    "sizes a $item's text at $density and centres the control on the title's first line",
    ({ role, density }) => {
      stampDensity(density);
      const rows = (
        <>
          {[
            { value: "fixed", title: "Fixed price", description: "Locked for twelve months." },
            { value: "spot", title: "Spot price", description: undefined },
          ].map(({ value, title, description }) => {
            const body = (
              <>
                <SelectionItem.Content>
                  <SelectionItem.Title>{title}</SelectionItem.Title>
                  {description ? <SelectionItem.Description>{description}</SelectionItem.Description> : null}
                </SelectionItem.Content>
                {description ? <SelectionItem.Actions>Recommended</SelectionItem.Actions> : null}
                {description ? <SelectionItem.SubSection>Price details</SelectionItem.SubSection> : null}
              </>
            );
            return role === "checkbox" ? (
              <CheckboxItem key={value} value={value}>
                {body}
              </CheckboxItem>
            ) : (
              <RadioItem key={value} value={value}>
                {body}
              </RadioItem>
            );
          })}
        </>
      );
      renderThemed(
        role === "checkbox" ? (
          <CheckboxItemGroup label="Plans">{rows}</CheckboxItemGroup>
        ) : (
          <RadioItemGroup label="Plans">{rows}</RadioItemGroup>
        )
      );

      const expected = ROW_TYPE[density];
      expect(fontAndLeading(textNamed("Fixed price")), "title").toEqual(expected.title);
      expect(fontAndLeading(textNamed("Locked for twelve months.")), "description").toEqual(
        expected.description
      );
      expect(fontAndLeading(textNamed("Recommended")), "plain text in Actions").toEqual(expected.plain);
      expect(fontAndLeading(textNamed("Price details")), "plain text in a SubSection").toEqual(
        expected.plain
      );

      for (const title of ["Fixed price", "Spot price"]) {
        const line = textNamed(title).getBoundingClientRect().top + expected.title[1] / 2;
        const control = page
          .getByRole(role, { name: new RegExp(`^${title}`) })
          .element()
          .getBoundingClientRect();
        expect(control.top + control.height / 2, `${title} control centre`).toBeCloseTo(line, 0);
      }
    }
  );

  it("leaves Item and Alert titles and descriptions at text-sm when comfortable", () => {
    stampDensity("comfortable");
    renderThemed(
      <>
        <Item.Root>
          <Item.Content>
            <Item.Title>Item title</Item.Title>
            <Item.Description>Item description</Item.Description>
          </Item.Content>
        </Item.Root>
        <Alert.Root>
          <Alert.Title>Alert title</Alert.Title>
          <Alert.Description>Alert description</Alert.Description>
        </Alert.Root>
      </>
    );

    for (const text of ["Item title", "Item description", "Alert title", "Alert description"]) {
      expect(fontAndLeading(textNamed(text))[0], text).toBe(14);
    }
  });
});

/**
 * The one orientation map. These assertions compare the two families against each other rather than against
 * a class string, so the map cannot be forked back into two copies without one of the two
 * moving and this failing. The fieldset skeleton is FieldFrame `heading="legend"`.
 */
describe("selection group orientation map", () => {
  function radioNamed(name: string): HTMLElement {
    const element = page.getByRole("radio", { name, exact: true }).element();
    if (!(element instanceof HTMLElement)) {
      throw new Error(`expected radio named ${name}`);
    }
    return element;
  }

  /** The group primitive a member sits in: the `Field.Set` child that contains it. */
  function groupPrimitiveAround(member: HTMLElement): HTMLElement {
    const set = member.closest("fieldset");
    const primitive = [...(set?.children ?? [])].find((child) => child.contains(member));
    if (!(primitive instanceof HTMLElement)) {
      throw new Error("expected a group primitive under the fieldset");
    }
    return primitive;
  }

  function itemListAround(member: HTMLElement): HTMLElement {
    const list = member.closest("[role=list]");
    if (!(list instanceof HTMLElement)) {
      throw new Error("expected the private item list");
    }
    return list;
  }

  /** The four computed properties the two orientation arms actually set. */
  type GroupLayout = { display: string; flexDirection: string; flexWrap: string; gap: string };

  function layout(element: HTMLElement): GroupLayout {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      gap: style.rowGap,
    };
  }

  const VERTICAL_GROUP = {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: "8px",
  } satisfies GroupLayout;
  const HORIZONTAL = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "16px",
  } satisfies GroupLayout;
  const VERTICAL_LIST = {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: "0px",
  } satisfies GroupLayout;

  it("lays a checkbox group and a radio group out identically at each orientation", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Checks vertical">
          <Field.Label>
            <UiCheckbox value="a" />
            Check vertical
          </Field.Label>
        </CheckboxGroup>
        <RadioGroup label="Radios vertical">
          <Radio value="a">Radio vertical</Radio>
        </RadioGroup>
        <CheckboxGroup label="Checks horizontal" orientation="horizontal">
          <Field.Label>
            <UiCheckbox value="a" />
            Check horizontal
          </Field.Label>
        </CheckboxGroup>
        <RadioGroup label="Radios horizontal" orientation="horizontal">
          <Radio value="a">Radio horizontal</Radio>
        </RadioGroup>
      </>
    );

    const checksVertical = layout(groupPrimitiveAround(checkboxNamed("Check vertical")));
    const checksHorizontal = layout(groupPrimitiveAround(checkboxNamed("Check horizontal")));
    expect(checksVertical).toEqual(layout(groupPrimitiveAround(radioNamed("Radio vertical"))));
    expect(checksHorizontal).toEqual(layout(groupPrimitiveAround(radioNamed("Radio horizontal"))));
    // Signed values, so an unstyled pair cannot pass by matching each other's defaults.
    expect(checksVertical).toEqual(VERTICAL_GROUP);
    expect(checksHorizontal).toEqual(HORIZONTAL);
  });

  it("lays a checkbox card list and a radio card list out identically at each orientation", () => {
    renderThemed(
      <>
        <CheckboxItemGroup label="Check cards vertical">
          <CheckboxItem value="a">
            <RowTitle>Check card vertical</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label="Radio cards vertical">
          <RadioItem value="a">
            <RowTitle>Radio card vertical</RowTitle>
          </RadioItem>
        </RadioItemGroup>
        <CheckboxItemGroup label="Check cards horizontal" orientation="horizontal">
          <CheckboxItem value="a">
            <RowTitle>Check card horizontal</RowTitle>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label="Radio cards horizontal" orientation="horizontal">
          <RadioItem value="a">
            <RowTitle>Radio card horizontal</RowTitle>
          </RadioItem>
        </RadioItemGroup>
      </>
    );

    const checkVertical = layout(itemListAround(checkboxNamed("Check card vertical")));
    const checkHorizontal = layout(itemListAround(checkboxNamed("Check card horizontal")));
    expect(checkVertical).toEqual(layout(itemListAround(radioNamed("Radio card vertical"))));
    expect(checkHorizontal).toEqual(layout(itemListAround(radioNamed("Radio card horizontal"))));
    expect(checkVertical).toEqual(VERTICAL_LIST);
    expect(checkHorizontal).toEqual(HORIZONTAL);
    // The card list is nested in a group primitive that keeps the group orientation.
    expect(layout(groupPrimitiveAround(checkboxNamed("Check card vertical")))).toEqual(VERTICAL_GROUP);
    expect(layout(groupPrimitiveAround(radioNamed("Radio card horizontal")))).toEqual(HORIZONTAL);
  });

  it("collapses the plain vertical group gap when its direct children are shells", () => {
    renderThemed(
      <>
        <CheckboxGroup label="Check shells vertical">
          <CheckboxItem value="a">Check shell vertical a</CheckboxItem>
          <CheckboxItem value="b">Check shell vertical b</CheckboxItem>
        </CheckboxGroup>
        <RadioGroup label="Radio shells vertical">
          <RadioItem value="a">
            <RowTitle>Radio shell vertical a</RowTitle>
          </RadioItem>
          <RadioItem value="b">
            <RowTitle>Radio shell vertical b</RowTitle>
          </RadioItem>
        </RadioGroup>
      </>
    );

    const checkGroup = groupPrimitiveAround(checkboxNamed("Check shell vertical a"));
    const radioGroup = groupPrimitiveAround(radioNamed("Radio shell vertical a"));
    expect(layout(checkGroup)).toEqual(VERTICAL_LIST);
    expect(layout(radioGroup)).toEqual(VERTICAL_LIST);
    // Plain groups stay plain: no list semantics are added to the shells.
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
    // The second shell still collapses its top border into the first, as a connected stack.
    const secondCheck = checkboxNamed("Check shell vertical b").closest("[data-selection-item]");
    if (!(secondCheck instanceof HTMLElement)) {
      throw new Error("expected checkbox-item shell");
    }
    expect(getComputedStyle(secondCheck).borderTopWidth).toBe("0px");
  });

  it("renders shells in a plain horizontal group as independent rounded cards", () => {
    renderThemed(
      <div style={radiusToken}>
        <CheckboxGroup label="Check shells horizontal" orientation="horizontal">
          <CheckboxItem value="a">Check shell horizontal a</CheckboxItem>
          <CheckboxItem value="b">Check shell horizontal b</CheckboxItem>
        </CheckboxGroup>
        <RadioGroup label="Radio shells horizontal" orientation="horizontal">
          <RadioItem value="a">
            <RowTitle>Radio shell horizontal a</RowTitle>
          </RadioItem>
          <RadioItem value="b">
            <RowTitle>Radio shell horizontal b</RowTitle>
          </RadioItem>
        </RadioGroup>
      </div>
    );

    const checkGroup = groupPrimitiveAround(checkboxNamed("Check shell horizontal a"));
    const radioGroup = groupPrimitiveAround(radioNamed("Radio shell horizontal a"));
    assertHorizontalItemList(
      checkGroup,
      [...checkGroup.querySelectorAll("[data-selection-item]")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    );
    assertHorizontalItemList(
      radioGroup,
      [...radioGroup.querySelectorAll("[data-selection-item]")].filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      )
    );
    expect(page.getByRole("listitem").elements()).toHaveLength(0);
  });

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
      expect(radioNamed(name)).toBeTruthy();
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
