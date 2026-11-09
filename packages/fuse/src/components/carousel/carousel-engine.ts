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
 * Measurement is `carousel-measure.ts`'s: every length is in the viewport's scroll coordinates,
 * read from the painted boxes, and it says whether a reading is steady, taken with the viewport's
 * box holding still, or unsteady, taken while an animating transform moved it, as WebKit samples a
 * running transform afresh at each layout read. The engine treats an unsteady reading as it treats
 * a box scaled to nothing: the viewport has no usable layout for now, and it measures again on the
 * next frame. After `UNSTEADY_READINGS` unsteady readings in a row it accepts the latest as it is,
 * and every one after it until one is steady, so an animation that never rests cannot stall the
 * carousel. An accepted reading puts no page back, unlike one after a box that was gone: the
 * viewport stayed scrollable, so the browser reset no scroll position.
 *
 * A scroll that ends while the reading is unsteady is owed its end again, as one that ends under
 * held input is, and its end is read afresh after the next quiet spell, up to `END_READS` reads in
 * all; the last accepts what it reads, as a reading past `UNSTEADY_READINGS` is accepted. Nothing
 * from an earlier read is kept for a later one, no layout and no reckoning of the engine's own
 * scroll, as each could be undone by what came between: a later scroll, a gap change or a
 * navigation. So the end is read as the end of whatever scroll last moved the viewport, and every
 * scroll event starts the count over, as the end owed is now that scroll's. Nothing else needs to:
 * after the engine's own scroll begins or input goes down, an end is read only once a scroll event
 * has come, and input that never scrolls, such as a tap, leaves the end owed to the same scroll.
 */
import { createCarouselInput } from "./carousel-input";
import { measureCarousel, scrollPositionOf } from "./carousel-measure";
import type { CarouselOrientation, CarouselReading, Size } from "./carousel-measure";
import { clampIndex, nearestPage, pagesOf, samePages, visibleSlides } from "./carousel-pages";
import type { Pages } from "./carousel-pages";

export type { CarouselOrientation } from "./carousel-measure";

/** One measurement of the carousel: what the labels, the pages and the inert slides all read. */
export type CarouselSnapshot = {
  /** The mounted slides, in document order. A slide's place in it is its number. */
  readonly slides: readonly HTMLElement[];
  /** Each of `slides` by element, to its place in them, so a slide finds its number in one read. */
  readonly numbers: ReadonlyMap<HTMLElement, number>;
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
 *
 * `still` is where held input last left the viewport with nothing to take over: where it was when
 * the input began, or when a page the Root committed came to wait under it for a usable reading,
 * whichever came later. A scroll event whose viewport has moved from there is the held input's
 * own, and supersedes the waiting page; one that left it there belongs to a scroll that came
 * before, its event still on its way. A live session no input holds any more, such as inertia
 * after a release, has none: armed input is always held.
 */
type ScrollSession =
  | { readonly kind: "idle" }
  | { readonly kind: "armed"; readonly still: number }
  | { readonly kind: "live"; readonly still: number | null };

/** The session with no user input that can scroll under way. */
const IDLE: ScrollSession = { kind: "idle" };

/** The last measurement, in scroll coordinates, with the pages its snap positions make. */
type Layout = Omit<CarouselReading, "sizes"> & { readonly pages: Pages };

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

/**
 * The most unsteady readings in a row the engine sets aside before it accepts one. It measures
 * again once a frame while it waits, so this is about half a second at 60 frames a second, which
 * outlasts a popup's opening transition, typically 150 to 300ms; a loaded runner, which renders
 * frames further apart, waits longer still. Past it, an animation that never rests gets what the
 * engine read before it waited at all: a slow read may mix two samples, but the carousel gets pages
 * and places its page rather than wait without end.
 */
const UNSTEADY_READINGS = 30;

/**
 * The most reads of one scroll's end: one, and a quiet spell before each read after it while they
 * are unsteady, so over half a second, as long as `UNSTEADY_READINGS` waits. The last accepts what
 * it reads, so an end whose every read is unsteady settles though the next-frame retries between
 * them hold still and start `UNSTEADY_READINGS` over.
 */
const END_READS = 5;

/** The attributes whose change can move a slide without resizing anything. */
const LAYOUT_ATTRIBUTES = ["class", "style", "dir", "hidden"];

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
  // a box scaled to nothing, as under `scale(0)`, or an unsteady reading. The layout before it
  // stands meanwhile.
  let unmeasured = false;
  // Whether a measurement since the last usable one found no box or one scaled to nothing, so the
  // browser may have reset the scroll position meanwhile.
  let vanished = false;
  // The unsteady readings in a row since the last steady one, or one that found no box. It stops at
  // the bound, past which every reading is accepted until one is steady.
  let unsteadyReadings = 0;
  // The reads of the scroll end owed since an unsteady read of it, counting the one under way, or
  // 0 with none owed so. A scroll event starts it over.
  let endReads = 0;
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
  let session: ScrollSession = IDLE;
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

  /** The scroll position in the last measured direction. */
  function position(): number {
    return scrollPositionOf(viewport, orientation, layout?.rtl === true);
  }

  /** The last measurement, unless the latest found no usable layout. */
  function usable(): Layout | null {
    return unmeasured ? null : layout;
  }

  /** Where the engine's own scroll is heading, in the last measurement. */
  function ownDestination(): number | undefined {
    return target === null ? undefined : layout?.pages.positions[target];
  }

  /**
   * Whether the engine's own scroll is under way, short of its page: a scroll end that comes now is
   * the end of a scroll before it, or of one that superseded it.
   */
  function short(): boolean {
    const destination = ownDestination();
    return destination !== undefined && Math.abs(position() - destination) >= ARRIVED;
  }

  /**
   * A measurement with no usable layout: keep the last one, and retry once there may be one.
   *
   * @param retry - When to measure again.
   * @param cause - Whether the box is gone or scaled to nothing, or the reading was unsteady.
   */
  function unusable(retry: "on resize" | "next frame", cause: "vanished" | "unsteady"): "unmeasurable" {
    unmeasured = true;
    if (cause === "vanished") {
      vanished = true;
      unsteadyReadings = 0;
    } else {
      unsteadyReadings += 1;
    }
    // Forgotten, so the box coming back reads as a resize.
    sizes.clear();
    if (retry === "next frame" && retryFrame === null && view !== null) {
      // A transform changes no box size, so no observer reports the scale growing back or resting.
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
   * Measure the layout, once, and keep it if it is usable. What the measurement found decides: no
   * box, as under `display: none`, waits for the resize that showing again brings; geometry that is
   * not finite, as under `scale(0)`, and an unsteady reading are retried on the next frame, since
   * no observer reports a transform changing; and an unsteady reading is accepted once
   * `UNSTEADY_READINGS` have come in a row, or as the last of `END_READS` reads of a scroll's end.
   * Meanwhile the last layout and the selected page stand: see the module comment.
   *
   * @returns Whether the viewport has no usable layout, and otherwise whether the selected page must
   *   be put back, as after showing again or a change of direction, since the browser may have reset
   *   or mirrored the scroll position meanwhile.
   */
  function measure(): "unmeasurable" | "restore" | "measured" {
    const result = measureCarousel(viewport, orientation, members);
    if (result.kind === "no-box") {
      return unusable("on resize", "vanished");
    }
    if (result.kind === "non-finite") {
      return unusable("next frame", "vanished");
    }
    if (!result.steady && unsteadyReadings < UNSTEADY_READINGS && endReads < END_READS) {
      return unusable("next frame", "unsteady");
    }
    const { slides, numbers, geometry, port, rtl } = result;
    // Usable: the layout, and the sizes the resize observer compares against, are now this one's.
    const restore = applied !== null && (vanished || (layout !== null && layout.rtl !== rtl));
    unmeasured = false;
    vanished = false;
    // Only a steady reading ends the unsteady period. One accepted past the bound leaves the count
    // at the bound, so every reading after it is accepted too until one is steady.
    if (result.steady) {
      unsteadyReadings = 0;
    }
    sizes.clear();
    for (const [box, size] of result.sizes) {
      sizes.set(box, size);
    }
    layout = { slides, numbers, geometry, port, pages: pagesOf(port, geometry), rtl };
    return restore ? "restore" : "measured";
  }

  /** Publish the snapshot for the current layout and scroll position, if it differs. */
  function publish(current: Layout): void {
    const indexes = visibleSlides(current.port, current.geometry, position());
    const next: CarouselSnapshot = {
      slides: current.slides,
      numbers: current.numbers,
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
    session = IDLE;
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
    if (session.kind === "armed") {
      // The user's input has begun to scroll: measure once, so this session reads a fresh layout.
      // The input is still held, so where it left the viewport still carries over.
      session = { kind: "live", still: session.still };
      dirty = true;
      flush();
    }
    // The session's fresh measurement, when it just took one, which may have found no usable layout.
    const measured = usable();
    if (measured === null) {
      return;
    }
    publish(measured);
    // Only a live session reports its page as it goes; any other scroll waits for its end. The
    // engine's own scroll, which is heading to its page, has ended any session.
    if (session.kind === "live") {
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
    if (short()) {
      owe(ended);
      return;
    }
    forgive();
    ended();
  }

  /**
   * A scroll ended: read where, from a fresh measurement, and tell the Root. A read that is unsteady
   * leaves where the scroll ended unread, so its end is owed again, as under held input, up to
   * `END_READS` reads: see the module comment.
   */
  function ended(): void {
    // Ending the engine's own scroll: where its page started in the layout it was measured against.
    const own = ownDestination();
    ending = own === undefined || layout === null ? null : { pages: layout.pages, start: own };
    target = null;
    session = IDLE;
    // Where the scroll ended is read from a fresh measurement, so a re-snap after an inherited
    // layout change settles on the page it shows.
    endReads += 1;
    dirty = true;
    flush();
    ending = null;
    if (unmeasured && unsteadyReadings > 0) {
      owe(ended);
      return;
    }
    endReads = 0;
    // A page the Root committed while no reading was usable, applied now, scrolls toward it: that
    // scroll's end is the one to read.
    if (short()) {
      return;
    }
    const settled = usable();
    if (settled !== null) {
      observe(settled);
    }
    listener.onSettle();
  }

  function onScroll(): void {
    // The end owed, if any, is now this scroll's: its reads count afresh.
    endReads = 0;
    if (
      session.kind !== "idle" &&
      session.still !== null &&
      applied !== null &&
      applied !== committed &&
      Math.abs(position() - session.still) >= ARRIVED
    ) {
      // Held input has scrolled the viewport since a page the Root committed came to wait for a
      // usable reading, so the scroll is the user's: the waiting page counts as applied, and the
      // next usable reading moves nowhere under the finger. This holds in a live session too, which
      // loses its usable reading whenever the readings turn unsteady. The Root learns the page this
      // scroll ends on, and its next count of ended scrolls, a new commit, applies its page again
      // then, so a controlled Root whose parent kept the page still brings it back once the scroll
      // ends. Input that never scrolls, such as a tap, takes nothing over, and the waiting page
      // applies as it would have. A scroll event alone does not show the input scrolled: one for a
      // scroll that ended before the input began, or before the page came to wait, can arrive after
      // it with the viewport still there, so only a move from `still`, by as much as the engine's
      // own scroll counts as arriving, takes over.
      applied = committed;
      // The Root has already moved to the waiting page, so it is the page to observe from: a scroll
      // that ends back on the page before it is still news to the Root, and a controlled Root's
      // parent still hears of it. No reading is usable now, so the page is clamped against the last
      // usable layout's pages, which `apply` would clamp against had the page applied; that layout
      // had pages, or nothing would have been applied. Nothing scrolls, and `target` stays `null`,
      // as the input took over any scroll of the engine's own.
      const count = layout?.pages.positions.length ?? 0;
      if (count > 0) {
        page = clampIndex(committed.index, count);
      }
    }
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
    if (session.kind === "idle") {
      session = { kind: "armed", still: position() };
    } else if (session.kind === "live" && session.still === null) {
      // Input held again over a live session's inertia: it holds from here.
      session = { kind: "live", still: position() };
    }
  }

  /**
   * Every held input was released. Input that never scrolled leaves nothing live. What a scroll is
   * owed, or a live session still under way, counts a fresh spell from now: a live session's end
   * may not come by `scrollend`, as when a tap stops its inertia.
   */
  function released(): void {
    if (session.kind === "armed") {
      session = IDLE;
    } else if (session.kind === "live") {
      // Nothing holds the session any more, so its inertia supersedes nothing.
      session = { kind: "live", still: null };
      owed ??= settle;
    }
    countQuiet();
  }

  /**
   * Whether a mutation can have moved a slide. A change inside one slide's content cannot, except
   * by resizing that slide, which the resize observer reports; anything at or above the slides,
   * such as a reorder or a class on a slide or its wrapper, can.
   *
   * A record's target is the node whose children or attribute changed, so the test is on it alone,
   * whatever the record's type: a target strictly inside a measured slide moves nothing, and any
   * other target, a slide itself (its class, or children added to it), a wrapper or the viewport,
   * can. The walk therefore starts at the target's parent, so a slide that is the target does not
   * count as lying in itself, and climbs to the viewport, which no slide is inside. It costs the
   * target's depth below the viewport, not one `contains` per slide.
   */
  function movesSlides(record: MutationRecord): boolean {
    // Keyed by any node, so the walk needs no element check, which would fail across realms.
    const numbers: ReadonlyMap<Node, number> | undefined = layout?.numbers;
    if (numbers === undefined || record.target === viewport) {
      return true;
    }
    for (let node = record.target.parentNode; node !== null && node !== viewport; node = node.parentNode) {
      if (numbers.has(node)) {
        return false;
      }
    }
    return true;
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
      if (session.kind !== "idle" && session.still !== null && applied !== null && applied !== committed) {
        // The page waits for a usable reading under held input: only a move from here supersedes it.
        session = { ...session, still: position() };
      }
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
