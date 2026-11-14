"use client";

import { useLayoutEffect, useState } from "react";
import type { PointerEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { writeStyle } from "./chart-dom";
import { glideFrom, snapGlide } from "./chart-spring";
import { trackPointer } from "./layout/pointer-speed";
import type { TrackedPointer } from "./layout/pointer-speed";
import { followSpring } from "./layout/spring";
import type { Spring } from "./layout/spring";
import { readPlace, SPARKLINE_PART, SPARKLINE_SLOT } from "./sparkline-marks";
import type { SparklineMarkPlace } from "./sparkline-marks";

/**
 * Props for `SparklineHover`. It renders a `div` by default, and `render` puts its behavior on
 * another element, such as the tile that holds the Sparklines.
 *
 * @beta
 */
export type SparklineHoverProps = useRender.ComponentProps<"div"> & {
  /**
   * One or more `Sparkline`s, whose hover marks glide on a spring once the wrapper hydrates. A
   * server component can render the wrapper around server-rendered Sparklines, and the data stays
   * on the server. Before it hydrates, or with no script, the Sparklines keep their CSS hover. A
   * step to another value glides the crosshair, the dot and the band that re-strokes a line or an
   * area, and a hovered bar lifts at once. Under reduced motion the marks move at once. A Sparkline
   * inside nested wrappers follows the nearest one, and the wrapper leaves a Sparkline with
   * `data-hover="none"` alone. Pass `render` to put the behavior on another element, such as the
   * tile that holds the Sparklines.
   */
  children?: useRender.ComponentProps<"div">["children"];
};

/** The groups a glide translates, inside a Sparkline's `sparkline-glide` group. */
type Movers = {
  readonly crosshair: Element;
  readonly dot: Element;
  /**
   * The band's groups that clip the line at its start and at its end, the second inside the first,
   * and the whole line inside both, which moves against them.
   */
  readonly band: readonly [start: Element, end: Element, line: Element] | null;
};

/** One Sparkline's glide group and the groups in it that move. */
type GlideMarks = { readonly glide: SVGGElement; readonly movers: Movers };

/** The selector of a slot a Sparkline part spreads. */
const slot = ({ "data-slot": name }: { readonly "data-slot": string }) => `[data-slot="${name}"]`;

/** The selector of a mover group, a child of the glide group. */
const mover = (name: string) => `:scope > [data-part="${name}"]`;

const VALUE = slot(SPARKLINE_SLOT.value);
const SPARKLINE = `svg${slot(SPARKLINE_SLOT.root)}`;
const GLIDE = slot(SPARKLINE_SLOT.glide);

/**
 * The attribute every wrapper element carries, written after the consumer's props. A `render`
 * element may write its own `data-slot`, so a wrapper is not known by its slot. Ownership goes by
 * the connected roots, and this attribute only marks a wrapper in the server's markup that has not
 * hydrated yet, which holds its Sparklines until it does.
 */
const BOUNDARY = "data-sparkline-hover";

/** The wrapper elements connected now, each the owner of the Sparklines nearest it. */
const roots = new WeakSet<Element>();

/**
 * The wrapper that owns an element: the nearest connected wrapper around it, or null when there is
 * none or a nearer wrapper that has not hydrated yet holds it, which leaves it its CSS hover.
 */
function ownerOf(element: Element): Element | null {
  for (let at = element.parentElement; at !== null; at = at.parentElement) {
    if (roots.has(at)) return at;
    if (at.hasAttribute(BOUNDARY)) return null;
  }
  return null;
}

/**
 * A Sparkline's glide marks, or null when its markup lacks them, as it does with no value or with
 * `data-hover="none"`.
 */
function marksOf(svg: SVGSVGElement): GlideMarks | null {
  const glide = svg.querySelector(GLIDE);
  if (!(glide instanceof SVGGElement)) return null;
  const crosshair = glide.querySelector(mover(SPARKLINE_PART.crosshair));
  const dot = glide.querySelector(mover(SPARKLINE_PART.dot));
  if (crosshair === null || dot === null) return null;
  const start = glide.querySelector(mover(SPARKLINE_PART.bandStart));
  const end = start?.querySelector(mover(SPARKLINE_PART.bandEnd)) ?? null;
  const line = end?.firstElementChild ?? null;
  const band = start === null || end === null || line === null ? null : ([start, end, line] as const);
  return { glide, movers: { crosshair, dot, band } };
}

/** End every mover's glide, so each shows its rest. */
function snapMovers({ crosshair, dot, band }: Movers): void {
  snapGlide(crosshair);
  snapGlide(dot);
  if (band !== null) band.forEach(snapGlide);
}

/** The Sparklines a wrapper owns that have glide marks to move. */
function ownedSparklines(root: Element): SVGSVGElement[] {
  return [...root.querySelectorAll(SPARKLINE)].filter(
    (svg): svg is SVGSVGElement =>
      svg instanceof SVGSVGElement && ownerOf(svg) === root && marksOf(svg) !== null
  );
}

/** The value region an event target sits in, when `root` owns its Sparkline, or null. */
function ownedRegion(root: Element, target: EventTarget | null): SVGGElement | null {
  if (!(target instanceof Element)) return null;
  const region = target.closest(VALUE);
  return region instanceof SVGGElement && ownerOf(region) === root ? region : null;
}

/** What a wrapper does with its Sparklines' pointer events and markup. */
type Glider = {
  /** Track the pointer's speed, which picks the spring of the next step. */
  readonly move: (event: PointerEvent) => void;
  /** Place the marks at the value the pointer reached, gliding from where they show, or at once. */
  readonly over: (event: PointerEvent, motion: "glide" | "snap") => void;
  /** Forget where the marks rest once the pointer leaves a Sparkline's values. */
  readonly out: (event: PointerEvent) => void;
  /**
   * The wrapper element's ref, stable for the glider's life. Attaching an element takes over the
   * Sparklines it owns, now and as they come and go: it places each one's marks at the value
   * hovered now, which a pointer that rested there before hydration hovers, then marks its glide
   * group `data-glide`, which hands its hover from the CSS to the glide, and keeps the marks on the
   * hovered value through new data. A ref callback runs in the commit's layout phase, so the
   * takeover lands before the commit paints, whichever component's state replaced the element. Its cleanup lets go a microtask later, unless the same element attaches
   * again first, as it does when a consumer's inline ref changes the merged ref each render, so a
   * running glide survives that; another element lets go of the old one at once.
   */
  readonly ref: (root: Element | null) => (() => void) | undefined;
  /** End every running glide at once, as reduced motion asks. */
  readonly snapAll: () => void;
};

/**
 * Create a wrapper's glider. It keeps the pointer's speed, the Sparklines it has taken over, and
 * where each one's marks rest while the pointer is over one of its values, and writes to the page,
 * never to React.
 *
 * @returns The glider.
 */
function createGlider(): Glider {
  let pointer: TrackedPointer | null = null;
  const rests = new WeakMap<Element, SparklineMarkPlace>();
  const owned = new Set<SVGSVGElement>();

  // Place a Sparkline's marks at a region's rest, gliding on a spring from their last rest.
  const place = (region: SVGGElement, spring: Spring | null): void => {
    const svg = region.ownerSVGElement;
    const marks = svg === null ? null : marksOf(svg);
    if (svg === null || marks === null) return;
    const { glide, movers } = marks;
    const to = readPlace(region);
    writeStyle(glide, "--_value-x", String(to.x));
    writeStyle(glide, "--_value-y", String(to.y));
    writeStyle(glide, "--_band-start", to.band === undefined ? null : String(to.band[0]));
    writeStyle(glide, "--_band-end", to.band === undefined ? null : String(to.band[1]));
    const from = rests.get(glide);
    rests.set(glide, to);
    if (from === undefined || spring === null) {
      snapMovers(movers);
      return;
    }
    // The marks glide in percent of the box they rest in, the view box of a line or an area and the
    // svg's own box for bars, so a glide stays in step with a box that resizes as it runs.
    const x = from.x - to.x;
    glideFrom(movers.crosshair, [x, 0], spring, "%");
    glideFrom(movers.dot, [x, from.y - to.y], spring, "%");
    if (movers.band === null || from.band === undefined || to.band === undefined) return;
    // Each edge slides from its own old place, the end group inside the start group, and the line
    // inside both slides back. Every glide plays the same spring from the same moment, so the
    // offsets the three show always sum to none and the line holds still.
    const [start, end, line] = movers.band;
    const fromStart = from.band[0] - to.band[0];
    const fromEnd = from.band[1] - to.band[1];
    glideFrom(start, [fromStart, 0], spring, "%");
    glideFrom(end, [fromEnd - fromStart, 0], spring, "%");
    glideFrom(line, [-fromEnd, 0], spring, "%");
  };

  // Forget a Sparkline's rest and show its marks where they rest.
  const release = (svg: SVGSVGElement): void => {
    const marks = marksOf(svg);
    if (marks === null) return;
    rests.delete(marks.glide);
    snapMovers(marks.movers);
  };

  // Place a Sparkline's marks at once at the value hovered now, or release them when none is. New
  // data moves the marks with no step, so they snap, as a chart's crosshair does on a commit.
  const reconcile = (svg: SVGSVGElement): void => {
    const hovered = svg.querySelector(`${VALUE}:hover`);
    if (hovered instanceof SVGGElement) place(hovered, null);
    else release(svg);
  };

  // Place a Sparkline's marks, then mark its glide group, which a re-render may have drawn anew,
  // so the takeover CSS shows them placed.
  const take = (svg: SVGSVGElement): void => {
    reconcile(svg);
    svg.querySelector(GLIDE)?.setAttribute("data-glide", "");
  };

  // Take over the Sparklines a wrapper element owns, as `ref` describes. Returns the let-go.
  const connect = (root: Element): (() => void) => {
    roots.add(root);
    // Take over the Sparklines that arrived, initialized before they are marked, and let go of
    // those that left or that a nearer wrapper now owns, whose marker that wrapper keeps.
    const discover = (): void => {
      const now = new Set(ownedSparklines(root));
      for (const svg of owned) {
        if (!now.has(svg)) owned.delete(svg);
      }
      for (const svg of now) {
        if (owned.has(svg)) continue;
        owned.add(svg);
        take(svg);
      }
    };
    const markup = new MutationObserver((records) => {
      // A change inside a Sparkline it owns, such as new data, which rewrites its value regions,
      // places its marks again. Any other change of the tree, a Sparkline that gained its glide
      // marks included, only finds Sparklines that came or went. The marks' own writes change
      // only their glide group, which needs nothing.
      const changed = new Set<SVGSVGElement>();
      let tree = false;
      for (const { target, type } of records) {
        if (!(target instanceof Element) || target.closest(GLIDE) !== null) continue;
        const svg = target.closest(SPARKLINE);
        if (svg instanceof SVGSVGElement && owned.has(svg)) changed.add(svg);
        else if (type === "childList") tree = true;
      }
      if (tree) discover();
      changed.forEach(take);
    });
    markup.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    discover();
    return () => {
      markup.disconnect();
      for (const svg of owned) {
        release(svg);
        if (ownerOf(svg) === root) svg.querySelector(GLIDE)?.removeAttribute("data-glide");
      }
      owned.clear();
      roots.delete(root);
    };
  };

  // The element connected now, and the one whose cleanup waits a microtask to let go.
  let connection: { readonly root: Element; readonly disconnect: () => void } | null = null;
  let leaving: Element | null = null;

  return {
    move(event) {
      pointer = trackPointer(pointer, event.clientX, event.clientY, event.pointerType, event.timeStamp);
    },
    over(event, motion) {
      const region = ownedRegion(event.currentTarget, event.target);
      if (region === null) return;
      place(region, motion === "snap" ? null : followSpring(pointer?.speed ?? null));
    },
    out(event) {
      const region = ownedRegion(event.currentTarget, event.target);
      const svg = region?.ownerSVGElement ?? null;
      if (svg === null) return;
      // A move to another value of the same Sparkline is a step, which its pointerover takes.
      if (ownedRegion(event.currentTarget, event.relatedTarget)?.ownerSVGElement === svg) return;
      release(svg);
    },
    snapAll() {
      for (const svg of owned) {
        const marks = marksOf(svg);
        if (marks !== null) snapMovers(marks.movers);
      }
    },
    ref(root) {
      if (root === null) return undefined;
      if (leaving === root) leaving = null;
      if (connection?.root !== root) {
        connection?.disconnect();
        connection = { root, disconnect: connect(root) };
      }
      return () => {
        leaving = root;
        queueMicrotask(() => {
          if (leaving !== root) return;
          leaving = null;
          if (connection?.root !== root) return;
          connection.disconnect();
          connection = null;
        });
      };
    },
  };
}

/**
 * Wraps one or more `Sparkline`s and, once it hydrates, moves their hover marks on a spring. A
 * server component may render it around server-rendered Sparklines: it reads each value's place from
 * their markup, so the data stays on the server, and before it hydrates, or with no script, the
 * Sparklines keep their own CSS hover, which cross-fades from value to value.
 *
 * Hydrated, the pointer over a value shows one dashed crosshair, one dot and, on a line or an area,
 * one band that re-strokes the line around the value, and a step to another value glides them
 * there on the crosshair's follow spring, which quickens with the pointer as a chart's does, from
 * wherever they show mid-glide. A bar's lift moves at once. They move at once under reduced motion,
 * and the first value the pointer reaches places them with no glide, as does a pointer that rests on
 * a value as the wrapper hydrates. New data places them at once on the value hovered then, and they
 * glide in shares of the box, so a new size keeps them on it. Like the Sparkline's own hover, the
 * marks show only on a device that hovers, and add nothing to the accessible name and no tab stop.
 * A pointer move writes the marks' place and starts their glides, and renders nothing in React. A
 * Sparkline inside nested wrappers follows the nearest one, and keeps its CSS hover until that one
 * hydrates. A Sparkline with `data-hover="none"` has no hover to move, and the wrapper leaves it be.
 *
 * @beta
 */
export function SparklineHover({ render, ref, ...props }: SparklineHoverProps): ReactElement {
  const reduced = useReducedMotion();
  const [glider] = useState(createGlider);
  useLayoutEffect(() => {
    if (reduced) glider.snapAll();
  }, [glider, reduced]);
  // The server and hydration render nothing the glide adds, so the CSS hover holds until the
  // stable `glider.ref` takes each Sparkline over in the client commit that attaches the element.
  return useRender({
    defaultTagName: "div",
    ref: ref === undefined ? glider.ref : [ref, glider.ref],
    props: {
      "data-slot": "sparkline-hover",
      ...mergeProps<"div">(
        {
          onPointerMove: glider.move,
          onPointerOver: (event: PointerEvent) => {
            glider.over(event, reduced ? "snap" : "glide");
          },
          onPointerOut: glider.out,
        },
        props
      ),
      [BOUNDARY]: "",
    },
    render,
  });
}

Object.assign(SparklineHover, { displayName: "SparklineHover" });
