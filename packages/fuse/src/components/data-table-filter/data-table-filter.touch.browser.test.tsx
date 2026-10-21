/**
 * The add menu on a 390px phone under a coarse pointer: submenus below their rows, 44px rows,
 * and 44px reach on Back and the header operator. Touch emulation is page-wide, so this file runs
 * in the `browser-touch` project.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { focusIs, Orders, renderOrders, settled } from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";

/** WCAG 2.5.5's enhanced target, the floor the filter keeps under a coarse pointer. */
const COARSE_TARGET = 44;

type TouchEmulationCdp = {
  send: (
    method: "Emulation.setTouchEmulationEnabled",
    params: { enabled: boolean; maxTouchPoints?: number }
  ) => Promise<void>;
};

/** Chromium's touch emulation, which also switches `(pointer: coarse)` on and off. */
async function emulatePointer(pointer: "fine" | "coarse"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session = cdp() as TouchEmulationCdp;
  await session.send(
    "Emulation.setTouchEmulationEnabled",
    pointer === "coarse" ? { enabled: true, maxTouchPoints: 1 } : { enabled: false }
  );
  expect(matchMedia("(pointer: coarse)").matches, `${pointer} pointer emulated`).toBe(pointer === "coarse");
}

/**
 * Whether presses at the ends of a 44px band centred on the control land on it, the band running
 * top to bottom, or also start to end. The control may be smaller than 44px and reach the band
 * through its hit area, which the popup must not clip.
 */
function reaches(control: HTMLElement, inline: boolean): boolean {
  const box = control.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const half = COARSE_TARGET / 2 - 1;
  const points: [number, number][] = [
    [x, y - half],
    [x, y + half],
  ];
  if (inline) {
    points.push([x - half, y], [x + half, y]);
  }
  return points.every(([pointX, pointY]) => {
    const hit = document.elementFromPoint(pointX, pointY);
    return hit !== null && control.contains(hit);
  });
}

afterEach(async () => {
  await emulatePointer("fine");
  await page.viewport(414, 896);
});

describe("DataTableFilter narrow chip strip under a coarse pointer", () => {
  it("keeps each segment's 44px band inside the strip, top and bottom", async () => {
    await page.viewport(390, 844);
    await emulatePointer("coarse");
    // Room above the bar, so every band lies inside the viewport.
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingTop: 48 }}>
          <Orders
            initial={[
              { id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } },
              {
                id: "status",
                value: { kind: "option", operator: "isAnyOf", values: ["paid", "pending", "overdue"] },
              },
            ]}
          />
        </div>
      )
    );
    await settled();
    const segments = [
      roleNamed("combobox", "Customer operator"),
      roleNamed("button", "“nord”"),
      roleNamed("button", "Remove Customer filter"),
    ];
    for (const segment of segments) {
      const box = segment.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      for (const edge of [y - COARSE_TARGET / 2 + 2, y + COARSE_TARGET / 2 - 2]) {
        const hit = document.elementFromPoint(x, edge);
        expect(
          hit !== null && segment.contains(hit),
          `${segment.getAttribute("aria-label") ?? ""} at ${String(edge)}`
        ).toBe(true);
      }
    }
  });
});

describe("DataTableFilter add menu under a coarse pointer", () => {
  it("puts a submenu below its row, flush with the menu, and keeps rows 44px tall on a 390px screen", async () => {
    await page.viewport(390, 844);
    await emulatePointer("coarse");
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    // Boxes are read after the open zoom.
    await settled();
    const menu = roleNamed("dialog", "Add filter");
    for (const row of page.elementLocator(menu).getByRole("menuitem").elements()) {
      expect(row.getBoundingClientRect().height, row.textContent).toBeGreaterThanOrEqual(COARSE_TARGET);
    }

    const status = roleNamed("menuitem", "Status");
    await userEvent.click(status);
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Status" }).query()).not.toBeNull();
    await settled();
    const search = roleNamed("searchbox", "Search Status");
    // DOM audit: the submenu popup has no accessible name of its own, and its box is the
    // behaviour under test, so the search's popup is found by its slot.
    const submenu = search.closest<HTMLElement>("[data-slot=data-table-filter-options-menu]");
    if (submenu === null) {
      throw new Error("expected the Status submenu");
    }
    const outer = menu.getBoundingClientRect();
    const inner = submenu.getBoundingClientRect();
    expect(inner.top).toBeGreaterThanOrEqual(status.getBoundingClientRect().bottom);
    expect(inner.left).toBeCloseTo(outer.left, 0);
    expect(inner.width).toBeCloseTo(outer.width, 0);
    for (const row of page.elementLocator(submenu).getByRole("menuitemcheckbox").elements()) {
      expect(row.getBoundingClientRect().height, row.textContent).toBeGreaterThanOrEqual(COARSE_TARGET);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });

  it("gives Back and the header operator a 44px reach in the in-place editor", async () => {
    await page.viewport(390, 844);
    await emulatePointer("coarse");
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await settled();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await settled();
    expect(reaches(roleNamed("button", "Back to fields"), true)).toBe(true);
    expect(reaches(roleNamed("combobox", "Customer operator"), false)).toBe(true);
  });
});
