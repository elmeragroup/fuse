import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * The orders table the data table filter's browser suites drive: six handwritten rows, a field per
 * kind, and a 3,000-option Product field for the cap. Suites write their expected rows, counts and
 * summaries out by hand from these rows, never through the filter.
 */
import {
  columnFacetingFeature,
  columnFilteringFeature,
  createColumnHelper,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { functionalUpdate } from "@tanstack/react-table";
import type { ColumnFiltersState, Updater } from "@tanstack/react-table";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import stylesCss from "../dist/styles.css?raw";
import themesCss from "../dist/themes.css?raw";
import { DataTableFilter } from "../src/components/data-table-filter";
import type { DataTableFilterRootProps } from "../src/components/data-table-filter/data-table-filter";
import { defineFilterFields } from "../src/components/data-table-filter/filter-fields";
import type { FilterFieldMap } from "../src/components/data-table-filter/filter-fields";
import { createDataTableFilterFn } from "../src/components/data-table-filter/filter-fn";
import { definedProps } from "../src/internal/defined-props";
import type { SupportedLocale } from "../src/intl/locale-context";
import { ThemeScope } from "../src/theme/theme-scope";
import { withLocale } from "./locale-matrix";
import { fkasPrivate, renderThemed, roleNamed } from "./themed-browser-render";

type Status = "draft" | "pending" | "paid" | "overdue" | "cancelled";
type Tag = "priority" | "export" | "manual";

/** One fixture row. */
export type Order = {
  readonly id: string;
  readonly customer: string;
  readonly status: Status;
  readonly tags: readonly Tag[];
  readonly product: string;
  readonly amount: number;
  readonly created: Date;
};

/** Noon UTC, so the calendar day is the same in every zone the suites use. */
function day(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

const MATERIALS = [
  "Oak",
  "Pine",
  "Birch",
  "Ash",
  "Walnut",
  "Steel",
  "Brass",
  "Linen",
  "Wool",
  "Cotton",
  "Glass",
  "Stone",
];
const ITEMS = [
  "shelf",
  "chair",
  "table",
  "lamp",
  "rug",
  "mirror",
  "stool",
  "bench",
  "desk",
  "cabinet",
  "vase",
  "bowl",
  "tray",
  "basket",
  "hook",
  "rail",
  "frame",
  "clock",
  "throw",
  "cushion",
  "blanket",
  "planter",
  "candle",
  "holder",
  "box",
];
const SIZES = [20, 30, 40, 50, 60, 80, 100, 120, 160, 200];

/** 12 materials × 25 items × 10 sizes: 3,000 products in a stable order. */
export const PRODUCTS: readonly { readonly value: string; readonly label: string }[] = MATERIALS.flatMap(
  (material) =>
    ITEMS.flatMap((item) =>
      SIZES.map((size) => ({
        value: `${material.toLowerCase()}-${item}-${String(size)}`,
        label: `${material} ${item} ${String(size)} cm`,
      }))
    )
);

/** The six rows. */
export const ORDERS: readonly Order[] = [
  {
    id: "1",
    customer: "Aurora Bakeri",
    status: "paid",
    tags: ["priority"],
    product: "stone-box-200",
    amount: 120,
    created: day("2026-10-02"),
  },
  {
    id: "2",
    customer: "Fjellstue AS",
    status: "pending",
    tags: ["export"],
    product: "glass-vase-30",
    amount: 480,
    created: day("2026-10-05"),
  },
  {
    id: "3",
    customer: "Havbris Sjømat",
    status: "paid",
    tags: ["priority", "export"],
    product: "stone-box-200",
    amount: 950,
    created: day("2026-10-12"),
  },
  {
    id: "4",
    customer: "Nordlys Kafé",
    status: "overdue",
    tags: [],
    product: "glass-vase-30",
    amount: 60,
    created: day("2026-09-28"),
  },
  {
    id: "5",
    customer: "Café Nord",
    status: "draft",
    tags: ["manual"],
    product: "stone-box-200",
    amount: 300,
    created: day("2026-10-19"),
  },
  {
    id: "6",
    customer: "Bryggen Bokhandel",
    status: "pending",
    tags: ["priority"],
    product: "oak-shelf-20",
    amount: 780,
    created: day("2026-10-20"),
  },
];

const defineOrderFields = defineFilterFields<Order>();

/** A field per kind, in this order: Status, Tags, Customer, Amount, Created. */
export const FIELDS = defineOrderFields({
  status: {
    kind: "option",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  tags: {
    kind: "multiOption",
    label: "Tags",
    options: [
      { value: "priority", label: "Priority" },
      { value: "export", label: "Export" },
      { value: "manual", label: "Manual review" },
    ],
  },
  customer: { kind: "text", label: "Customer" },
  amount: { kind: "number", label: "Amount", step: 10 },
  created: { kind: "date", label: "Created" },
});

/** The same fields plus the 3,000-option Product field, ordered by count. */
export const FIELDS_WITH_PRODUCT = defineOrderFields({
  ...FIELDS,
  product: { kind: "option", label: "Product", options: PRODUCTS, order: "count" },
});

const dataTableFilter = createDataTableFilterFn({ timeZone: "UTC" });

const features = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns: { dataTableFilter },
});

const columns = createColumnHelper<typeof features, Order>();
const COLUMNS = columns.columns([
  columns.accessor("customer", { header: "Customer" }),
  columns.accessor("status", { header: "Status" }),
  columns.accessor("tags", { header: "Tags", getUniqueValues: (order) => [...order.tags] }),
  columns.accessor("product", { header: "Product" }),
  columns.accessor("amount", { header: "Amount" }),
  columns.accessor("created", { header: "Created" }),
]);

/** Status is paid, pending or overdue. */
export const STATUS_THREE: ColumnFiltersState = [
  { id: "status", value: { kind: "option", operator: "isAnyOf", values: ["paid", "pending", "overdue"] } },
];

/** The customer contains "nord". */
export const CUSTOMER_NORD: ColumnFiltersState = [
  { id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } },
];

/** Created falls in September 2026. */
export const CREATED_SEPTEMBER: ColumnFiltersState = [
  { id: "created", value: { kind: "date", operator: "isBetween", values: ["2026-09-01", "2026-09-30"] } },
];

/**
 * A calendar's stand-in for a date editor's function child, at a month grid's size: seven 36px
 * columns by eight rows.
 *
 * @returns A button named Calendar.
 */
export function CalendarStandIn(): ReactElement {
  return (
    <button type="button" style={{ width: 252, height: 288 }}>
      Calendar
    </button>
  );
}

/** The fixture's props. */
export type OrdersProps = {
  readonly initial: ColumnFiltersState;
  readonly manual?: boolean;
  readonly products?: boolean;
  readonly facets?: DataTableFilterRootProps<typeof FIELDS>["facets"];
  /** Replaces the fields, for a field config one test needs. Renders without facets. */
  readonly fields?: FilterFieldMap;
  /**
   * Controls `columnFilters` and hears every `onColumnFiltersChange` call TanStack makes, one per
   * write the filter sends.
   */
  readonly onColumnFiltersChange?: () => void;
  /**
   * With `onColumnFiltersChange`, republishes the controlled filters as deep copies at this
   * interval in ms, as a host does that parses them from the URL on every change. A status line
   * counts the republishes.
   */
  readonly republishEvery?: number;
  readonly onActiveFieldChange?: (fieldId: string | null) => void;
  readonly formatOperator?: DataTableFilterRootProps<typeof FIELDS>["formatOperator"];
  readonly children?: ReactNode;
};

/**
 * The filter over the fixture table, with the visible order ids in a status line and the raw
 * `columnFilters` state, as TanStack holds it, in another.
 */
export function Orders({
  initial,
  manual = false,
  products = false,
  facets,
  fields,
  onActiveFieldChange,
  onColumnFiltersChange,
  republishEvery,
  formatOperator,
  children,
}: OrdersProps): ReactElement {
  const [controlled, setControlled] = useState(initial);
  const [republishes, setRepublishes] = useState(0);
  useEffect(() => {
    if (republishEvery === undefined) {
      return undefined;
    }
    const timer = setInterval(() => {
      setControlled((previous) => structuredClone(previous));
      setRepublishes((count) => count + 1);
    }, republishEvery);
    return () => {
      clearInterval(timer);
    };
  }, [republishEvery]);
  const table = useTable({
    features,
    columns: COLUMNS,
    data: ORDERS,
    defaultColumn: { filterFn: "dataTableFilter" },
    initialState: { columnFilters: initial },
    manualFiltering: manual,
    ...definedProps({
      state: onColumnFiltersChange === undefined ? undefined : { columnFilters: controlled },
      onColumnFiltersChange:
        onColumnFiltersChange === undefined
          ? undefined
          : (updater: Updater<ColumnFiltersState>) => {
              onColumnFiltersChange();
              setControlled((previous) => functionalUpdate(updater, previous));
            },
    }),
  });
  const ids = table.getRowModel().rows.map((row) => row.original.id);
  const body = (
    <>
      {children ?? (
        <>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </>
      )}
      <output aria-label="Visible orders">{ids.join(" ")}</output>
      {republishEvery === undefined ? null : <output aria-label="Republishes">{republishes}</output>}
      {/* Out of the layout, so layout and scroll checks see the page they always saw. */}
      <output
        aria-label="Column filters"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {JSON.stringify(table.atoms.columnFilters.get())}
      </output>
      <button type="button">After the bar</button>
    </>
  );
  return fields === undefined ? (
    <DataTableFilter.Root
      table={table}
      fields={products ? FIELDS_WITH_PRODUCT : FIELDS}
      timeZone="UTC"
      facets={facets}
      onActiveFieldChange={onActiveFieldChange}
      formatOperator={formatOperator}>
      {body}
    </DataTableFilter.Root>
  ) : (
    <DataTableFilter.Root
      table={table}
      fields={fields}
      timeZone="UTC"
      onActiveFieldChange={onActiveFieldChange}
      formatOperator={formatOperator}>
      {body}
    </DataTableFilter.Root>
  );
}

/**
 * The raw `columnFilters` state.
 *
 * @returns The parsed JSON of the state line.
 */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- raw TanStack state, which the tests parse
export function columnFilters(): unknown {
  return JSON.parse(roleNamed("status", "Column filters").textContent);
}

/**
 * Renders the fixture in a locale.
 *
 * @param props - The fixture's props.
 * @param locale - The locale, en-US by default.
 * @returns The render result.
 */
export function renderOrders(props: OrdersProps, locale: SupportedLocale = "en-US") {
  return renderThemed(withLocale(locale, <Orders {...props} />));
}

/**
 * Freezes the clock at noon UTC on 2026-10-12 for the rest of the test, so date presets read a
 * fixed today. Order 3 was created that day, and no order the day before or after, so a preset
 * one day off changes the rows. Only `Date` is faked: timers stay real for the interactions.
 */
export function freezeToday(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/**
 * Renders the fixture inside a shadow root, as a web-component host does: the shadow root loads
 * the stylesheets itself and holds the ThemeScope, so the overlays portal into it too. Unmounts
 * when the test finishes. Locators reach an open root only, so a test of a closed one queries the
 * returned root itself.
 *
 * @param props - The fixture's props.
 * @param mode - The shadow root's mode.
 * @returns The shadow root, whose `activeElement` names the focused element inside it.
 */
export function renderOrdersInShadowRoot(props: OrdersProps, mode: ShadowRootMode = "open"): ShadowRoot {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode });
  const style = document.createElement("style");
  style.textContent = `${stylesCss}\n${themesCss}`;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  const root = createRoot(mount);
  flushSync(() => {
    root.render(<ThemeScope theme={fkasPrivate}>{withLocale("en-US", <Orders {...props} />)}</ThemeScope>);
  });
  onTestFinished(() => {
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  });
  return shadow;
}

/**
 * Renders the fixture into a same-origin iframe from this window's React, through a portal, as an
 * editor that previews content in a frame does. The frame's document loads the stylesheets and
 * holds the ThemeScope, so the overlays portal into it too, and every node there belongs to the
 * frame's realm. Unmounts when the test finishes.
 *
 * @param props - The fixture's props.
 * @returns The frame's document, whose `activeElement` names the focused element in it.
 */
export function renderOrdersInFrame(props: OrdersProps): Document {
  const frame = document.createElement("iframe");
  frame.style.width = "900px";
  frame.style.height = "700px";
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error("expected a same-origin frame document");
  }
  const style = frameDocument.createElement("style");
  style.textContent = `${stylesCss}\n${themesCss}`;
  frameDocument.head.append(style);
  const mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  flushSync(() => {
    root.render(
      createPortal(
        <ThemeScope theme={fkasPrivate}>{withLocale("en-US", <Orders {...props} />)}</ThemeScope>,
        frameDocument.body
      )
    );
  });
  onTestFinished(() => {
    flushSync(() => {
      root.unmount();
    });
    mount.remove();
    frame.remove();
  });
  return frameDocument;
}

/**
 * The visible order ids, space-separated.
 *
 * @returns The ids.
 */
export function visibleOrders(): string {
  return roleNamed("status", "Visible orders").textContent;
}

/**
 * The focused element.
 *
 * @returns The active element.
 */
export function active(): Element | null {
  return document.activeElement;
}

/**
 * Whether the element with this role and exact name has focus. Polled, since the element may
 * not exist yet while an overlay opens.
 *
 * @param role - The ARIA role.
 * @param name - The exact accessible name.
 * @returns Whether that element is the active element.
 */
export function focusIs(role: Parameters<typeof page.getByRole>[0], name: string): boolean {
  const element = page.getByRole(role, { name, exact: true }).query();
  return element !== null && element === document.activeElement;
}

/**
 * Waits for every running animation and transition, such as an overlay's open zoom. A cancelled
 * one, such as a transition a newer one replaced, counts as settled.
 */
export async function settled(): Promise<void> {
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
}

/** One painted frame of a popup: its side and its bottom edge in whole pixels. */
export type SideFrame = readonly [side: string | null, bottom: number];

/**
 * Samples the open dialog's side and bottom edge on every animation frame, the frames a person
 * sees, until the returned function stops it.
 *
 * @returns A function that stops sampling and returns the frames.
 */
export function watchSides(): () => SideFrame[] {
  const frames: SideFrame[] = [];
  let request = 0;
  const sample = () => {
    const [popup] = page.getByRole("dialog").elements();
    if (popup !== undefined) {
      frames.push([popup.getAttribute("data-side"), Math.round(popup.getBoundingClientRect().bottom)]);
    }
    request = requestAnimationFrame(sample);
  };
  request = requestAnimationFrame(sample);
  return () => {
    cancelAnimationFrame(request);
    return frames;
  };
}

/**
 * The number of side changes between consecutive frames.
 *
 * @param frames - The sampled frames.
 * @returns How many times the side changed.
 */
export function flipsIn(frames: readonly SideFrame[]): number {
  return frames.filter((frame, index) => index > 0 && frame[0] !== frames[index - 1]?.[0]).length;
}

/**
 * Whether the add menu is open.
 *
 * @returns Whether a dialog named "Add filter" is in the page.
 */
export function menuOpen(): boolean {
  return page.getByRole("dialog", { name: "Add filter" }).query() !== null;
}
