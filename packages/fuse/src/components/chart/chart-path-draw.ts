"use client";

/**
 * What a Line and an Area share between the vertices of `layout/series-path.ts` and Root's loop:
 * where the numbers land, the topology a writer draws them in, the clip spans that dash or hatch a
 * part of the path, the route a data update tweens, and the crossfade that replaces a path whose
 * slots changed in another way. Each part's writer stays in its own module, as the central suite
 * asks, and calls these.
 */
import type { ChartMotion, MarkValues, ValueAxis } from "./chart-motion";
import { placementOf } from "./chart-motion-mark";
import type { Commit, MotionMark } from "./chart-motion-mark";
import { pathAnchor } from "./chart-paths";
import type { ChartPaths, PathKind as RouteKind } from "./chart-paths";
import type { ChartCurve } from "./chart-types";
import { AREA_STRIDE } from "./layout/line-path";
import type { PathPlacement, PathTopology, Span } from "./layout/line-path";
import { CHART_CROSSFADE_MS } from "./layout/motion";
import { pathMotion } from "./layout/path-motion";
import type { PathSlots } from "./layout/path-motion";
import { cellRun, pointAlong, slotCentreAt, snapAcross, snapAlong, strokeCentre } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/** What a path's writer reads besides the numbers: the frame, the curve and the topology. */
export type PathLook = {
  readonly frame: PlotFrame;
  readonly xScale: "band" | "point";
  readonly curve: ChartCurve;
  /** The topology of the resting path. */
  readonly topology: PathTopology;
  /**
   * The topology of the route a data update tweens, which the update sets when it starts, so a
   * frame of the route and a frame at rest each draw their own vertices.
   */
  readonly moving: { current: PathTopology | null };
  /** The ids of the two clip paths the writer fills: the solid path's and the marked twin's. */
  readonly clips: { readonly solid: string; readonly marked: string };
  /**
   * The width the part strokes its path in, CSS pixels, 0 for a fill, which a Line reads off its
   * computed style each commit, so a straight stroke covers whole device pixels at any width.
   */
  readonly stroke: { current: number };
};

/**
 * Where a path's numbers land: vertices on the crosshair's column, and cell edges, plain step
 * risers and values on device pixels, each moved by the stroke's parity, so a stroked step's runs
 * and risers cover whole device pixels at any width. A riser of an odd width takes the pixels just past its cell
 * edge, inside the band of the run it starts. An Area strokes nothing, so its fill edges stay on
 * the cell edges.
 *
 * @param look - The path's look.
 * @returns The placement for `linePaths` and `areaPaths`.
 */
export function placeOf(look: PathLook): PathPlacement {
  const { frame } = look;
  const width = look.stroke.current;
  return {
    orientation: frame.orientation,
    curve: look.curve,
    along: (at) => pointAlong(frame, at, look.xScale),
    run: (centre, cells) => {
      const [start, end] = cellRun(frame, centre, cells);
      return [strokeCentre(frame, start, width), strokeCentre(frame, end, width)];
    },
    across: (at) => strokeCentre(frame, snapAcross(frame, at), width),
    edge: (at) => strokeCentre(frame, snapAlong(frame, at), width),
    digits: null,
  };
}

/**
 * The topology of the numbers a frame draws: the last route's while its vertex count matches,
 * which a frame of the route and its resting frame both draw in, and the resting one otherwise.
 * Where the two hold the same vertices they differ only in what a vertex that leaves the path
 * draws on its way, which has no length at rest.
 *
 * @param moving - The last route's topology, or null.
 * @param topology - The resting topology.
 * @param count - The vertices the frame draws.
 * @returns The topology.
 */
export function topologyAt<S extends Counted>(moving: S | null, topology: S, count: number): S {
  return moving?.count === count ? moving : topology;
}

/** How far the clip rectangles reach past the plot, so a stroke or a cap at the edge keeps its paint. */
const CLIP_MARGIN = 16;

/** Fill a clip path with one rectangle per span along the slot axis, reusing its rectangles. */
function fillClip(clip: Element, frame: PlotFrame, spans: readonly Span[]): void {
  const vertical = frame.orientation === "vertical";
  const across = (vertical ? frame.box.height : frame.box.width) + 2 * CLIP_MARGIN;
  while (clip.children.length > spans.length) clip.lastElementChild?.remove();
  while (clip.children.length < spans.length) {
    clip.append(clip.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect"));
  }
  spans.forEach(([start, end], index) => {
    const rect = clip.children[index];
    if (rect === undefined) return;
    const position = { start: String(start), size: String(Math.max(0, end - start)) };
    rect.setAttribute(vertical ? "x" : "y", position.start);
    rect.setAttribute(vertical ? "width" : "height", position.size);
    rect.setAttribute(vertical ? "y" : "x", String(-CLIP_MARGIN));
    rect.setAttribute(vertical ? "height" : "width", String(across));
  });
}

/**
 * Write the path data of a frame onto a series group: the solid path and its marked twin, which
 * dashes or hatches the spans, each clipped to its side of them. A path without spans draws whole.
 *
 * @param group - The series group, which holds both clip paths and both paths.
 * @param look - The path's look.
 * @param d - The path data.
 * @param spans - The spans the twin draws, sorted and disjoint.
 * @param mode - "replace" draws the twin in place of the solid path over the spans, as a Line
 *   dashes them, and "overlay" draws it over the whole path, as an Area hatches them.
 * @param dots - An Area's lone readings, which its dot and dashed dot twin draw, each clipped to
 *   its side of the spans as a Line's dots are.
 */
export function writePath(
  group: Element,
  look: PathLook,
  d: string,
  spans: readonly Span[],
  mode: "replace" | "overlay",
  dots = ""
): void {
  const { frame, clips } = look;
  const length = frame.orientation === "vertical" ? frame.box.width : frame.box.height;
  const low = -CLIP_MARGIN;
  const high = length + CLIP_MARGIN;
  const marked = spans.map(([start, end]): Span => [Math.max(low, start), Math.min(high, end)]);
  const solid: Span[] = [];
  let from = low;
  for (const [start, end] of marked) {
    solid.push([from, start]);
    from = end;
  }
  solid.push([from, high]);
  for (const child of group.children) {
    const part = child.getAttribute("data-part");
    if (part === "solid-clip") fillClip(child, frame, solid);
    else if (part === "marked-clip") fillClip(child, frame, marked);
    else if (part === "solid") {
      // React has already written a resting path, so a frame that draws it again writes nothing.
      if (child.getAttribute("d") !== d) child.setAttribute("d", d);
      if (spans.length === 0 || mode === "overlay") child.removeAttribute("clip-path");
      else child.setAttribute("clip-path", `url(#${clips.solid})`);
    } else if (part === "marked") {
      const twin = spans.length === 0 ? "" : d;
      if (child.getAttribute("d") !== twin) child.setAttribute("d", twin);
      child.setAttribute("clip-path", `url(#${clips.marked})`);
    } else if (part === "dot") {
      if (child.getAttribute("d") !== dots) child.setAttribute("d", dots);
      if (spans.length === 0) child.removeAttribute("clip-path");
      else child.setAttribute("clip-path", `url(#${clips.solid})`);
    } else if (part === "dot-marked") {
      const twin = spans.length === 0 ? "" : dots;
      if (child.getAttribute("d") !== twin) child.setAttribute("d", twin);
      child.setAttribute("clip-path", `url(#${clips.marked})`);
    }
  }
}

/**
 * What each of a path's numbers measures: a vertex's place along the slot axis, then its value, and
 * an Area's base, both across the value axis. The loop repeats the declaration for every vertex.
 *
 * @param orientation - Root's orientation.
 * @param stride - The numbers per vertex.
 * @returns One vertex's axes.
 */
export function pathAxes(orientation: "vertical" | "horizontal", stride: number): ValueAxis[] {
  const along: ValueAxis = orientation === "vertical" ? "x" : "y";
  const across: ValueAxis = orientation === "vertical" ? "y" : "x";
  return stride === AREA_STRIDE ? [along, across, across] : [along, across];
}

/** A topology that knows its vertex count, as every path topology does. */
export type Counted = { readonly count: number };

/**
 * The vertices a path draws, which a decimated path draws only some of its window's slots as: each
 * one's key and place in the window, in window order, and every slot of the window.
 */
export type DrawnPath = {
  readonly keys: readonly string[];
  /** Each vertex's place in the window, in slots from its first, which may fall between slots. */
  readonly positions: readonly number[];
  readonly window: PathSlots;
};

/** The vertices the loop holds for a path: their keys, places in the window and topology. */
export type HeldPath<S extends Counted = PathTopology> = {
  readonly keys: readonly string[];
  readonly positions: readonly number[];
  readonly topology: S;
};

/** What a path keeps from the commit it last placed, which the next data update starts from. */
export type PathMemory<S extends Counted = PathTopology> = HeldPath<S> & {
  /** The slots of the window the path rests on. */
  readonly window: PathSlots;
  /** The route the last data update set the loop on, or null when it placed a rest. */
  readonly route: HeldPath<S> | null;
};

/** How a data update moves a path. */
export type PathStep<S extends Counted = PathTopology> =
  | {
      readonly kind: "route";
      /** The route's numbers, from what the path drew and to the new vertices. */
      readonly via: { readonly from: MarkValues; readonly to: MarkValues };
      /** The route's vertices, their places in the new window, and their topology. */
      readonly route: HeldPath<S>;
      /** The keys the route grows past the old end. */
      readonly grown: ReadonlySet<string>;
    }
  | { readonly kind: "crossfade" }
  | { readonly kind: "snap" };

/**
 * How a kind of path reads and builds its topology one vertex at a time, so a route joins the new
 * topology's vertices with the old topology's leaving ones, and moves a vertex along the slot axis.
 */
export type PathKind<S extends Counted, T> = {
  /** The numbers per vertex. */
  readonly stride: number;
  /** One vertex's topology out of a topology. */
  readonly at: (topology: S, index: number) => T;
  /** A topology from vertices' topologies, with the new topology's own settings. */
  readonly of: (vertices: readonly T[], like: S) => S;
  /** A vertex's numbers moved along the slot axis by a whole number of slots. */
  readonly shift: (vertex: readonly number[], by: number) => number[];
  /**
   * The topology a vertex in both paths draws its route in, from its old and its new one. Without
   * it the route draws the new one.
   */
  readonly keep?: (old: T, next: T) => T;
  /**
   * A vertex at its own place with no length, on the zero line, where a vertex one path lacks
   * starts or ends while its slot stays in the window, or undefined for a vertex that starts or
   * ends on the other path at its place, as a line's and a column's do.
   */
  readonly flat?: (vertex: readonly number[], topology: T) => number[] | undefined;
};

/** One vertex's numbers out of a list, by its index. */
function vertexAt(values: MarkValues, stride: number, index: number): number[] {
  return Array.from({ length: stride }, (_, offset) => values[index * stride + offset] ?? 0);
}

/** One vertex of a Line's or an Area's topology. */
type VertexTopology = {
  readonly state: PathTopology["states"][number];
  readonly estimated: boolean;
  readonly projected: boolean;
  readonly side: PathTopology["sides"][number];
  readonly cells: number;
};

/**
 * The path kind of a Line or an Area: a vertex is its place along the slot axis, then its value and
 * its base, so a slide moves its first number.
 *
 * @param stride - `LINE_STRIDE` or `AREA_STRIDE`.
 * @param slot - The distance from one slot's centre to the next along the slot axis.
 * @returns The kind.
 */
export function seriesPathKind(stride: number, slot: number): PathKind<PathTopology, VertexTopology> {
  return {
    stride,
    at: (topology, index) => ({
      state: topology.states[index] ?? "pending",
      estimated: topology.estimated[index] ?? false,
      projected: index >= topology.projectedFrom,
      side: topology.sides[index] ?? null,
      cells: topology.cells[index] ?? 1,
    }),
    of: (vertices, like) => {
      const projected = vertices.findIndex((vertex) => vertex.projected);
      return {
        count: vertices.length,
        states: vertices.map((vertex) => vertex.state),
        estimated: vertices.map((vertex) => vertex.estimated),
        projectedFrom: projected === -1 ? vertices.length : projected,
        missing: like.missing,
        sides: vertices.map((vertex) => vertex.side),
        cells: vertices.map((vertex) => vertex.cells),
      };
    },
    shift: ([along = 0, ...rest], by) => [along + by * slot, ...rest],
  };
}

/**
 * The numbers a path draws at a place in its window, between the vertices around it, or its end
 * vertex past either end. Vertices sit about a pixel column apart where a path decimates, so a
 * straight blend lands on the path.
 */
function sampler(
  positions: readonly number[],
  values: MarkValues,
  stride: number
): (position: number) => number[] {
  const order = positions
    .map((_, index) => index)
    .toSorted((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
  const at = (rank: number) => positions[order[rank] ?? 0] ?? 0;
  return (position) => {
    // The first vertex at or past the place, by bisection.
    let low = 0;
    let high = order.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (at(middle) < position) low = middle + 1;
      else high = middle;
    }
    const after = order[Math.min(low, order.length - 1)] ?? 0;
    const before = order[Math.max(low - 1, 0)] ?? 0;
    const end = vertexAt(values, stride, after);
    if (low === 0 || low === order.length || at(low) === position) {
      return low === order.length ? vertexAt(values, stride, before) : end;
    }
    const start = vertexAt(values, stride, before);
    const share = (position - at(low - 1)) / (at(low) - at(low - 1));
    return start.map((value, offset) => value + ((end[offset] ?? value) - value) * share);
  };
}

/** One vertex of a route: its key, its place in the new window, its numbers and its topology. */
type RouteVertex<T> = {
  readonly key: string;
  readonly at: number;
  readonly from: readonly number[];
  readonly to: readonly number[];
  readonly vertex: T;
};

/**
 * Decide how a data update moves a path, and lay its route out from what the path drew. The mode
 * reads off the window's slots, and the route joins the vertices the loop holds with the new ones
 * by key. A vertex in both tweens from where it drew. A new vertex starts on the old path at its
 * slot, where a decimated path drew no vertex, or slides in from beyond the edge, or grows out of
 * the old end. An old vertex the new path lacks ends on the new path at its slot, slides out past
 * the edge, or shrinks into the new end, and a vertex an interrupted slide still takes out keeps
 * sliding, so the path keeps its geometry until the clip hides it.
 *
 * @param memory - What the path placed last, or null before its first placement.
 * @param path - The new vertices' keys and places, and the new window's slots.
 * @param topology - The new topology.
 * @param rest - The new resting numbers.
 * @param drawn - What the loop drew last for the path.
 * @param kind - How the path's vertices hold their numbers and topology.
 * @returns The route, a crossfade, or a snap when no old vertex is known.
 */
export function pathStep<S extends Counted, T>(
  memory: PathMemory<S> | null,
  path: DrawnPath,
  topology: S,
  rest: MarkValues,
  drawn: MarkValues | null,
  kind: PathKind<S, T>
): PathStep<S> {
  if (memory === null || drawn === null) return { kind: "snap" };
  const { stride } = kind;
  const motion = pathMotion(memory.window, path.window);
  if (motion.mode === "crossfade") return { kind: "crossfade" };
  const { by } = motion;
  const slides = motion.mode === "slide";
  // The loop holds the last route while its tween runs and the rest once it ends, and the two
  // differ in vertex count whenever they differ at all.
  const { route } = memory;
  const held = route !== null && route.keys.length * stride === drawn.length ? route : memory;
  if (held.keys.length * stride !== drawn.length) return { kind: "snap" };
  const oldLast = memory.window.keys.length - 1;
  const newLast = path.window.keys.length - 1;
  const oldAt = sampler(held.positions, drawn, stride);
  const newAt = sampler(path.positions, rest, stride);
  const heldIndex = new Map(held.keys.map((key, index) => [key, index]));
  const resting = new Set(memory.keys);
  const vertices: RouteVertex<T>[] = [];
  const grown = new Set<string>();
  path.keys.forEach((key, index) => {
    const at = path.positions[index] ?? index;
    const to = vertexAt(rest, stride, index);
    const next = kind.at(topology, index);
    const old = heldIndex.get(key);
    if (old !== undefined) {
      const vertex = kind.keep === undefined ? next : kind.keep(kind.at(held.topology, old), next);
      vertices.push({ key, at, from: vertexAt(drawn, stride, old), to, vertex });
      return;
    }
    const source = at + by;
    let from: readonly number[];
    if (source >= 0 && source <= oldLast) from = kind.flat?.(to, next) ?? oldAt(source);
    // It slides in from beyond the edge, already at its new value.
    else if (slides) from = kind.shift(to, by);
    else {
      from = oldAt(oldLast);
      grown.add(key);
    }
    vertices.push({ key, at, from, to, vertex: next });
  });
  const kept = new Set(path.keys);
  held.keys.forEach((key, index) => {
    if (kept.has(key)) return;
    const at = (held.positions[index] ?? index) - by;
    const from = vertexAt(drawn, stride, index);
    let to: readonly number[];
    const vertex = kind.at(held.topology, index);
    if (at >= 0 && at <= newLast) to = kind.flat?.(from, vertex) ?? newAt(at);
    // It slides out past the edge at the value it drew.
    else if (slides) to = kind.shift(from, -by);
    else if (at > newLast && resting.has(key)) to = newAt(newLast);
    // A vertex an earlier slide was taking out stays outside the plot, and leaves at rest.
    else to = from;
    vertices.push({ key, at, from, to, vertex });
  });
  // The route keeps axis order, and a new vertex comes before an old one at the same place.
  const ordered = vertices.toSorted((a, b) => a.at - b.at);
  return {
    kind: "route",
    via: { from: ordered.flatMap(({ from }) => from), to: ordered.flatMap(({ to }) => to) },
    route: {
      keys: ordered.map(({ key }) => key),
      positions: ordered.map(({ at }) => at),
      topology: kind.of(
        ordered.map(({ vertex }) => vertex),
        topology
      ),
    },
    grown,
  };
}

/**
 * The distance from one slot's centre to the next along the slot axis.
 *
 * @param frame - The layout's frame.
 * @param xScale - Root's x scale.
 * @returns The distance in CSS pixels.
 */
export function slotStep(frame: PlotFrame, xScale: "band" | "point"): number {
  return slotCentreAt(frame, 1, xScale) - slotCentreAt(frame, 0, xScale);
}

/**
 * A window position's unsnapped centre along the slot axis, where a vertex rests.
 *
 * @param frame - The layout's frame.
 * @param xScale - Root's x scale.
 * @returns The function.
 */
export function centreAlong(frame: PlotFrame, xScale: "band" | "point"): (position: number) => number {
  return (position) => slotCentreAt(frame, position, xScale);
}

/**
 * Fade a mark's old drawing out over its new one. The old drawing is a copy of the live node, or of
 * a copy the mark kept of how it last showed, which `redraw` puts back where it was, inside a
 * group React renders empty, and it leaves when its fade ends or a range step finishes it. The live
 * node fades in on the same clock.
 *
 * @param live - The node React and the loop draw into.
 * @param outgoing - The empty group the copy fades out in.
 * @param redraw - Writes the old drawing onto the copy.
 * @param source - What the copy starts from, the live node by default.
 */
export function crossfade(
  live: Element,
  outgoing: Element,
  redraw: (copy: Element) => void,
  source: Element = live
): void {
  for (const animation of live.getAnimations()) animation.finish();
  for (const old of outgoing.children) for (const animation of old.getAnimations()) animation.finish();
  outgoing.replaceChildren();
  const copy = source.cloneNode(true);
  if (!(copy instanceof Element)) return;
  copy.setAttribute("data-outgoing", "");
  redraw(copy);
  // The copy's clip paths and paint servers take ids of their own, so the live node keeps its own.
  const renamed = new Map<string, string>();
  for (const element of copy.querySelectorAll("[id]")) {
    renamed.set(element.id, `${element.id}-out`);
    element.id = `${element.id}-out`;
  }
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of ["clip-path", "mask", "fill", "stroke"]) {
      const reference = /^url\(#(.+)\)$/u.exec(element.getAttribute(name) ?? "")?.[1];
      const next = reference === undefined ? undefined : renamed.get(reference);
      if (next !== undefined) element.setAttribute(name, `url(#${next})`);
    }
  }
  outgoing.append(copy);
  const timing = { duration: CHART_CROSSFADE_MS, easing: "linear" } as const;
  const out = copy.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, fill: "forwards" });
  const leave = (): void => {
    copy.remove();
  };
  out.onfinish = leave;
  out.oncancel = leave;
  live.animate([{ opacity: 0 }, { opacity: 1 }], timing);
}

/** What `placePath` reads and keeps for one series path between commits. */
export type PathCommit<L extends { readonly moving: { current: S | null } }, S extends Counted, T> = {
  readonly mark: MotionMark<SVGGElement, ValueAxis[]>;
  readonly motion: ChartMotion;
  readonly paths: ChartPaths;
  readonly seriesIndex: number;
  /** What draws the path, which names its anchor and its route record. */
  readonly drawn: RouteKind;
  readonly kind: PathKind<S, T>;
  readonly look: L;
  /** The new vertices' keys and places, and the new window's slots. */
  readonly path: DrawnPath;
  readonly topology: S;
  /** The resting numbers of the new vertices. */
  readonly rest: MarkValues;
  /** What the path placed last, which this call replaces. */
  readonly memory: { current: PathMemory<S> | null };
  /** The look the path drew with last, which a crossfade redraws the old path in. */
  readonly lastLook: { current: L | null };
  /** The empty group a crossfade fades the old path out in. */
  readonly outgoing: Element | null;
  /** The part's writer, which a crossfade redraws the old path with. */
  readonly draw: (group: SVGGElement, look: L, values: MarkValues) => void;
};

/** Whether two key lists hold the same keys in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/**
 * Place a series path for a commit, the one placement Lines, Areas and path-form Bars share. A
 * data update tweens the path's route from what it drew, or crossfades it, and records the route
 * for the marks attached to the series. Every other commit places the rest as the classifier asks,
 * and a resize keeps a running route.
 *
 * @param asked - What the commit asks of the path, from `useCommitMotion`.
 * @param input - The path, its look and what it keeps between commits.
 */
export function placePath<L extends { readonly moving: { current: S | null } }, S extends Counted, T>(
  asked: Commit,
  input: PathCommit<L, S, T>
): void {
  const { mark, motion, paths, seriesIndex, drawn, kind, look, path, topology, rest, memory } = input;
  const anchor = pathAnchor(seriesIndex, drawn);
  const previous = memory.current;
  const before = mark.drawn();
  const step = asked.kind === "move" ? pathStep(previous, path, topology, rest, before, kind) : null;
  const keptRoute = asked.kind === "settle" && previous !== null && sameKeys(previous.keys, path.keys);
  if (step?.kind === "route") {
    look.moving.current = step.route.topology;
    mark.place(rest, placementOf(asked, { via: step.via }), anchor);
  } else if (step?.kind === "crossfade") {
    const node = mark.node();
    const old = input.lastLook.current;
    if (node !== null && input.outgoing !== null && old !== null && before !== null && !motion.reduced()) {
      crossfade(node, input.outgoing, (copy) => {
        if (copy instanceof SVGGElement) input.draw(copy, old, before);
      });
    }
    look.moving.current = null;
    mark.place(rest, { kind: "snap" }, anchor);
  } else {
    if (!keptRoute) look.moving.current = null;
    mark.place(rest, step?.kind === "snap" ? { kind: "snap" } : placementOf(asked), anchor);
  }
  const route = step?.kind === "route" ? step.route : keptRoute ? previous.route : null;
  const grown =
    step?.kind === "route" ? step.grown : keptRoute ? paths.get(seriesIndex, drawn)?.grown : undefined;
  memory.current = { keys: path.keys, positions: path.positions, window: path.window, topology, route };
  input.lastLook.current = look;
  paths.set(seriesIndex, drawn, {
    keys: route?.keys ?? path.keys,
    positions: route?.positions ?? path.positions,
    rest: path.keys,
    restPositions: path.positions,
    stride: kind.stride,
    grown: grown ?? new Set(),
    // A new object each commit that crossfades, so a follower tells this crossfade from the last.
    crossfade: step?.kind === "crossfade" ? {} : null,
  });
}
