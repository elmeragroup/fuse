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
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { InputGroup } from "./input-group";

function groups(): HTMLElement[] {
  return page
    .getByRole("group")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function rootAt(index = 0): HTMLElement {
  const root = groups().filter((element) => element.dataset.slot === "input-group")[index];
  if (root === undefined) {
    throw new Error(`expected an input-group root at ${index}`);
  }
  return root;
}

function addonAt(index = 0): HTMLElement {
  const addon = groups().filter((element) => element.dataset.slot === "input-group-addon")[index];
  if (addon === undefined) {
    throw new Error(`expected an input-group addon at ${index}`);
  }
  return addon;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
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
    expect(rootAt().getAttribute("data-slot")).toBe("input-group");
    expect(addonAt().getAttribute("data-slot")).toBe("input-group-addon");
    const control = textboxNamed("Account");
    expect(control.getAttribute("data-slot")).toBe("input-group-control");
    expect(control.hasAttribute("data-focus-ring-control")).toBe(true);
    const text = rootAt().querySelector('[data-slot="input-group-text"]');
    expect(text?.textContent).toBe("NO");
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
    buttonNamed("Before").focus();
    await userEvent.keyboard("{Tab}");
    const control = textboxNamed("Meter");
    expect(document.activeElement).toBe(control);
    expect(control.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("Copy"));
    expect(addonAt().getAttribute("tabindex")).toBeNull();
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
      buttonNamed("Before"),
      textboxNamed("Search"),
      rootAt()
    );
  });

  it("leaves the group ring unpainted for mouse focus and for addon buttons (§8.6)", async () => {
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
    // in the group, and the one §8.6 keeps off the group chrome.
    await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
    expect(buttonNamed("Clear").matches(":focus-visible")).toBe(false);
    expectNoFocusRing(rootAt(), "mouse focus must not paint the group ring");

    textboxNamed("Search").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("Clear"));
    expect(buttonNamed("Clear").matches(":focus-visible")).toBe(true);
    expectNoFocusRing(rootAt(), "an addon button must keep its own ring off the group chrome");
  });

  it("keeps the canonical group ring inside a popup surface (§8.7)", async () => {
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
      buttonNamed("Before"),
      textboxNamed("Filter"),
      rootAt()
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
    expect(buttonNamed("Look up").getAttribute("type")).toBe("button");
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
    expect(buttonNamed("Extra small").getAttribute("data-size")).toBe("xs");
    expect(buttonNamed("Small").getAttribute("data-size")).toBe("sm");
    expect(buttonNamed("Icon extra small").getAttribute("data-size")).toBe("icon-xs");
    expect(buttonNamed("Icon small").getAttribute("data-size")).toBe("icon-sm");
    expect(buttonNamed("Extra small").getAttribute("data-slot")).toBe("button");
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
    const invalidRoot = rootAt(1);
    expect(invalidRoot.matches(':has([data-slot][aria-invalid="true"])')).toBe(true);
    // The invalid chrome adds a ring on top of the shared shadow; comparing the
    // painted box-shadow keeps this a state probe rather than a snapshot.
    expect(getComputedStyle(invalidRoot).boxShadow).not.toBe(getComputedStyle(rootAt(0)).boxShadow);
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
    expect(Number(getComputedStyle(rootAt()).opacity)).toBeLessThan(1);
    expect(rootAt().matches(":has(:disabled)")).toBe(true);
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
    expect(addonAt(0).getAttribute("data-align")).toBe("inline-start");
    expect(addonAt(1).getAttribute("data-align")).toBe("inline-end");
    expect(addonAt(2).getAttribute("data-align")).toBe("block-start");
    expect(addonAt(3).getAttribute("data-align")).toBe("block-end");
    expect(getComputedStyle(rootAt(0)).flexDirection).toBe("row");
    expect(getComputedStyle(rootAt(1)).flexDirection).toBe("column");
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
      expect(px(getComputedStyle(rootAt()).height)).toBe(CONTROL_MD[density].height);
      compactXs.push(px(getComputedStyle(buttonNamed("Copy")).height));
      compactIconXs.push(px(getComputedStyle(buttonNamed("Clear")).height));
    }
    // input-group.md §4 exemption: compact addon chrome is density-independent.
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
    expect(px(getComputedStyle(rootAt()).height)).toBe(CONTROL_MD.dense.height);
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
    expect(px(getComputedStyle(rootAt()).height)).toBeGreaterThan(CONTROL_MD.dense.height);
  });
});
