/**
 * The carousel's DOM adapter. It measures a native scroll-snap viewport, reports which page the
 * scroll position is on and which slides it shows, and scrolls to a page. It is React-free: the
 * Root creates one per viewport and turns its reports into state, so no part reads it directly.
 *
 * The browser's own scroller runs every gesture. The engine listens to `scroll` passively and
 * reads one `scrollLeft` or `scrollTop` per frame, with a horizontal viewport's computed
 * `direction`, so it never delays a swipe, a wheel turn or a
 * keyboard scroll, and it never writes a transform. A page change calls `scrollTo` without
 * `behavior`, so the viewport's own `scroll-behavior: smooth` animates it and the central
 * reduced-motion rule in `fuse.css` turns that animation off.
 *
 * The engine keeps these apart:
 *
 * - Reconciliation. The Root's commit and every invalidation, a resize, a change to the viewport's
 *   subtree, a slide mounting or unmounting, end in one `flush`. It measures the layout at most
 *   once, applies the committed slides and page, and only then publishes one
 *   {@link CarouselSnapshot}: the slides in document order, the pages their snap positions make and
 *   the slides in view. It never reports a page, since the page it applies is the Root's own.
 *   A layout with no usable box, under `display: none` or `scale(0)`, is never cached: the last
 *   usable one stands, and the engine measures again once the box resizes or, for a scale, on the
 *   next frame. With no slides there is nothing placed, so slides that return are placed afresh.
 * - Freshness where the layout is used. Layout inherited from outside, such as an ancestor's gap or
 *   a class that changes which slides snap, moves slides without any report, and no cheap check
 *   can prove it did not. So each user action that resolves a page measures first: a navigation
 *   calls `refresh`, which runs the one `flush` with the layout marked dirty, before the Root picks
 *   the destination, and a scroll's end measures before it reads which page the viewport settled
 *   on. That is one measurement per action. Without an action, an inherited change reaches the
 *   indicators only at the next scroll end, navigation, resize, mutation or commit.
 * - Observation. Live page reports belong to a scroll session, which the engine alone owns. User
 *   input that can scroll the viewport, a pointer down, a key down or a wheel turn along its axis,
 *   arms it for as long as that input is held. `carousel-input.ts` alone owns those lifetimes, and
 *   catches each release wherever it lands. A scroll frame while it is armed starts the session: the layout is measured once, through the one `flush`, so live reports
 *   never read a stale page count, and from then each frame reads the position against that
 *   measurement, with no box read, and reports the nearest page, so the indicators follow a swipe
 *   and its inertia live. The session ends at the scroll's end, or when the engine itself scrolls
 *   to a page. Input that ends without scrolling, such as a tap, a click on a control in a slide or
 *   keys typed into a field, leaves nothing live. Any scroll without a session, such as the
 *   browser re-snapping after a layout change, a focus scroll or a programmatic one, reports its
 *   page only at its end, from a fresh measurement, so a re-snap never publishes a page read from
 *   stale geometry. The one exception is the engine's own scroll, a page change or a placement:
 *   when it ends where its page was, while the slides moved under it, the engine puts its own
 *   page back where the layout now has it, as Firefox may not re-snap it (`flush`). Every scroll
 *   frame still updates the slides in view. Notifying the Root that the user acted, which stops
 *   rotation, is separate: any user input does it, scroll or not.
 * - Ends. A scroll ends at `scrollend`, or, without it, after a quiet spell with no scroll event.
 *   What a scroll is owed, its settle, is kept apart from the one timer that counts out its spell.
 *   Nothing ends while input is held, as a finger at rest mid-drag sends no scroll events: new
 *   input stops the timer but keeps what is owed, and when the last input is released a fresh
 *   spell starts for it, or for a live session still under way. Only the engine's own page change,
 *   whose scroll brings its own end, replaces what an earlier scroll was owed.
 *
 * Every length is in the viewport's scroll coordinates, the space of `scrollLeft`, `clientWidth`
 * and `scrollWidth`. A transform on an ancestor, such as `scale(0.5)`, scales the boxes
 * `getBoundingClientRect` reports but not the scroll range, so the engine divides each box by the
 * viewport's painted size over its layout size, per axis. That keeps sub-pixel slide widths, which
 * the integer `offsetLeft` and `offsetWidth` would round, and stays right while a scale animates,
 * since the ratio is read with the boxes. A rotated or skewed ancestor is not supported: a box's
 * bounds are then not a scaled copy of its layout.
 */
import { documentOrder } from "../../internal/dom-node";
import { createCarouselInput } from "./carousel-input";
import { clampIndex, nearestPage, pagesOf, parseSnapAlign, samePages, visibleSlides } from "./carousel-pages";
import type { Pages, ScrollPort, SlideGeometry, SnapAxis } from "./carousel-pages";

/** The axis a carousel scrolls on. */
export type CarouselOrientation = "horizontal" | "vertical";

/** One measurement of the carousel: what the labels, the pages and the inert slides all read. */
export type CarouselSnapshot = {
  /** The mounted slides, in document order. A slide's place in it is its number. */
  readonly slides: readonly HTMLElement[];
  /** The pages, from the slides' snap positions. `leadingSlides` index into `slides`. */
  readonly pages: Pages;
  /** The slides with more than a pixel inside the viewport. */
  readonly visible: ReadonlySet<HTMLElement>;
};

/** What the engine reports. */
export type CarouselEngineListener = {
  /** A reconciliation or a scroll produced a snapshot that differs from the last one. */
  readonly onSnapshot: (snapshot: CarouselSnapshot) => void;
  /**
   * A native scroll brought another page nearest. It reports where the viewport is, not why, with
   * the page count of the measurement it was read from.
   */
  readonly onPage: (page: number, pageCount: number) => void;
  /**
   * The user acted on the viewport: a pointer went down in it, a key went down in it, or a wheel
   * turned along its axis. It runs even when the page does not change, such as for a short drag
   * that snaps back.
   */
  readonly onInteract: () => void;
  /** A scroll ended. */
  readonly onSettle: () => void;
};

/** What the Root has committed: the page it shows, and how many scrolls have ended. */
export type CarouselCommit = {
  /** The Root's page. A new value scrolls to it; a page past either end scrolls to that end. */
  readonly index: number;
  /**
   * The Root's count of ended scrolls. A new value applies `index` again, so a controlled Root
   * whose parent kept its page scrolls back to it once the user's scroll ends.
   */
  readonly settled: number;
};

/** A running engine. */
export type CarouselEngine = {
  /** Reconcile with the Root's commit: measure if anything moved, then apply its page. */
  readonly commit: (commit: CarouselCommit) => void;
  /**
   * Measure now, as before a navigation resolves its destination: the layout may have moved in
   * ways nothing reported.
   *
   * @returns The fresh page count, or the last one while the viewport has no usable layout.
   */
  readonly refresh: () => number;
  /**
   * The members may have changed, as when a slide mounts without the Root rendering: reconcile once
   * this task ends. The reconciliation compares the members with the slides it watches, so a slide
   * that leaves and rejoins in one commit measures nothing.
   */
  readonly reconcileLater: () => void;
  /** Stop listening and observing. */
  readonly destroy: () => void;
};

/**
 * How a page change moves: `css` leaves the motion to the viewport's `scroll-behavior`, and
 * `instant` jumps, for putting the selected page in place without the user watching a scroll.
 */
type Motion = "css" | "instant";

/**
 * The engine's scroll session: `idle` with no user input that can scroll under way, `armed` while
 * such input lasts without having scrolled, and `live` from its first scroll frame until the scroll
 * ends. Only a live session reports pages frame by frame.
 */
type ScrollSession = "idle" | "armed" | "live";

/** The last measurement, in scroll coordinates. */
type Layout = {
  readonly slides: readonly HTMLElement[];
  readonly geometry: readonly SlideGeometry[];
  readonly port: ScrollPort;
  readonly pages: Pages;
  readonly rtl: boolean;
};

/** A box's layout size, in the viewport's scroll coordinates. */
type Size = { readonly width: number; readonly height: number };

/**
 * A quiet spell: a scroll counts as ended once no `scroll` event has fired for this long. It ends
 * every scroll in a browser without `scrollend`, and a scroll end that arrived short of the
 * engine's own page in one with it. It outlasts the gap between the frames of a momentum scroll.
 */
const SETTLE_FALLBACK_MS = 150;

/** A programmatic scroll has arrived once it is this close to its page. */
const ARRIVED = 1;

/** A resize smaller than this is the rounding of a size the last measurement already read. */
const SAME_SIZE = 0.5;

/** The attributes whose change can move a slide without resizing anything. */
const LAYOUT_ATTRIBUTES = ["class", "style", "dir", "hidden"];

/** A computed length in px, resolving a percentage against `basis` and `auto` to `0`. */
function lengthOf(value: string, basis: number): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return value.trim().endsWith("%") ? (parsed / 100) * basis : parsed;
}

/** The physical sides of the scroll axis's start and end, for reading computed styles. */
type AxisSides = { readonly start: "left" | "right" | "top"; readonly end: "left" | "right" | "bottom" };

function sidesOf(orientation: CarouselOrientation, rtl: boolean): AxisSides {
  if (orientation === "vertical") {
    return { start: "top", end: "bottom" };
  }
  return rtl ? { start: "right", end: "left" } : { start: "left", end: "right" };
}

function sideValue(
  style: CSSStyleDeclaration,
  property: "scroll-padding" | "scroll-margin",
  side: string
): string {
  return style.getPropertyValue(`${property}-${side}`);
}

/**
 * An element's border-box size as layout gives it, before any transform, from its computed
 * style, which keeps fractions.
 */
function layoutSizeOf(style: CSSStyleDeclaration): Size {
  const width = Number.parseFloat(style.width) || 0;
  const height = Number.parseFloat(style.height) || 0;
  if (style.boxSizing === "border-box") {
    return { width, height };
  }
  const sum = (...values: string[]) =>
    values.reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
  return {
    width: width + sum(style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth),
    height:
      height + sum(style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth),
  };
}

function sameSnapshot(left: CarouselSnapshot, right: CarouselSnapshot): boolean {
  // One measurement's slides and pages are the same references until the layout is measured again.
  const sameLayout =
    (left.slides === right.slides && left.pages === right.pages) ||
    (left.slides.length === right.slides.length &&
      left.slides.every((slide, index) => slide === right.slides[index]) &&
      samePages(left.pages, right.pages));
  return (
    sameLayout &&
    left.visible.size === right.visible.size &&
    [...left.visible].every((slide) => right.visible.has(slide))
  );
}

/**
 * Create the engine for a viewport. It reads nothing until the Root's first commit.
 *
 * @param viewport - The scroll-snap container.
 * @param orientation - The axis it scrolls on.
 * @param members - The mounted slides, which the Root keeps current; their order comes from the
 *   document.
 * @param listener - Where the engine reports.
 * @returns The engine. Call `destroy` when the viewport unmounts.
 */
export function createCarouselEngine(
  viewport: HTMLElement,
  orientation: CarouselOrientation,
  members: ReadonlySet<HTMLElement>,
  listener: CarouselEngineListener
): CarouselEngine {
  const view = viewport.ownerDocument.defaultView;
  const axis: SnapAxis = orientation === "vertical" ? "block" : "inline";
  const vertical = orientation === "vertical";
  // The slides the resize observer watches, and the size each box had at the last measurement.
  const observed = new Set<HTMLElement>();
  const sizes = new Map<Element, Size>();
  let layout: Layout | null = null;
  let published: CarouselSnapshot | null = null;
  let dirty = true;
  let scheduled = false;
  let destroyed = false;
  // Whether the last measurement found no usable layout: no layout box, as under `display: none`,
  // or a box scaled to nothing, as under `scale(0)`. The layout before it stands meanwhile.
  let unmeasured = false;
  // A retry on the next frame, for a scale no observer reports the end of.
  let retryFrame: number | null = null;
  // The selected page. Scroll observations move it; so does applying the Root's page.
  let page = 0;
  // The page the engine's own scroll, a page change or a placement that moves the viewport, is
  // heading to. While it runs, scroll frames move nothing, so the indicators do not step through
  // the pages it passes. User input cancels it.
  let target: number | null = null;
  // While the engine's own scroll ends: the pages it was measured against, and where its page
  // started in them. See `strandedUnderOwnScroll`.
  let ending: { readonly pages: Pages; readonly start: number } | null = null;
  // The scroll session live page reports belong to; see the module comment.
  let session: ScrollSession = "idle";
  // The Root's latest commit, and the one last applied to a layout with pages: `null` until the
  // first placement, and again once the slides are gone, so returning slides are placed afresh.
  let committed: CarouselCommit = { index: 0, settled: 0 };
  let applied: CarouselCommit | null = null;
  let frame: number | null = null;
  // The end a scroll is still owed, kept until it runs or the engine's own page change replaces
  // it: `settle` for a scroll no `scrollend` will end, `ended` for one whose end came while input
  // was held or short of the engine's page. Apart from it, the one timer counting out its spell.
  let owed: (() => void) | null = null;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  const hasScrollEnd = "onscrollend" in viewport;

  function readsRtl(): boolean {
    return !vertical && getComputedStyle(viewport).direction === "rtl";
  }

  /** The scroll position on the axis in a direction, positive from the start in either. */
  function positionIn(rtl: boolean): number {
    if (vertical) {
      return viewport.scrollTop;
    }
    // Every engine reports a right-to-left `scrollLeft` as 0 at the start, negative toward the end.
    return rtl ? -viewport.scrollLeft : viewport.scrollLeft;
  }

  /** The scroll position in the last measured direction. */
  function position(): number {
    return positionIn(layout?.rtl === true);
  }

  /** The last measurement, unless the latest found no usable layout. */
  function usable(): Layout | null {
    return unmeasured ? null : layout;
  }

  /** Where the engine's own scroll is heading, in the last measurement. */
  function ownDestination(): number | undefined {
    return target === null ? undefined : layout?.pages.positions[target];
  }

  /** A measurement with no usable layout: keep the last one, and retry once there may be one. */
  function unusable(retry: "on resize" | "next frame"): "unmeasurable" {
    unmeasured = true;
    // Forgotten, so the box coming back reads as a resize.
    sizes.clear();
    if (retry === "next frame" && retryFrame === null && view !== null) {
      // A transform changes no box size, so no observer reports the scale growing back.
      retryFrame = view.requestAnimationFrame(() => {
        retryFrame = null;
        invalidate();
      });
    }
    return "unmeasurable";
  }

  /** Watch exactly the mounted slides. Returns whether the set changed. */
  function syncMembers(): boolean {
    let changed = false;
    for (const slide of observed) {
      if (!members.has(slide)) {
        observed.delete(slide);
        resizeObserver?.unobserve(slide);
        sizes.delete(slide);
        changed = true;
      }
    }
    for (const slide of members) {
      if (!observed.has(slide)) {
        observed.add(slide);
        resizeObserver?.observe(slide);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Read the layout, once: the viewport's box and style, then each slide's box and style. A
   * viewport without a layout box, such as one under `display: none`, reads nothing and keeps the
   * last layout and the selected page until it shows again.
   *
   * @returns Whether the viewport is hidden, and otherwise whether the selected page must be put
   *   back, as after showing again or a change of direction, since the browser may have reset or
   *   mirrored the scroll position meanwhile.
   */
  function measure(): "unmeasurable" | "restore" | "measured" {
    // One read per box, the viewport's and each slide's: `getClientRects` is empty for an element
    // with no layout box, as under `display: none`, and holds the one border box of a block or flex
    // item otherwise.
    const [rect] = viewport.getClientRects();
    if (rect === undefined) {
      // Showing again resizes the viewport, which the resize observer reports.
      return unusable("on resize");
    }
    const style = getComputedStyle(viewport);
    const rtl = !vertical && style.direction === "rtl";
    const sides = sidesOf(orientation, rtl);
    const viewportSize = layoutSizeOf(style);
    // Painted over layout size, per axis: 1 without a transform, 0.5 under `scale(0.5)`, and 0
    // under `scale(0)`, where no box says where anything is.
    const scaleX = viewportSize.width > 0 ? rect.width / viewportSize.width : 1;
    const scaleY = viewportSize.height > 0 ? rect.height / viewportSize.height : 1;
    if (!(Number.isFinite(scaleX) && Number.isFinite(scaleY) && scaleX > 0 && scaleY > 0)) {
      return unusable("next frame");
    }
    const size = vertical ? viewport.clientHeight : viewport.clientWidth;
    const port: ScrollPort = {
      size,
      scrollSize: vertical ? viewport.scrollHeight : viewport.scrollWidth,
      paddingStart: lengthOf(sideValue(style, "scroll-padding", sides.start), size),
      paddingEnd: lengthOf(sideValue(style, "scroll-padding", sides.end), size),
    };
    // In the direction just read: a switch of direction mirrors the scroll position the previous
    // layout's direction would read.
    const scrolled = positionIn(rtl);
    // The padding box's start edge on screen, from which the scroll origin is `scrolled` px back.
    const originTop = rect.top + viewport.clientTop * scaleY;
    const originLeft = rect.left + viewport.clientLeft * scaleX;
    const originRight = originLeft + viewport.clientWidth * scaleX;
    // A slide without a layout box, such as one a host rule hides, takes no page and no number:
    // the user cannot reach it. It stays a member, and its resize reports it showing again.
    const slides: HTMLElement[] = [];
    const boxes: DOMRect[] = [];
    for (const slide of [...members].filter((member) => member.isConnected).toSorted(documentOrder)) {
      const [box] = slide.getClientRects();
      if (box !== undefined) {
        slides.push(slide);
        boxes.push(box);
      }
    }
    const slideSizes: Size[] = [];
    const geometry = slides.map((slide, index) => {
      const box = boxes[index] ?? new DOMRect();
      const slideStyle = getComputedStyle(slide);
      const width = box.width / scaleX;
      const height = box.height / scaleY;
      slideSizes.push({ width, height });
      let offset: number;
      if (vertical) {
        offset = (box.top - originTop) / scaleY;
      } else if (rtl) {
        offset = (originRight - box.right) / scaleX;
      } else {
        offset = (box.left - originLeft) / scaleX;
      }
      return {
        start: offset + scrolled,
        size: vertical ? height : width,
        marginStart: lengthOf(sideValue(slideStyle, "scroll-margin", sides.start), 0),
        marginEnd: lengthOf(sideValue(slideStyle, "scroll-margin", sides.end), 0),
        align: parseSnapAlign(slideStyle.getPropertyValue("scroll-snap-align"), axis),
      } satisfies SlideGeometry;
    });
    const finite = geometry.every(
      (slide) => Number.isFinite(slide.start) && Number.isFinite(slide.size) && slide.size >= 0
    );
    if (!finite) {
      return unusable("next frame");
    }
    // Usable: the layout, and the sizes the resize observer compares against, are now this one's.
    const restore = applied !== null && (unmeasured || (layout !== null && layout.rtl !== rtl));
    unmeasured = false;
    sizes.clear();
    sizes.set(viewport, viewportSize);
    for (const [index, slide] of slides.entries()) {
      const size = slideSizes[index];
      if (size !== undefined) {
        sizes.set(slide, size);
      }
    }
    layout = { slides, geometry, port, pages: pagesOf(port, geometry), rtl };
    return restore ? "restore" : "measured";
  }

  /** Publish the snapshot for the current layout and scroll position, if it differs. */
  function publish(current: Layout): void {
    const indexes = visibleSlides(current.port, current.geometry, position());
    const next: CarouselSnapshot = {
      slides: current.slides,
      pages: current.pages,
      visible: new Set(current.slides.filter((_, index) => indexes.has(index))),
    };
    if (published === null || !sameSnapshot(next, published)) {
      published = next;
      listener.onSnapshot(next);
    }
  }

  function scrollToPosition(destination: number, motion: Motion): void {
    // The engine's own scroll is no user's: it ends any session, and its own end replaces what an
    // earlier scroll was owed.
    session = "idle";
    forgive();
    const physical = layout?.rtl === true ? -destination : destination;
    const options: ScrollToOptions = vertical ? { top: physical } : { left: physical };
    // No `behavior` for a page change: the viewport's `scroll-behavior: smooth` animates it, and
    // reduced motion sets that to `auto`.
    viewport.scrollTo(motion === "instant" ? { ...options, behavior: "instant" } : options);
  }

  /**
   * Jump to the selected page without motion. A jump that moves the viewport is the engine's own
   * scroll until it ends, like a page change.
   */
  function place(positions: readonly number[]): void {
    const destination = positions[page] ?? 0;
    target = Math.abs(position() - destination) < ARRIVED ? null : page;
    scrollToPosition(destination, "instant");
  }

  /** Scroll to a page with the viewport's own motion, unless it is there or the user is. */
  function move(positions: readonly number[], next: number): void {
    // Already there, or the user's own scroll is: a scroll now would fight a finger still down.
    if (next === page && target === null) {
      return;
    }
    const destination = positions[next] ?? 0;
    page = next;
    if (Math.abs(position() - destination) < ARRIVED) {
      target = null;
      return;
    }
    target = next;
    scrollToPosition(destination, "css");
  }

  /** Apply the committed page to a fresh layout. */
  function apply(current: Layout, restore: boolean): void {
    const positions = current.pages.positions;
    if (positions.length === 0) {
      // No slides, so no placement: the browser has reset the scroll, and returning slides are
      // placed afresh at the Root's page.
      applied = null;
      target = null;
      page = 0;
      return;
    }
    const last = positions.length - 1;
    const wanted = clampIndex(committed.index, positions.length);
    // Read before `applied` takes this commit: whether any page has been put in place yet.
    const first = applied === null;
    const requested = first || applied?.index !== committed.index || applied.settled !== committed.settled;
    applied = committed;
    if (first || restore) {
      page = requested ? wanted : Math.min(last, page);
      place(positions);
      return;
    }
    if (requested) {
      move(positions, wanted);
    } else if (page > last) {
      // The slides shrank under the selected page, and the browser already clamped the scroll.
      page = last;
      place(positions);
    }
  }

  /** The one reconciliation point: measure at most once, apply the commit, then publish. */
  function flush(): void {
    scheduled = false;
    if (destroyed) {
      return;
    }
    // This flush reads the DOM as it is now, so the mutations still queued are judged here and
    // spent, rather than reported again once it is done.
    const pending = mutationObserver?.takeRecords() ?? [];
    // Every check runs, so the watched slides always end up equal to the members.
    const membersChanged = syncMembers();
    const moved = pending.some(movesSlides);
    const current = usable();
    const mirrored = current !== null && readsRtl() !== current.rtl;
    if (membersChanged || moved || mirrored) {
      dirty = true;
    }
    let restore = false;
    if (dirty) {
      dirty = false;
      const result = measure();
      if (result === "unmeasurable") {
        return;
      }
      restore = result === "restore" || strandedUnderOwnScroll();
    }
    const fresh = usable();
    if (fresh === null) {
      return;
    }
    apply(fresh, restore);
    publish(fresh);
  }

  /**
   * Whether the engine's own scroll ended where its page was in the layout it was measured
   * against, while this measurement has the slides elsewhere: the layout moved under that scroll,
   * so the position it left no longer shows the page the engine itself scrolled to, and the page
   * is put back. CSS Scroll Snap 1 § 6.2 has the browser re-snap to the slide it was snapped to,
   * which Chromium and WebKit do, so their scroll ends on the page's new position. Firefox does
   * not re-snap the slide of a jump whose layout changes in the same task, before the jump's
   * scroll is processed, as when an ancestor sets a spacing variable as the carousel mounts: it
   * leaves the viewport where the jump put it, on another slide's snap position or between two.
   * Any other scroll, a script's, a focus scroll or the user's, keeps the page it ends on.
   */
  function strandedUnderOwnScroll(): boolean {
    return (
      ending !== null &&
      layout !== null &&
      Math.abs(position() - ending.start) < ARRIVED &&
      !samePages(ending.pages, layout.pages)
    );
  }

  function reconcileLater(): void {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  /** An observer saw the layout move: measure at the next reconciliation, once this task ends. */
  function invalidate(): void {
    dirty = true;
    reconcileLater();
  }

  /** Report the nearest page and the slides in view for the current scroll position. */
  function track(): void {
    const current = usable();
    if (current === null) {
      return;
    }
    if (readsRtl() !== current.rtl) {
      // Mirrored under the last measurement: reconcile before reading positions in it again.
      invalidate();
      return;
    }
    if (session === "armed") {
      // The user's input has begun to scroll: measure once, so this session reads a fresh layout.
      session = "live";
      dirty = true;
      flush();
    }
    // The session's fresh measurement, when it just took one.
    const measured = layout ?? current;
    publish(measured);
    // Only a live session reports its page as it goes; any other scroll waits for its end. The
    // engine's own scroll, which is heading to its page, has ended any session.
    if (session === "live") {
      observe(measured);
    }
  }

  /** Report the page nearest the scroll position, by a layout's positions. */
  function observe(current: Layout): void {
    const positions = current.pages.positions;
    if (positions.length === 0) {
      return;
    }
    const nearest = nearestPage(positions, position());
    if (nearest !== page) {
      page = nearest;
      listener.onPage(page, positions.length);
    }
  }

  /** Owe a scroll its end, `then`, after a full quiet spell from now. */
  function owe(then: () => void): void {
    owed = then;
    countQuiet();
  }

  /**
   * Count a full quiet spell from now for what is owed. While the user holds input it cannot end:
   * the release counts a fresh one.
   */
  function countQuiet(): void {
    stopTimer();
    if (owed === null) {
      return;
    }
    quietTimer = setTimeout(() => {
      quietTimer = null;
      const then = owed;
      if (then !== null && !input.held()) {
        owed = null;
        then();
      }
    }, SETTLE_FALLBACK_MS);
  }

  /** Stop counting, keeping what is owed. */
  function stopTimer(): void {
    if (quietTimer !== null) {
      clearTimeout(quietTimer);
      quietTimer = null;
    }
  }

  /** Nothing is owed any more: the scroll has settled, or the engine's own scroll replaces it. */
  function forgive(): void {
    stopTimer();
    owed = null;
  }

  /** A scroll ended, by `scrollend` or a quiet spell without it. */
  function settle(): void {
    // Nothing settles under held input: a finger or button still down may move the viewport yet.
    // The spell ends the scroll once the input is released.
    if (input.held()) {
      owe(ended);
      return;
    }
    // Short of the engine's own scroll's page, a scroll end is either the end of the scroll before
    // it, which ended after a new page change began, or the end of a scroll that superseded it,
    // such as a script's jump. A quiet spell tells them apart: the engine's scroll keeps sending
    // scroll events, each of which restarts it, until its own end arrives; a superseded scroll
    // leaves the viewport at rest, and the spell ends it.
    const destination = ownDestination();
    if (destination !== undefined && Math.abs(position() - destination) >= ARRIVED) {
      owe(ended);
      return;
    }
    forgive();
    ended();
  }

  /** A scroll ended: read where, from a fresh measurement, and tell the Root. */
  function ended(): void {
    // Ending the engine's own scroll: where its page started in the layout it was measured against.
    const own = ownDestination();
    ending = own === undefined || layout === null ? null : { pages: layout.pages, start: own };
    target = null;
    session = "idle";
    // Where the scroll ended is read from a fresh measurement, so a re-snap after an inherited
    // layout change settles on the page it shows.
    dirty = true;
    flush();
    ending = null;
    const settled = usable();
    if (settled !== null) {
      observe(settled);
    }
    listener.onSettle();
  }

  function onScroll(): void {
    if (frame === null && view !== null) {
      frame = view.requestAnimationFrame(() => {
        frame = null;
        track();
      });
    }
    // A scroll event starts the spell over. Without `scrollend` a spell ends every scroll; with it,
    // a spell counts only for a scroll end that was deferred or arrived short.
    if (owed === null && !hasScrollEnd) {
      owed = settle;
    }
    countQuiet();
  }

  /**
   * User input that can scroll the viewport began: it takes over from a page change, stops the
   * spell's count while keeping what is owed, tells the Root, which stops rotation, and arms a
   * scroll session for as long as the input is held.
   */
  function interact(): void {
    target = null;
    stopTimer();
    listener.onInteract();
    if (session === "idle") {
      session = "armed";
    }
  }

  /**
   * Every held input was released. Input that never scrolled leaves nothing live. What a scroll is
   * owed, or a live session still under way, counts a fresh spell from now: a live session's end
   * may not come by `scrollend`, as when a tap stops its inertia.
   */
  function released(): void {
    if (session === "armed") {
      session = "idle";
    }
    if (owed === null && session === "live") {
      owed = settle;
    }
    countQuiet();
  }

  /**
   * Whether a mutation can have moved a slide. A change inside one slide's content cannot, except
   * by resizing that slide, which the resize observer reports; anything at or above the slides,
   * such as a reorder or a class on a slide or its wrapper, can.
   */
  function movesSlides(record: MutationRecord): boolean {
    const changed = record.target;
    return !(layout?.slides ?? []).some((slide) => slide !== changed && slide.contains(changed));
  }

  /** Whether a resize report differs from the size the last measurement read. */
  function resized(entry: ResizeObserverEntry): boolean {
    const known = sizes.get(entry.target);
    const box = entry.borderBoxSize[0];
    if (known === undefined || box === undefined) {
      return true;
    }
    // In a horizontal writing mode, whichever way the carousel scrolls, inline is the width.
    return (
      Math.abs(box.inlineSize - known.width) >= SAME_SIZE ||
      Math.abs(box.blockSize - known.height) >= SAME_SIZE
    );
  }

  const resizeObserver =
    view === null
      ? null
      : new view.ResizeObserver((entries) => {
          // Observing a box reports its size at once; a box the last measurement read at that size
          // has not moved anything.
          if (entries.some(resized)) {
            invalidate();
          }
        });
  resizeObserver?.observe(viewport);
  const mutationObserver =
    view === null
      ? null
      : new view.MutationObserver((records) => {
          if (records.some(movesSlides)) {
            invalidate();
          }
        });
  mutationObserver?.observe(viewport, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: LAYOUT_ATTRIBUTES,
  });

  const passive = { passive: true } as const;
  viewport.addEventListener("scroll", onScroll, passive);
  viewport.addEventListener("scrollend", settle, passive);
  const input = createCarouselInput(viewport, orientation, { onInput: interact, onRelease: released });

  return {
    commit(next) {
      committed = next;
      flush();
    },
    refresh() {
      dirty = true;
      flush();
      return layout?.pages.positions.length ?? 0;
    },
    reconcileLater,
    destroy() {
      destroyed = true;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("scrollend", settle);
      input.destroy();
      if (frame !== null) {
        view?.cancelAnimationFrame(frame);
      }
      if (retryFrame !== null) {
        view?.cancelAnimationFrame(retryFrame);
      }
      forgive();
    },
  };
}
