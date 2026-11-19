/**
 * What a grid's columns hold, as the capture's page function reads them for the facts `gridHugs`,
 * `gridHolds`, `gridWidest` and `gridTallest`, which decide where a CSS track draws as a Figma one.
 * An `auto` column draws as Figma's HUG track where it ends at its widest item's max-content width;
 * a plain `fr` column draws as Figma's FLEX track, which has no content floor (probe PG12), where CSS's
 * floor at its items' min-content width binds nowhere; and a HUG track that holds a filling layer,
 * which Figma never lets set it (PG2), draws alike where another item sets it. Each fact compares
 * lengths a font may set, which the same Roboto file draws differently on macOS and in Playwright's
 * Linux image, "Selection" 57.59px on the one and 56px on the other (C5 review, 2026-11-18). So none
 * holds by an equality of two such lengths alone: a column counts as hugging where it ends at its
 * widest item's max-content width both as rendered and with each of its texts one character longer,
 * which a font's rounding cannot fake, and a column holding its items, and an item setting its
 * track, only where it leads by the clearance the page hands in. The page calls `gridColumns` on each
 * grid of two or more columns in every mode it stamps, and keeps each fact only where every mode
 * measured it. The function is passed to the page as its source, so it reads nothing outside its own
 * body and the helpers it is handed.
 */

/** What one reading of a grid's columns found. */
export type GridColumns = {
  /** The columns as wide as their widest item at max-content, as rendered and with longer text. */
  readonly hugs: readonly number[];
  /** The columns wider than each of their items at min-content by the clearance. */
  readonly holds: readonly number[];
  /**
   * For each column, the item, by its place among the grid's items, that sets it: its only item, or
   * one wider at its own width than every other item in it by the clearance; -1 for none.
   */
  readonly widest: readonly number[];
  /** For each row, the item taller than every other item in it by the clearance, or -1. */
  readonly tallest: readonly number[];
  /** The grid's items, in the order the fields above number them. */
  readonly items: readonly Element[];
};

/** The helpers the page hands {@link gridColumns}. */
type PageHelpers = {
  /** Writes styles for a measure and puts them back. */
  readonly withStyles: (
    writes: readonly (readonly [Element, string, string])[],
    measure: () => number
  ) => number;
  /** Reads with every text in the grid one character longer, and puts the text back. */
  readonly longer: (read: () => readonly number[]) => readonly number[];
  /** Whether an element adds a box of its own to its flow beside its children's. */
  readonly addsBox: (element: Element) => boolean;
  /** The layout unit in CSS pixels within which two lengths are one. */
  readonly unit: number;
  /** The least lead, in CSS pixels, by which a font-set length counts as longer than another. */
  readonly clearance: number;
};

/**
 * Read a grid's columns. Each column's used width, from its computed `grid-template-columns`, is
 * compared with the width the column takes as a `max-content` and as a `min-content` track, its
 * items' largest contributions at those sizes, their own widths and margins included (CSS Grid 1
 * §11.5), which the page reads by writing that one track in place and the others at their used
 * widths. Each item's own width and height are its margin box with its own `justify-self` and
 * `align-self` at `start`, which leave the tracks as they are, since an item's alignment takes no
 * part in sizing them (§11.1). The grid's items are its in-flow children, and those of a `display:
 * contents` child among them (CSS Display 3 §2.5), and the page puts item `i` in row `i` divided by
 * the column count and column `i` modulo it, as auto-placement by rows does where no item places
 * itself, which the build checks the grid's CSS keeps. The grid or a `display: contents` child that
 * adds a box of its own to the grid's flow, its own text as an anonymous item (CSS Grid 1 §6.1) or a
 * `::before` or `::after` in flow, would add an item the build has no part for and move every index
 * after it, so such a grid records nothing. Runs in the page.
 *
 * @param grid - The grid element.
 * @param helpers - What the page hands in.
 * @returns What the columns hold, or undefined for no grid of two or more columns.
 */
export function gridColumns(grid: Element, helpers: PageHelpers): GridColumns | undefined {
  const { withStyles, longer, addsBox, unit, clearance } = helpers;
  const tracksNow = (): string[] => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
  const style = getComputedStyle(grid);
  const tracks = style.display.endsWith("grid") ? tracksNow() : [];
  if (tracks.length < 2 || addsBox(grid)) {
    return undefined;
  }
  const wrappers: Element[] = [];
  const itemsOf = (parent: Element): Element[] =>
    [...parent.children].flatMap((child) => {
      const own = getComputedStyle(child);
      if (own.display === "contents") {
        wrappers.push(child);
        return itemsOf(child);
      }
      return own.display === "none" || ["absolute", "fixed"].includes(own.position) ? [] : [child];
    });
  const items = itemsOf(grid);
  if (wrappers.some(addsBox)) {
    return undefined;
  }
  // The width a column takes as a `keyword` track, the others at their used widths.
  const sized = (used: readonly string[], column: number, keyword: string): number =>
    withStyles(
      [
        [
          grid,
          "grid-template-columns",
          used.map((track, index) => (index === column ? keyword : track)).join(" "),
        ],
      ],
      () => Number.parseFloat(tracksNow()[column] ?? "")
    );
  // The columns that end at their widest item's max-content width, as the page stands.
  const hugging = (): readonly number[] => {
    const used = tracksNow();
    return used.flatMap((track, column) =>
      Math.abs(Number.parseFloat(track) - sized(used, column, "max-content")) < unit ? [column] : []
    );
  };
  const longerHugs = longer(hugging);
  const hugs = hugging().filter((column) => longerHugs.includes(column));
  const holds = tracks.flatMap((track, column) =>
    Number.parseFloat(track) >= sized(tracks, column, "min-content") + clearance ? [column] : []
  );
  const outer = (item: Element, self: string, width: boolean): number =>
    withStyles([[item, self, "start"]], () => {
      const box = item.getBoundingClientRect();
      const own = getComputedStyle(item);
      const margins = width
        ? (Number.parseFloat(own.marginLeft) || 0) + (Number.parseFloat(own.marginRight) || 0)
        : (Number.parseFloat(own.marginTop) || 0) + (Number.parseFloat(own.marginBottom) || 0);
      return (width ? box.width : box.height) + margins;
    });
  const widths = items.map((item) => outer(item, "justify-self", true));
  const heights = items.map((item) => outer(item, "align-self", false));
  // A track's only item, or the one longer than every other in it by the clearance, or -1.
  const setter = (lengths: readonly number[], inTrack: (index: number) => boolean): number => {
    const members = lengths.flatMap((_length, index) => (inTrack(index) ? [index] : []));
    const [only] = members;
    if (members.length === 1 && only !== undefined) {
      return only;
    }
    const leader = members.find((index) =>
      members.every((other) => other === index || (lengths[index] ?? 0) >= (lengths[other] ?? 0) + clearance)
    );
    return leader ?? -1;
  };
  const columns = tracks.length;
  const rows = Math.ceil(items.length / columns);
  return {
    hugs,
    holds,
    widest: tracks.map((_track, column) => setter(widths, (index) => index % columns === column)),
    tallest: Array.from({ length: rows }, (_row, row) =>
      setter(heights, (index) => Math.floor(index / columns) === row)
    ),
    items,
  };
}
