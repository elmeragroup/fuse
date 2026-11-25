/**
 * The height of a `SkeletonReveal`'s root through a pane swap. It is package-private. It eases from
 * the height the root showed to the incoming pane's, or snaps, and follows the incoming pane while
 * it eases. It owns the one running ease, the declarations it writes on the root and puts back, and
 * the reader of the root's natural height every ease targets. `RevealMotion` runs the pane fades.
 */
import { windowOf, windowShowing } from "../../internal/dom-node";
import { localHeight, ownHeight } from "./skeleton-geometry";
import { RESIZE_EASING, RESIZE_MS } from "./skeleton-reveal-plan";

/**
 * How far apart two readings of the root's natural height may be and still be the same target. It
 * is well under any real resize, and well over the float noise between two fractional readings.
 */
const RESIZE_EPSILON = 0.05;

/**
 * How near the root's natural height must be to the height it shows for no ease to run. Under
 * half a pixel, the two lay out alike.
 */
const SETTLE_EPSILON = 0.5;

/** One inline declaration as the root had it, with its value and priority, empty when undeclared. */
type InlineDeclaration = { readonly name: string; readonly value: string; readonly priority: string };

/** A declaration a height ease writes on the root, by longhand, with its value. */
type Override = { readonly name: string; readonly value: string };

/**
 * Whether a flex container's main axis runs vertically, as a column across horizontal text or a row
 * down vertical text.
 */
function verticalMainAxis(style: CSSStyleDeclaration): boolean {
  const column = style.flexDirection.startsWith("column");
  const verticalText = !style.writingMode.startsWith("horizontal");
  return column !== verticalText;
}

/** The style of the box that lays the root out, which is its nearest ancestor that generates one. */
function layoutParentStyle(root: HTMLElement): CSSStyleDeclaration | null {
  const view = windowOf(root);
  for (let parent = root.parentElement; parent !== null; parent = parent.parentElement) {
    const style = view.getComputedStyle(parent);
    if (style.display !== "contents") return style;
  }
  return null;
}

/**
 * What a height ease writes on the root so that its keyframes are its used height and nothing
 * else of its layout changes, each by longhand. The `overflow` shorthand reads empty when only
 * one longhand is declared, so saving and restoring it would erase that one.
 *
 * - A clip, so the incoming content does not spill while the root is shorter than it, only on a
 *   root whose overflow is `visible` or `clip`. A clip makes no formatting context and no
 *   scrollbar, so it lays such a root out as before. A root that already scrolls or hides its
 *   overflow keeps it. Its content cannot spill, and a clip in its place would let margins
 *   collapse through it and take its scrollbar gutter away, rewrapping its content.
 * - In a flex container whose main axis is vertical, no growing or shrinking from an `auto`
 *   basis. The container would otherwise share its space out again around each keyframe, and a
 *   used height written as `height` would be shrunk or grown a second time.
 *
 * The root keeps its own `box-sizing`. The ease writes its heights in that box model instead, so
 * the root's `min-height` and `max-height` bound the ease as they bound the height it ends at.
 */
function easeOverrides(root: HTMLElement): readonly Override[] {
  const style = windowOf(root).getComputedStyle(root);
  const unclipped = (value: string): boolean => value === "visible" || value === "clip";
  const clip =
    unclipped(style.overflowX) && unclipped(style.overflowY)
      ? [
          { name: "overflow-x", value: "clip" },
          { name: "overflow-y", value: "clip" },
        ]
      : [];
  const parent = layoutParentStyle(root);
  const flexing =
    parent !== null && parent.display.endsWith("flex") && verticalMainAxis(parent)
      ? [
          { name: "flex-grow", value: "0" },
          { name: "flex-shrink", value: "0" },
          { name: "flex-basis", value: "auto" },
        ]
      : [];
  return [...clip, ...flexing];
}

/** The root's own inline declarations of the properties an ease writes, to put back after it. */
function saveDeclarations(root: HTMLElement, overrides: readonly Override[]): readonly InlineDeclaration[] {
  return overrides.map(({ name }) => ({
    name,
    value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name),
  }));
}

/**
 * Writes an ease's declarations, important so they hold even over an important declaration of the
 * root's own. The saved declarations come back exactly once the ease ends.
 */
function applyOverrides(root: HTMLElement, overrides: readonly Override[]): void {
  for (const { name, value } of overrides) root.style.setProperty(name, value, "important");
}

/** Puts the root's own inline declarations back exactly, removing the ones it did not have. */
function restoreDeclarations(root: HTMLElement, declarations: readonly InlineDeclaration[]): void {
  for (const { name, value, priority } of declarations) {
    if (value === "") root.style.removeProperty(name);
    else root.style.setProperty(name, value, priority);
  }
}

/** A root's running height ease, with the styles it found and the pane whose resizes retarget it. */
type Resize = {
  /** The element the ease runs on, whose declarations it saved. Every read and restore is on it. */
  readonly root: HTMLElement;
  /** The root's document when the ease started, whose window gives out the retarget frames. */
  readonly document: Document;
  readonly animation: Animation;
  readonly effect: KeyframeEffect;
  /** The keyframes the ease runs, in the root's own box model. */
  frames: Keyframe[];
  /** The root's natural border-box height the ease runs to, in local pixels. */
  to: number;
  /** What the ease writes on the root. */
  readonly overrides: readonly Override[];
  /** The root's own inline declarations of the properties the ease writes. */
  readonly declarations: readonly InlineDeclaration[];
  /**
   * Watches the incoming pane while the ease runs. It is only a trigger. What it reports is the
   * pane's size, which the eased root may stretch and a writing mode may turn, so each report
   * measures the root's natural height afresh rather than reading it from the pane. It never
   * measures in its own callback. Lifting the ease there changes the layout it observes, which the
   * browser reports as a "ResizeObserver loop" error event, so it schedules the retarget for the
   * next animation frame, before that frame lays out, once however many reports arrive.
   */
  readonly observer: ResizeObserver;
  /** The animation frame a retarget is scheduled for, or 0 when none is. */
  frame: number;
};

/**
 * How a swap moves the root to its new height: an ease, or a snap. An ease starts from the height
 * the root had before the swap, recorded while the leaving pane was on screen; without a record,
 * from the outgoing pane's height in place of the incoming one's.
 */
export type HeightChange =
  | { readonly kind: "snap" }
  | { readonly kind: "ease"; readonly rootBefore: number | null; readonly leavingHeight: number };

/** Keyframes from one border-box height to another, written in the root's own box model. */
function heightFrames(root: HTMLElement, from: number, to: number): Keyframe[] {
  return [{ height: `${String(ownHeight(root, from))}px` }, { height: `${String(ownHeight(root, to))}px` }];
}

/**
 * The natural height of a root an ease runs on, which a retarget or a swap under the ease targets.
 * With the ease lifted for the read, its keyframes and the declarations it wrote, its root lays out
 * under its own styles alone. The function then puts the ease back as it was, at the same time,
 * before anything paints. A root with no ease running is at its natural height already.
 */
function naturalHeight(resize: Resize): number {
  resize.effect.setKeyframes([]);
  restoreDeclarations(resize.root, resize.declarations);
  const natural = localHeight(resize.root);
  applyOverrides(resize.root, resize.overrides);
  resize.effect.setKeyframes(resize.frames);
  return natural;
}

/**
 * The root's height through pane swaps, with at most one ease at a time, each ended exactly once.
 */
export class RootHeight {
  #resize: Resize | null = null;
  #disposed = false;
  /** Called when an ease runs to its end, so the reveal can report its final layout. */
  readonly #onSettled: () => void;

  /**
   * @param onSettled - Called each time an ease settles: runs to its end, stops where the root
   *   already stands, or is snapped; not when a new ease replaces it or the owner is disposed.
   */
  constructor(onSettled: () => void) {
    this.#onSettled = onSettled;
  }

  /** Whether an ease is running, so the root has not reached its final height yet. */
  get easing(): boolean {
    return this.#resize !== null;
  }

  /**
   * Stops any running ease and puts the root's declarations back, telling no one. Calling it again
   * does nothing.
   */
  dispose(): void {
    this.#disposed = true;
    if (this.#resize !== null) this.#endResize(this.#resize, "disposed");
  }

  /**
   * Ends a height ease, the one way any ease ends. It stops the ease, stops following its pane and
   * puts back the root's styles. An ease that `settled`, by running to its end, stopping where the
   * root already stands or snapping, tells the reveal its height is final, once. One that a new ease
   * `replaced`, or that ends because the owner is `disposed`, does not.
   */
  #endResize(resize: Resize, how: "settled" | "replaced" | "disposed"): void {
    if (this.#resize !== resize) return;
    this.#resize = null;
    resize.observer.disconnect();
    windowShowing(resize.document)?.cancelAnimationFrame(resize.frame);
    resize.animation.cancel();
    restoreDeclarations(resize.root, resize.declarations);
    if (how === "settled" && !this.#disposed) this.#onSettled();
  }

  /**
   * Moves the root to the incoming pane's height, the one way every swap does. The change carries
   * the swap's facts rather than a start and an end. Where an ease starts depends on the ease
   * already running, which this owner alone holds. It always ends the ease before it, so no
   * earlier target, clip or observed pane outlives a swap. Then it snaps, or eases from the height
   * the root shows now.
   *
   * A reveal whose `render` element changed has a new root: an ease still running on the old one
   * ends there first, its declarations put back on the element it saved them from, and counts as
   * replaced. The old element is no longer the reveal's layout, so its height settling is nothing
   * to report; the new root starts afresh, as one with no ease running, and reports its own.
   */
  moveTo(root: HTMLElement, incoming: HTMLElement, change: HeightChange): void {
    if (this.#disposed) return;
    if (this.#resize !== null && this.#resize.root !== root) this.#endResize(this.#resize, "replaced");
    const running = this.#resize;
    const shown = localHeight(root);
    if (change.kind === "snap") {
      if (running !== null) this.#endResize(running, "settled");
      return;
    }
    // The outgoing pane is out of flow, so the root's natural height is now the target.
    const to = running === null ? localHeight(root) : naturalHeight(running);
    const from =
      running !== null ? shown : (change.rootBefore ?? to - localHeight(incoming) + change.leavingHeight);
    if (Math.abs(from - to) < SETTLE_EPSILON) {
      if (running !== null) this.#endResize(running, "settled");
      return;
    }
    if (running !== null) this.#endResize(running, "replaced");
    const overrides = easeOverrides(root);
    const declarations = saveDeclarations(root, overrides);
    applyOverrides(root, overrides);
    const view = windowOf(root);
    const frames = heightFrames(root, from, to);
    const effect = new view.KeyframeEffect(root, frames, { duration: RESIZE_MS, easing: RESIZE_EASING });
    const animation = new view.Animation(effect, root.ownerDocument.timeline);
    const observer = new view.ResizeObserver(() => {
      if (this.#resize !== resize || resize.frame !== 0) return;
      resize.frame =
        windowShowing(resize.document)?.requestAnimationFrame(() => {
          resize.frame = 0;
          if (this.#resize === resize && !this.#disposed) this.#retarget(resize);
        }) ?? 0;
    });
    const resize: Resize = {
      root,
      document: root.ownerDocument,
      animation,
      effect,
      frames,
      to,
      overrides,
      declarations,
      observer,
      frame: 0,
    };
    this.#resize = resize;
    animation.play();
    observer.observe(incoming);
    void animation.finished.then(
      () => {
        this.#endResize(resize, "settled");
      },
      () => undefined
    );
  }

  /**
   * Answers a resize under a running ease, measured in the root's own terms. The same target
   * resumes the same ease where it was, a target the root already shows settles it, and any other
   * one runs a new ease from the height shown.
   */
  #retarget(resize: Resize): void {
    const shown = localHeight(resize.root);
    const natural = naturalHeight(resize);
    if (Math.abs(natural - resize.to) < RESIZE_EPSILON) return;
    if (Math.abs(natural - shown) < SETTLE_EPSILON) {
      this.#endResize(resize, "settled");
      return;
    }
    resize.to = natural;
    resize.frames = heightFrames(resize.root, shown, natural);
    resize.effect.setKeyframes(resize.frames);
    resize.animation.currentTime = 0;
  }
}
