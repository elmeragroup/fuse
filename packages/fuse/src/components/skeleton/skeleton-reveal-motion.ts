/**
 * The pane swap of a `SkeletonReveal`, ported from skullet's fades
 * (https://github.com/lochie/skullet, MIT, Lochie Axon). When the pane on screen changes, the
 * outgoing pane pops out of flow, pinned to the box it had, inert and above the incoming one, so
 * the incoming pane lays out at once. The root then eases its height from the outgoing pane's to
 * the incoming one's with `overflow: clip` while the ease runs, and the incoming content's own
 * surfaces (cards, borders, fills) appear whole at once inside that clip. Only its pieces of text
 * and media fade in while the skeleton's bones fade out, so no surface of the old height lingers
 * and snaps once the fade ends.
 *
 * `RevealMotion` owns every fade it starts, so a swap reports whether its panes completed or were
 * cancelled, and disposing it on unmount stops them all; the root's height ease is the
 * `RootHeight` in `skeleton-reveal-height.ts`, which it hands each swap's height change to. Inline lengths it writes are local
 * layout pixels: a client rect is divided by the root's transform scale, so a reveal under a
 * scaled ancestor pins and eases at its own size. Every size it reads comes from the one reader in
 * `skeleton-geometry.ts`, which the bones are measured with too.
 *
 * Reduced motion keeps Fuse's central rule: the height changes at once and nothing staggers, while
 * the opacity fades stay.
 */
import { isText, windowOf } from "../../internal/dom-node";
import { localHeight, scaleOf } from "./skeleton-geometry";
import { RootHeight } from "./skeleton-reveal-height";
import type { HeightChange } from "./skeleton-reveal-height";
import {
  REVEAL_FADE_MS,
  planReveal,
  positionDelayMs,
  rowDelayMs,
  skeletonHoldMs,
} from "./skeleton-reveal-plan";
import type { Box, RevealPlan, SkeletonRevealMode } from "./skeleton-reveal-plan";

/** Which pane a `SkeletonReveal` shows. */
export type PaneKind = "skeleton" | "content";

/** How an animated step ended: it ran to its end, or something stopped it first. */
export type MotionOutcome = "completed" | "cancelled";

/** Where a pane stood within its root before it left, in local pixels: what it is pinned to. */
type PaneBox = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

/** The attribute on a pane that is leaving. */
export const EXITING_ATTRIBUTE = "data-exiting";
/** The bones layer's slot, which a leaving skeleton fades out of. */
const BONES_SLOT = "skeleton-reveal-bones";
/** The ghost's slot, the content rendered unseen that the skeleton is measured from. */
const GHOST_SLOT = "skeleton-reveal-ghost";
/** One bone's slot. */
const BONE_SLOT = "skeleton-reveal-bone";
/** The attribute on a bone holding the computed font size of the text it stands for, in pixels. */
export const BONE_FONT_SIZE_ATTRIBUTE = "data-font-size";

/** Completed only when every step completed. */
function allCompleted(outcomes: readonly Promise<MotionOutcome>[]): Promise<MotionOutcome> {
  return Promise.all(outcomes).then((results) =>
    results.every((result) => result === "completed") ? "completed" : "cancelled"
  );
}

/**
 * Measures a pane within its root, before it pops out.
 *
 * @param pane - The pane about to leave.
 * @param root - The positioned root it sits in.
 * @returns The pane's box relative to the root's padding box, in local fractional pixels, so a
 *   shrink-to-fit pane does not rewrap as it leaves and a scaled reveal keeps its size. In a root
 *   that scrolls, the box is where the pane stands in the scrolled content, as an absolutely
 *   positioned child of it is placed: its scroll offset is added back, and since a right-to-left
 *   root scrolls by a negative `scrollLeft` from its start edge, the same sum holds there too.
 */
function boxOf(pane: HTMLElement, root: HTMLElement): PaneBox {
  const scale = scaleOf(root);
  const rect = pane.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return {
    top: (rect.top - origin.top) / scale.y - root.clientTop + root.scrollTop,
    left: (rect.left - origin.left) / scale.x - root.clientLeft + root.scrollLeft,
    width: rect.width / scale.x,
    height: rect.height / scale.y,
  };
}

/**
 * Takes a pane out of flow where it stood, inert and above the pane replacing it. `layer` stacks
 * it over every pane that left before it, whatever the document order.
 */
function popOut(pane: HTMLElement, box: PaneBox, layer: number): void {
  Object.assign(pane.style, {
    position: "absolute",
    top: `${String(box.top)}px`,
    left: `${String(box.left)}px`,
    width: `${String(box.width)}px`,
    height: `${String(box.height)}px`,
    margin: "0",
    boxSizing: "border-box",
    pointerEvents: "none",
    zIndex: String(layer),
  });
  pane.inert = true;
  pane.setAttribute(EXITING_ATTRIBUTE, "");
}

/** A row or card of incoming content: its box, read once, and the largest text size of its pieces. */
type SequenceUnit = { readonly rect: DOMRect; size: number };

/** Whether an element holds text of its own, not only inside its child elements. */
function hasOwnText(element: Element): boolean {
  return [...element.childNodes].some((node) => isText(node) && node.data.trim() !== "");
}

/**
 * What a reveal brings in one by one: every element holding text or media of its own. A piece is
 * what its fade animates, so it must draw a box: an element with `display: contents`, such as the
 * pane's own fieldset, draws none, and its text fades with the nearest boxed element around it,
 * which takes the whole of that element's content as one piece. An element that renders nothing,
 * with `display: none` or a hidden input, is no piece, and neither is anything inside it.
 */
function piecesOf(root: Element): Element[] {
  const view = windowOf(root);
  const found = new Set<Element>();
  const displayOf = (element: Element): string => view.getComputedStyle(element).display;
  const visit = (container: Element, boxed: Element): void => {
    for (const child of container.children) {
      const display = displayOf(child);
      if (display === "none") continue;
      if (display === "contents") {
        if (hasOwnText(child)) found.add(boxed);
        else visit(child, boxed);
        continue;
      }
      if (child.firstElementChild === null || hasOwnText(child) || child.localName === "svg")
        found.add(child);
      else visit(child, child);
    }
  };
  visit(root, root);
  // A boxed element that fades as a whole leaves no separate piece inside it.
  return [...found].filter((piece) => {
    for (let element = piece.parentElement; element !== null; element = element.parentElement) {
      if (found.has(element)) return false;
      if (element === root) break;
    }
    return true;
  });
}

/** A row of a list or a card of a grid: the piece's nearest ancestor with two or more siblings like it. */
function unitOf(piece: Element, root: Element): Element {
  for (
    let element: Element | null = piece;
    element !== null && element !== root;
    element = element.parentElement
  ) {
    const parent: Element | null = element.parentElement;
    if (parent === null) break;
    const current = element;
    const alike = [...parent.children].filter(
      (sibling) => sibling.localName === current.localName && sibling.className === current.className
    );
    if (alike.length >= 3) return element;
  }
  return piece;
}

function toBox(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function fontSizeOf(element: Element): number {
  return Number.parseFloat(windowOf(element).getComputedStyle(element).fontSize) || 16;
}

/** An element's computed opacity, or null when the computed value is not a number. */
function opacityOf(element: Element): number | null {
  const opacity = Number.parseFloat(windowOf(element).getComputedStyle(element).opacity);
  return Number.isNaN(opacity) ? null : opacity;
}

function containsCentre(outer: DOMRect, inner: DOMRect): boolean {
  const x = inner.left + inner.width / 2;
  const y = inner.top + inner.height / 2;
  return x >= outer.left && x <= outer.right && y >= outer.top && y <= outer.bottom;
}

/** The delays of one sequenced reveal, for its pieces and for the bones they replace. */
type SequenceTiming = {
  readonly pieces: ReadonlyMap<Element, number | null>;
  /** A bone's delay, from its box and the font size of the text it stands for. */
  readonly bone: (rect: DOMRect, fontSize: number) => number | null;
};

/**
 * Times a sequence against the incoming content's own box, read before the root's height ease
 * starts: the ease clips the root to the outgoing height, which is not where the pieces land.
 */
function sequenceTiming(
  content: HTMLElement,
  contentPieces: readonly Element[],
  order: "position" | "row"
): SequenceTiming {
  const reveal = toBox(content.getBoundingClientRect());
  // Each unit's box, read once for its pieces and its bones alike.
  const units = new Map<Element, SequenceUnit>();
  const timed = contentPieces.map((piece) => {
    const element = unitOf(piece, content);
    const fontSize = fontSizeOf(piece);
    let unit = units.get(element);
    if (unit === undefined) {
      unit = { rect: element.getBoundingClientRect(), size: fontSize };
      units.set(element, unit);
    } else unit.size = Math.max(unit.size, fontSize);
    return { piece, ownUnit: element === piece, unit, fontSize };
  });
  const viewport = windowOf(content).innerHeight;
  const unitBoxes = [...units.values()];

  const pieces = new Map<Element, number | null>();
  for (const { piece, ownUnit, unit, fontSize } of timed) {
    const box = toBox(piece.getBoundingClientRect());
    if (order === "position") {
      pieces.set(piece, positionDelayMs(box, reveal));
      continue;
    }
    pieces.set(
      piece,
      rowDelayMs({ box, unit: ownUnit ? null : toBox(unit.rect), secondary: fontSize < unit.size }, viewport)
    );
  }

  const bone = (rect: DOMRect, fontSize: number): number | null => {
    if (order === "position") return positionDelayMs(toBox(rect), reveal);
    const unit = unitBoxes.find((candidate) => containsCentre(candidate.rect, rect));
    return rowDelayMs(
      {
        box: toBox(rect),
        unit: unit === undefined ? null : toBox(unit.rect),
        // Smaller text than its row's largest, by the same rule as the pieces.
        secondary: unit !== undefined && fontSize < unit.size,
      },
      viewport
    );
  };
  return { pieces, bone };
}

/** What the root knew about the skeleton that is leaving, for the planner. */
export type SkeletonHistory = {
  /** Milliseconds the skeleton was up; `Infinity` for a server-rendered one. */
  readonly shownMs: number;
  /** Whether wheel, touch or key input arrived within the planner's input window. */
  readonly recentInput: boolean;
  /** Whether the skeleton was drawn over the data on screen. */
  readonly refetch: boolean;
};

/** A pane in a swap, with the kind the component rendered it as. */
export type SwapPane = { readonly element: HTMLElement; readonly kind: PaneKind };

/** One pane swap. */
export type PaneSwap = {
  readonly root: HTMLElement;
  readonly mode: SkeletonRevealMode;
  readonly reducedMotion: boolean;
  /** The pane now on screen. */
  readonly incoming: SwapPane;
  /** The pane that was. */
  readonly leaving: SwapPane;
  /** For content replacing a skeleton: how the skeleton loaded. */
  readonly history: SkeletonHistory;
};

/** The swap's two halves, each settling once its pane has, completed or cancelled. */
export type SwapProgress = {
  /** The incoming pane has arrived, or its arrival was stopped. */
  readonly entered: Promise<MotionOutcome>;
  /** The leaving pane can be removed. */
  readonly exited: Promise<MotionOutcome>;
};

/** Reduced motion keeps the fades but nothing staggers, as the central rule zeroes delays. */
function underPreference(plan: RevealPlan, reducedMotion: boolean): RevealPlan {
  return reducedMotion && plan.kind === "sequence" ? { kind: "together", durationMs: plan.durationMs } : plan;
}

/**
 * The motion of one `SkeletonReveal`: every animation it starts is its own, so it can tell a
 * completed reveal from a stopped one and stop them all when the reveal unmounts.
 */
export class RevealMotion {
  /** Every fade this owner started, with the element it animates, kept as it was created. */
  readonly #animations = new Map<Animation, Element>();
  /**
   * Holds that keep a frozen target at the opacity it showed, by the leaving pane they were made
   * for. An inline style cannot: a CSS animation of the element's own, such as a pulse, outranks
   * inline style in the cascade, while an animation started here composites above it. A hold is
   * released by that ownership, not by where its target is now, so one whose element its own
   * component removed before the pane finished leaving goes with the pane all the same.
   */
  readonly #holds = new Map<Animation, Element>();
  #disposed = false;
  /**
   * The kind of every pane a swap has handled, as the component rendered it. Weak, and only looked
   * up, so a pane React has removed takes its ghost and bones with it.
   */
  readonly #kinds = new WeakMap<HTMLElement, PaneKind>();
  /** How many panes have left, so each one stacks over those before it. */
  #left = 0;
  /**
   * The pane on screen and its box, and the root's own height, kept current by `track`: a swap
   * pins the leaving pane to that box and eases the root from that height, the one it really
   * had, whatever its own styles made of the pane's.
   */
  #current: {
    readonly pane: HTMLElement;
    readonly root: HTMLElement;
    box: PaneBox;
    rootHeight: number;
    readonly observer: ResizeObserver;
  } | null = null;
  /** The root's height, which each swap moves to the incoming pane's. */
  readonly #height: RootHeight;

  /**
   * @param onHeightSettled - Called each time a height ease runs to its end.
   */
  constructor(onHeightSettled: () => void) {
    this.#height = new RootHeight(onHeightSettled);
  }

  /** Whether a height ease is running, so the root has not reached its final height yet. */
  get easing(): boolean {
    return this.#height.easing;
  }

  /** Whether `dispose` has run; a disposed owner starts nothing. */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Brings in the skeleton a reveal mounts with on the client: `smart` holds it back so a fast
   * load never flashes one, while its space stays reserved.
   *
   * @param skeleton - The skeleton pane.
   * @param mode - The reveal mode.
   */
  holdFirstSkeleton(skeleton: HTMLElement, mode: SkeletonRevealMode): void {
    const hold = skeletonHoldMs(mode);
    if (hold > 0) void this.#appear(skeleton, hold, REVEAL_FADE_MS);
  }

  /**
   * Swaps the pane on screen: pops the leaving pane out, eases the root's height, and fades the
   * two panes as the plan decides.
   *
   * @param swap - The root, the two panes and what the planner needs.
   * @returns When each pane has settled, and whether it completed.
   */
  swap(swap: PaneSwap): SwapProgress {
    const { root, incoming, leaving, reducedMotion } = swap;
    if (this.#disposed)
      return { entered: Promise.resolve("cancelled"), exited: Promise.resolve("cancelled") };
    this.#kinds.set(incoming.element, incoming.kind);
    this.#kinds.set(leaving.element, leaving.kind);

    // Inserting the incoming pane before the leaving one has already moved it, on either axis in
    // a flex or grid root, so it is pinned to the box recorded while it was the pane on screen.
    const tracked = this.#current?.pane === leaving.element ? this.#current : null;
    const box = tracked === null ? boxOf(leaving.element, root) : tracked.box;
    const rootBefore = tracked === null ? null : tracked.rootHeight;
    // Every fade under way in the leaving pane, its own and its pieces', is frozen where it got
    // to, so stopping it never brightens anything: a piece that had not started stays unseen.
    const from = opacityOf(leaving.element) ?? 1;
    leaving.element.style.opacity = String(from);
    this.#settleWithin(leaving.element, "freeze");
    this.#left += 1;
    popOut(leaving.element, box, this.#left);

    const progress = this.#fade(swap, from);
    void progress.exited.then(() => this.#releaseHolds(leaving.element));
    const ease: HeightChange = { kind: "ease", rootBefore, leavingHeight: box.height };
    this.#height.moveTo(root, incoming.element, reducedMotion || progress.instant ? { kind: "snap" } : ease);
    return { entered: progress.entered, exited: progress.exited };
  }

  /** The fades of a swap, and whether its content lands at once. */
  #fade(swap: PaneSwap, from: number): SwapProgress & { readonly instant: boolean } {
    const { root, incoming, leaving } = swap;
    if (incoming.kind === "skeleton") {
      // The content on screen stays until the skeleton replacing it shows, which may be never.
      const hold = skeletonHoldMs(swap.mode);
      return {
        instant: false,
        entered: this.#appear(incoming.element, hold, REVEAL_FADE_MS),
        exited: this.#vanish(leaving.element, hold, REVEAL_FADE_MS, from),
      };
    }

    const takenOver = this.#takeOver(root, leaving.element);
    if (takenOver > 0.01) {
      const durationMs = REVEAL_FADE_MS * (1 - takenOver);
      return {
        instant: false,
        entered: this.#appear(incoming.element, 0, durationMs, takenOver),
        exited: this.#vanish(leaving.element, 0, durationMs, from),
      };
    }

    const pieces = piecesOf(incoming.element);
    const plan = underPreference(
      planReveal(swap.mode, {
        ...swap.history,
        height: localHeight(incoming.element),
        pieces: pieces.length,
      }),
      swap.reducedMotion
    );
    if (plan.kind === "instant") {
      this.#clearExiting(root);
      return { instant: true, entered: Promise.resolve("completed"), exited: Promise.resolve("completed") };
    }
    const timing = plan.kind === "sequence" ? sequenceTiming(incoming.element, pieces, plan.order) : null;
    return {
      instant: false,
      entered: this.#contentIn(incoming.element, pieces, plan.durationMs, timing),
      exited:
        leaving.kind === "skeleton"
          ? this.#skeletonOut(leaving.element, plan.durationMs, timing)
          : this.#vanish(leaving.element, 0, plan.durationMs, from),
    };
  }

  /**
   * Records where the pane on screen stands in its root, at every commit and whenever the root or
   * the pane resizes, so a swap can pin it to the box it had before the incoming pane moved it.
   *
   * @param pane - The pane on screen.
   * @param root - The positioned root it sits in.
   */
  track(pane: HTMLElement, root: HTMLElement): void {
    if (this.#disposed || pane.hasAttribute(EXITING_ATTRIBUTE)) return;
    const current = this.#current;
    if (current?.pane === pane && current.root === root) {
      current.box = boxOf(pane, root);
      current.rootHeight = localHeight(root);
      return;
    }
    current?.observer.disconnect();
    const observer = new (windowOf(root).ResizeObserver)(() => {
      const tracked = this.#current;
      if (tracked?.pane !== pane || pane.hasAttribute(EXITING_ATTRIBUTE)) return;
      tracked.box = boxOf(pane, root);
      tracked.rootHeight = localHeight(root);
    });
    this.#current = {
      pane,
      root,
      box: boxOf(pane, root),
      rootHeight: localHeight(root),
      observer,
    };
    observer.observe(root);
    observer.observe(pane);
  }

  /** Stops every animation this owner started and the root's height ease. Idempotent. */
  dispose(): void {
    this.#disposed = true;
    this.#current?.observer.disconnect();
    this.#current = null;
    this.#height.dispose();
    for (const animation of [...this.#animations.keys()]) animation.cancel();
    for (const hold of [...this.#holds.keys()]) hold.cancel();
    this.#holds.clear();
    this.#animations.clear();
  }

  #animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ): Promise<MotionOutcome> {
    if (this.#disposed) return Promise.resolve("cancelled");
    const animation = element.animate(keyframes, options);
    this.#animations.set(animation, element);
    return animation.finished
      .then(
        (): MotionOutcome => "completed",
        (): MotionOutcome => "cancelled"
      )
      .finally(() => this.#animations.delete(animation));
  }

  /**
   * Fades an element in over `durationMs` after `delayMs`, from the opacity it is handed to its
   * own. The animation gives only its first keyframe, pinned at offset 0 (a lone keyframe would
   * otherwise be the last), so the browser ends it at the element's underlying opacity: a disabled
   * button's half, a hidden icon's zero, or whatever a transition or animation of the element's own
   * shows at each moment, which the fade follows rather than fights. It ends where the element
   * already is, so nothing snaps when the fade lets go.
   */
  #appear(element: Element, delayMs: number, durationMs: number, from = 0): Promise<MotionOutcome> {
    return this.#animate(element, [{ opacity: from, offset: 0 }], {
      delay: delayMs,
      duration: durationMs,
      easing: "ease",
      fill: "backwards",
    });
  }

  /** Fades an element out and leaves it at zero. */
  #vanish(element: HTMLElement, delayMs: number, durationMs: number, from = 1): Promise<MotionOutcome> {
    if (durationMs <= 0 || from <= 0) {
      element.style.opacity = "0";
      return Promise.resolve("completed");
    }
    return this.#animate(element, [{ opacity: from }, { opacity: 0 }], {
      delay: delayMs,
      duration: durationMs * from,
      easing: "ease",
      // Held at `from` through the delay too, so nothing underneath, such as a pulse, shows first.
      fill: "both",
    });
  }

  /**
   * Ends this owner's animations on an element and its subtree: `finish` jumps them to their end,
   * `freeze` holds each target at the opacity it shows now and then stops the animation.
   */
  #settleWithin(element: Element, how: "finish" | "freeze"): void {
    for (const [animation, target] of [...this.#animations]) {
      if (!element.contains(target)) continue;
      if (how === "finish") {
        animation.finish();
        continue;
      }
      this.#freeze(animation, target, element);
    }
  }

  /**
   * Stops an animation, holding its target at the opacity it shows now with a constant animation of
   * its own. A target that is not rendered, under `display: none` or out of the document, shows
   * nothing, so it is only stopped. Freezing never throws: it runs in a layout effect, where an
   * error would reach the page's error boundary.
   */
  #freeze(animation: Animation, target: Element, pane: Element): void {
    const rendered = target.isConnected && target.getClientRects().length > 0;
    // Nothing to hold for a target that shows nothing, or whose opacity reads as no number.
    const shown = rendered ? opacityOf(target) : null;
    animation.cancel();
    if (shown === null || this.#disposed) return;
    const hold = target.animate([{ opacity: shown }, { opacity: shown }], { duration: 1, fill: "forwards" });
    this.#holds.set(hold, pane);
  }

  /** Lets go of the holds inside a pane that has finished leaving, which shows nothing by now. */
  #releaseHolds(pane: Element): void {
    for (const [hold, owner] of [...this.#holds]) {
      if (owner !== pane) continue;
      hold.cancel();
      this.#holds.delete(hold);
    }
  }

  /** Content still fading out as content lands again: what the new pane takes over from. */
  #takeOver(root: HTMLElement, leaving: HTMLElement): number {
    let from = 0;
    for (const pane of root.querySelectorAll<HTMLElement>(`:scope > [${EXITING_ATTRIBUTE}]`)) {
      if (pane === leaving || this.#kinds.get(pane) !== "content") continue;
      from = Math.max(from, opacityOf(pane) ?? 0);
      this.#settleWithin(pane, "finish");
      pane.style.opacity = "0";
    }
    return from;
  }

  /** Ends every leaving pane at once, for content that lands instantly. */
  #clearExiting(root: HTMLElement): void {
    for (const pane of root.querySelectorAll<HTMLElement>(`:scope > [${EXITING_ATTRIBUTE}]`)) {
      this.#settleWithin(pane, "finish");
      pane.style.opacity = "0";
    }
  }

  /** Brings content's pieces in: its own surfaces show at once, its text and media fade. */
  #contentIn(
    content: HTMLElement,
    contentPieces: readonly Element[],
    durationMs: number,
    timing: SequenceTiming | null
  ): Promise<MotionOutcome> {
    // A piece shown at zero opacity of its own, such as a hidden status icon, stays unseen: it is
    // not animated at all, so no fade can lift it. One whose opacity reads as no number is too.
    const pieces = contentPieces.filter((piece) => (opacityOf(piece) ?? 0) > 0);
    if (pieces.length === 0) return this.#appear(content, 0, durationMs);
    return allCompleted(
      pieces.map((piece) => {
        const delay = timing === null ? 0 : (timing.pieces.get(piece) ?? null);
        return delay === null ? Promise.resolve("completed") : this.#appear(piece, delay, durationMs);
      })
    );
  }

  /** Takes a skeleton away: its ghost's surfaces go at once, its bones fade as the plan times them. */
  #skeletonOut(
    skeleton: HTMLElement,
    durationMs: number,
    timing: SequenceTiming | null
  ): Promise<MotionOutcome> {
    for (const ghost of skeleton.querySelectorAll<HTMLElement>(`:scope > [data-slot="${GHOST_SLOT}"]`)) {
      ghost.style.visibility = "hidden";
    }
    const layers = [...skeleton.querySelectorAll<HTMLElement>(`:scope > [data-slot="${BONES_SLOT}"]`)];
    if (timing === null) return allCompleted(layers.map((layer) => this.#vanish(layer, 0, durationMs)));
    // Each bone leaves from what its pulse shows at the swap, held there through its delay, so a
    // bone caught dim never brightens before it fades. Every bone is read before any fade starts,
    // so starting one never makes the next read lay the page out again.
    const bones = layers
      .flatMap((layer) => [...layer.querySelectorAll<HTMLElement>(`[data-slot="${BONE_SLOT}"]`)])
      .map((bone) => ({
        bone,
        delay: timing.bone(
          bone.getBoundingClientRect(),
          Number.parseFloat(bone.getAttribute(BONE_FONT_SIZE_ATTRIBUTE) ?? "") || 16
        ),
        // A bone whose opacity reads as no number leaves from full.
        shown: opacityOf(bone) ?? 1,
      }));
    return allCompleted(
      bones.map(({ bone, delay, shown }) =>
        delay === null ? this.#vanish(bone, 0, 0) : this.#vanish(bone, delay, durationMs, shown)
      )
    );
  }
}
