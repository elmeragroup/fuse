import { useState } from "react";
import type { ReactElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { expectTargets } from "../../../test/target-size";
import { renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { Trash } from "../../icons/generated/trash";
import { Tray } from "../../icons/generated/tray";
import type { SupportedLocale } from "../../intl/locale-context";
import { DENSITIES } from "../../theme";
import { ActionBar } from "./index";

const ROWS = ["Order 1", "Order 2", "Order 3"] as const;

type SelectionProps = {
  /**
   * The positioned container's width, in px. The default fits the 414px test viewport, below the
   * 28rem at which the buttons show their words.
   */
  readonly width?: number;
  readonly offset?: number;
};

/** A list of checkable rows with the bar over it, as a consumer composes them. */
function Selection({ width = 400, offset = 16 }: SelectionProps): ReactElement {
  const [rows, setRows] = useState<readonly string[]>(ROWS);
  const [checked, setChecked] = useState<readonly string[]>([]);
  return (
    <div data-testid="container" style={{ position: "relative", width, height: 240 }}>
      {rows.map((row) => (
        <label key={row} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={checked.includes(row)}
            onChange={(event) => {
              setChecked(event.target.checked ? [...checked, row] : checked.filter((r) => r !== row));
            }}
          />
          {row}
        </label>
      ))}
      <ActionBar.Root count={checked.length} offset={offset}>
        <ActionBar.Count />
        <ActionBar.Clear
          onClick={() => {
            setChecked([]);
          }}
        />
        <ActionBar.Separator />
        <ActionBar.Button>
          <Tray data-icon="inline-start" />
          <ActionBar.ButtonLabel>Archive</ActionBar.ButtonLabel>
        </ActionBar.Button>
        <ActionBar.Button
          onClick={() => {
            setRows(rows.filter((row) => !checked.includes(row)));
            setChecked([]);
          }}>
          <Trash data-icon="inline-start" />
          <ActionBar.ButtonLabel>Delete</ActionBar.ButtonLabel>
        </ActionBar.Button>
      </ActionBar.Root>
    </div>
  );
}

/** Mount in en-US, the locale whose dictionary the suite reads unless a test names another. */
function renderEnglish(node: ReactElement) {
  return renderThemed(withLocale("en-US", node));
}

/** Whether a computed `translate` moves the box at all: `none`, or every axis at 0. */
function unmoved(translate: string): boolean {
  return translate === "none" || translate.split(" ").every((axis) => Number.parseFloat(axis) === 0);
}

function queryToolbar(): Element | null {
  return page.getByRole("toolbar").query();
}

/** The bar's live region. It has no name, so the suite finds it by its role alone. */
function status(): Element {
  return page.getByRole("status").element();
}

async function check(row: string): Promise<void> {
  await userEvent.click(page.getByRole("checkbox", { name: row }));
}

afterEach(async () => {
  document.documentElement.removeAttribute("data-density");
  await emulateReducedMotion("no-preference");
});

describe("ActionBar", () => {
  it("mounts a named toolbar only while something is selected and announces each count in a live region that exists before it", async () => {
    renderEnglish(<Selection />);
    // The live region is in the document, empty, before the first selection, so screen readers
    // announce the first count as a change.
    expect(queryToolbar()).toBeNull();
    expect(status().textContent).toBe("");

    await check("Order 1");
    await expect.element(page.getByRole("toolbar", { name: "Bulk actions" })).toBeVisible();
    expect(status().textContent).toBe("1 selected");
    expect(roleNamed("toolbar", "Bulk actions").textContent).toContain("1 selected");

    await check("Order 2");
    expect(status().textContent).toBe("2 selected");
    expect(roleNamed("toolbar", "Bulk actions").textContent).toContain("2 selected");

    await check("Order 1");
    const toolbar = roleNamed("toolbar", "Bulk actions");
    // Hold the exit open so the leaving bar can be checked whatever the machine's load.
    toolbar.style.transitionDuration = "60s";
    await check("Order 2");
    expect(status().textContent).toBe("");
    // The leaving bar keeps its last count on screen and is inert: its buttons take no focus.
    expect(toolbar.textContent).toContain("1 selected");
    roleNamed("button", "Archive").focus();
    expect(document.activeElement).not.toBe(roleNamed("button", "Archive"));
    // It unmounts once its exit transition ends.
    for (const animation of toolbar.getAnimations()) animation.finish();
    await vi.waitFor(() => {
      expect(toolbar.isConnected).toBe(false);
    });
  });

  it("only fades out under reduced motion, never moving", async () => {
    await emulateReducedMotion("reduce");
    renderEnglish(<Selection />);
    await check("Order 1");
    const toolbar = roleNamed("toolbar", "Bulk actions");
    expect(unmoved(getComputedStyle(toolbar).translate), getComputedStyle(toolbar).translate).toBe(true);
    // Hold the exit open so the leaving bar can be read whatever the machine's load.
    toolbar.style.transitionDuration = "60s";
    await check("Order 1");
    const leaving = getComputedStyle(toolbar).translate;
    expect(unmoved(leaving), `leaving translate ${leaving}`).toBe(true);
    // It still fades: the leaving bar runs an opacity transition and nothing else.
    const transitions = toolbar
      .getAnimations()
      .filter((animation) => animation instanceof CSSTransition)
      .map((animation) => animation.transitionProperty);
    expect(transitions).toEqual(["opacity"]);
    for (const animation of toolbar.getAnimations()) animation.finish();
    await vi.waitFor(() => {
      expect(toolbar.isConnected).toBe(false);
    });
  });

  it("is one Tab stop whose items the arrow keys move between", async () => {
    renderEnglish(<Selection />);
    await check("Order 1");
    roleNamed("checkbox", "Order 1").focus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "Clear selection"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(roleNamed("button", "Archive"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(roleNamed("button", "Delete"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(roleNamed("button", "Clear selection"));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(roleNamed("checkbox", "Order 3"));
  });

  it("returns focus to where it came from when Clear empties the selection", async () => {
    renderEnglish(<Selection />);
    await check("Order 3");
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "Clear selection"));
    await userEvent.keyboard("{Enter}");
    expect(roleNamed("checkbox", "Order 3")).toHaveProperty("checked", false);
    expect(document.activeElement).toBe(roleNamed("checkbox", "Order 3"));
  });

  it("drops focus to the body when the element focus came from is gone", async () => {
    renderEnglish(<Selection />);
    await check("Order 3");
    roleNamed("checkbox", "Order 3").focus();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(roleNamed("button", "Delete"));
    await userEvent.keyboard("{Enter}");
    expect(page.getByRole("checkbox", { name: "Order 3" }).query()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("takes an explicit name and Clear label ahead of the dictionary", async () => {
    renderEnglish(
      <ActionBar.Root count={2} aria-label="Order actions">
        <ActionBar.Count>2 orders</ActionBar.Count>
        <ActionBar.Clear aria-label="Deselect orders" />
      </ActionBar.Root>
    );
    await expect.element(page.getByRole("toolbar", { name: "Order actions" })).toBeVisible();
    expect(roleNamed("toolbar", "Order actions").textContent).toBe("2 orders");
    expect(roleNamed("button", "Deselect orders")).toBeInstanceOf(HTMLElement);
  });

  it.each<[SupportedLocale, string, string, string, string]>([
    ["en-US", "Bulk actions", "Clear selection", "1 selected", "1,200 selected"],
    ["nb-NO", "Massehandlinger", "Fjern valg", "1 valgt", "1 200 valgt"],
    ["sv-SE", "Massåtgärder", "Rensa markering", "1 markerad", "1 200 markerade"],
    ["fi-FI", "Joukkotoiminnot", "Tyhjennä valinta", "1 valittu", "1 200 valittua"],
  ])("speaks %s: the bar, Clear and a singular and plural count", async (locale, bar, clear, one, many) => {
    const { rerender } = renderThemed(
      withLocale(
        locale,
        <ActionBar.Root count={1}>
          <ActionBar.Count />
          <ActionBar.Clear />
        </ActionBar.Root>
      )
    );
    await expect.element(page.getByRole("toolbar", { name: bar })).toBeVisible();
    expect(roleNamed("button", clear)).toBeInstanceOf(HTMLElement);
    expect(status().textContent).toBe(one);
    rerender(
      withLocale(
        locale,
        <ActionBar.Root count={1200}>
          <ActionBar.Count />
        </ActionBar.Root>
      )
    );
    expect(status().textContent).toBe(many);
    expect(roleNamed("toolbar", bar).textContent).toBe(many);
  });

  it("floats centred at offset px above the bottom of its positioned container", async () => {
    renderEnglish(<Selection offset={72} />);
    await check("Order 1");
    const toolbar = roleNamed("toolbar", "Bulk actions");
    const container = page.getByTestId("container").element().getBoundingClientRect();
    // Measure once the entrance has settled, since its translate moves the box.
    await Promise.all(toolbar.getAnimations().map((animation) => animation.finished));
    const bar = toolbar.getBoundingClientRect();
    expect(container.bottom - bar.bottom).toBeCloseTo(72, 1);
    expect(bar.left - container.left).toBeCloseTo(container.right - bar.right, 1);
  });

  it("keeps the button words as names but shows icons alone in a container narrower than 28rem", async () => {
    const { rerender } = renderEnglish(<Selection width={640} />);
    await check("Order 1");
    const wide = roleNamed("button", "Archive").querySelector("span");
    expect(wide?.getBoundingClientRect().width).toBeGreaterThan(20);
    rerender(withLocale("en-US", <Selection width={400} />));
    const narrow = roleNamed("button", "Archive").querySelector("span");
    expect(narrow?.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  it("keeps every control at least a 24px target at both densities", async () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderEnglish(<Selection />);
      await check("Order 1");
      expectTargets(
        [
          roleNamed("button", "Clear selection"),
          roleNamed("button", "Archive"),
          roleNamed("button", "Delete"),
        ],
        density
      );
      unmount();
    }
  });
});
