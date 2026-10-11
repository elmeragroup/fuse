/**
 * Border attribution: which drawn borders take their colour from `currentColor`, the text colour.
 *
 * A probe reads every border side of an element and of its `::before` and `::after` twice: once as
 * rendered, and once with every `color` set to a sentinel. A border colour that changes under
 * the sentinel follows its box's `color`, so it is `currentColor` by
 * definition, whether spelled bare, through an undefined custom property's fallback, or mixed.
 * A box whose own `color` stays put under the sentinel, through a more specific `!important`
 * rule or an inline one, cannot be judged, so it is reported as blocking the sentinel.
 */

/** The sentinel `color`, as the browser computes it. `probeBorders` writes the same literal. */
export const SENTINEL_COLOR = "rgb(1, 2, 3)";

/** The four border sides, in CSS order. */
export const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

/** One border side. */
export type BorderSide = (typeof BORDER_SIDES)[number];

/** One side's computed border, and its colour under the sentinel `color`. */
export type SideReading = {
  readonly width: string;
  readonly style: string;
  readonly color: string;
  readonly sentinelColor: string;
};

/** One element or pseudo-element with a border width on some side. */
export type BorderReading = {
  /** The nearest `data-slot`, the element's own or an ancestor's; empty outside any part. */
  readonly slot: string;
  readonly tag: string;
  /** The pseudo-element read, or empty for the element itself. */
  readonly pseudo: "" | "::before" | "::after";
  /** The box's own computed `color` under the sentinel. */
  readonly sentinelColor: string;
  readonly sides: Readonly<Record<BorderSide, SideReading>>;
};

/**
 * The sides a reading draws: a width above zero and a style that paints.
 *
 * @param reading - The element's or pseudo-element's reading.
 * @returns The drawn sides, in CSS order.
 */
export function drawnSides(reading: BorderReading): BorderSide[] {
  return BORDER_SIDES.filter((side) => {
    const { width, style } = reading.sides[side];
    return Number.parseFloat(width) > 0 && style !== "none" && style !== "hidden";
  });
}

/**
 * The drawn sides whose colour follows the sentinel `color`.
 *
 * @param reading - The element's or pseudo-element's reading.
 * @returns The sides drawn in `currentColor`, in CSS order.
 */
export function currentColorSides(reading: BorderReading): BorderSide[] {
  return drawnSides(reading).filter(
    (side) => reading.sides[side].sentinelColor !== reading.sides[side].color
  );
}

/**
 * Whether a reading draws a border but kept its own `color` under the sentinel, so its border
 * colours cannot be attributed.
 *
 * @param reading - The element's or pseudo-element's reading.
 * @returns `true` when a drawn side exists and the box's colour is not the sentinel.
 */
export function blocksSentinel(reading: BorderReading): boolean {
  return reading.sentinelColor !== SENTINEL_COLOR && drawnSides(reading).length > 0;
}

/**
 * Every currentColor border claim, one per slot, tag, pseudo-element, side and density, with how
 * many instances make it and on which pages. A box that blocks the sentinel makes one claim
 * saying so in place of its sides.
 *
 * @param readings - Readings with the page and density each was taken at.
 * @returns The claims, sorted.
 */
export function currentColorReport(
  readings: readonly (BorderReading & { readonly page: string; readonly density: string })[]
): string[] {
  const claims = new Map<string, { count: number; pages: Set<string> }>();
  for (const reading of readings) {
    const box = `${reading.slot || "(no slot)"} <${reading.tag}>${reading.pseudo}`;
    const made = blocksSentinel(reading)
      ? [`${box} blocks the colour sentinel at ${reading.density}`]
      : currentColorSides(reading).map(
          (side) => `${box} draws its ${side} border in currentColor at ${reading.density}`
        );
    for (const claim of made) {
      const entry = claims.get(claim) ?? { count: 0, pages: new Set<string>() };
      entry.count += 1;
      entry.pages.add(reading.page);
      claims.set(claim, entry);
    }
  }
  return [...claims]
    .map(([claim, { count, pages }]) => `${claim} (${String(count)} on ${[...pages].join(", ")})`)
    .sort();
}

/**
 * Probes the borders of one demo stage in the page. It runs in the browser through
 * `locator.evaluate`, so it references nothing outside its own body.
 *
 * The stage scope reads every element inside the stage. The unseen scope reads the subtrees of the
 * parts the density probe just read (`densityOpened`), so it throws when no density pass has
 * started, and a popup's elements are read once, when it opens. An element counts with a non-empty
 * box; a generated `::before` or `::after` counts on its own, so a `display: contents` host's
 * positioned pseudo-element is read, unless it or an ancestor is `display: none` or it is
 * `visibility: hidden`. Transitions and animations are off for the read, so a colour is never
 * caught mid-way.
 *
 * The sentinel is a temporary sheet that sets `color` on every element and pseudo-element, so a
 * pseudo-element's own `color` cannot hide its currentColor border. A more specific `!important`
 * rule or an inline `style="color: … !important"` beats the sheet, so each box's own `color` is
 * read under it too.
 *
 * @param stage - The demo stage.
 * @param scope - The stage's elements, or the ones an opener just revealed.
 * @returns One reading per element or pseudo-element with a border width, in document order.
 */
export function probeBorders(stage: Element, scope: "stage" | "unseen"): BorderReading[] {
  const sides = ["top", "right", "bottom", "left"] as const;
  const opened = globalThis.densityOpened;
  if (scope === "unseen" && opened === undefined) {
    throw new Error("The unseen border scope reads densityOpened, which no density pass has set.");
  }
  const roots = scope === "stage" ? [...stage.children] : [...(opened ?? [])];
  const elements = [...new Set(roots.flatMap((root) => [root, ...root.querySelectorAll("*")]))];
  const hidden = new Map<Element, boolean>();
  const isHidden = (element: Element | null): boolean => {
    if (element === null) {
      return false;
    }
    const known = hidden.get(element);
    if (known !== undefined) {
      return known;
    }
    const result = getComputedStyle(element).display === "none" || isHidden(element.parentElement);
    hidden.set(element, result);
    return result;
  };
  // An element needs a box of its own; a pseudo-element needs to be generated and shown.
  const shows = (element: Element, pseudo: string, style: CSSStyleDeclaration): boolean => {
    if (pseudo === "") {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    }
    const generated = style.content !== "none" && style.content !== "normal";
    return generated && style.display !== "none" && style.visibility !== "hidden" && !isHidden(element);
  };
  const boxes = elements.flatMap((element) =>
    (["", "::before", "::after"] as const).flatMap((pseudo) => {
      const style = getComputedStyle(element, pseudo || null);
      const bordered = sides.some((side) => style.getPropertyValue(`border-${side}-width`) !== "0px");
      return bordered && shows(element, pseudo, style) ? [{ element, pseudo, style }] : [];
    })
  );

  const freeze = document.createElement("style");
  freeze.textContent = "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(freeze);
  const read = (style: CSSStyleDeclaration, property: string): string => style.getPropertyValue(property);
  const base = boxes.map(({ style }) =>
    sides.map((side) => ({
      width: read(style, `border-${side}-width`),
      style: read(style, `border-${side}-style`),
      color: read(style, `border-${side}-color`),
    }))
  );
  const sentinelSheet = document.createElement("style");
  sentinelSheet.textContent = "*, *::before, *::after { color: rgb(1, 2, 3) !important; }";
  document.head.append(sentinelSheet);
  const sentinel = boxes.map(({ style }) => sides.map((side) => read(style, `border-${side}-color`)));
  const sentinelColors = boxes.map(({ style }) => read(style, "color"));
  sentinelSheet.remove();
  freeze.remove();

  return boxes.map(({ element, pseudo }, index) => {
    const side = (at: number): SideReading => ({
      width: base[index]?.[at]?.width ?? "",
      style: base[index]?.[at]?.style ?? "",
      color: base[index]?.[at]?.color ?? "",
      sentinelColor: sentinel[index]?.[at] ?? "",
    });
    return {
      slot: element.closest("[data-slot]")?.getAttribute("data-slot") ?? "",
      tag: element.tagName.toLowerCase(),
      pseudo,
      sentinelColor: sentinelColors[index] ?? "",
      sides: { top: side(0), right: side(1), bottom: side(2), left: side(3) },
    };
  });
}
