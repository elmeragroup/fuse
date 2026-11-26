import type { CSSProperties, ReactElement, ReactNode } from "react";

import { page } from "vitest/browser";

import { Frame } from "../src/components/frame/frame";
import { Table } from "../src/components/table/table";
import type { TableRootProps } from "../src/components/table/table";
import { pixelsAt, rows, screenshotOf } from "./screenshot-pixels";

/** The table on the page, or the one with the accessible name `name`. */
export function htmlTable(name?: string): HTMLTableElement {
  const element =
    name === undefined ? page.getByRole("table").element() : page.getByRole("table", { name }).element();
  if (!(element instanceof HTMLTableElement)) {
    throw new Error(`expected a table${name === undefined ? "" : ` named ${name}`}`);
  }
  return element;
}

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

/** A one-row table of two cells, each kept on one line, in a box narrower than the table by default. */
export function MeterTable({
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

type CappedTableProps = TableRootProps & {
  /** The sticky header's own `z-index`, or `"none"` for a header that sets none. The default is 10. */
  headerZIndex?: number | "none";
  /**
   * The meter whose row is selected. With it set, each row takes focus and a test id of
   * `meter-<number>`.
   */
  selectedMeter?: number;
};

/** What a {@link CappedTable} row takes beyond its cells. */
type CappedRowProps = { tabIndex?: number; "data-testid"?: string; "data-state"?: string };

/** The props of a {@link CappedTable} row: none, or with `selectedMeter` set, focus and a test id. */
function cappedRowProps(meter: number, selectedMeter: number | undefined): CappedRowProps {
  const props: CappedRowProps = {};
  if (selectedMeter === undefined) return props;
  props.tabIndex = 0;
  props["data-testid"] = `meter-${String(meter)}`;
  if (meter === selectedMeter) props["data-state"] = "selected";
  return props;
}

/** A wide table of six rows under a sticky header, in a Frame capped shorter than the rows. */
export function CappedTable({
  headerZIndex = 10,
  selectedMeter,
  ...tableProps
}: CappedTableProps): ReactElement {
  const meters = [1, 2, 3, 4, 5, 6];
  const headerStyle: CSSProperties = { position: "sticky", top: 0, background: "var(--background)" };
  if (headerZIndex !== "none") headerStyle.zIndex = headerZIndex;
  return (
    <div style={{ width: "240px" }}>
      <Frame.Root style={{ maxHeight: "140px" }}>
        <Table.Root {...tableProps}>
          <Table.Header style={headerStyle}>
            <Table.Row>
              <Table.Head className="whitespace-nowrap">Meter at Storgata 1, Oslo</Table.Head>
              <Table.Head className="whitespace-nowrap">Reading on 24 November 2026</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {meters.map((meter) => (
              <Table.Row key={meter} {...cappedRowProps(meter, selectedMeter)}>
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
export function cappedBox(): HTMLElement {
  const box = document.querySelector('[data-slot="table-container"]');
  if (!(box instanceof HTMLElement)) throw new Error("expected the table's container");
  return box;
}

/** Whether the capped table is wider and taller than its visible area. */
export function cappedOverflow() {
  const table = htmlTable("Meter readings").getBoundingClientRect();
  const box = cappedBox().getBoundingClientRect();
  return { wider: table.width > box.width, taller: table.height > box.height };
}

/**
 * The colors of one screenshot of a box at the midpoints of its four edges, each 1px inside the
 * edge, so each point lies inside a 2px outline drawn on the box's border edge.
 */
export async function edgePixels(box: Element): Promise<number[][]> {
  const { width, height } = box.getBoundingClientRect();
  return pixelsAt(box, [
    [1, height / 2],
    [width - 2, height / 2],
    [width / 2, 1],
    [width / 2, height - 2],
  ]);
}

/** A square in the theme's `--ring` color, the color a focus outline draws in. */
export function RingSwatch(): ReactElement {
  return <div data-testid="ring" style={{ width: "8px", height: "8px", background: "var(--ring)" }} />;
}

/** The color at the middle of the rendered `RingSwatch`. */
export async function ringColor(): Promise<number[] | undefined> {
  const [color] = await rows(page.getByTestId("ring").element(), 4, [4]);
  return color;
}

/** The table's scrolling viewport. */
export function viewport(): HTMLElement {
  const element = document.querySelector('[data-slot="table-viewport"]');
  if (!(element instanceof HTMLElement)) throw new Error("expected the table's viewport");
  return element;
}

/** The viewport's role and tab index, both `null` while it is no stop. */
export function scrollStop() {
  return { role: viewport().getAttribute("role"), tabIndex: viewport().getAttribute("tabindex") };
}

/** The viewport as a scroll stop: a group in the tab order. */
export const STOP = { role: "group", tabIndex: "0" };
/** The viewport as no stop. */
export const NO_STOP = { role: null, tabIndex: null };

/** The box of the capped table's header. */
export function shownHeaderBox(): DOMRect {
  const header = htmlTable("Meter readings").tHead;
  if (header === null) throw new Error("expected the header");
  return header.getBoundingClientRect();
}

/** The viewport's pixels in the rows the capped table's header covers: the header as it shows. */
export async function shownHeader(): Promise<Uint8ClampedArray> {
  const shot = await screenshotOf(viewport());
  const height = Math.floor(shownHeaderBox().bottom - viewport().getBoundingClientRect().top);
  return shot.data.subarray(0, height * shot.width * 4);
}
