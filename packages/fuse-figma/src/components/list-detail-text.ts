/**
 * The docs List detail default demo's copy and lengths, free of imports for the client bundle, which
 * `list-detail-kit.ts` draws and `compare/list-detail-demo.ts` renders for both List detail
 * renderers.
 */

/** The width of the docs default demo's `w-3xl` row, from which its `split="3xl"` root splits. */
export const LIST_DETAIL_HOST_WIDTH = 768;

/** The height of the docs default demo's `h-80` row, which the root and its pane stretch to. */
export const LIST_DETAIL_HOST_HEIGHT = 320;

/** The docs default demo's customers: each name and product. */
export const LIST_DETAIL_CUSTOMERS = [
  { name: "Henrik Aasen", product: "Spot price" },
  { name: "Ingrid Lund", product: "Fixed price, 12 months" },
  { name: "Siri Haugen", product: "Spot price with solar" },
] as const;

/** The pane's text while nothing is selected, the docs default demo's. */
export const LIST_DETAIL_EMPTY = "Select a customer.";

/** The accessible name of the demo's `ListDetail.Close`, a ghost `icon-sm` Button with X. */
export const LIST_DETAIL_CLOSE_LABEL = "Close details";

/**
 * The classes the docs default demo passes, by the element that takes them. `close` is the
 * `ListDetail.Close` Button's, which renders only in the Sheet.
 */
export const LIST_DETAIL_DEMO_CLASSES = {
  host: "flex",
  root: "flex-1",
  list: "m-0 flex list-none flex-col gap-1 p-2",
  row: "w-full justify-start",
  empty: "text-sm m-auto p-6 text-muted-foreground",
  item: "flex flex-col gap-2 p-4",
  header: "flex items-center gap-2",
  close: "ml-auto",
  product: "text-sm m-0",
} as const;
