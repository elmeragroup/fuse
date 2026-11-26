import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { axFocused, axNodes } from "../../../test/ax-tree";
import { assertNoAxeViolations } from "../../../test/axe";
import { focusByKeyboard } from "../../../test/forced-highlight";
import { withLocale } from "../../../test/locale-matrix";
import { withForcedColors } from "../../../test/media-emulation";
import { finishAnimations, glyphInkContrast, pixelContrast, pixelsAt } from "../../../test/screenshot-pixels";
import type { Point } from "../../../test/screenshot-pixels";
import { PANEL, describePartPaint } from "../../../test/surface-paint";
import type { Layer, PartCase } from "../../../test/surface-paint";
import {
  CappedTable,
  MeterTable,
  NO_STOP,
  RingSwatch,
  STOP,
  cappedBox,
  cappedOverflow,
  edgePixels,
  htmlTable,
  ringColor,
  scrollStop,
  shownHeader,
  shownHeaderBox,
  viewport,
} from "../../../test/table-browser-fixtures";
import {
  ROW,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Frame } from "../frame/frame";
import { Meter } from "../meter/meter";
import { Table, VerticalTable } from "./table";
import type { VerticalTableItem } from "./table";

describe("VerticalTable", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  it.each(DENSITIES)(
    "pads keys and values with the row metrics, and the compact variant by its own 4px, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <div>
          <VerticalTable.Root>
            <VerticalTable.Body data={[{ label: "Default key", value: "Default value" }]} />
          </VerticalTable.Root>
          <VerticalTable.Root variant="non-bordered-compact">
            <VerticalTable.Body data={[{ label: "Compact key", value: "Compact value" }]} />
          </VerticalTable.Root>
        </div>
      );
      const block = (name: string) => {
        const style = getComputedStyle(page.getByRole("cell", { name, exact: true }).element());
        return [px(style.paddingTop), px(style.paddingBottom)];
      };
      const row = ROW[density];
      expect(block("Default key")).toEqual([row.py, row.py]);
      expect(block("Default value")).toEqual([row.py, row.py]);
      expect(block("Compact key")).toEqual([4, 4]);
      expect(block("Compact value")).toEqual([4, 4]);
    }
  );

  it("starts a row-header key at the inline start and closes the last row with the box's own border", () => {
    renderThemed(
      <VerticalTable.Body tableProps={{ "aria-label": "Meter facts" }}>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
          <VerticalTable.Value>Smart meter</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Grid area</VerticalTable.Key>
          <VerticalTable.Value>NO1</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    );
    const key = page.getByRole("rowheader", { name: "Meter type" }).element();
    expect(key.tagName).toBe("TH");
    expect(getComputedStyle(key).textAlign).toBe("start");
    const [first, last] = page.getByRole("row").elements();
    if (first === undefined || last === undefined) {
      throw new Error("expected two rows");
    }
    expect(getComputedStyle(first).borderBottomWidth).toBe("1px");
    expect(getComputedStyle(last).borderBottomWidth).toBe("0px");
  });

  it("renders a level-2 heading and N data rows of two cells, with data before children", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header>Customer</VerticalTable.Header>
        <VerticalTable.Body
          data={[
            { label: "Name", value: "Kari Nordmann" },
            { label: "Meter point", value: "7070575000" },
          ]}>
          <VerticalTable.Row>
            <VerticalTable.Key>Grid company</VerticalTable.Key>
            <VerticalTable.Value>Skagerak Nett</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    const heading = page.getByRole("heading", { name: "Customer", exact: true, level: 2 }).element();
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("vertical-table-header");

    const table = htmlTable();
    const rows = page.getByRole("row").elements();
    expect(rows).toHaveLength(3);
    expect(page.getByRole("cell").elements()).toHaveLength(6);
    expect(rows[0]?.textContent).toContain("Name");
    expect(rows[0]?.textContent).toContain("Kari Nordmann");
    expect(rows[1]?.textContent).toContain("Meter point");
    expect(rows[2]?.textContent).toContain("Grid company");
    expect(table.querySelectorAll("td")).toHaveLength(6);
  });

  it("hides isHidden rows and swaps loading cells for a skeleton", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header>Customer</VerticalTable.Header>
        <VerticalTable.Body>
          <VerticalTable.Row isHidden>
            <VerticalTable.Key>Hidden</VerticalTable.Key>
            <VerticalTable.Value>Secret</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key isLoading>Name</VerticalTable.Key>
            <VerticalTable.Value isLoading>Kari Nordmann</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    const hidden = page
      .getByRole("row", { includeHidden: true })
      .elements()
      .find((row) => row.textContent.includes("Hidden"));
    if (!(hidden instanceof HTMLElement)) {
      throw new Error("expected the hidden row");
    }
    expect(getComputedStyle(hidden).display).toBe("none");

    const loadingRow = page
      .getByRole("row")
      .elements()
      .find((row) => row.textContent.trim() === "");
    if (!(loadingRow instanceof HTMLElement)) {
      throw new Error("expected a loading row");
    }
    expect(loadingRow.textContent.trim()).toBe("");
    // IsLoading cells contain the skeleton node, which has no role, so the test finds it by its slot.
    expect(loadingRow.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(page.getByRole("cell", { name: "Name" }).elements()).toHaveLength(0);
  });

  it("keeps a row's stateful value with its own item when an item before it is removed", async () => {
    const items: VerticalTableItem[] = [
      { id: "plan", label: "Plan", value: <input aria-label="Plan note" defaultValue="" /> },
      { id: "meter", label: "Meter", value: <input aria-label="Meter note" defaultValue="" /> },
    ];
    const { rerender } = renderThemed(<VerticalTable.Body data={items} />);
    await userEvent.fill(textboxNamed("Meter note"), "Reading due");

    rerender(<VerticalTable.Body data={items.slice(1)} />);
    expect(textboxNamed("Meter note")).toHaveProperty("value", "Reading due");
  });

  it("names the table from Header via tableProps and exposes a Key row header", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header id="customer">Customer</VerticalTable.Header>
        <VerticalTable.Body
          id="facts"
          aria-labelledby="wrapper-only"
          tableProps={{ "aria-labelledby": "customer", id: "facts-table" }}>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
            <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    expect(htmlTable("Customer")).toBeTruthy();
    // The wrapper id and the tableProps id are distinct and each unique. An id has no role.
    expect(document.body.querySelectorAll("#facts")).toHaveLength(1);
    expect(document.body.querySelectorAll("#facts-table")).toHaveLength(1);
    expect(document.getElementById("facts")?.getAttribute("aria-labelledby")).toBe("wrapper-only");
    expect(htmlTable("Customer").id).toBe("facts-table");

    const header = page.getByRole("rowheader", { name: "Name", exact: true }).element();
    expect(header.tagName).toBe("TH");
    expect(header.getAttribute("scope")).toBe("row");
    expect(page.getByRole("cell", { name: "Kari Nordmann", exact: true }).element().tagName).toBe("TD");
  });
});

describe("Table", () => {
  it("puts a table wider than its container in the tab order as a named group the arrow keys scroll", async () => {
    const { host } = renderThemed(
      <>
        <button type="button">Before</button>
        <MeterTable aria-label="Meter readings" />
      </>
    );
    await expect.poll(scrollStop).toEqual(STOP);
    await assertNoAxeViolations(host);

    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("group", "Meter readings"));
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => viewport().scrollLeft).toBeGreaterThan(0);
  });

  it("stops on a scrolling table's viewport before the text input in its cells", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <MeterTable aria-label="Meter readings" control={<input aria-label="Note" />} />
      </>
    );
    await expect.poll(scrollStop).toEqual(STOP);

    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("group", "Meter readings"));
    await userEvent.tab();
    expect(document.activeElement).toBe(textboxNamed("Note"));
  });

  it.each([
    {
      label: "the table's aria-label when its aria-labelledby names a missing id",
      props: { "aria-labelledby": "missing-heading", "aria-label": "Meter readings" },
      name: "Meter readings",
    },
    {
      label: "the table's aria-labelledby",
      props: { "aria-labelledby": "meter-heading" },
      name: "Readings in Oslo",
    },
    { label: "the table's caption", props: { caption: "November readings" }, name: "November readings" },
  ])("names the scrolling viewport by $label", async ({ props, name }) => {
    const { host } = renderThemed(
      <>
        <h2 id="meter-heading">Readings in Oslo</h2>
        <MeterTable {...props} />
      </>
    );
    await expect.poll(scrollStop).toEqual(STOP);
    expect(roleNamed("group", name)).toBe(viewport());
    await assertNoAxeViolations(host);
  });

  it.each([
    { label: "an unnamed, uncaptioned", props: {} },
    { label: "an empty-captioned", props: { caption: "" } },
  ])("gives $label scrolling table's viewport no name in Chromium", async ({ props }) => {
    renderThemed(<MeterTable {...props} />);
    await expect.poll(scrollStop).toEqual(STOP);

    viewport().focus();
    // ARIA names a group from its author only, so Chromium must not take the cells' text.
    const focused = axFocused(await axNodes());
    expect(focused?.role?.value).toBe("group");
    expect(focused?.name?.value ?? "").toBe("");
  });

  it("drops the stop when the container widens to fit the table", async () => {
    const { rerender } = renderThemed(<MeterTable aria-label="Meter readings" />);
    await expect.poll(scrollStop).toEqual(STOP);

    rerender(<MeterTable width="1200px" aria-label="Meter readings" />);
    await expect.poll(scrollStop).toEqual(NO_STOP);
  });

  it("drops the stop when the viewport stops clipping the table", async () => {
    const style = document.createElement("style");
    style.textContent = '.meter-unclipped [data-slot="table-viewport"] { overflow: visible; }';
    document.head.append(style);
    try {
      const { rerender } = renderThemed(
        <div>
          <MeterTable aria-label="Meter readings" />
        </div>
      );
      await expect.poll(scrollStop).toEqual(STOP);

      rerender(
        <div className="meter-unclipped">
          <MeterTable aria-label="Meter readings" />
        </div>
      );
      await expect.poll(scrollStop).toEqual(NO_STOP);
    } finally {
      style.remove();
    }
  });

  it.each([
    { tabIndex: 0, lands: () => htmlTable("Meter readings") },
    { tabIndex: -1, lands: () => roleNamed("button", "After") },
  ])("leaves focus to a scrolling table that sets its tabIndex to $tabIndex", async ({ tabIndex, lands }) => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <MeterTable aria-label="Meter readings" tabIndex={tabIndex} />
        <button type="button">After</button>
      </>
    );
    // Give the viewport's first measurement a frame to land.
    await nextFrames(2);
    expect(viewport().scrollWidth).toBeGreaterThan(viewport().clientWidth);
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(lands());
  });

  it("keeps scrolling a table that sets its own tabIndex with the keys while the table has focus", async () => {
    renderThemed(<MeterTable aria-label="Meter readings" tabIndex={0} />);
    htmlTable("Meter readings").focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => viewport().scrollLeft).toBeGreaterThan(0);
  });

  it.each([
    {
      change: "a cell's text",
      shrink: (cell: HTMLElement) => {
        cell.textContent = "1200 kWh";
      },
    },
    {
      change: "a cell's style",
      shrink: (cell: HTMLElement) => {
        cell.style.overflow = "hidden";
      },
    },
  ])(
    "drops the stop when $change stops a fixed-layout table overflowing with no box resize",
    async ({ shrink }) => {
      const reading = "1200 kWh read at Storgata 1, Oslo, on 24 November 2026";
      // The change lands outside React, so the table and its container do not render.
      renderThemed(
        <div style={{ width: "300px" }}>
          <Table.Root aria-label="Meter readings" className="table-fixed">
            <Table.Body>
              <Table.Row>
                <Table.Cell className="whitespace-nowrap">{reading}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </div>
      );
      await expect.poll(scrollStop).toEqual(STOP);
      const tableWidth = htmlTable("Meter readings").getBoundingClientRect().width;

      shrink(roleNamed("cell", reading));
      await expect.poll(scrollStop).toEqual(NO_STOP);
      expect(htmlTable("Meter readings").getBoundingClientRect().width).toBe(tableWidth);
    }
  );

  it.each([
    { label: "its body rows", firstCell: {} },
    {
      label: "a sticky first cell",
      firstCell: { position: "sticky", insetInlineStart: 0, zIndex: 10, background: "var(--background)" },
    },
  ] as const)(
    "paints a framed scrolling table's focus outline over $label at either scroll end",
    async ({ firstCell }) => {
      renderThemed(
        <>
          <button type="button">Before</button>
          <MeterTable aria-label="Meter readings" width="240px" framed firstCell={firstCell} />
          <RingSwatch />
        </>
      );
      // The stop is found by its role and name, so the check samples whichever element the DOM
      // makes the stop.
      const stop = page.getByRole("group", { name: "Meter readings" });
      await expect.poll(() => stop.query()).not.toBeNull();
      const ring = await ringColor();
      const box = stop.element();
      // The framed body fills the whole box, so each edge point lies over a body row.
      for (const pixel of await edgePixels(box)) expect(pixel, "an edge before focus").not.toEqual(ring);

      roleNamed("button", "Before").focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(box);
      expect(box.matches(":focus-visible")).toBe(true);
      for (const end of [0, box.scrollWidth - box.clientWidth]) {
        box.scrollLeft = end;
        await nextFrames(2);
        expect(Math.abs(box.scrollLeft - end)).toBeLessThanOrEqual(1);
        for (const pixel of await edgePixels(box))
          expect(pixel, `the outline at scrollLeft ${end}`).toEqual(ring);
      }
    }
  );

  it("keeps a framed table's width, positioned controls and cell clicks while its viewport has focus", async () => {
    // A consumer's own minimum width is wider than the box and wider than the cells need.
    const style = document.createElement("style");
    style.textContent = ".meter-wide { min-width: 600px; }";
    document.head.append(style);
    let clicks = 0;
    try {
      renderThemed(
        <>
          <button type="button">Before</button>
          <MeterTable
            aria-label="Meter readings"
            className="meter-wide"
            width="240px"
            framed
            cells={["Meter 1200", "1200 kWh"]}
            caption={
              <>
                Readings
                {/* No part between the caption and the viewport is positioned, so the viewport
                    places this control at its own end. */}
                <button type="button" style={{ position: "absolute", insetInlineEnd: 0, top: 0 }}>
                  Export
                </button>
              </>
            }
            control={
              <button type="button" onClick={() => (clicks += 1)}>
                Edit
              </button>
            }
          />
        </>
      );
      await expect.poll(scrollStop).toEqual(STOP);
      const box = viewport();
      const end = box.scrollWidth - box.clientWidth;
      box.scrollLeft = end;
      await nextFrames(2);
      expect(Math.abs(box.scrollLeft - end)).toBeLessThanOrEqual(1);
      const scrolled = box.scrollLeft;
      const exportAt = () => {
        const { x, y } = roleNamed("button", "Export").getBoundingClientRect();
        return { x, y };
      };
      const placed = exportAt();

      roleNamed("button", "Before").focus();
      await userEvent.tab();
      expect(box.matches(":focus-visible")).toBe(true);
      // The viewport's observers measure on the next frame.
      await nextFrames(3);
      expect(document.activeElement).toBe(box);
      expect(scrollStop()).toEqual(STOP);
      expect(box.scrollLeft).toBe(scrolled);
      expect(exportAt()).toEqual(placed);

      // A pointer over the last cell, scrolled into view, hits the cell.
      const cell = roleNamed("cell", "1200 kWh");
      const shown = cell.getBoundingClientRect();
      expect(shown.right).toBeLessThanOrEqual(box.getBoundingClientRect().right);
      expect(document.elementFromPoint(shown.x + shown.width / 2, shown.y + shown.height / 2)).toBe(cell);
      await userEvent.click(roleNamed("button", "Edit"));
      expect(clicks).toBe(1);
    } finally {
      style.remove();
    }
  });

  it("keeps a height-capped framed table's sticky header and focus outline on its visible box as it scrolls down", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <CappedTable aria-label="Meter readings" />
        <RingSwatch />
      </>
    );
    const stop = page.getByRole("group", { name: "Meter readings" });
    await expect.poll(() => stop.query()).not.toBeNull();
    expect(cappedOverflow()).toEqual({ wider: true, taller: true });
    const ring = await ringColor();
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(stop.element());

    await userEvent.keyboard("{End}");
    const lastRow = roleNamed("cell", "Meter 6");
    await expect
      .poll(() => lastRow.getBoundingClientRect().bottom <= cappedBox().getBoundingClientRect().bottom + 1)
      .toBe(true);
    expect(htmlTable("Meter readings").tHead?.getBoundingClientRect().top).toBeCloseTo(
      cappedBox().getBoundingClientRect().top,
      0
    );
    for (const pixel of await edgePixels(cappedBox()))
      expect(pixel, "an edge of the scrolled box").toEqual(ring);
  });

  it("adds no tab stop around a height-capped table that sets its tabIndex to -1", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <CappedTable aria-label="Meter readings" tabIndex={-1} />
        <button type="button">After</button>
      </>
    );
    await nextFrames(2);
    expect(cappedOverflow()).toEqual({ wider: true, taller: true });
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });

  it("renders a plain table where the browser has no ResizeObserver", async () => {
    const resizeObserver = Object.getOwnPropertyDescriptor(window, "ResizeObserver");
    if (resizeObserver === undefined) throw new Error("expected a ResizeObserver to remove");
    Reflect.deleteProperty(window, "ResizeObserver");
    try {
      renderThemed(<MeterTable aria-label="Meter readings" />);
      await nextFrames(2);
      expect(htmlTable("Meter readings").rows).toHaveLength(1);
      expect(scrollStop()).toEqual(NO_STOP);
    } finally {
      Object.defineProperty(window, "ResizeObserver", resizeObserver);
    }
  });
});

// The fill a framed Table's cells, a Table row in a Frame.Panel and a VerticalTable box paint in
// each state, the text that travels with it and the surface it states (see `surface-paint.tsx`).
const cell = (name: string) => () => roleNamed("cell", name);

/** A Frame's own translucent `muted` over the page, which shows through a transparent framed row. */
const FRAME: readonly Layer[] = [{ role: "--muted", alpha: 0.72 }, { role: "--background" }];

function FramedTable({ children }: { children: ReactNode }): ReactElement {
  return (
    <Frame.Root>
      <Table.Root>{children}</Table.Root>
    </Frame.Root>
  );
}

const TABLE_PARTS: readonly PartCase[] = [
  {
    label: "a framed Table.Body at rest",
    node: (className) => (
      <FramedTable>
        <Table.Body className={className}>
          <Table.Row>
            <Table.Cell>Meter</Table.Cell>
          </Table.Row>
        </Table.Body>
      </FramedTable>
    ),
    text: cell("Meter"),
    role: "--panel-foreground",
    fill: PANEL,
  },
  {
    label: "a framed Table.Cell at rest",
    node: (className) => (
      <FramedTable>
        <Table.Body>
          <Table.Row>
            <Table.Cell className={className}>Meter</Table.Cell>
          </Table.Row>
        </Table.Body>
      </FramedTable>
    ),
    text: cell("Meter"),
    role: "--panel-foreground",
    fill: PANEL,
  },
  {
    // A hovered framed row clears its cells, so the Frame's own fill shows through.
    label: "a hovered framed Table.Row",
    node: (className) => (
      <FramedTable>
        <Table.Body>
          <Table.Row className={className}>
            <Table.Cell>Meter</Table.Cell>
          </Table.Row>
        </Table.Body>
      </FramedTable>
    ),
    text: cell("Meter"),
    role: "--foreground",
    fill: FRAME,
    hover: cell("Meter"),
  },
  {
    label: "a selected framed Table.Row",
    node: (className) => (
      <FramedTable>
        <Table.Body>
          <Table.Row data-state="selected" className={className}>
            <Table.Cell>Meter</Table.Cell>
          </Table.Row>
        </Table.Body>
      </FramedTable>
    ),
    text: cell("Meter"),
    role: "--foreground",
    fill: [{ role: "--muted", alpha: 0.72 }, ...FRAME],
  },
  {
    // A framed header's row stays clear on hover, and its heads keep their own muted text.
    label: "a hovered framed Table.Header row",
    node: (className) => (
      <FramedTable>
        <Table.Header>
          <Table.Row>
            <Table.Head className={className}>Meter</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>1200 kWh</Table.Cell>
          </Table.Row>
        </Table.Body>
      </FramedTable>
    ),
    text: () => roleNamed("columnheader", "Meter"),
    role: "--muted-foreground",
    fill: FRAME,
    hover: () => roleNamed("columnheader", "Meter"),
  },
  {
    // A framed footer's row stays clear on hover and keeps the text around it.
    label: "a hovered framed Table.Footer row",
    node: (className) => (
      <FramedTable>
        <Table.Body>
          <Table.Row>
            <Table.Cell>1200 kWh</Table.Cell>
          </Table.Row>
        </Table.Body>
        <Table.Footer>
          <Table.Row className={className}>
            <Table.Cell>Total</Table.Cell>
          </Table.Row>
        </Table.Footer>
      </FramedTable>
    ),
    text: cell("Total"),
    role: "inherit",
    fill: FRAME,
    hover: cell("Total"),
  },
  {
    label: "a hovered Table.Row in a Frame.Panel",
    node: (className) => (
      <Frame.Root>
        <Frame.Panel>
          <Table.Root>
            <Table.Body>
              <Table.Row className={className}>
                <Table.Cell>Meter</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Frame.Panel>
      </Frame.Root>
    ),
    text: cell("Meter"),
    role: "--foreground",
    fill: [{ role: "--muted", alpha: 0.72 }, ...PANEL],
    hover: cell("Meter"),
  },
  {
    label: "the bordered VerticalTable.Body",
    node: (className) => (
      <VerticalTable.Root>
        <VerticalTable.Body className={className} data={[{ label: "Usage", value: "1200 kWh" }]} />
      </VerticalTable.Root>
    ),
    text: cell("1200 kWh"),
    role: "--panel-foreground",
    fill: PANEL,
  },
  {
    label: "a hovered bordered VerticalTable.Row",
    node: (className) => (
      <VerticalTable.Root>
        <VerticalTable.Body>
          <VerticalTable.Row className={className}>
            <VerticalTable.Key>Usage</VerticalTable.Key>
            <VerticalTable.Value>1200 kWh</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    ),
    text: cell("1200 kWh"),
    role: "--panel-foreground",
    fill: PANEL,
    hover: cell("1200 kWh"),
  },
  {
    label: "the compact VerticalTable.Body",
    node: (className) => (
      <VerticalTable.Root variant="non-bordered-compact">
        <VerticalTable.Body className={className} data={[{ label: "Usage", value: "1200 kWh" }]} />
      </VerticalTable.Root>
    ),
    text: cell("1200 kWh"),
    role: "inherit",
    fill: [{ role: "--background" }],
  },
];

describe("Table.Row selected in forced-colors mode", () => {
  /**
   * Rows that take focus, as in a row-focused treegrid. By default there are four, the second
   * selected and the third not, so the middle two sit between the same neighbors. Each row holds
   * a name and a Meter, whose fill forced colors keep in `Highlight`.
   */
  function renderRows(
    framed: boolean,
    ids: readonly string[] = ["first", "selected", "unselected", "last"]
  ): void {
    const table = (
      <Table.Root>
        <Table.Body>
          {ids.map((id) => (
            <Table.Row
              key={id}
              tabIndex={0}
              data-testid={id}
              data-state={id === "selected" ? "selected" : undefined}>
              <Table.Cell data-testid={`${id}-name`}>Name</Table.Cell>
              <Table.Cell>
                <Meter value={55} aria-label="Storage" className="w-24" data-testid={`${id}-meter`} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ width: 320, padding: 8 }}>{framed ? <Frame.Root>{table}</Frame.Root> : table}</div>
      )
    );
  }

  function testElement(id: string): HTMLElement {
    const element = page.getByTestId(id).element();
    if (!(element instanceof HTMLElement)) throw new Error(`expected an HTML element ${id}`);
    return element;
  }

  /**
   * A row's pixels 1px, 3px, 5px and 7px in from its left edge, at its vertical middle, and from
   * its top edge, 7px in from its left: the selection mark, the gap after it, the focus outline
   * and the row's inside, which the cell's padding keeps clear of text.
   */
  async function rowEdges(
    row: HTMLElement
  ): Promise<Record<"mark" | "gap" | "focus" | "inside", number[][]>> {
    finishAnimations([row]);
    const middle = row.getBoundingClientRect().height / 2;
    const insets = [1, 3, 5, 7];
    const pixels = await pixelsAt(row, [
      ...insets.map((inset): Point => [inset, middle]),
      ...insets.map((inset): Point => [7, inset]),
    ]);
    const at = (index: number): number[][] =>
      [pixels[index], pixels[index + insets.length]].map((pixel) => pixel ?? []);
    return { mark: at(0), gap: at(1), focus: at(2), inside: at(3) };
  }

  // Oracle: WCAG 1.4.11's 3:1 for a state indicator against the color beside it, and an
  // unselected row's pixels for what the selection leaves alone.
  it.each([
    ["plain", false],
    ["framed", true],
  ])(
    "marks a selected row of a %s table along its edge and leaves its inside as an unselected row's",
    async (_layout, framed) => {
      await withForcedColors("active", async () => {
        renderRows(framed);
        const selected = await rowEdges(testElement("selected"));
        const unselected = await rowEdges(testElement("unselected"));
        for (const [side, mark] of selected.mark.entries()) {
          expect(
            pixelContrast(mark, selected.gap[side] ?? []),
            "mark against the gap"
          ).toBeGreaterThanOrEqual(3);
          expect(
            pixelContrast(mark, unselected.mark[side] ?? []),
            "mark against an unselected row's edge"
          ).toBeGreaterThanOrEqual(3);
        }
        expect(selected.gap, "gap").toEqual(unselected.gap);
        expect(selected.inside, "inside").toEqual(unselected.inside);
      });
    }
  );

  it.each([
    ["selected", "plain", false],
    ["selected", "framed", true],
    ["unselected", "plain", false],
    ["unselected", "framed", true],
  ])("outlines a focused %s row inside its edge, the only row of a %s table", async (id, _layout, framed) => {
    await withForcedColors("active", async () => {
      // The table's scrolling container clips whatever the row draws outside its own box.
      renderRows(framed, [id]);
      const row = testElement(id);
      const unfocused = await rowEdges(row);
      await focusByKeyboard(row);
      const focused = await rowEdges(row);
      expect(focused.mark, "mark").toEqual(unfocused.mark);
      for (const [side, outline] of focused.focus.entries()) {
        expect(
          pixelContrast(outline, focused.gap[side] ?? []),
          "outline against the gap"
        ).toBeGreaterThanOrEqual(3);
        expect(
          pixelContrast(outline, unfocused.focus[side] ?? []),
          "outline against the unfocused row"
        ).toBeGreaterThanOrEqual(3);
      }
      expect(focused.inside, "inside").toEqual(unfocused.inside);
    });
  });

  // Oracle: the same header before the rows scroll under it.
  it("keeps a focused selected row's frame and outline under a sticky header with no z-index", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<CappedTable aria-label="Meter readings" headerZIndex="none" selectedMeter={2} />);
      const selected = testElement("meter-2");
      await focusByKeyboard(selected);
      viewport().scrollTop = 0;
      await nextFrames(2);
      const alone = await shownHeader();
      // The selected row's top edge goes 8px under the header's bottom edge.
      const header = shownHeaderBox();
      viewport().scrollTop = selected.getBoundingClientRect().top - header.bottom + 8;
      await nextFrames(2);
      expect(selected.getBoundingClientRect().top).toBeLessThan(header.bottom);
      expect(await shownHeader()).toEqual(alone);
    });
  });

  // Oracle: WCAG 1.4.11's 3:1 for a graphic, here the Meter's fill against its empty track.
  it("keeps a Meter's fill apart from its track inside a selected row", async () => {
    await withForcedColors("active", async () => {
      renderRows(false);
      const meter = testElement("selected-meter");
      const fill = meter.querySelector('[data-slot="meter-bar-fill"]');
      if (fill === null) throw new Error("expected the meter's fill");
      const bar = fill.getBoundingClientRect();
      const box = meter.getBoundingClientRect();
      const row = bar.top + bar.height / 2 - box.top;
      // The value is 55, so the fill ends at 55% of the bar and the track shows from there.
      const [inFill, inTrack] = await pixelsAt(meter, [
        [bar.left - box.left + bar.width / 2, row],
        [bar.right - box.left + 4, row],
      ]);
      expect(pixelContrast(inFill ?? [], inTrack ?? [])).toBeGreaterThanOrEqual(3);
    });
  });

  // Oracle: WCAG 1.4.11's 3:1 for the selection against the ground beside the text, and 1.4.3's
  // 4.5:1 for the selected text against the selection.
  it("shows text selected inside a selected row in the dark forced palette", async () => {
    await withForcedColors(
      "active",
      async () => {
        renderRows(false);
        const name = testElement("selected-name");
        const range = document.createRange();
        range.selectNodeContents(name);
        const selection = window.getSelection();
        if (selection === null) throw new Error("expected a selection");
        selection.removeAllRanges();
        selection.addRange(range);
        await nextFrames(2);
        const text = range.getBoundingClientRect();
        const box = name.getBoundingClientRect();
        // 1px in from the text box's top start corner, above the capitals, and 3px before the box.
        const top = text.top - box.top + 1;
        const [selected, ground] = await pixelsAt(name, [
          [text.left - box.left + 1, top],
          [text.left - box.left - 3, top],
        ]);
        expect(
          pixelContrast(selected ?? [], ground ?? []),
          "selection against the row"
        ).toBeGreaterThanOrEqual(3);
        expect(await glyphInkContrast(name), "text against the selection").toBeGreaterThanOrEqual(4.5);
        selection.removeAllRanges();
      },
      { colorScheme: "dark" }
    );
  });
});

describePartPaint(TABLE_PARTS);
