import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { Checkbox } from "@base-ui/react/checkbox";
import type { BaseUIEvent } from "@base-ui/react/types";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill test reads --card and --background.
import "../../../dist/themes.css";
import { expectValidFocusRing, focusRingClippers } from "../../../test/assert-focus-ring";
import { assertHorizontalItemList, radiusToken } from "../../../test/assert-selection-item-group-layout";
import { HOSTS, centreY, firstLineCentreY, hostCss } from "../../../test/first-line";
import {
  cssVarColor,
  effectiveOpacity,
  fkasExternal,
  fkasPrivate,
  headingNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { DENSITIES } from "../../theme/density";
import { Alert } from "../alert/alert";
import { Badge } from "../badge/badge";
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

      // The shared ring is a flush 2px ring, so it paints 2px past the control.
      expectValidFocusRing(control, "keyboard focus must paint the flush 2px ring");
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

  describe("disabled row", () => {
    /**
     * One scheme's rows: row-level disabling in a vertical stack and in horizontal cards,
     * group-level disabling in both orientations, two standalone shells, and controls nested
     * in SubSections, enabled under a disabled row and disabled under an enabled one.
     */
    function DisabledRows({ scheme }: { scheme: string }) {
      const title = (row: string) => <RowTitle>{`${scheme} ${row}`}</RowTitle>;
      return (
        <>
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
                <CheckboxItemGroup label={`${scheme} bundle extras`}>
                  <CheckboxItem value="free">{title("free extra")}</CheckboxItem>
                </CheckboxItemGroup>
              </CheckboxItem.SubSection>
            </CheckboxItem>
            <CheckboxItem value="extras">
              {title("extras")}
              <CheckboxItem.SubSection>
                <CheckboxItemGroup label={`${scheme} extra options`}>
                  <CheckboxItem value="locked" isDisabled>
                    {title("locked extra")}
                  </CheckboxItem>
                </CheckboxItemGroup>
              </CheckboxItem.SubSection>
            </CheckboxItem>
          </CheckboxItemGroup>
        </>
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

    /** The colour stops of a computed gradient, in sRGB. */
    function gradientStops(image: string): readonly { r: number; g: number; b: number; alpha: number }[] {
      return [...image.matchAll(/(?:rgba?|oklch|lab)\([^()]*\)/g)].map(([stop]) =>
        CssColor.toSrgb(getOrThrow(CssColor.parse(stop)))
      );
    }

    /**
     * Checks every fixture row of one scheme. A disabled row fills with `fill`, the role read
     * where it sits, under stripes of `stripeAlpha` black; an enabled one keeps the card or,
     * checked, the muted fill and no image. A disabled row's control paints at its own 50%,
     * and the row's title, and any sub-section content, keep full strength.
     */
    async function expectRows(scheme: string, fill: "--muted" | "--card", stripeAlpha: number) {
      for (const { row, control, checked, disabled, pulled } of DISABLED_ROWS) {
        const name = `${scheme} ${row}`;
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
    }

    it("keeps the card fill without stripes in external themes, at row and group level, in light and dark", async () => {
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
        await expectRows(scheme, "--card", 0);
      }
      expect(cssVarColor(shellFrom("Dark fixed"), "--card")).not.toBe(
        cssVarColor(shellFrom("Light fixed"), "--card")
      );
    });

    it("keeps the muted fill under black stripes at 2% in internal themes, at row and group level, in light and dark", async () => {
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
        await expectRows(scheme, "--muted", 0.02);
        // A checked disabled row keeps the primary checked edge of an internal row.
        const spot = shellFrom(`${scheme} spot`);
        expect(getComputedStyle(spot).borderTopColor, scheme).toBe(cssVarColor(spot, "--primary"));
      }
      expect(cssVarColor(shellFrom("Dark fixed"), "--muted")).not.toBe(
        cssVarColor(shellFrom("Light fixed"), "--muted")
      );
    });

    it("shows the disabled row and its cursor for a custom control that is natively, aria- or data-disabled", async () => {
      /** A custom control's row, with a SubSection whose passive parts toggle it. */
      const row = (name: string, control: ReactElement) => (
        <Field.Root>
          <SelectionItem.Shell dataSlot="checkbox-item" control={control} isSubSectionSelectable>
            <RowTitle>{name}</RowTitle>
            <SelectionItem.SubSection>{`${name} details`}</SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      );
      renderThemed(
        <>
          {row("Native control", <input type="checkbox" disabled />)}
          {row(
            "Aria control",
            <span role="checkbox" aria-checked="false" aria-disabled="true" tabIndex={0} />
          )}
          {row("Data control", <span role="checkbox" aria-checked="false" data-disabled="" tabIndex={0} />)}
          {row("Enabled control", <input type="checkbox" />)}
          {row(
            "Data false control",
            <span role="checkbox" aria-checked="false" data-disabled="false" tabIndex={0} />
          )}
        </>
      );

      for (const [name, disabled] of [
        ["Native control", true],
        ["Aria control", true],
        ["Data control", true],
        ["Enabled control", false],
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
      expect(gradientStops(getComputedStyle(shell).backgroundImage).map(({ alpha }) => alpha)).toEqual([
        0, 0, 0, 0,
      ]);
    });
  });

  it("keeps the Field root's gap around a stack of shells, which a wrapper connects", () => {
    renderThemed(
      <Field.Root>
        <Field.Label>Plans label</Field.Label>
        <div>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Upper</RowTitle>
          </SelectionItem.Shell>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Lower</RowTitle>
          </SelectionItem.Shell>
        </div>
      </Field.Root>
    );
    const stack = shellFrom("Upper").parentElement;
    const root = stack?.parentElement;
    if (!(stack instanceof HTMLElement) || !(root instanceof HTMLElement)) {
      throw new Error("expected the stack and the Field root");
    }
    // Field layout carries no connected-stack policy: its gap stays the density gap.
    expect(getComputedStyle(root).rowGap).not.toBe("0px");
    // The wrapper's shells share an edge: the lower one starts where the upper one ends.
    expect(shellFrom("Lower").getBoundingClientRect().top).toBeLessThanOrEqual(
      shellFrom("Upper").getBoundingClientRect().bottom
    );
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
      // Actions text sits on the row's first line, so beside a title it takes the title's leading.
      expect(fontAndLeading(textNamed("Recommended")), "plain text in Actions").toEqual([
        expected.plain[0],
        expected.title[1],
      ]);
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

  it.each(DENSITIES)(
    "centres the control on the title's first line when the row holds the public Item.Description, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed">
            <SelectionItem.Content>
              <SelectionItem.Title>Fixed price</SelectionItem.Title>
              <Item.Description>Locked for twelve months.</Item.Description>
            </SelectionItem.Content>
          </CheckboxItem>
        </CheckboxItemGroup>
      );
      // Item.Media sizes itself to Item.Title's line beside an Item.Description; the selection
      // control keeps its own title's line for either description slot.
      const line = textNamed("Fixed price").getBoundingClientRect().top + ROW_TYPE[density].title[1] / 2;
      const control = page
        .getByRole("checkbox", { name: /^Fixed price/ })
        .element()
        .getBoundingClientRect();
      expect(control.top + control.height / 2).toBeCloseTo(line, 0);
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

describe.each(HOSTS)("selection row first line in a %s host", (host) => {
  function controlCentreY(role: "checkbox" | "radio", name: RegExp): number {
    return centreY(page.getByRole(role, { name }).element());
  }

  it.each(DENSITIES)("centres text and badge Actions content on the title's first line at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <div style={{ width: "320px" }}>
        <style>{hostCss(host)}</style>
        <CheckboxItemGroup label="Plans">
          <CheckboxItem value="fixed">
            <SelectionItem.Content>
              <SelectionItem.Title>Fixed price</SelectionItem.Title>
              <SelectionItem.Description>
                Locked for twelve months, whatever the spot market does.
              </SelectionItem.Description>
            </SelectionItem.Content>
            <SelectionItem.Actions>Recommended</SelectionItem.Actions>
          </CheckboxItem>
          <CheckboxItem value="spot">
            <SelectionItem.Content>
              <SelectionItem.Title>Spot price</SelectionItem.Title>
              <SelectionItem.Description>Follows the hourly market.</SelectionItem.Description>
            </SelectionItem.Content>
            <SelectionItem.Actions>
              <Badge variant="info" size="sm">
                Current
              </Badge>
            </SelectionItem.Actions>
          </CheckboxItem>
        </CheckboxItemGroup>
      </div>
    );
    const fixedLine = firstLineCentreY(textNamed("Fixed price"));
    const spotLine = firstLineCentreY(textNamed("Spot price"));
    expect(Math.abs(firstLineCentreY(textNamed("Recommended")) - fixedLine), "text").toBeLessThanOrEqual(0.5);
    expect(Math.abs(centreY(textNamed("Current")) - spotLine), "badge").toBeLessThanOrEqual(0.5);
  });

  it.each(DENSITIES)(
    "grows the row around wrapped Actions text and keeps its first line on the title's at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <>
          <style>{hostCss(host)}</style>
          <CheckboxItemGroup label="Plans">
            <CheckboxItem value="fixed">
              <SelectionItem.Content>
                <SelectionItem.Title>Fixed</SelectionItem.Title>
              </SelectionItem.Content>
              <SelectionItem.Actions style={{ width: "100px" }}>
                Billed every month in arrears from the first meter reading
              </SelectionItem.Actions>
            </CheckboxItem>
          </CheckboxItemGroup>
        </>
      );
      const text = textNamed("Billed every month in arrears from the first meter reading");
      const row = text.closest("[data-selection-item]");
      if (row === null) {
        throw new Error("expected the selection row around the Actions");
      }
      const range = document.createRange();
      range.selectNodeContents(text);
      const lines = [...range.getClientRects()];
      // The fixture wraps, or the test would not reach the case it names.
      expect(new Set(lines.map((line) => Math.round(line.top))).size).toBeGreaterThan(2);
      const rowBox = row.getBoundingClientRect();
      for (const box of [text.getBoundingClientRect(), ...lines]) {
        expect(box.top).toBeGreaterThanOrEqual(rowBox.top);
        expect(box.bottom).toBeLessThanOrEqual(rowBox.bottom);
      }
      expect(Math.abs(firstLineCentreY(text) - firstLineCentreY(textNamed("Fixed")))).toBeLessThanOrEqual(
        0.5
      );
    }
  );

  it.each(DENSITIES)("centres the control on a plain-text row's first line at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <>
        <style>{hostCss(host)}</style>
        <RadioItemGroup label="Plans">
          <RadioItem value="fixed">Fixed price</RadioItem>
        </RadioItemGroup>
      </>
    );
    const line = firstLineCentreY(textNamed("Fixed price"));
    expect(Math.abs(controlCentreY("radio", /^Fixed price/) - line)).toBeLessThanOrEqual(0.5);
  });

  it.each(DENSITIES)(
    "spaces the description from the title by the content gap and ends the content with it at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <>
          <style>{hostCss(host)}</style>
          <CheckboxItemGroup label="Plans">
            <CheckboxItem value="fixed">
              <SelectionItem.Content>
                <SelectionItem.Title>Fixed price</SelectionItem.Title>
                <SelectionItem.Description>Locked for twelve months.</SelectionItem.Description>
              </SelectionItem.Content>
            </CheckboxItem>
          </CheckboxItemGroup>
        </>
      );
      const title = textNamed("Fixed price").getBoundingClientRect();
      const description = textNamed("Locked for twelve months.");
      const content = description.parentElement;
      if (content === null) {
        throw new Error("expected the content column");
      }
      // The content column's gap is 0.25rem, 4px at the default 16px root.
      expect(description.getBoundingClientRect().top - title.bottom).toBeCloseTo(4, 2);
      expect(content.getBoundingClientRect().bottom - description.getBoundingClientRect().bottom).toBeCloseTo(
        0,
        2
      );
    }
  );
});

/**
 * A row title's weight comes from the theme's `--selection-title-weight`. The expected weights
 * are the design decisions, written by hand: the internal row's regular 400 and the external
 * radio card's medium 500. `selection-item-without-themes.browser.test.tsx` covers a host
 * without `themes.css`.
 */
describe("SelectionItem title weight", () => {
  function TitleRows({ prefix, className }: { prefix: string; className?: string }) {
    return (
      <>
        <CheckboxItemGroup label={`${prefix} add-ons`}>
          <CheckboxItem value="router">
            <CheckboxItem.Title role="heading" aria-level={3} className={className}>
              {`${prefix} checkbox row`}
            </CheckboxItem.Title>
          </CheckboxItem>
        </CheckboxItemGroup>
        <RadioItemGroup label={`${prefix} plan`}>
          <RadioItem value="fixed">
            <RadioItem.Title role="heading" aria-level={3} className={className}>
              {`${prefix} radio row`}
            </RadioItem.Title>
          </RadioItem>
        </RadioItemGroup>
      </>
    );
  }

  /** The computed weights of a prefix's checkbox and radio row titles. */
  function titleWeights(prefix: string): readonly string[] {
    return [`${prefix} checkbox row`, `${prefix} radio row`].map(
      (name) => getComputedStyle(headingNamed(name)).fontWeight
    );
  }

  it("sets row titles at 400 in internal themes and 500 in external ones, in light and dark", () => {
    renderThemed(
      <>
        <TitleRows prefix="Internal" />
        <ThemeScope theme={fkasExternal}>
          <TitleRows prefix="External" />
        </ThemeScope>
        <div data-theme="dark">
          <ThemeScope theme={fkasPrivate}>
            <TitleRows prefix="Dark internal" />
          </ThemeScope>
          <ThemeScope theme={fkasExternal}>
            <TitleRows prefix="Dark external" />
          </ThemeScope>
        </div>
      </>
    );

    expect(titleWeights("Internal")).toEqual(["400", "400"]);
    expect(titleWeights("External")).toEqual(["500", "500"]);
    expect(titleWeights("Dark internal")).toEqual(["400", "400"]);
    expect(titleWeights("Dark external")).toEqual(["500", "500"]);
  });

  it("resets row titles to 400 in an internal scope nested in an external one", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <TitleRows prefix="Outer external" />
        <ThemeScope theme={fkasPrivate}>
          <TitleRows prefix="Nested internal" />
        </ThemeScope>
      </ThemeScope>
    );

    expect(titleWeights("Outer external")).toEqual(["500", "500"]);
    expect(titleWeights("Nested internal")).toEqual(["400", "400"]);
  });

  it("takes a className weight over the theme's in either variant", () => {
    renderThemed(
      <>
        <TitleRows prefix="Internal medium" className="font-medium" />
        <ThemeScope theme={fkasExternal}>
          <TitleRows prefix="External semibold" className="font-semibold" />
          <TitleRows prefix="External normal" className="font-normal" />
        </ThemeScope>
      </>
    );

    expect(titleWeights("Internal medium")).toEqual(["500", "500"]);
    expect(titleWeights("External semibold")).toEqual(["600", "600"]);
    expect(titleWeights("External normal")).toEqual(["400", "400"]);
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
