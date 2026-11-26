import type { CSSProperties, ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { axFocused, axNodes } from "../../../test/ax-tree";
import { assertNoAxeViolations } from "../../../test/axe";
import { pixelsAt, rows } from "../../../test/screenshot-pixels";
import { PANEL, describePartPaint } from "../../../test/surface-paint";
import type { Layer, PartCase } from "../../../test/surface-paint";
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
import { Table, VerticalTable } from "./table";
import type { TableRootProps, VerticalTableItem } from "./table";

function htmlTable(name?: string): HTMLTableElement {
  const element =
    name === undefined ? page.getByRole("table").element() : page.getByRole("table", { name }).element();
  if (!(element instanceof HTMLTableElement)) {
    throw new Error(`expected a table${name === undefined ? "" : ` named ${name}`}`);
  }
  return element;
}

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

type MeterTableProps = TableRootProps & {
  /** The width of the box around the table. The default is narrower than the table. */
  width?: string;
  /** Whether a `Frame.Root` holds the table. */
  framed?: boolean;
  /** The two cells' text, each kept on one line. */
  cells?: readonly [string, string];
  /** The first cell's style. */
  firstCell?: CSSProperties;
  /** Content placed before the first cell's text. */
  control?: ReactNode;
  /** The table's caption, rendered as `Table.Caption`. */
  caption?: ReactNode;
};

function MeterTable({
  width = "200px",
  framed = false,
  cells = ["Meter 1200 at Storgata 1, Oslo", "1200 kWh read on 24 November 2026"],
  firstCell,
  control,
  caption,
  ...tableProps
}: MeterTableProps): ReactElement {
  const table = (
    <Table.Root {...tableProps}>
      {caption === undefined ? null : <Table.Caption>{caption}</Table.Caption>}
      <Table.Body>
        <Table.Row>
          <Table.Cell className="whitespace-nowrap" style={firstCell}>
            {control}
            {cells[0]}
          </Table.Cell>
          <Table.Cell className="whitespace-nowrap">{cells[1]}</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
  return <div style={{ width }}>{framed ? <Frame.Root>{table}</Frame.Root> : table}</div>;
}

/** A wide table of six rows under a sticky header, in a Frame capped shorter than the rows. */
function CappedTable(tableProps: TableRootProps): ReactElement {
  const meters = [1, 2, 3, 4, 5, 6];
  return (
    <div style={{ width: "240px" }}>
      <Frame.Root style={{ maxHeight: "140px" }}>
        <Table.Root {...tableProps}>
          <Table.Header style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--background)" }}>
            <Table.Row>
              <Table.Head className="whitespace-nowrap">Meter at Storgata 1, Oslo</Table.Head>
              <Table.Head className="whitespace-nowrap">Reading on 24 November 2026</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {meters.map((meter) => (
              <Table.Row key={meter}>
                <Table.Cell>{`Meter ${meter}`}</Table.Cell>
                <Table.Cell>{`${meter * 100} kWh`}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Frame.Root>
    </div>
  );
}

/** The Table's outer box, which the Frame caps, so it is the table's visible area. */
function cappedBox(): HTMLElement {
  const box = document.querySelector('[data-slot="table-container"]');
  if (!(box instanceof HTMLElement)) throw new Error("expected the table's container");
  return box;
}

/** Whether the capped table is wider and taller than its visible area. */
function cappedOverflow() {
  const table = htmlTable("Meter readings").getBoundingClientRect();
  const box = cappedBox().getBoundingClientRect();
  return { wider: table.width > box.width, taller: table.height > box.height };
}

/**
 * The colors of one screenshot of a box at the midpoints of its four edges, each 1px inside the
 * edge, so each point lies inside a 2px outline drawn on the box's border edge.
 */
async function edgePixels(box: Element): Promise<number[][]> {
  const { width, height } = box.getBoundingClientRect();
  return pixelsAt(box, [
    [1, height / 2],
    [width - 2, height / 2],
    [width / 2, 1],
    [width / 2, height - 2],
  ]);
}

/** A square in the theme's `--ring` color, the color a focus outline draws in. */
function RingSwatch(): ReactElement {
  return <div data-testid="ring" style={{ width: "8px", height: "8px", background: "var(--ring)" }} />;
}

/** The color at the middle of the rendered `RingSwatch`. */
async function ringColor(): Promise<number[] | undefined> {
  const [color] = await rows(page.getByTestId("ring").element(), 4, [4]);
  return color;
}

function viewport(): HTMLElement {
  const element = document.querySelector('[data-slot="table-viewport"]');
  if (!(element instanceof HTMLElement)) throw new Error("expected the table's viewport");
  return element;
}

/** The viewport's role and tab index, both `null` while it is no stop. */
function scrollStop() {
  return { role: viewport().getAttribute("role"), tabIndex: viewport().getAttribute("tabindex") };
}

const STOP = { role: "group", tabIndex: "0" };
const NO_STOP = { role: null, tabIndex: null };

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

describePartPaint(TABLE_PARTS);
