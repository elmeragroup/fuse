import type { RscStatus } from "../src/lib/docs-model";
import inventoryJson from "./fixtures/component-inventory.json";

/** One reviewed component page. */
export type InventoryEntry = {
  /** The name the SideNav and the page heading show. */
  readonly title: string;
  /** The page's RSC status, reviewed by hand rather than read from source. */
  readonly rsc: RscStatus;
  /**
   * Exactly the `.tsx` files in the page's demos directory. Generation fails unless the page
   * renders every one.
   */
  readonly demos: readonly string[];
};

function parseRscStatus(slug: string, value: string): RscStatus {
  if (value === "client" || value === "server") {
    return value;
  }
  throw new Error(`component-inventory.json: "${slug}" has rsc "${value}", not client or server`);
}

/**
 * The hand-reviewed component inventory, keyed by slug in the order the generator globs
 * pages. Tests compare generated output against it, so nothing here is generated.
 */
export const COMPONENT_INVENTORY: ReadonlyMap<string, InventoryEntry> = new Map(
  Object.entries(inventoryJson).map(([slug, entry]) => [
    slug,
    { title: entry.title, rsc: parseRscStatus(slug, entry.rsc), demos: entry.demos },
  ])
);
