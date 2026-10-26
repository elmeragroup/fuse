/**
 * Unit under test: `HALF_TURN_MIRRORS`, the pairs the instance diff swaps a half-turned glyph for.
 * Oracle: the icon library as the kit ships it (`fuseIcons`), each glyph's SVG path. A pair holds where the
 * mirror's filled shape is the glyph's filled shape turned 180° about the centre of the 256-unit
 * view box: every sample point of the box lies inside both or outside both, away from their edges.
 * The paths need not share a decomposition, and Phosphor's do not: CaretDown's caps start where
 * CaretUp's end.
 */
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { HALF_TURN_MIRRORS } from "./glyph-mirrors";
import { fuseIcons } from "./icon-library";
import type { IconSpec } from "./kit-spec";

let library: readonly IconSpec[];

beforeAll(async () => {
  library = await Effect.runPromise(fuseIcons);
});

type Point = readonly [number, number];
type Segment = readonly [Point, Point];

/** The side of the view box every Phosphor glyph draws in. */
const BOX = 256;

/**
 * The one path an icon's SVG draws, which the proof reads. It fails closed: the `<svg>` must carry no
 * `transform`, and hold exactly one element, a `<path>` with a `d` and no `transform`, so a second
 * drawing element, a group or a transform the proof would not read throws instead of passing.
 *
 * @param svg - The icon's SVG markup.
 * @returns The path's `d`.
 * @throws When the SVG holds anything but one plain path.
 */
function solePath(svg: string): string {
  const root = /^<svg\b([^>]*)>([\s\S]*)<\/svg>$/.exec(svg.trim());
  const [, rootAttributes = "", body = ""] = root ?? [];
  const elements = [...body.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)];
  const [only] = elements;
  const d = only === undefined ? undefined : /\bd="([^"]+)"/.exec(only[2] ?? "")?.[1];
  if (
    root === null ||
    /\btransform=/.test(rootAttributes) ||
    elements.length !== 1 ||
    only?.[1] !== "path" ||
    /\btransform=/.test(only[2] ?? "") ||
    d === undefined
  ) {
    throw new Error(`the proof reads one path with no transform, not ${svg}`);
  }
  return d;
}

/** The SVG path of an icon in the library, by its key. */
function pathOf(key: string): string {
  const svg = library.find((icon) => icon.key === key)?.svg;
  if (svg === undefined) {
    throw new Error(`the library holds no icon ${key}`);
  }
  return solePath(svg);
}

/** The points of an elliptical arc from `from` to `to`, as SVG 1.1 §F.6.5 parameterizes it. */
function arcPoints(from: Point, to: Point, radii: Point, rotation: number, large: boolean, sweep: boolean) {
  const phi = (rotation * Math.PI) / 180;
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = Math.cos(phi) * dx + Math.sin(phi) * dy;
  const y1p = -Math.sin(phi) * dx + Math.cos(phi) * dy;
  let rx = Math.abs(radii[0]);
  let ry = Math.abs(radii[1]);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (x1 + x2) / 2;
  const cy = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const start = angle((x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((-x1p - cxp) / rx, (-y1p - cyp) / ry) - start;
  if (!sweep && delta > 0) {
    delta -= 2 * Math.PI;
  } else if (sweep && delta < 0) {
    delta += 2 * Math.PI;
  }
  const steps = 32;
  return Array.from({ length: steps }, (_, step): Point => {
    const theta = start + (delta * (step + 1)) / steps;
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    return [Math.cos(phi) * ex - Math.sin(phi) * ey + cx, Math.sin(phi) * ex + Math.cos(phi) * ey + cy];
  });
}

/** The closed outlines of a path made of moves, lines and arcs, as Phosphor's bold glyphs are. */
function outlines(d: string): readonly (readonly Point[])[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const contours: Point[][] = [];
  let current: Point[] = [];
  let at: Point = [0, 0];
  let command = "";
  let index = 0;
  const next = (): number => Number(tokens[index++]);
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index++;
      if (command === "Z" || command === "z") {
        contours.push(current);
        current = [];
        continue;
      }
    }
    const relative = command === command.toLowerCase();
    const base = (point: Point): Point => (relative ? [at[0] + point[0], at[1] + point[1]] : point);
    switch (command.toUpperCase()) {
      case "M":
        if (current.length > 0) {
          contours.push(current);
        }
        at = base([next(), next()]);
        current = [at];
        command = relative ? "l" : "L";
        break;
      case "L":
        at = base([next(), next()]);
        current.push(at);
        break;
      case "H":
        at = [relative ? at[0] + next() : next(), at[1]];
        current.push(at);
        break;
      case "V":
        at = [at[0], relative ? at[1] + next() : next()];
        current.push(at);
        break;
      case "A": {
        const radii: Point = [next(), next()];
        const rotation = next();
        const large = next() === 1;
        const sweep = next() === 1;
        const to = base([next(), next()]);
        current.push(...arcPoints(at, to, radii, rotation, large, sweep));
        at = to;
        break;
      }
      default:
        throw new Error(`the proof reads moves, lines and arcs, not ${command}`);
    }
  }
  if (current.length > 0) {
    contours.push(current);
  }
  return contours;
}

/** The edges of closed outlines. */
function edgesOf(contours: readonly (readonly Point[])[]): readonly Segment[] {
  return contours.flatMap((contour) =>
    contour.map((point, index): Segment => [point, contour[(index + 1) % contour.length] ?? point])
  );
}

/** Whether a point lies inside closed edges by the non-zero rule, as SVG fills a path by default. */
function inside([x, y]: Point, edges: readonly Segment[]): boolean {
  let winding = 0;
  for (const [[x1, y1], [x2, y2]] of edges) {
    const cross = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
    if (y1 <= y && y2 > y && cross > 0) {
      winding++;
    } else if (y1 > y && y2 <= y && cross < 0) {
      winding--;
    }
  }
  return winding !== 0;
}

/** How far a point lies from the nearest edge. */
function distance([x, y]: Point, edges: readonly Segment[]): number {
  return Math.min(
    ...edges.map(([[x1, y1], [x2, y2]]) => {
      const length = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      const t =
        length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / length));
      return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
    })
  );
}

/**
 * The sample points, one per view-box unit, where the glyph turned half a turn and the mirror fill
 * differently, away from either outline by more than the paths' 0.01-unit rounding allows.
 */
function differences(glyph: string, mirror: string): number {
  const turned = edgesOf(outlines(pathOf(glyph))).map(([[x1, y1], [x2, y2]]): Segment => [
    [BOX - x1, BOX - y1],
    [BOX - x2, BOX - y2],
  ]);
  const held = edgesOf(outlines(pathOf(mirror)));
  let count = 0;
  for (let y = 0.5; y < BOX; y++) {
    for (let x = 0.5; x < BOX; x++) {
      const point: Point = [x, y];
      if (inside(point, turned) !== inside(point, held) && distance(point, [...turned, ...held]) > 0.1) {
        count++;
      }
    }
  }
  return count;
}

describe("the half-turn mirrors", () => {
  it.each([...HALF_TURN_MIRRORS])("%s turned half a turn fills the shape %s fills", (glyph, mirror) => {
    expect(differences(glyph, mirror)).toBe(0);
  });

  // Negative controls: an icon the proof would read only in part fails, rather than passing.
  it.each([
    [
      "a second path",
      '<svg viewBox="0 0 256 256"><path d="M0,0L1,1Z"></path><path d="M2,2L3,3Z"></path></svg>',
    ],
    [
      "a transform on the path",
      '<svg viewBox="0 0 256 256"><path d="M0,0L1,1Z" transform="rotate(90)"></path></svg>',
    ],
    [
      "a transform on the svg",
      '<svg viewBox="0 0 256 256" transform="scale(-1)"><path d="M0,0L1,1Z"></path></svg>',
    ],
    ["another drawing element", '<svg viewBox="0 0 256 256"><circle r="4"></circle></svg>'],
  ])("refuses an icon with %s", (_what, svg) => {
    expect(() => solePath(svg)).toThrow("the proof reads one path with no transform");
  });

  it("reads the one path a plain icon draws", () => {
    expect(solePath('<svg viewBox="0 0 256 256"><path d="M0,0L1,1Z"></path></svg>')).toBe("M0,0L1,1Z");
  });

  // A negative control: CaretRight is CaretDown turned a quarter turn, not half a turn.
  it("tells a glyph from one that is not its half-turn mirror", () => {
    expect(differences("icon/CaretDown", "icon/CaretRight")).toBeGreaterThan(1000);
  });
});
