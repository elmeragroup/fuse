import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { InputGroup } from "./input-group";

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

  it("keeps DOM tab order from the control to the addon button", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Meter" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button>Copy</InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      </>
    );
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    const control = textboxNamed("Meter");
    expect(document.activeElement).toBe(control);
    expect(control.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Copy"));
    expect(groupAround(roleNamed("button", "Copy")).getAttribute("tabindex")).toBeNull();
  });

  it("paints the within ring on the Root for keyboard focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Search" />
        </InputGroup.Root>
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
    expect(roleNamed("button", "Clear").matches(":focus-visible")).toBe(true);
    expectNoFocusRing(rootNamed("Search"), "an addon button must keep its own ring off the group chrome");
  });

  it("keeps the canonical group ring inside a popup surface", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <div data-slot="combobox-content">
          <InputGroup.Root>
            <InputGroup.Input aria-label="Filter" />
          </InputGroup.Root>
        </div>
      </>
    );
    await assertWithinKeyboardFocusRingAtBothDensities(
      roleNamed("button", "Before"),
      textboxNamed("Filter"),
      rootNamed("Filter")
    );
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

  it("surfaces aria-invalid on the control as group invalid chrome", () => {
    renderThemed(
      <>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Valid" />
        </InputGroup.Root>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Invalid" aria-invalid />
        </InputGroup.Root>
      </>
    );
    expect(textboxNamed("Invalid").getAttribute("aria-invalid")).toBe("true");
    const invalidRoot = rootNamed("Invalid");
    expect(getComputedStyle(invalidRoot).boxShadow).not.toBe(getComputedStyle(rootNamed("Valid")).boxShadow);
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

  it("dims the group and its addon when the control is disabled", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>NO</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Locked" disabled />
      </InputGroup.Root>
    );
    expect(Number(getComputedStyle(rootNamed("Locked")).opacity)).toBeLessThan(1);
    expect(rootNamed("Locked").matches(":has(:disabled)")).toBe(true);
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

  it("pins the signed md rung at both densities and does not rescope under ThemeScope", () => {
    const { rerender } = renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Meter" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button>Copy</InputGroup.Button>
          <InputGroup.Button size="icon-xs" aria-label="Clear" />
        </InputGroup.Addon>
      </InputGroup.Root>
    );

    const compactXs = [];
    const compactIconXs = [];
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      expect(px(getComputedStyle(rootNamed("Meter")).height)).toBe(CONTROL_MD[density].height);
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

  it("ignores a nested data-density stamp in both directions", () => {
    renderThemed(
      <>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Root" />
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

    // Density is a document-root axis: `ui.css` keys the comfortable block on
    // `:root[data-density="comfortable"]`, so a nested attribute rescopes nothing.
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const rung = CONTROL_MD[density].height;
      expect(px(getComputedStyle(rootNamed("Root")).height)).toBe(rung);
      expect(px(getComputedStyle(rootNamed("Nested comfortable")).height)).toBe(rung);
      expect(px(getComputedStyle(rootNamed("Nested dense")).height)).toBe(rung);
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
