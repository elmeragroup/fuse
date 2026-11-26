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

/** Within half a pixel: layout rounds to a quarter pixel, and the 8.75px dot lands between pixels. */
const TOLERANCE = 0.5;

function expectNear(actual: number, expected: number, label: string): void {
  expect(
    Math.abs(actual - expected),
    `${label}: ${String(actual)} against ${String(expected)}`
  ).toBeLessThanOrEqual(TOLERANCE);
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
  const found = indices.map((index) => {
    const each = items[index];
    if (each === undefined) throw new Error(`expected item ${String(index)} of list ${String(list)}`);
    return each;
  });
  // SAFETY: TypeScript cannot map a runtime array back to the tuple of its indices; `found` has one
  // element per index, each checked above.
  return found as { -readonly [K in keyof T]: HTMLElement };
}

function itemsOf(root: HTMLElement): HTMLElement[] {
  return [...root.children].filter((child): child is HTMLElement => child instanceof HTMLLIElement);
}

/** One Item's rail parts, found by their styling hooks. */
type Rail = {
  readonly rail: HTMLElement;
  readonly incoming: HTMLElement;
  readonly outgoing: HTMLElement;
  readonly indicator: HTMLElement | undefined;
};

function childWithSlot(parent: Element, slot: string): HTMLElement | undefined {
  const child = [...parent.children].find((each) => each.getAttribute("data-slot") === slot);
  return child instanceof HTMLElement ? child : undefined;
}

function railOf(item: HTMLElement): Rail {
  const rail = childWithSlot(item, "timeline-list-rail");
  if (rail === undefined) throw new Error("expected a rail");
  const connectors = [...rail.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute("data-slot") === "timeline-list-connector"
  );
  const [incoming, outgoing] = connectors;
  if (connectors.length !== 2 || incoming === undefined || outgoing === undefined) {
    throw new Error("expected an incoming and an outgoing connector");
  }
  return { rail, incoming, outgoing, indicator: childWithSlot(rail, "timeline-list-indicator") };
}

function indicatorOf(item: HTMLElement): HTMLElement {
  const { indicator } = railOf(item);
  if (indicator === undefined) throw new Error("expected an indicator");
  return indicator;
}

/** The Item's default mark, or the node the consumer put in its lane. */
function markOf(item: HTMLElement): HTMLElement {
  const [mark] = indicatorOf(item).children;
  if (!(mark instanceof HTMLElement)) throw new Error("expected a mark");
  return mark;
}

function contentOf(item: HTMLElement): HTMLElement {
  const content = childWithSlot(item, "timeline-list-content");
  if (content === undefined) throw new Error("expected a content cell");
  return content;
}

function oppositeOf(item: HTMLElement): HTMLElement {
  const opposite = childWithSlot(item, "timeline-list-opposite");
  if (opposite === undefined) throw new Error("expected an opposite cell");
  return opposite;
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

function centerX(box: DOMRect): number {
  return box.left + box.width / 2;
}

function centerY(box: DOMRect): number {
  return box.top + box.height / 2;
}

const box = (element: Element): DOMRect => element.getBoundingClientRect();

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
  readonly item?: (index: number) => TimelineListItemProps;
  /** The width of the list's parent, in CSS pixels. */
  readonly width?: number;
};

/** Three events, with the Time inline or across the rail. */
function renderEvents(
  root: TimelineListRootProps,
  { opposite = false, item = () => ({}), width = 640 }: EventsStage = {}
): void {
  renderThemed(
    withLocale(
      "en-US",
      <div style={{ width }}>
        <TimelineList.Root {...root}>
          {EVENTS.map((event, index) => {
            const time = <TimelineList.Time date={event.date}>{event.time}</TimelineList.Time>;
            const placed: TimelineListItemProps = item(index);
            if (opposite) placed.opposite = time;
            return (
              <TimelineList.Item key={event.title} {...placed}>
                <TimelineList.Title>{event.title}</TimelineList.Title>
                {opposite ? null : time}
                <TimelineList.Description>{event.copy}</TimelineList.Description>
              </TimelineList.Item>
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
 * starts at it in a horizontal one; the gap before and after every mark is one length, measured
 * beside the first mark; a markless Item's segments meet; and each Item's outgoing segment ends
 * where the next Item's incoming segment starts.
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
  let gap: number | undefined;
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
      gap ??= after(mark, outgoing);
      expect(gap, "the rail gap").toBeGreaterThan(0);
      expectNear(after(mark, outgoing), gap, `${label} gap after the mark`);
      if (!(horizontal && index === 0))
        expectNear(before(mark, incoming), gap, `${label} gap before the mark`);
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

  it("keeps role=list for a forwarded role={undefined} and lets a defined role replace it", () => {
    renderThemed(
      <>
        <TimelineList.Root role={undefined} data-testid="forwarded" />
        <TimelineList.Root role="none" data-testid="replaced" />
      </>
    );
    expect(page.getByTestId("forwarded").element().getAttribute("role")).toBe("list");
    expect(page.getByTestId("replaced").element().getAttribute("role")).toBe("none");
  });

  it("reads the opposite content, then the status text, then the children", () => {
    renderThemed(
      withLocale(
        "en-US",
        <TimelineList.Root>
          <TimelineList.Item
            status="complete"
            opposite={<TimelineList.Time date="2024-03-03">3 March 2024</TimelineList.Time>}>
            <TimelineList.Title>Order placed</TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      )
    );
    const [item] = itemsOf(listRoot());
    expect(item?.textContent).toBe("3 March 2024Completed Order placed");
  });

  it("announces complete, upcoming and error through hidden text, and current through aria-current", () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <TimelineList.Root>
          <TimelineList.Item status="complete">
            <TimelineList.Title>Placed</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item status="current">
            <TimelineList.Title>Packed</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item status="upcoming">
            <TimelineList.Title>Shipped</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item status="error">
            <TimelineList.Title>Delivered</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>Invoiced</TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      )
    );
    const [complete, current, upcoming, error, plain] = itemsOf(listRoot());
    const expected: readonly [HTMLElement | undefined, string | null, string | null][] = [
      [complete, "Fullført ", null],
      [current, null, "step"],
      [upcoming, "Kommende ", null],
      [error, "Feil ", null],
      [plain, null, null],
    ];
    for (const [item, text, current] of expected) {
      if (item === undefined) throw new Error("expected five items");
      const content = contentOf(item);
      const hidden = content.firstElementChild;
      expect(item.getAttribute("aria-current")).toBe(current);
      if (text === null) {
        expect(content.firstElementChild?.tagName).toBe("H3");
        continue;
      }
      // The status text comes first in the content, visually hidden, before the title.
      expect(hidden?.nextElementSibling?.tagName).toBe("H3");
      expect(hidden?.textContent).toBe(text);
      if (hidden !== null) expectVisuallyHidden(hidden, "status text");
    }
  });

  it("puts statusLabel in place of the locale text, renders none for an empty one, and lets a defined aria-current win", () => {
    renderThemed(
      <TimelineList.Root>
        <TimelineList.Item status="complete" statusLabel="Delivered on time">
          <TimelineList.Title>Delivered</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item status="error" statusLabel="">
          <TimelineList.Title>Returned</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item status="current" statusLabel="In progress">
          <TimelineList.Title>Packed</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item status="current" aria-current="date">
          <TimelineList.Title>Today</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item status="current" aria-current={undefined}>
          <TimelineList.Title>Forwarded</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item status="current" aria-current={false}>
          <TimelineList.Title>Opted out</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const [labeled, empty, current, explicit, forwarded, optedOut] = itemsOf(listRoot()).map(contentOf);
    // A wrapper that forwards `aria-current={undefined}` keeps the automatic value; `false` replaces it.
    expect(forwarded?.parentElement?.getAttribute("aria-current")).toBe("step");
    expect(optedOut?.parentElement?.getAttribute("aria-current")).toBe("false");
    expect(labeled?.textContent).toBe("Delivered on time Delivered");
    expect(empty?.textContent).toBe("Returned");
    expect(current?.textContent).toBe("In progress Packed");
    expect(current?.parentElement?.getAttribute("aria-current")).toBe("step");
    expect(explicit?.parentElement?.getAttribute("aria-current")).toBe("date");
  });

  it("lets an explicit Title level override the default of 3 and keeps noMargin forced", () => {
    renderThemed(
      <TimelineList.Root>
        <TimelineList.Item>
          <TimelineList.Title>Default</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item>
          <TimelineList.Title level={2}>Outline</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const defaultTitle = headingNamed("Default", 3);
    expect(defaultTitle.tagName).toBe("H3");
    expect(defaultTitle.getAttribute("data-slot")).toBe("timeline-list-title");
    expect(px(getComputedStyle(defaultTitle).marginBottom)).toBe(0);
    expect(headingNamed("Outline", 2).tagName).toBe("H2");
  });

  it("merges consumer className last and forwards native attributes and ref on each part", () => {
    const rootRef = createRef<HTMLOListElement>();
    const itemRef = createRef<HTMLLIElement>();
    const timeRef = createRef<HTMLTimeElement>();
    const descriptionRef = createRef<HTMLDivElement>();
    renderThemed(
      <TimelineList.Root ref={rootRef} id="history" className="max-w-md" data-track="orders">
        <TimelineList.Item ref={itemRef} className="gap-x-6 ring-1" data-step="1">
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
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const root = listRoot();
    expect(rootRef.current).toBe(root);
    expect(root.id).toBe("history");
    expect(root.getAttribute("data-track")).toBe("orders");
    expect(px(getComputedStyle(root).maxWidth)).toBe(448);

    const [item] = itemsIn(0, 0);
    expect(itemRef.current).toBe(item);
    expect(item.getAttribute("data-step")).toBe("1");
    expect(getComputedStyle(item).boxShadow).not.toBe("none");
    expect(px(getComputedStyle(item).columnGap)).toBe(24);

    expect(getComputedStyle(headingNamed("Order placed")).textTransform).toBe("uppercase");
    const time = page.getByText("3 March 2024", { exact: true }).element();
    if (!(time instanceof HTMLTimeElement)) throw new Error("expected a time element");
    expect(timeRef.current).toBe(time);
    expect(time.id).toBe("placed-at");
    expect(getComputedStyle(time).fontVariantNumeric).toContain("tabular-nums");
    expect(time.getAttribute("datetime")).toBe("2024-03-03T10:00:00.000Z");
    const description = page.getByText("Confirmed at checkout.", { exact: true }).element();
    if (!(description instanceof HTMLElement)) throw new Error("expected the description");
    expect(descriptionRef.current).toBe(description);
    expect(description.id).toBe("placed-copy");
    expect(px(getComputedStyle(description).fontSize)).toBe(14);
  });

  for (const indicatorSize of ["dot", "md", "lg"] as const) {
    for (const layout of ["vertical", "horizontal"] as const) {
      it(`keeps the ${layout} ${indicatorSize} rail invariants, each mark on its title and the first at the list start`, () => {
        renderEvents({ layout, indicatorSize }, { item: () => ({ status: "complete" }) });
        expectRail(itemsOf(listRoot()), { horizontal: layout === "horizontal" });
        const [first] = itemsIn(0, 0);
        const start = layout === "horizontal" ? box(markOf(first)).left : box(railOf(first).rail).left;
        expectNear(start, box(listRoot()).left, "first mark or rail flush with the list start");
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

  it("hides the check and cross at dot size, turns the error dot into a rotated square, and shows both glyphs from md", () => {
    renderThemed(
      <>
        {(["dot", "md"] as const).map((indicatorSize) => (
          <TimelineList.Root key={indicatorSize} indicatorSize={indicatorSize}>
            {[0, 1].map((index) => (
              <TimelineList.Item key={index} statusLabel="" status={index === 0 ? "complete" : "error"}>
                <TimelineList.Title>{`${indicatorSize} ${String(index)}`}</TimelineList.Title>
              </TimelineList.Item>
            ))}
          </TimelineList.Root>
        ))}
      </>
    );
    const glyphOf = (item: HTMLElement | undefined): SVGElement => {
      const glyph = item === undefined ? null : markOf(item).querySelector("svg");
      if (!(glyph instanceof SVGElement)) throw new Error("expected a glyph");
      return glyph;
    };
    const [dotComplete, dotError] = itemsOf(listRoot(0));
    const [mdComplete, mdError] = itemsOf(listRoot(1));
    expect(getComputedStyle(glyphOf(dotComplete)).display).toBe("none");
    expect(getComputedStyle(glyphOf(dotError)).display).toBe("none");
    expect(getComputedStyle(glyphOf(mdComplete)).display).not.toBe("none");
    expect(getComputedStyle(glyphOf(mdError)).display).not.toBe("none");
    if (dotError === undefined || mdError === undefined) throw new Error("expected error items");
    const dotErrorMark = getComputedStyle(markOf(dotError));
    expect(dotErrorMark.rotate).toBe("45deg");
    expect(px(dotErrorMark.borderTopLeftRadius)).toBe(0);
    const mdErrorMark = markOf(mdError);
    expect(getComputedStyle(mdErrorMark).rotate).not.toBe("45deg");
    expect(px(getComputedStyle(mdErrorMark).borderTopLeftRadius)).toBeGreaterThanOrEqual(
      box(mdErrorMark).width / 2
    );
  });

  it("keeps the rail on one line when only some Items have opposite content", () => {
    const date = <TimelineList.Time date="2024-03-03">3 March 2024</TimelineList.Time>;
    renderEvents({}, { item: (index) => (index === 0 ? { opposite: date } : {}) });
    const [dated, undated] = itemsIn(0, 0, 1);
    expectRail(itemsOf(listRoot()));
    expect(box(railOf(dated).rail).left).toBeGreaterThan(box(oppositeOf(dated)).right);
    expectNear(box(contentOf(undated)).left, box(contentOf(dated)).left, "bodies on one edge");
    expectNear(centerY(firstLine(oppositeOf(dated))), centerY(box(markOf(dated))), "date on the mark");
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
      expect(markOf(dot).getAttribute("data-skeleton-part")).toBe("timeline-list-mark");
    });
  }

  it("folds a narrow alternate list to one side, the date above the body and centered on the mark", () => {
    const longDate = "Tuesday 12 March 2024, after the meter reading window closed";
    renderThemed(
      <div className="w-72">
        <TimelineList.Root layout="alternate">
          {EVENTS.map((event, index) => (
            <TimelineList.Item
              key={event.title}
              opposite={
                <TimelineList.Time date={event.date}>{index === 1 ? longDate : event.time}</TimelineList.Time>
              }>
              <TimelineList.Title>{event.title}</TimelineList.Title>
              <TimelineList.Description>{event.copy}</TimelineList.Description>
            </TimelineList.Item>
          ))}
        </TimelineList.Root>
      </div>
    );
    const items = itemsOf(listRoot());
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

  it("keeps a folded lg Item without an opposite cell on one row, its title on the mark", () => {
    renderThemed(
      <div className="w-72">
        <TimelineList.Root layout="alternate" indicatorSize="lg">
          <TimelineList.Item
            status="complete"
            statusLabel=""
            opposite={<TimelineList.Time date="2024-03-03">3 March 2024</TimelineList.Time>}>
            <TimelineList.Title>Order placed</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item status="upcoming" statusLabel="">
            <TimelineList.Title>Invoice issued</TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
      </div>
    );
    const [dated, bare] = itemsIn(0, 0, 1);
    expectNear(centerY(box(markOf(dated))), centerY(firstLine(oppositeOf(dated))), "dated mark on the date");
    expectNear(
      centerY(box(markOf(bare))),
      centerY(firstLine(headingNamed("Invoice issued"))),
      "bare mark on its title"
    );
    expectNear(box(contentOf(bare)).top, box(bare).top, "the bare body starts on the first row");
  });

  it("wraps horizontal Item text inside a horizontal ScrollArea, which overflows and scrolls sideways", () => {
    const copy = "The grid company confirmed the reading and forwarded it to the supplier for billing.";
    renderThemed(
      <ScrollArea.Root orientation="horizontal" className="w-80">
        <TimelineList.Root layout="horizontal">
          {EVENTS.map((event) => (
            <TimelineList.Item key={event.title}>
              <TimelineList.Title>{event.title}</TimelineList.Title>
              <TimelineList.Description>{copy}</TimelineList.Description>
            </TimelineList.Item>
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
        <TimelineList.Item>
          <TimelineList.Title>Reading checked</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item>
          <TimelineList.Title>Reading approved</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    renderThemed(
      <div style={{ width: 768 }}>
        <TimelineList.Root layout="horizontal" indicatorSize="lg">
          <TimelineList.Item>
            <TimelineList.Title>Outer</TimelineList.Title>
            {nested}
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>Outer next</TimelineList.Title>
          </TimelineList.Item>
        </TimelineList.Root>
        <TimelineList.Root layout="alternate" indicatorSize="lg">
          <TimelineList.Item>
            <TimelineList.Title>Odd</TimelineList.Title>
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>Even</TimelineList.Title>
            {nested}
          </TimelineList.Item>
        </TimelineList.Root>
      </div>
    );
    for (const index of [1, 3]) {
      const [first, second] = itemsOf(listRoot(index));
      if (first === undefined || second === undefined) throw new Error("expected two nested items");
      expect(box(second).top, `nested list ${String(index)} stacks its items`).toBeGreaterThanOrEqual(
        box(first).bottom
      );
      expectNear(box(second).left, box(first).left, `nested list ${String(index)} items on one edge`);
      expect(getComputedStyle(contentOf(first)).textAlign).toBe("start");
      expect(box(railOf(first).rail).left).toBeLessThan(box(contentOf(first)).left);
      expectRail([first, second]);
      // The nested list keeps its own dot lane, narrower than the outer list's lg lane.
      const [outer] = itemsOf(listRoot(index - 1));
      if (outer === undefined) throw new Error("expected an outer item");
      expectNear(box(indicatorOf(first)).width, box(markOf(first)).width, "the nested lane is a dot wide");
      // The outer rail's cross size is its lane: its width in a vertical list, its height in a
      // horizontal one.
      const outerRail = box(railOf(outer).rail);
      expect(box(indicatorOf(first)).width).toBeLessThan(Math.min(outerRail.width, outerRail.height));
    }
    // The outer even Item puts its body before the rail and aligns it to the rail.
    const [even] = itemsIn(2, 1);
    expect(getComputedStyle(contentOf(even)).textAlign).toBe("end");
  });

  it("paints no segment before the first mark or after the last, and paints the ones between", () => {
    renderEvents({});
    const items = itemsOf(listRoot());
    const opacity = (element: HTMLElement): string => getComputedStyle(element).opacity;
    expect(items.map((item) => [opacity(railOf(item).incoming), opacity(railOf(item).outgoing)])).toEqual([
      ["0", "1"],
      ["1", "1"],
      ["1", "0"],
    ]);
    // The unpainted first segment keeps its length, so the first mark still centers on its title.
    const [first] = itemsIn(0, 0);
    expect(box(railOf(first).incoming).height).toBeGreaterThan(0);
  });

  it("renders no opposite cell or lane for a boolean or an empty string, and renders 0", () => {
    const dateWhen = (shown: boolean): ReactNode =>
      shown && <TimelineList.Time date="2024-03-03">3 March 2024</TimelineList.Time>;
    renderThemed(
      <TimelineList.Root indicatorSize="md">
        <TimelineList.Item opposite={dateWhen(false)} indicator="">
          <TimelineList.Title>Order placed</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item opposite={true}>
          <TimelineList.Title>Meter reading received</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item opposite="">
          <TimelineList.Title>Invoice issued</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    renderThemed(
      <TimelineList.Root indicatorSize="md">
        <TimelineList.Item opposite={0} indicator={0}>
          <TimelineList.Title>Zero readings</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    // A numeric 0 still renders, as a cell and as a lane.
    const [zero] = itemsIn(1, 0);
    expect(oppositeOf(zero).textContent).toBe("0");
    expect(indicatorOf(zero).textContent).toBe("0");
    const root = listRoot();
    const items = itemsOf(root);
    for (const item of items) {
      expect(childWithSlot(item, "timeline-list-opposite")).toBeUndefined();
      expectNear(box(railOf(item).rail).left, box(root).left, "rail at the list start");
    }
    expect(railOf(items[0] ?? root).indicator, "an empty indicator leaves no lane").toBeUndefined();
    expectRail(items);
  });

  it("gives plain-text opposite content the title's line height, so it centers on the mark", () => {
    renderThemed(
      <TimelineList.Root>
        <TimelineList.Item opposite="3 March">
          <TimelineList.Title>Order placed</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
    const [item] = itemsIn(0, 0);
    expect(getComputedStyle(oppositeOf(item)).lineHeight).toBe(
      getComputedStyle(headingNamed("Order placed")).lineHeight
    );
    expectNear(centerY(firstLine(oppositeOf(item))), centerY(box(markOf(item))), "date on the mark");
  });

  for (const layout of ["vertical", "horizontal"] as const) {
    for (const indicatorSize of ["md", "lg"] as const) {
      it(`keeps a default dot in a ${layout} ${indicatorSize} lane on its title line, with the rail gap on both sides`, () => {
        renderEvents(
          { layout, indicatorSize },
          { item: (index) => (index === 1 ? { status: "complete" } : {}) }
        );
        const items = itemsOf(listRoot());
        // A default dot comes first and last, around a lane-sized status mark: each dot stays smaller,
        // and the rail invariants hold the same gap around both.
        const [first, statused, last] = itemsIn(0, 0, 1, 2);
        for (const dot of [first, last])
          expect(box(markOf(dot)).width).toBeLessThan(box(markOf(statused)).width);
        expectRail(items, { horizontal: layout === "horizontal" });
      });
    }
  }

  it("wraps unbroken text inside its cell, in vertical and horizontal lists", () => {
    const address = "meter-reading-confirmations@grid-company.example";
    renderThemed(
      <>
        <div style={{ width: 200 }}>
          <TimelineList.Root>
            <TimelineList.Item opposite={address}>
              <TimelineList.Title>Reading confirmed</TimelineList.Title>
              <TimelineList.Description>{address}</TimelineList.Description>
            </TimelineList.Item>
          </TimelineList.Root>
        </div>
        <div style={{ width: 480 }}>
          <TimelineList.Root layout="horizontal">
            <TimelineList.Item>
              <TimelineList.Title>{address}</TimelineList.Title>
            </TimelineList.Item>
            <TimelineList.Item>
              <TimelineList.Title>Next event</TimelineList.Title>
            </TimelineList.Item>
          </TimelineList.Root>
        </div>
      </>
    );
    const cells = [
      ...itemsOf(listRoot(0)).flatMap((item) => [contentOf(item), oppositeOf(item)]),
      contentOf(itemsOf(listRoot(1))[0] ?? listRoot(1)),
    ];
    for (const [index, cell] of cells.entries()) {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const right = Math.max(...[...range.getClientRects()].map((rect) => rect.right));
      expect(right, `cell ${String(index)} text stays inside it`).toBeLessThanOrEqual(
        box(cell).right + TOLERANCE
      );
    }
  });

  it("keeps one line through markless Items (null, false, empty) to the last one's text, with dates that wrap above a horizontal rail", () => {
    const longDate = "Tuesday 12 March 2026, after the meter reading window closed";
    // The horizontal list's dates, by Item: the third Item has none.
    const dates: readonly (readonly [string, string] | undefined)[] = [
      ["2026-01-15", "Q1 2026"],
      ["2026-03-12", longDate],
      undefined,
      ["2026-10-15", "Q4 2026"],
    ];
    const dateOf = (index: number): ReactNode => {
      const date = dates[index];
      return date === undefined ? undefined : <TimelineList.Time date={date[0]}>{date[1]}</TimelineList.Time>;
    };
    renderThemed(
      <>
        {(["vertical", "horizontal"] as const).map((layout) => (
          <div key={layout} style={{ width: 960 }}>
            <TimelineList.Root layout={layout} indicatorSize="md">
              {[undefined, null, false, ""].map((indicator, index) => (
                <TimelineList.Item
                  key={String(indicator)}
                  {...(indicator === undefined ? { status: "complete", statusLabel: "" } : { indicator })}
                  opposite={layout === "horizontal" ? dateOf(index) : undefined}>
                  <TimelineList.Title>{`${layout} ${String(index)}`}</TimelineList.Title>
                </TimelineList.Item>
              ))}
            </TimelineList.Root>
          </div>
        ))}
      </>
    );
    // The markless Items pass the rail invariants; the last one's line reaches its text.
    expectRail(itemsOf(listRoot(0)));
    expectRail(itemsOf(listRoot(1)), { horizontal: true });
    for (const bare of [...itemsIn(0, 1, 2, 3), ...itemsIn(1, 1, 2, 3)]) {
      expect(railOf(bare).indicator).toBeUndefined();
    }
    const [verticalLast] = itemsIn(0, 3);
    const [wrapped, horizontalLast] = itemsIn(1, 1, 3);
    const vertical = centerY(firstLine(headingNamed("vertical 3")));
    expectNear(
      box(railOf(verticalLast).incoming).bottom,
      vertical,
      "the vertical line reaches the title line"
    );
    const horizontal = firstLine(headingNamed("horizontal 3")).left;
    expectNear(
      box(railOf(horizontalLast).incoming).right,
      horizontal,
      "the horizontal line reaches the text"
    );
    // In the horizontal list each date sits above the rail and each body under it, though one date wraps.
    expect(box(oppositeOf(wrapped)).height, "the long date wraps").toBeGreaterThan(
      firstLine(oppositeOf(wrapped)).height * 2
    );
    for (const [index, item] of itemsOf(listRoot(1)).entries()) {
      const rail = box(railOf(item).rail);
      expect(box(contentOf(item)).top, `item ${String(index)} body under the rail`).toBeGreaterThanOrEqual(
        rail.bottom - TOLERANCE
      );
      if (index !== 2)
        expect(box(oppositeOf(item)).bottom, `item ${String(index)} date above`).toBeLessThanOrEqual(
          rail.top + TOLERANCE
        );
    }
  });

  it("keeps an opposite child's own line height and aligns a direct Time", () => {
    renderThemed(
      <TimelineList.Root>
        <TimelineList.Item opposite={<p className="leading-none">Q1 2026</p>}>
          <TimelineList.Title>Smart meters</TimelineList.Title>
        </TimelineList.Item>
        <TimelineList.Item opposite={<TimelineList.Time date="2026-04-15">15 April 2026</TimelineList.Time>}>
          <TimelineList.Title>Hourly prices</TimelineList.Title>
        </TimelineList.Item>
      </TimelineList.Root>
    );
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
            <TimelineList.Item key={status} status={status} statusLabel="">
              <TimelineList.Title>{status}</TimelineList.Title>
              <TimelineList.Description>Every status draws in system colors.</TimelineList.Description>
            </TimelineList.Item>
          ))}
          <TimelineList.Item>
            <TimelineList.Title>No status</TimelineList.Title>
          </TimelineList.Item>
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
      const near = (pixel: readonly number[], color: { r: number; g: number; b: number }): boolean =>
        [color.r, color.g, color.b].every(
          (value, channel) => Math.abs((pixel[channel] ?? Number.NaN) - value * 255) <= 8
        );
      for (const [label, item] of [
        ["complete", complete],
        ["error", error],
      ] as const) {
        const mark = markOf(item);
        const { width } = box(mark);
        const inset = Math.ceil(width * 0.2);
        const span = Math.floor(width) - 2 * inset;
        const points = Array.from({ length: span * span }, (_, at): readonly [number, number] => [
          inset + (at % span),
          inset + Math.floor(at / span),
        ]);
        const glyph = mark.querySelector("svg");
        if (glyph === null) throw new Error("expected a glyph");
        expect(getComputedStyle(glyph).color, `${label} glyph color`).toBe(canvasColor);
        const pixels = await pixelsAt(mark, points);
        const shows = (color: { r: number; g: number; b: number }): boolean =>
          pixels.some((pixel) => near(pixel, color));
        expect(
          { glyph: shows(canvas), fill: shows(canvasText) },
          `${label} glyph in Canvas on a CanvasText fill`
        ).toEqual({
          glyph: true,
          fill: true,
        });
      }
    });
  });
});
