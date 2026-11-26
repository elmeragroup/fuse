import { createRef } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { withForcedColors } from "../../../test/media-emulation";
import { differsFromCanvas, middleOf, pixelsAt } from "../../../test/screenshot-pixels";
import { toSrgb } from "../../../test/surface-paint";
import { headingNamed, px, renderThemed } from "../../../test/themed-browser-render";
import { expectVisuallyHidden } from "../../../test/visually-hidden";
import { Avatar } from "../avatar";
import { Loader } from "../loader/loader";
import { ScrollArea } from "../scroll-area";
import { TimelineList } from "./timeline-list";
import type { TimelineListItemProps, TimelineListRootProps } from "./timeline-list";

/** A Step's props: the Item's, and the content of its Opposite and Indicator. */
type StepProps = TimelineListItemProps & {
  /** The Opposite's children; unset renders no Opposite. */
  opposite?: ReactNode;
  /** The Indicator's children; unset renders the default mark. */
  readonly indicator?: ReactNode;
  /** Whether each part gets a consumer's `data-slot` and state attributes; see `renamedSlot`. */
  readonly renamed?: boolean;
};

/** A part's name in a consumer's `data-slot`. */
type SlotPart = "list" | "event" | "when" | "rail" | "mark" | "body" | "time" | "title" | "copy";

/** The state attributes a consumer forwards to each part, which the part's own must replace. */
type ForwardedState = { readonly [P in SlotPart]?: Readonly<Record<string, string>> };
const FORWARDED: ForwardedState = {
  list: { "data-layout": "history", "data-indicator-size": "history" },
  event: { "data-status": "history" },
  mark: { "data-mark": "history" },
};

/** A consumer's `data-slot` and forwarded state attributes for a part when `renamed`, else no props. */
const renamedSlot =
  (renamed: boolean) =>
  (part: SlotPart): Readonly<Record<string, string>> =>
    renamed ? { "data-slot": `history-${part}`, ...FORWARDED[part] } : {};

/** One event composed from the parts in their order: an optional Opposite, the Indicator, the Content. */
function Step({ opposite, indicator, renamed = false, children, ...props }: StepProps): ReactNode {
  const slot = renamedSlot(renamed);
  return (
    <TimelineList.Item {...slot("event")} {...props}>
      {opposite === undefined ? null : (
        <TimelineList.Opposite {...slot("when")}>{opposite}</TimelineList.Opposite>
      )}
      {/* An unset indicator reaches the Indicator as unset children, its default mark. */}
      <TimelineList.Indicator {...slot("rail")}>{indicator}</TimelineList.Indicator>
      <TimelineList.Content {...slot("body")}>{children}</TimelineList.Content>
    </TimelineList.Item>
  );
}

/** The rail gap under the test theme: `--spacing(1)`, 4px, between a mark and each connector. */
const RAIL_GAP = 4;

/** Within half a pixel: layout rounds to a quarter pixel, and the 8.75px dot lands between pixels. */
const TOLERANCE = 0.5;

function expectNear(actual: number, expected: number, label: string): void {
  expect(
    Math.abs(actual - expected),
    `${label}: ${String(actual)} against ${String(expected)}`
  ).toBeLessThanOrEqual(TOLERANCE);
}

/** `value`, which a lookup must have found. */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what}`);
  return value;
}

function listRoot(index = 0): HTMLElement {
  const element = page.getByRole("list").elements()[index];
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a list");
  }
  return element;
}

/**
 * The Items at `indices` of the list at `list`, counted from 0 in document order, each one
 * required.
 */
function itemsIn<const T extends readonly number[]>(
  list: number,
  ...indices: T
): { -readonly [K in keyof T]: HTMLElement } {
  const items = itemsOf(listRoot(list));
  const found = indices.map((index) =>
    required(items[index], `item ${String(index)} of list ${String(list)}`)
  );
  // SAFETY: TypeScript cannot map a runtime array back to the tuple of its indices; `found` has one
  // element per index, each checked above.
  return found as { -readonly [K in keyof T]: HTMLElement };
}

function itemsOf(root: HTMLElement): HTMLElement[] {
  return [...root.children].filter((child): child is HTMLElement => child instanceof HTMLLIElement);
}

/** One Item's rail parts, found by their part markers. */
type Rail = {
  readonly rail: HTMLElement;
  readonly incoming: HTMLElement;
  readonly outgoing: HTMLElement;
  readonly indicator: HTMLElement | undefined;
};

/** The children of `parent` that are the part, by the marker a consumer's `data-slot` cannot replace. */
function childParts(parent: Element, part: string): HTMLElement[] {
  return [...parent.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute("data-timeline-list-part") === part
  );
}

function railOf(item: HTMLElement): Rail {
  const rail = required(childParts(item, "indicator")[0], "a rail");
  const connectors = childParts(rail, "connector");
  const [incoming, outgoing] = connectors;
  if (connectors.length !== 2 || incoming === undefined || outgoing === undefined) {
    throw new Error("expected an incoming and an outgoing connector");
  }
  // An empty lane draws no mark, so it counts as no lane.
  const [lane] = childParts(rail, "lane");
  return { rail, incoming, outgoing, indicator: lane?.firstChild === null ? undefined : lane };
}

const indicatorOf = (item: HTMLElement): HTMLElement => required(railOf(item).indicator, "an indicator");

/** The Item's default mark, or the node the consumer put in its lane. */
function markOf(item: HTMLElement): HTMLElement {
  const [mark] = indicatorOf(item).children;
  if (!(mark instanceof HTMLElement)) throw new Error("expected a mark");
  return mark;
}

const contentOf = (item: HTMLElement): HTMLElement =>
  required(childParts(item, "content")[0], "a content cell");

const oppositeOf = (item: HTMLElement): HTMLElement =>
  required(childParts(item, "opposite")[0], "an opposite cell");

/** Each Item's incoming and outgoing connector opacity, as `"in out"`. */
const paintsOf = (items: readonly HTMLElement[]): string[] =>
  items.map(
    (item) =>
      `${getComputedStyle(railOf(item).incoming).opacity} ${getComputedStyle(railOf(item).outgoing).opacity}`
  );

/** The glyphs a mark shows: its `svg` children that are not `display: none`. */
function shownGlyphs(mark: HTMLElement): SVGElement[] {
  return [...mark.querySelectorAll("svg")].filter((glyph) => getComputedStyle(glyph).display !== "none");
}

/** An address with no break opportunity, which a text cell must still wrap inside itself. */
const ADDRESS = "meter-reading-confirmations@grid-company.example";

/** Checks that every line of a cell's text ends inside the cell. */
function expectTextInside(cell: HTMLElement, label: string): void {
  const range = document.createRange();
  range.selectNodeContents(cell);
  const right = Math.max(...[...range.getClientRects()].map((rect) => rect.right));
  expect(right, `${label} text stays inside its cell`).toBeLessThanOrEqual(box(cell).right + TOLERANCE);
}

/** The box of the first rendered line of an element's text, read through a DOM `Range`. */
function firstLine(element: Element): DOMRect {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const text = walker.nextNode();
  if (text === null) throw new Error("expected text");
  const range = document.createRange();
  range.selectNodeContents(text);
  const [first] = range.getClientRects();
  if (first === undefined) throw new Error("expected a rendered line");
  return first;
}

const centerX = (box: DOMRect): number => box.left + box.width / 2;
const centerY = (box: DOMRect): number => box.top + box.height / 2;

const box = (element: Element): DOMRect => element.getBoundingClientRect();

/** A theme color as the browser resolves its token, apart from the recipe. */
function themeColor(token: string): string {
  const probe = document.createElement("span");
  probe.style.backgroundColor = `var(${token})`;
  listRoot().append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

const EVENTS = [
  { title: "Order placed", date: "2024-03-03", time: "3 March 2024", copy: "Confirmed at checkout." },
  {
    title: "Meter reading received",
    date: "2024-03-12",
    time: "12 March 2024",
    copy: "Submitted by the customer.",
  },
  { title: "Invoice issued", date: "2024-04-01", time: "1 April 2024", copy: "Ready for payment." },
] as const;

/** How `renderEvents` stages its list. */
type EventsStage = {
  /** Whether each Time goes across the rail, in `opposite`, instead of among the children. */
  readonly opposite?: boolean;
  /** Each Item's props, by position. */
  readonly item?: (index: number) => StepProps;
  /** The width of the list's parent, in CSS pixels. */
  readonly width?: number;
  /** Whether every part gets a consumer's `data-slot` and state attributes. */
  readonly renamed?: boolean;
  /** A child of the list before the first Item. */
  readonly before?: ReactNode;
};

/** Three events, with the Time inline or across the rail. */
function renderEvents(
  root: TimelineListRootProps,
  { opposite = false, item = () => ({}), width = 640, renamed = false, before }: EventsStage = {}
): void {
  const slot = renamedSlot(renamed);
  renderThemed(
    withLocale(
      "en-US",
      <div style={{ width }}>
        <TimelineList.Root {...slot("list")} {...root}>
          {before}
          {EVENTS.map((event, index) => {
            const time = (
              <TimelineList.Time {...slot("time")} date={event.date}>
                {event.time}
              </TimelineList.Time>
            );
            const placed: StepProps = { renamed, ...item(index) };
            if (opposite) placed.opposite = time;
            return (
              <Step key={event.title} {...placed}>
                <TimelineList.Title {...slot("title")}>{event.title}</TimelineList.Title>
                {opposite ? null : time}
                <TimelineList.Description {...slot("copy")}>{event.copy}</TimelineList.Description>
              </Step>
            );
          })}
        </TimelineList.Root>
      </div>
    )
  );
}

/** The first heading in an Item's content, the line its mark centers on or starts at. */
function titleOf(item: HTMLElement): HTMLElement {
  const title = contentOf(item).querySelector("h1, h2, h3, h4, h5, h6");
  if (!(title instanceof HTMLElement)) throw new Error("expected a title");
  return title;
}

/**
 * The rail invariants over a list's Items, against independently stated expectations: every mark
 * and segment sits on one line; a mark centers on its anchor's first line in a vertical rail and
 * starts at it in a horizontal one; the gap before and after every mark is `RAIL_GAP`; a markless
 * Item's segments meet; and each Item's outgoing segment ends where the next Item's incoming
 * segment starts.
 *
 * @param items - The list's Items, in order.
 * @param options - Whether the rail runs horizontally, and the element each mark aligns to, the
 *   title by default.
 */
function expectRail(
  items: readonly HTMLElement[],
  {
    horizontal = false,
    anchor = titleOf,
  }: { horizontal?: boolean; anchor?: (item: HTMLElement) => Element } = {}
): void {
  const across = horizontal ? centerY : centerX;
  const [first] = items;
  if (first === undefined) throw new Error("expected an item");
  const line = across(box(railOf(first).outgoing));
  const before = (mark: DOMRect, incoming: DOMRect): number =>
    horizontal ? mark.left - incoming.right : mark.top - incoming.bottom;
  const after = (mark: DOMRect, outgoing: DOMRect): number =>
    horizontal ? outgoing.left - mark.right : outgoing.top - mark.bottom;
  items.forEach((item, index) => {
    const label = `item ${String(index)}`;
    const incoming = box(railOf(item).incoming);
    const outgoing = box(railOf(item).outgoing);
    expectNear(across(incoming), line, `${label} incoming segment on the line`);
    expectNear(across(outgoing), line, `${label} outgoing segment on the line`);
    if (railOf(item).indicator === undefined) {
      expectNear(
        horizontal ? incoming.right : incoming.bottom,
        horizontal ? outgoing.left : outgoing.top,
        `${label} segments meet`
      );
    } else {
      const mark = box(markOf(item));
      const text = firstLine(anchor(item));
      expectNear(across(mark), line, `${label} mark on the line`);
      expectNear(
        horizontal ? mark.left : centerY(mark),
        horizontal ? text.left : centerY(text),
        `${label} mark on its text`
      );
      expectNear(after(mark, outgoing), RAIL_GAP, `${label} gap after the mark`);
      if (!(horizontal && index === 0))
        expectNear(before(mark, incoming), RAIL_GAP, `${label} gap before the mark`);
    }
    const next = items[index + 1];
    if (next !== undefined) {
      const nextIncoming = box(railOf(next).incoming);
      expectNear(
        horizontal ? outgoing.right : outgoing.bottom,
        horizontal ? nextIncoming.left : nextIncoming.top,
        `${label} segment meets the next`
      );
    }
  });
}

describe("TimelineList", () => {
  it("renders one list of listitems with heading and text content, hiding each rail", () => {
    renderEvents({});
    const root = listRoot();
    expect(page.getByRole("list").elements()).toHaveLength(1);
    expect(root.tagName).toBe("OL");
    expect(root.getAttribute("role")).toBe("list");
    // No Item draws a list marker.
    for (const item of itemsOf(root)) expect(getComputedStyle(item).display).not.toBe("list-item");
    expect(page.getByRole("listitem").elements()).toHaveLength(3);
    expect(headingNamed("Order placed", 3)).toBeDefined();
    expect(page.getByText("Confirmed at checkout.").element()).toBeDefined();
    for (const item of itemsOf(root)) {
      const { rail, indicator } = railOf(item);
      expect(rail.getAttribute("aria-hidden")).toBe("true");
      expect(indicator?.tagName).toBe("DIV");
    }
    // A list does not indent itself: the first rail starts at the list's start edge.
    const [first] = itemsIn(0, 0);
    expectNear(box(railOf(first).rail).left, box(root).left, "rail at the list start");
  });

  it("announces each status through hidden text or aria-current, and lets statusLabel and a defined aria-current replace them", () => {
    // Each title is unique, so it keys its Step.
    const steps: readonly (readonly [title: string, props: StepProps])[] = [
      ["Placed", { status: "complete", opposite: "3 March 2024" }],
      ["Picked", { status: "current" }],
      ["Shipped", { status: "upcoming" }],
      ["Failed", { status: "error" }],
      ["Invoiced", {}],
      ["Delivered", { status: "complete", statusLabel: "Delivered on time" }],
      ["Returned", { status: "error", statusLabel: "" }],
      ["Packed", { status: "current", statusLabel: "In progress" }],
      ["Today", { status: "current", "aria-current": "date" }],
      ["Forwarded", { status: "current", "aria-current": undefined }],
      ["Opted out", { status: "current", "aria-current": false }],
    ];
    renderThemed(
      withLocale(
        "nb-NO",
        <TimelineList.Root>
          {steps.map(([title, props]) => (
            <Step key={title} {...props}>
              <TimelineList.Title>{title}</TimelineList.Title>
            </Step>
          ))}
        </TimelineList.Root>
      )
    );
    // `statusLabel` replaces the locale text, an empty one renders none, and a defined
    // `aria-current` wins while a forwarded `undefined` keeps the automatic `"step"`.
    const labeled = itemsIn(0, 5, 6, 7, 8, 9, 10);
    const texts = labeled.map((item) => item.textContent).join(" | ");
    expect(texts).toBe(
      "Delivered on time Delivered | Returned | In progress Packed | Today | Forwarded | Opted out"
    );
    const currents = labeled.slice(2).map((item) => item.getAttribute("aria-current"));
    expect(currents).toEqual(["step", "date", "step", "false"]);
    const [complete, current, upcoming, error, plain] = itemsIn(0, 0, 1, 2, 3, 4);
    // The status text reads first, then the parts in the order they are written.
    expect(complete.textContent).toBe("Fullført 3 March 2024Placed");
    const expected: readonly [HTMLElement, string | null, string | null][] = [
      [complete, "Fullført ", null],
      [current, null, "step"],
      [upcoming, "Kommende ", null],
      [error, "Feil ", null],
      [plain, null, null],
    ];
    for (const [item, text, current] of expected) {
      const hidden = item.firstElementChild;
      expect(item.getAttribute("aria-current")).toBe(current);
      if (text === null) {
        expect(hidden?.getAttribute("data-slot")).toBe("timeline-list-indicator");
        continue;
      }
      // The status text is the Item's first child, visually hidden, before its parts.
      expect(hidden?.nextElementSibling?.getAttribute("data-timeline-list-part")).toMatch(
        /opposite|indicator/
      );
      expect(hidden?.textContent).toBe(text);
      if (hidden !== null) expectVisuallyHidden(hidden, "status text");
    }
  });

  it("merges consumer className last, forwards native attributes and ref, keeps defaults a forwarded undefined would erase, and sets Title levels", () => {
    const rootRef = createRef<HTMLOListElement>();
    const itemRef = createRef<HTMLLIElement>();
    const timeRef = createRef<HTMLTimeElement>();
    const descriptionRef = createRef<HTMLDivElement>();
    renderThemed(
      <TimelineList.Root ref={rootRef} id="history" className="max-w-md" data-track="orders" role={undefined}>
        <Step ref={itemRef} className="gap-x-6 ring-1" data-step="1">
          <TimelineList.Title className="uppercase">Order placed</TimelineList.Title>
          <TimelineList.Time
            ref={timeRef}
            date="2024-03-03T10:00:00.000Z"
            className="tabular-nums"
            id="placed-at">
            3 March 2024
          </TimelineList.Time>
          <TimelineList.Description ref={descriptionRef} className="text-sm" id="placed-copy">
            Confirmed at checkout.
          </TimelineList.Description>
        </Step>
        <TimelineList.Item>
          <TimelineList.Indicator aria-hidden={undefined} data-testid="forwarded" />
          <TimelineList.Indicator aria-hidden={false} data-testid="shown" />
          <TimelineList.Content>
            <TimelineList.Title level={2}>Outline</TimelineList.Title>
          </TimelineList.Content>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    renderThemed(<TimelineList.Root role="none" data-testid="replaced" />);
    // A forwarded `undefined` keeps the list role and the hidden rail; a defined value replaces them.
    const shown = (id: string, name: string): string | null =>
      page.getByTestId(id).element().getAttribute(name);
    expect([
      shown("forwarded", "aria-hidden"),
      shown("shown", "aria-hidden"),
      shown("replaced", "role"),
    ]).toEqual(["true", "false", "none"]);
    const root = listRoot();
    expect(root.getAttribute("role")).toBe("list");
    expect(rootRef.current).toBe(root);
    expect([root.id, root.getAttribute("data-track")]).toEqual(["history", "orders"]);
    expect(px(getComputedStyle(root).maxWidth)).toBe(448);

    const [item] = itemsIn(0, 0);
    expect(itemRef.current).toBe(item);
    const itemStyle = getComputedStyle(item);
    expect([item.getAttribute("data-step"), itemStyle.boxShadow === "none"]).toEqual(["1", false]);
    expect(px(itemStyle.columnGap)).toBe(24);

    expect(getComputedStyle(headingNamed("Order placed")).textTransform).toBe("uppercase");
    // A Title is a level 3 heading by default, and an explicit level replaces it; noMargin stays forced.
    const defaultTitle = headingNamed("Order placed", 3);
    const titleSlot = defaultTitle.getAttribute("data-slot");
    expect([titleSlot, px(getComputedStyle(defaultTitle).marginBottom)]).toEqual(["timeline-list-title", 0]);
    expect(headingNamed("Outline", 2).tagName).toBe("H2");
    const time = page.getByText("3 March 2024", { exact: true }).element();
    if (!(time instanceof HTMLTimeElement)) throw new Error("expected a time element");
    expect(timeRef.current).toBe(time);
    expect([time.id, time.getAttribute("datetime")]).toEqual(["placed-at", "2024-03-03T10:00:00.000Z"]);
    expect(getComputedStyle(time).fontVariantNumeric).toContain("tabular-nums");
    const description = page.getByText("Confirmed at checkout.", { exact: true }).element();
    if (!(description instanceof HTMLElement)) throw new Error("expected the description");
    expect(descriptionRef.current).toBe(description);
    expect([description.id, px(getComputedStyle(description).fontSize)]).toEqual(["placed-copy", 14]);
  });

  for (const indicatorSize of ["dot", "md", "lg"] as const) {
    for (const layout of ["vertical", "horizontal"] as const) {
      it(`keeps the ${layout} ${indicatorSize} rail invariants, each mark on its title and the first at the list start`, () => {
        renderEvents({ layout, indicatorSize }, { item: () => ({ status: "complete" }) });
        expectRail(itemsOf(listRoot()), { horizontal: layout === "horizontal" });
        const [first] = itemsIn(0, 0);
        const start = layout === "horizontal" ? box(markOf(first)).left : box(railOf(first).rail).left;
        expectNear(start, box(listRoot()).left, "first mark or rail flush with the list start");
        // No segment paints before the first mark or after the last; the ones between paint.
        expect(paintsOf(itemsOf(listRoot()))).toEqual(["0 1", "1 1", "1 0"]);
      });
    }

    it(`keeps the ${indicatorSize} rail geometry in a wide alternate list, with the body on alternating sides`, () => {
      renderEvents(
        { layout: "alternate", indicatorSize },
        { opposite: true, item: () => ({ status: "complete" }) }
      );
      const items = itemsOf(listRoot());
      expectRail(items);
      const [odd, even] = itemsIn(0, 0, 1);
      const railX = centerX(box(railOf(odd).rail));
      expect(box(contentOf(odd)).left).toBeGreaterThan(railX);
      expect(box(oppositeOf(odd)).right).toBeLessThan(railX);
      expect(box(contentOf(even)).right).toBeLessThan(railX);
      expect(box(oppositeOf(even)).left).toBeGreaterThan(railX);
      expectNear(centerX(box(railOf(even).rail)), railX, "both rails on one line");
    });
  }

  for (const layout of ["vertical", "horizontal"] as const) {
    for (const indicatorSize of ["md", "lg"] as const) {
      it(`keeps a ${layout} ${indicatorSize} rail, its dated cells and each dot when every part takes a consumer's data-slot and state attributes`, () => {
        // An unset default dot and an explicit childless Mark's dot, around a status mark.
        const mark = <TimelineList.Mark {...renamedSlot(true)("mark")} />;
        const lanes: StepProps[] = [{}, { status: "complete" }, { indicator: mark }];
        renderEvents(
          { layout, indicatorSize },
          { opposite: true, renamed: true, item: (index) => lanes[index] ?? {} }
        );
        expectRail(itemsOf(listRoot()), { horizontal: layout === "horizontal" });
        const [first, statused, last] = itemsIn(0, 0, 1, 2);
        expect(shownGlyphs(markOf(statused)), "the complete mark's check").toHaveLength(1);
        for (const dot of [first, last]) expectNear(box(markOf(dot)).width, 8.75, "the dot");
      });
    }
  }

  for (const layout of ["vertical", "alternate"] as const) {
    it(`leaves a leading template and a hidden first, middle or last ${layout} Item out of the opposite column, rail ends, spacing and sides`, () => {
      // Each list hides one Item, or starts with a template, as React's streamed Suspense shell does.
      const cases = [0, 1, 2, "template"] as const;
      for (const hidden of cases) {
        const before = hidden === "template" ? <template /> : undefined;
        const item = (index: number): StepProps => (index === hidden ? { hidden: true, opposite: "Q1" } : {});
        renderEvents({ layout }, { before, item });
      }
      for (const [list, hidden] of cases.entries()) {
        const root = listRoot(list);
        const shown = itemsOf(root).filter((item) => !item.hidden);
        const [first, last] = [required(shown[0], "a shown Item"), required(shown.at(-1), "a shown Item")];
        const label = `${layout}, ${hidden === "template" ? "a leading template" : `item ${String(hidden)} hidden`}`;
        expectRail(shown);
        const ends = shown.map((item) => `${item === first ? 0 : 1} ${item === last ? 0 : 1}`);
        expect(paintsOf(shown), `${label}: no line before the first or after the last`).toEqual(ends);
        expect(getComputedStyle(contentOf(last)).paddingBlockEnd, `${label}: no trailing space`).toBe("0px");
        const sides = shown.map((item) => box(contentOf(item)).left > box(railOf(item).rail).left);
        const alternating = shown.map((_, at) => layout !== "alternate" || at % 2 === 0);
        expect(sides, `${label}: the body's sides`).toEqual(alternating);
        if (layout === "vertical")
          expectNear(box(railOf(first).rail).left, box(root).left, `${label}: no column`);
      }
    });
  }

  it("draws each status from the Item's data-status at every lane size, with no status on the Mark and every data-slot replaced", () => {
    const statuses = ["complete", "current", "upcoming", "error"] as const;
    // Each status Item's parts take a consumer's `data-slot` and state attributes, which the status styling
    // must not read.
    const slot = renamedSlot(true);
    renderThemed(
      <>
        {(["dot", "md", "lg"] as const).map((indicatorSize) => (
          <TimelineList.Root key={indicatorSize} indicatorSize={indicatorSize} {...slot("list")}>
            {(["complete", "current", "upcoming"] as const).map((status) => (
              <TimelineList.Item key={`glyph ${status}`} status={status} statusLabel="">
                <TimelineList.Indicator>
                  <TimelineList.Mark>
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M9.5 1 3 9h4.5L6 15l7-8.5H8.5z" />
                    </svg>
                  </TimelineList.Mark>
                </TimelineList.Indicator>
              </TimelineList.Item>
            ))}
            {statuses.map((status) => (
              <TimelineList.Item key={status} status={status} statusLabel="" {...slot("event")}>
                <TimelineList.Indicator {...slot("rail")}>
                  <TimelineList.Mark {...slot("mark")} />
                </TimelineList.Indicator>
                <TimelineList.Content {...slot("body")}>
                  <TimelineList.Title>{`${indicatorSize} ${status}`}</TimelineList.Title>
                </TimelineList.Content>
              </TimelineList.Item>
            ))}
          </TimelineList.Root>
        ))}
      </>
    );
    for (const [list, size] of ["dot", "md", "lg"].entries()) {
      // A Mark with a glyph fills the lane in the status's colors, as the childless complete mark does.
      const [glyphed, completeItem] = itemsIn(list, 0, 3);
      expectNear(box(markOf(glyphed)).width, box(markOf(completeItem)).width, `${size}: glyph mark fills`);
      // A Mark around children is measured through them, so it carries no skeleton role.
      expect(markOf(glyphed).hasAttribute("data-skeleton-part"), `${size}: no skeleton role`).toBe(false);
      // A glyph in a ringed Mark takes the ring's color.
      for (const ringed of itemsIn(list, 1, 2).map(markOf)) {
        const color = getComputedStyle(required(ringed.querySelector("svg") ?? undefined, "a glyph")).color;
        expect(color, `${size}: glyph in the ring's color`).toBe(getComputedStyle(ringed).borderTopColor);
      }
      const marks = itemsIn(list, 3, 4, 5, 6).map(markOf);
      const [complete, current, upcoming, error] = marks.map((mark) => getComputedStyle(mark));
      const label = `${size}: `;
      expect(complete?.backgroundColor, `${label}complete fills`).not.toBe("rgba(0, 0, 0, 0)");
      const ring = px(current?.borderTopWidth ?? "");
      expect(ring, `${label}current rings`).toBeGreaterThan(0);
      const unfilled = [px(upcoming?.borderTopWidth ?? ""), upcoming?.backgroundColor];
      expect(unfilled, `${label}upcoming rings, unfilled`).toEqual([ring, "rgba(0, 0, 0, 0)"]);
      expect(error?.backgroundColor, `${label}error fills`).toBe(themeColor("--error"));
      // At dot size the error mark is a rotated square; from md it is a circle with a cross.
      const rotatedSquare = [error?.rotate, px(error?.borderTopLeftRadius ?? "") === 0];
      expect(rotatedSquare, `${label}error mark`).toEqual(size === "dot" ? ["45deg", true] : ["0deg", false]);
      const glyphs = itemsIn(list, 3, 6).map((item) => shownGlyphs(markOf(item)).length);
      expect(glyphs, `${label}check and cross`).toEqual(size === "dot" ? [0, 0] : [1, 1]);
    }
  });

  it("keeps the rail on one line when only some Items have opposite content, which wraps unbroken text", () => {
    renderEvents({}, { width: 240, item: (index) => (index === 0 ? { opposite: ADDRESS } : {}) });
    const [dated, undated] = itemsIn(0, 0, 1);
    expectRail(itemsOf(listRoot()));
    expect(box(railOf(dated).rail).left).toBeGreaterThan(box(oppositeOf(dated)).right);
    expectNear(box(contentOf(undated)).left, box(contentOf(dated)).left, "bodies on one edge");
    expectNear(centerY(firstLine(oppositeOf(dated))), centerY(box(markOf(dated))), "date on the mark");
    expectTextInside(oppositeOf(dated), "the vertical opposite");
  });

  for (const layout of ["vertical", "alternate", "horizontal"] as const) {
    it(`shares one ${layout} line between a dot and an Avatar, and centers an Avatar and a Loader in the lane`, () => {
      const avatarNode = (
        <Avatar.Root>
          <Avatar.Fallback>KN</Avatar.Fallback>
        </Avatar.Root>
      );
      const lanes = [{}, { indicator: avatarNode }, { indicator: <Loader className="p-0" /> }];
      renderEvents({ layout, indicatorSize: "lg" }, { item: (index) => lanes[index] ?? {} });
      const [dot, avatar, loader] = itemsIn(0, 0, 1, 2);
      const spinner = markOf(loader).querySelector("svg");
      if (spinner === null) throw new Error("expected the spinner");
      // The line's center across the direction of travel: x in a vertical rail, y in a horizontal one.
      const across = layout === "horizontal" ? centerY : centerX;
      const along = layout === "horizontal" ? centerX : centerY;
      const line = across(box(railOf(dot).outgoing));
      for (const [label, node, item] of [
        ["dot", markOf(dot), dot],
        ["avatar", markOf(avatar), avatar],
        ["spinner", spinner, loader],
      ] as const) {
        expectNear(across(box(node)), line, `${label} on the line`);
        expectNear(along(box(node)), along(box(indicatorOf(item))), `${label} centered in the lane`);
      }
      if (layout !== "horizontal") {
        const title = centerY(firstLine(titleOf(avatar)));
        expectNear(centerY(box(markOf(avatar))), title, "avatar on the title line");
      }
      // The mark and the skeleton role stay off a custom node.
      expect(avatar.querySelector("[data-slot=timeline-list-mark]")).toBeNull();
      expect(indicatorOf(avatar).hasAttribute("data-skeleton-part")).toBe(false);
    });
  }

  it("folds a narrow lg alternate list to one side, the date above the body and on the mark, an undated Item on one row", () => {
    const longDate = "Tuesday 12 March 2024, after the meter reading window closed";
    renderThemed(
      <div className="w-72">
        <TimelineList.Root layout="alternate" indicatorSize="lg">
          {EVENTS.map((event, index) => (
            <Step
              key={event.title}
              status="complete"
              statusLabel=""
              opposite={
                <TimelineList.Time date={event.date}>{index === 1 ? longDate : event.time}</TimelineList.Time>
              }>
              <TimelineList.Title>{event.title}</TimelineList.Title>
              <TimelineList.Description>{event.copy}</TimelineList.Description>
            </Step>
          ))}
          <TimelineList.Item status="upcoming" statusLabel="">
            <TimelineList.Opposite hidden>
              <TimelineList.Time date="2024-05-01">1 May 2024</TimelineList.Time>
            </TimelineList.Opposite>
            <TimelineList.Indicator />
            <TimelineList.Content>
              <TimelineList.Title>Title only</TimelineList.Title>
            </TimelineList.Content>
          </TimelineList.Item>
        </TimelineList.Root>
      </div>
    );
    // An Item whose opposite cell is hidden keeps one row: its body starts at the top, its title on the mark.
    const [bare] = itemsIn(0, 3);
    expectNear(box(contentOf(bare)).top, box(bare).top, "the bare body starts on the first row");
    expectNear(centerY(box(markOf(bare))), centerY(firstLine(titleOf(bare))), "bare mark on its title");
    const items = itemsOf(listRoot()).slice(0, 3);
    items.forEach((item, index) => {
      const opposite = oppositeOf(item);
      const content = contentOf(item);
      const rail = box(railOf(item).rail);
      expect(box(opposite).left, `item ${String(index)} date beside the rail`).toBeGreaterThan(rail.right);
      expectNear(box(content).left, box(opposite).left, `item ${String(index)} one text edge`);
      expectNear(box(content).top, box(opposite).bottom, `item ${String(index)} body under the date, no gap`);
      expect(rail.bottom, `item ${String(index)} rail beside both`).toBeGreaterThanOrEqual(
        box(content).bottom - TOLERANCE
      );
    });
    // Each mark centers on its date, the first line of the stacked cells.
    expectRail(items, { anchor: oppositeOf });
    const [wrapped] = itemsIn(0, 1);
    expect(box(oppositeOf(wrapped)).height).toBeGreaterThan(firstLine(oppositeOf(wrapped)).height * 2);
  });

  it("wraps horizontal Item text, unbroken text too, inside a horizontal ScrollArea, which overflows and scrolls sideways", () => {
    const copy = "The grid company confirmed the reading and forwarded it to the supplier for billing.";
    renderThemed(
      <ScrollArea.Root orientation="horizontal" className="w-80">
        <TimelineList.Root layout="horizontal">
          {EVENTS.map((event, index) => (
            <Step key={event.title}>
              <TimelineList.Title>{index === 0 ? ADDRESS : event.title}</TimelineList.Title>
              <TimelineList.Description>{copy}</TimelineList.Description>
            </Step>
          ))}
        </TimelineList.Root>
      </ScrollArea.Root>
    );
    const root = listRoot();
    const viewport = root.closest("[data-slot=scroll-area-viewport]");
    if (!(viewport instanceof HTMLElement)) throw new Error("expected the viewport");
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    viewport.scrollLeft = 80;
    expect(viewport.scrollLeft, "the viewport scrolls sideways").toBe(80);
    expectTextInside(contentOf(itemsIn(0, 0)[0]), "the horizontal title");
    for (const item of itemsOf(root)) {
      const description = contentOf(item).querySelector("[data-slot=timeline-list-description]");
      if (description === null) throw new Error("expected a description");
      const line = firstLine(description);
      expect(box(description).height, "description wraps").toBeGreaterThan(line.height * 2);
      expect(box(description).width, "description narrower than the copy on one line").toBeLessThan(
        copy.length * 4
      );
    }
  });

  it("keeps a nested list's own layout, lane size and alignment inside a horizontal list and an alternate Item", () => {
    const nested = (
      <TimelineList.Root>
        <Step>
          <TimelineList.Title>Reading checked</TimelineList.Title>
        </Step>
        <Step>
          <TimelineList.Title>Reading approved</TimelineList.Title>
        </Step>
      </TimelineList.Root>
    );
    renderThemed(
      <div style={{ width: 768 }}>
        <TimelineList.Root layout="horizontal" indicatorSize="lg">
          <Step>
            <TimelineList.Title>Outer</TimelineList.Title>
            {nested}
          </Step>
          <Step>
            <TimelineList.Title>Outer next</TimelineList.Title>
          </Step>
        </TimelineList.Root>
        <TimelineList.Root layout="alternate" indicatorSize="lg">
          <Step>
            <TimelineList.Title>Odd</TimelineList.Title>
          </Step>
          <Step status="complete" statusLabel="">
            <TimelineList.Title>Even</TimelineList.Title>
            {nested}
          </Step>
        </TimelineList.Root>
      </div>
    );
    for (const index of [1, 3]) {
      const [first, second] = itemsIn(index, 0, 1);
      expect(box(second).top, `list ${String(index)} stacks`).toBeGreaterThanOrEqual(box(first).bottom);
      expectNear(box(second).left, box(first).left, `nested list ${String(index)} items on one edge`);
      expect(getComputedStyle(contentOf(first)).textAlign).toBe("start");
      expect(box(railOf(first).rail).left).toBeLessThan(box(contentOf(first)).left);
      expectRail([first, second]);
      // The nested list keeps its own dot lane, narrower than the outer list's lg lane.
      const [outer] = itemsIn(index - 1, 0);
      expectNear(box(indicatorOf(first)).width, box(markOf(first)).width, "the nested lane is a dot wide");
      // The outer rail's cross size is its lane: its width in a vertical list, its height in a
      // horizontal one.
      const outerRail = box(railOf(outer).rail);
      expect(box(indicatorOf(first)).width).toBeLessThan(Math.min(outerRail.width, outerRail.height));
    }
    // The complete outer Item draws a check; the dot nested in its body takes neither its fill nor its glyph.
    const [, completeOuter] = itemsIn(2, 0, 1);
    const [nestedDot] = itemsIn(3, 0);
    const glyphs = [completeOuter, nestedDot].map((item) => shownGlyphs(markOf(item)).length);
    expect(glyphs, "a check outside, none on the nested dot").toEqual([1, 0]);
    const [nestedFill, outerFill] = [nestedDot, completeOuter].map((item) => getComputedStyle(markOf(item)));
    expect(nestedFill?.backgroundColor).not.toBe(outerFill?.backgroundColor);
    // The outer even Item puts its body before the rail and aligns it to the rail.
    const [even] = itemsIn(2, 1);
    expect(getComputedStyle(contentOf(even)).textAlign).toBe("end");
  });

  it("reserves no column for an empty or hidden Opposite, draws no mark for an Indicator of null, and renders 0", () => {
    const dateWhen = (shown: boolean): ReactNode =>
      shown && <TimelineList.Time date="2024-03-03">3 March 2024</TimelineList.Time>;
    renderThemed(
      <TimelineList.Root indicatorSize="md">
        <Step opposite={dateWhen(false)} indicator={null}>
          <TimelineList.Title>Order placed</TimelineList.Title>
        </Step>
        <Step opposite={true}>
          <TimelineList.Title>Meter reading received</TimelineList.Title>
        </Step>
        <Step opposite="">
          <TimelineList.Title>Invoice issued</TimelineList.Title>
        </Step>
        <TimelineList.Item>
          <TimelineList.Opposite hidden>
            <TimelineList.Time date="2024-05-01">1 May 2024</TimelineList.Time>
          </TimelineList.Opposite>
          <TimelineList.Indicator />
          <TimelineList.Content>
            <TimelineList.Title>Payment received</TimelineList.Title>
          </TimelineList.Content>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    renderThemed(
      <TimelineList.Root indicatorSize="md">
        <Step opposite={0} indicator={0}>
          <TimelineList.Title>Zero readings</TimelineList.Title>
        </Step>
      </TimelineList.Root>
    );
    // A numeric 0 still renders, as a cell and as a lane.
    const [zero] = itemsIn(1, 0);
    expect(oppositeOf(zero).textContent).toBe("0");
    expect(indicatorOf(zero).textContent).toBe("0");
    const root = listRoot();
    const items = itemsOf(root);
    for (const item of items) {
      expect(getComputedStyle(oppositeOf(item)).display, "an empty or hidden Opposite takes no room").toBe(
        "none"
      );
      expectNear(box(railOf(item).rail).left, box(root).left, "rail at the list start");
    }
    expect(railOf(items[0] ?? root).indicator, "an Indicator of null draws no mark").toBeUndefined();
    expectRail(items);
  });

  it("keeps one line through markless Items (null, false, empty) to the last one's text, with dates that wrap above a horizontal rail", () => {
    const longDate = "Tuesday 12 March 2026, after the meter reading window closed";
    // The horizontal list's dates, by Item: the third Item has none, and the second wraps.
    const dateOf = (index: number): ReactNode =>
      index === 2 ? undefined : (
        <TimelineList.Time date="2026-01-15">
          {index === 1 ? longDate : `Q${String(index + 1)} 2026`}
        </TimelineList.Time>
      );
    renderThemed(
      <>
        {(["vertical", "horizontal"] as const).map((layout) => (
          <div key={layout} style={{ width: 960 }}>
            <TimelineList.Root layout={layout} indicatorSize="md">
              {[undefined, null, false, ""].map((indicator, index) => (
                <Step
                  key={String(indicator)}
                  {...(indicator === undefined ? { status: "complete", statusLabel: "" } : { indicator })}
                  opposite={layout === "horizontal" ? dateOf(index) : undefined}>
                  <TimelineList.Title>{`${layout} ${String(index)}`}</TimelineList.Title>
                </Step>
              ))}
            </TimelineList.Root>
          </div>
        ))}
      </>
    );
    // The markless Items pass the rail invariants; the last one's line reaches its text.
    expectRail(itemsOf(listRoot(0)));
    expectRail(itemsOf(listRoot(1)), { horizontal: true });
    for (const bare of [...itemsIn(0, 1, 2, 3), ...itemsIn(1, 1, 2, 3)])
      expect(railOf(bare).indicator).toBeUndefined();
    const [verticalLast] = itemsIn(0, 3);
    const [wrapped, horizontalLast] = itemsIn(1, 1, 3);
    const vertical = centerY(firstLine(headingNamed("vertical 3")));
    expectNear(box(railOf(verticalLast).incoming).bottom, vertical, "the vertical line reaches its title");
    const horizontal = firstLine(headingNamed("horizontal 3")).left;
    expectNear(box(railOf(horizontalLast).incoming).right, horizontal, "the horizontal line reaches it");
    // In the horizontal list each date sits above the rail and each body under it, though one date wraps.
    const wrappedDate = oppositeOf(wrapped);
    expect(box(wrappedDate).height, "the long date wraps").toBeGreaterThan(firstLine(wrappedDate).height * 2);
    for (const [index, item] of itemsOf(listRoot(1)).entries()) {
      const rail = box(railOf(item).rail);
      const placed = [
        box(contentOf(item)).top >= rail.bottom - TOLERANCE,
        index === 2 || box(oppositeOf(item)).bottom <= rail.top + TOLERANCE,
      ];
      expect(placed, `item ${String(index)} body under the rail, any date above`).toEqual([true, true]);
    }
  });

  it("gives bare opposite text and a direct Time the title's line height, and keeps a child's own", () => {
    renderThemed(
      <TimelineList.Root>
        <Step opposite={<p className="leading-none">Q1 2026</p>}>
          <TimelineList.Title>Smart meters</TimelineList.Title>
        </Step>
        <Step opposite="3 March">
          <TimelineList.Title>Order placed</TimelineList.Title>
        </Step>
        <Step opposite={<TimelineList.Time date="2026-04-15">15 April 2026</TimelineList.Time>}>
          <TimelineList.Title>Hourly prices</TimelineList.Title>
        </Step>
      </TimelineList.Root>
    );
    // Bare text takes the title's line height from the cell, so it centers on the mark.
    const [bare] = itemsIn(0, 1);
    expect(getComputedStyle(oppositeOf(bare)).lineHeight).toBe(getComputedStyle(titleOf(bare)).lineHeight);
    expectNear(centerY(firstLine(oppositeOf(bare))), centerY(box(markOf(bare))), "bare date on the mark");
    const quarter = page.getByText("Q1 2026").element();
    expect(getComputedStyle(quarter).lineHeight).toBe(getComputedStyle(quarter).fontSize);
    const time = page.getByText("15 April 2026").element();
    expect(getComputedStyle(time).lineHeight).toBe(
      getComputedStyle(headingNamed("Hourly prices")).lineHeight
    );
  });

  it("draws each mark, the default dot, glyph, ring and connector in forced-colors mode", async () => {
    await withForcedColors("active", async () => {
      renderThemed(
        <TimelineList.Root indicatorSize="md">
          {(["complete", "current", "upcoming", "error"] as const).map((status) => (
            <Step key={status} status={status} statusLabel="">
              <TimelineList.Title>{status}</TimelineList.Title>
              <TimelineList.Description>Every status draws in system colors.</TimelineList.Description>
            </Step>
          ))}
          <Step>
            <TimelineList.Title>No status</TimelineList.Title>
          </Step>
        </TimelineList.Root>
      );
      const root = listRoot();
      const [complete, current, upcoming, error, plain] = itemsIn(0, 0, 1, 2, 3, 4);
      const ring = (item: HTMLElement): DOMRect => {
        const mark = box(markOf(item));
        return new DOMRect(mark.left, centerY(mark) - 1, 2, 2);
      };
      const outgoing = box(railOf(complete).outgoing);
      const connector = new DOMRect(outgoing.left, outgoing.top + 2, 1, 8);
      expect(
        await differsFromCanvas(root, [
          middleOf(markOf(complete), 4),
          ring(current),
          middleOf(markOf(current), 2),
          ring(upcoming),
          middleOf(markOf(error), 4),
          middleOf(markOf(plain), 4),
          connector,
        ])
      ).toEqual([true, true, true, true, true, true, true]);
      // Each glyph on a filled mark paints in Canvas, so it stays visible on the CanvasText fill:
      // inside the circle's inscribed square, the mark shows both colors.
      const probe = document.createElement("span");
      probe.style.color = "Canvas";
      probe.style.backgroundColor = "CanvasText";
      root.append(probe);
      const canvasColor = getComputedStyle(probe).color;
      const canvas = toSrgb(canvasColor);
      const canvasText = toSrgb(getComputedStyle(probe).backgroundColor);
      // Out of the list before any screenshot, so the real last Item stays last.
      probe.remove();
      const near = (pixel: readonly number[], { r, g, b }: { r: number; g: number; b: number }): boolean =>
        [r, g, b].every((value, channel) => Math.abs((pixel[channel] ?? Number.NaN) - value * 255) <= 8);
      for (const [label, item] of Object.entries({ complete, error })) {
        const mark = markOf(item);
        const { width } = box(mark);
        const inset = Math.ceil(width * 0.2);
        const span = Math.floor(width) - 2 * inset;
        const points = Array.from({ length: span * span }, (_, at): readonly [number, number] => [
          inset + (at % span),
          inset + Math.floor(at / span),
        ]);
        const glyph = required(shownGlyphs(mark)[0], "a glyph");
        expect(getComputedStyle(glyph).color, `${label} glyph color`).toBe(canvasColor);
        const pixels = await pixelsAt(mark, points);
        const shows = (color: { r: number; g: number; b: number }): boolean =>
          pixels.some((pixel) => near(pixel, color));
        const shown = [shows(canvas), shows(canvasText)];
        expect(shown, `${label} glyph in Canvas on a CanvasText fill`).toEqual([true, true]);
      }
    });
  });
});
