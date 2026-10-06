import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill parity test reads --card and --background.
import "../../../dist/themes.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import {
  CONTROL_MD,
  cssVarColor,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Input } from "../input/input";
import { InputGroup } from "./index";

function groupAround(start: HTMLElement): HTMLElement {
  const group = start.closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error("expected a group ancestor");
  }
  return group;
}

function rootNamed(name: string): HTMLElement {
  return groupAround(textboxNamed(name));
}

describe("InputGroup", () => {
  it("renders the group chrome around a named control", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>NO</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Account" />
      </InputGroup.Root>
    );
    const root = rootNamed("Account");
    const addon = groupAround(textNamed("NO"));
    const control = textboxNamed("Account");
    expect(root.getAttribute("data-slot")).toBe("input-group");
    expect(addon.getAttribute("data-slot")).toBe("input-group-addon");
    expect(control.getAttribute("data-slot")).toBe("input-group-control");
    expect(control.hasAttribute("data-focus-ring-control")).toBe(true);
    expect(textNamed("NO").getAttribute("data-slot")).toBe("input-group-text");
  });

  it("paints Input's fill and chrome, enabled and disabled, where the card and page background differ", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Input aria-label="Plain" />
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>kr</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Grouped" />
        </InputGroup.Root>
        <Input aria-label="Plain disabled" disabled />
        <InputGroup.Root>
          <InputGroup.Input aria-label="Grouped disabled" disabled />
        </InputGroup.Root>
      </ThemeScope>
    );
    const plain = getComputedStyle(textboxNamed("Plain"));
    const group = rootNamed("Grouped");
    const grouped = getComputedStyle(group);
    // The oracle is the theme's own --card, read where the group sits; the external theme
    // tints --background, so an unfilled group would show a different colour.
    const card = cssVarColor(group, "--card");
    expect(card).not.toBe(cssVarColor(group, "--background"));
    expect(grouped.backgroundColor).toBe(card);
    expect(plain.backgroundColor).toBe(card);
    // Unit: the root's computed chrome. Oracle: Input's, which composes the same recipe through
    // fieldBox, so a merge cancellation on either side shows up as a difference.
    expect(grouped.borderTopColor).toBe(plain.borderTopColor);
    expect(grouped.borderTopLeftRadius).toBe(plain.borderTopLeftRadius);
    expect(grouped.boxShadow).toBe(plain.boxShadow);
    const disabledGroup = getComputedStyle(rootNamed("Grouped disabled"));
    const disabledInput = getComputedStyle(textboxNamed("Plain disabled"));
    expect(disabledGroup.backgroundColor).toBe(disabledInput.backgroundColor);
    expect(disabledGroup.borderTopColor).toBe(disabledInput.borderTopColor);
    expect(disabledGroup.boxShadow).toBe(disabledInput.boxShadow);
  });

  it("lets the Textarea control override the primitive slot too", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Textarea aria-label="Message" />
      </InputGroup.Root>
    );
    const control = textboxNamed("Message");
    expect(control.tagName).toBe("TEXTAREA");
    expect(control.getAttribute("data-slot")).toBe("input-group-control");
    expect(getComputedStyle(control).resize).toBe("none");
  });

  it("focuses the sibling input when the addon is clicked, but not through a nested button", async () => {
    const clicks: string[] = [];
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon
          onClick={() => {
            clicks.push("addon");
          }}>
          <InputGroup.Text>Search</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Query" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button
            onClick={() => {
              clicks.push("button");
            }}>
            Clear
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    const control = textboxNamed("Query");

    await userEvent.click(page.getByText("Search"));
    expect(document.activeElement).toBe(control);
    expect(clicks).toEqual(["addon"]);

    control.blur();
    await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
    expect(document.activeElement).not.toBe(control);
    expect(clicks).toEqual(["addon", "button"]);
  });

  it.each([
    [
      "paints the within ring on the Root for keyboard focus, at both densities",
      (group: ReactElement) => group,
    ],
    [
      "keeps the canonical group ring inside a popup surface",
      (group: ReactElement) => <div data-slot="combobox-content">{group}</div>,
    ],
  ])("%s", async (_title, wrap) => {
    renderThemed(
      <>
        <button type="button">Before</button>
        {wrap(
          <InputGroup.Root>
            <InputGroup.Input aria-label="Search" />
          </InputGroup.Root>
        )}
      </>
    );
    await assertWithinKeyboardFocusRingAtBothDensities(
      roleNamed("button", "Before"),
      textboxNamed("Search"),
      rootNamed("Search")
    );
  });

  it("leaves the group ring unpainted for mouse focus and for addon buttons", async () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Search" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button>Clear</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    // Chromium always matches :focus-visible on a clicked text field, so the
    // mouse arm is probed on the addon button — the only non-editable receiver
    // in the group, and the one that must stay off the group chrome.
    await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
    expect(roleNamed("button", "Clear").matches(":focus-visible")).toBe(false);
    expectNoFocusRing(rootNamed("Search"), "mouse focus must not paint the group ring");

    textboxNamed("Search").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Clear"));
    expect(groupAround(roleNamed("button", "Clear")).getAttribute("tabindex")).toBeNull();
    expect(roleNamed("button", "Clear").matches(":focus-visible")).toBe(true);
    expectNoFocusRing(rootNamed("Search"), "an addon button must keep its own ring off the group chrome");
  });

  it("filters the input to digits beside a text addon, counting maxLength in digits", async () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>+47</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Phone" filter="numeric" maxLength={8} />
      </InputGroup.Root>
    );
    const phone = textboxNamed("Phone");
    if (!(phone instanceof HTMLInputElement)) {
      throw new Error("expected an <input> named Phone");
    }
    expect(phone).toHaveProperty("inputMode", "numeric");

    await userEvent.type(page.getByRole("textbox", { name: "Phone", exact: true }), "9a1");
    expect(phone).toHaveProperty("value", "91");

    // A dictated run with separators: six digits fit after the two typed ones.
    phone.setSelectionRange(2, 2);
    phone.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: "234 567 8",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(phone).toHaveProperty("value", "91234567");
  });

  it("defaults the addon button to type=button so Enter never triggers it", async () => {
    const events: string[] = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          events.push("submit");
        }}>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Address" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button
              onClick={() => {
                events.push("click");
              }}>
              Look up
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      </form>
    );
    expect(roleNamed("button", "Look up").getAttribute("type")).toBe("button");
    textboxNamed("Address").focus();
    await userEvent.keyboard("{Enter}");
    expect(events).not.toContain("click");
  });

  it("reflects the compact size axis as data-size without touching Button's size", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Sizes" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button>Extra small</InputGroup.Button>
          <InputGroup.Button size="sm">Small</InputGroup.Button>
          <InputGroup.Button size="icon-xs" aria-label="Icon extra small" />
          <InputGroup.Button size="icon-sm" aria-label="Icon small" />
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    expect(roleNamed("button", "Extra small").getAttribute("data-size")).toBe("xs");
    expect(roleNamed("button", "Small").getAttribute("data-size")).toBe("sm");
    expect(roleNamed("button", "Icon extra small").getAttribute("data-size")).toBe("icon-xs");
    expect(roleNamed("button", "Icon small").getAttribute("data-size")).toBe("icon-sm");
    expect(roleNamed("button", "Extra small").getAttribute("data-slot")).toBe("button");
  });

  it("keeps an enabled field editable and undimmed beside a disabled addon", async () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Editable meter" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button disabled>Copy meter</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    expect(getComputedStyle(rootNamed("Editable meter")).opacity).toBe("1");
    await userEvent.fill(page.getByRole("textbox", { name: "Editable meter" }), "12345");
    await expect.element(page.getByRole("textbox", { name: "Editable meter" })).toHaveValue("12345");
    expect(roleNamed("button", "Copy meter").matches(":disabled")).toBe(true);
  });

  it("reflects align as data-align and turns block rails into a column", () => {
    renderThemed(
      <>
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>Start</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Inline" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Text>End</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
        <InputGroup.Root>
          <InputGroup.Addon align="block-start">
            <InputGroup.Text>Above</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Block" />
          <InputGroup.Addon align="block-end">
            <InputGroup.Text>Below</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
      </>
    );
    expect(groupAround(textNamed("Start")).getAttribute("data-align")).toBe("inline-start");
    expect(groupAround(textNamed("End")).getAttribute("data-align")).toBe("inline-end");
    expect(groupAround(textNamed("Above")).getAttribute("data-align")).toBe("block-start");
    expect(groupAround(textNamed("Below")).getAttribute("data-align")).toBe("block-end");
    expect(getComputedStyle(rootNamed("Inline")).flexDirection).toBe("row");
    expect(getComputedStyle(rootNamed("Block")).flexDirection).toBe("column");
  });

  it("pins the signed md rung at both densities and ignores a nested data-density stamp or ThemeScope", () => {
    const { rerender } = renderThemed(
      <>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Meter" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button>Copy</InputGroup.Button>
            <InputGroup.Button size="icon-xs" aria-label="Clear" />
          </InputGroup.Addon>
        </InputGroup.Root>
        <div data-density="comfortable">
          <InputGroup.Root>
            <InputGroup.Input aria-label="Nested comfortable" />
          </InputGroup.Root>
        </div>
        <div data-density="dense">
          <InputGroup.Root>
            <InputGroup.Input aria-label="Nested dense" />
          </InputGroup.Root>
        </div>
      </>
    );

    const compactXs = [];
    const compactIconXs = [];
    // Density is a document-root axis: `fuse.css` keys the comfortable block on
    // `:root[data-density="comfortable"]`, so a nested attribute rescopes nothing.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const rung = CONTROL_MD[density].height;
      expect(px(getComputedStyle(rootNamed("Meter")).height)).toBe(rung);
      expect(px(getComputedStyle(rootNamed("Nested comfortable")).height)).toBe(rung);
      expect(px(getComputedStyle(rootNamed("Nested dense")).height)).toBe(rung);
      compactXs.push(px(getComputedStyle(roleNamed("button", "Copy")).height));
      compactIconXs.push(px(getComputedStyle(roleNamed("button", "Clear")).height));
    }
    // Compact addon chrome is density-independent.
    expect(compactXs[0]).toBe(compactXs[1]);
    expect(compactIconXs[0]).toBe(compactIconXs[1]);

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Meter" />
        </InputGroup.Root>
      </ThemeScope>
    );
    expect(px(getComputedStyle(rootNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });

  it("pads addon buttons like the field, not like a standalone Button", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Query" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button size="sm">Search</InputGroup.Button>
          <InputGroup.Button size="sm">
            <span data-icon="inline-start" aria-hidden>
              *
            </span>
            Find
          </InputGroup.Button>
          <InputGroup.Button>
            <span data-icon="inline-start" aria-hidden>
              *
            </span>
            Lead
          </InputGroup.Button>
          <InputGroup.Button>
            Trail
            <span data-icon="inline-end" aria-hidden>
              *
            </span>
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );

    // The field's own md control inset and icon edge: 10px and 8px dense, 14px and 12px
    // comfortable. A standalone md Button pads 32px and 24px at comfortable density. The
    // default xs addon keeps its compact 6px (`px-1.5`) inset and the same md icon edge.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const bare = getComputedStyle(roleNamed("button", "Search"));
      expect(px(bare.paddingInlineStart), `${density} start`).toBe(CONTROL_MD[density].px);
      expect(px(bare.paddingInlineEnd), `${density} end`).toBe(CONTROL_MD[density].px);
      const icon = getComputedStyle(roleNamed("button", "Find"));
      expect(px(icon.paddingInlineStart), `${density} icon edge`).toBe(CONTROL_MD[density].pxIcon);
      expect(px(icon.paddingInlineEnd), `${density} far edge`).toBe(CONTROL_MD[density].px);
      const lead = getComputedStyle(roleNamed("button", "Lead"));
      expect(px(lead.paddingInlineStart), `${density} xs leading icon edge`).toBe(CONTROL_MD[density].pxIcon);
      expect(px(lead.paddingInlineEnd), `${density} xs far edge`).toBe(6);
      const trail = getComputedStyle(roleNamed("button", "Trail"));
      expect(px(trail.paddingInlineEnd), `${density} xs trailing icon edge`).toBe(CONTROL_MD[density].pxIcon);
      expect(px(trail.paddingInlineStart), `${density} xs far edge`).toBe(6);
    }
  });

  it("fits xs addon buttons inside the md field box at the 24px target floor, at both densities", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Button size="icon-xs" aria-label="Lead icon" />
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Rails" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button>Trail text</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );

    // Oracle: the WCAG 2.5.8 floor and the field's own border box. A rail that kept its
    // block padding would stand taller than the box inside the dense border.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const group = rootNamed("Rails");
      const groupBox = group.getBoundingClientRect();
      expect(groupBox.height, density).toBe(CONTROL_MD[density].height);
      for (const name of ["Lead icon", "Trail text"]) {
        const button = roleNamed("button", name);
        const buttonBox = button.getBoundingClientRect();
        expect(buttonBox.height, `${density} ${name}`).toBeGreaterThanOrEqual(24);
        const railBox = groupAround(button).getBoundingClientRect();
        expect(railBox.height, `${density} ${name} rail`).toBeLessThanOrEqual(group.clientHeight);
        expect(railBox.top, `${density} ${name} rail top`).toBeGreaterThanOrEqual(groupBox.top);
        expect(railBox.bottom, `${density} ${name} rail bottom`).toBeLessThanOrEqual(groupBox.bottom);
      }
    }
  });

  it("grows past the md rung for block rails and textarea controls", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Textarea aria-label="Notes" />
        <InputGroup.Addon align="block-end">
          <InputGroup.Text>Sent to support.</InputGroup.Text>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    stampDensity("dense");
    expect(px(getComputedStyle(rootNamed("Notes")).height)).toBeGreaterThan(CONTROL_MD.dense.height);
  });
});
