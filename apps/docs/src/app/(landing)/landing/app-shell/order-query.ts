/**
 * Order search's query: free text over the fields a back-office agent searches by, and facets
 * the way the sales tool's order search filters (`order-search-data-table-toolbar.tsx`). Pure, so
 * the state machine can tell which orders the table shows before it renders.
 */
import {
  ORDER_STATUSES,
  PRICE_AREAS,
  priceAreaLabel,
  PRODUCTS,
  SALES_CHANNELS,
  STATUS_ORDER,
} from "./dashboard-orders";
import type { Order, OrderStatus, PriceArea, Product, SalesChannel } from "./dashboard-orders";

/** The value each facet picks from. */
type FacetValues = {
  readonly status: OrderStatus;
  readonly channel: SalesChannel;
  readonly product: Product;
  readonly priceArea: PriceArea;
};

/** A facet the table filters by. */
export type FacetKey = keyof FacetValues;

/** A facet's name, its options in menu order, and how an order answers it. */
type Facet<V> = {
  readonly label: string;
  readonly options: readonly V[];
  /** The order's value, or none where it has not got one yet, as a draft's price area. */
  readonly of: (order: Order) => V | undefined;
  readonly name: (value: V) => string;
};

/** Every facet, in toolbar order. */
export const FACET_KEYS = [
  "status",
  "channel",
  "product",
  "priceArea",
] as const satisfies readonly FacetKey[];

/** Every facet typed by the values it picks from. */
type FacetTable = { readonly [K in FacetKey]: Facet<FacetValues[K]> };

/** Each facet's label, options and reading of an order. */
export const FACETS: FacetTable = {
  status: {
    label: "Status",
    options: STATUS_ORDER,
    of: (order) => order.status,
    name: (status) => ORDER_STATUSES[status].label,
  },
  channel: { label: "Sales channel", options: SALES_CHANNELS, of: (order) => order.channel, name: String },
  product: { label: "Product", options: PRODUCTS, of: (order) => order.product, name: String },
  priceArea: {
    label: "Price area",
    options: PRICE_AREAS,
    of: (order) => (order.facility._tag === "Known" ? order.facility.priceArea : undefined),
    name: priceAreaLabel,
  },
};

/** The picked options per facet; an empty pick leaves the facet open. */
export type FacetPicks = { readonly [K in FacetKey]: readonly FacetValues[K][] };

/** What Order search narrows by. */
export type OrderQuery = {
  readonly text: string;
  readonly picks: FacetPicks;
};

/** The query that matches every order. */
export const EMPTY_QUERY: OrderQuery = {
  text: "",
  picks: { status: [], channel: [], product: [], priceArea: [] },
};

function searchable(order: Order): string {
  return `${String(order.id)} ${order.customer} ${order.meterPointId} ${order.address}`.toLocaleLowerCase(
    "nb-NO"
  );
}

function matchesText(order: Order, text: string): boolean {
  const haystack = searchable(order);
  return text
    .toLocaleLowerCase("nb-NO")
    .split(/\s+/u)
    .every((word) => haystack.includes(word));
}

function inFacet<K extends FacetKey>(order: Order, key: K, picked: readonly FacetValues[K][]): boolean {
  if (picked.length === 0) {
    return true;
  }
  const value = FACETS[key].of(order);
  return value !== undefined && picked.includes(value);
}

function matchesPicks(order: Order, picks: FacetPicks, except?: FacetKey): boolean {
  return FACET_KEYS.every((key) => key === except || inFacet(order, key, picks[key]));
}

/**
 * Every word of the text must appear in the order's id, customer, metering point ID or address,
 * and every facet with a pick must hold the order's value.
 *
 * @param order - The order to test.
 * @param query - The search.
 * @returns Whether Order search lists the order.
 */
export function matchesQuery(order: Order, query: OrderQuery): boolean {
  return matchesText(order, query.text.trim()) && matchesPicks(order, query.picks);
}

/**
 * How many orders an option would show, given the rest of the query: the text and every other
 * facet's picks, as a faceted search counts.
 *
 * @param orders - Every order.
 * @param query - The current search.
 * @param key - The facet the option belongs to.
 * @param option - The option to count.
 * @returns The number of orders that picking only this option in its facet would list.
 */
export function optionCount<K extends FacetKey>(
  orders: readonly Order[],
  query: OrderQuery,
  key: K,
  option: FacetValues[K]
): number {
  return orders.filter(
    (order) =>
      matchesText(order, query.text.trim()) &&
      matchesPicks(order, query.picks, key) &&
      FACETS[key].of(order) === option
  ).length;
}

/**
 * @param query - The current search.
 * @param key - The facet to change.
 * @param option - The option to add or remove.
 * @returns The query with the option toggled in its facet, in the facet's option order.
 */
export function togglePick<K extends FacetKey>(
  query: OrderQuery,
  key: K,
  option: FacetValues[K]
): OrderQuery {
  const facet: Facet<FacetValues[K]> = FACETS[key];
  const current: readonly FacetValues[K][] = query.picks[key];
  const next = current.includes(option)
    ? current.filter((value) => value !== option)
    : facet.options.filter((value) => value === option || current.includes(value));
  return { ...query, picks: { ...query.picks, [key]: next } };
}

/**
 * @param query - The current search.
 * @returns Whether anything narrows the list, so the toolbar offers a reset.
 */
export function isNarrowed(query: OrderQuery): boolean {
  return query.text.trim() !== "" || FACET_KEYS.some((key) => query.picks[key].length > 0);
}
