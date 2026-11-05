"use client";

/**
 * Where a polar tooltip rests (D6, D7, Q9). The popup's centre sits on the active ray, just outside
 * the rim, at any angle: a slice's bisector, a ring's value end or a spoke. Base UI places it on the
 * side nearest the ray, which `data-side` names, and the side offset pulls it back by half its own
 * size, so its centre lands on the ray whichever side Base UI tries. A step's glide orbits the dial
 * the short way round and never crosses the centre, and a pointer that moves toward the popup
 * inside the triangle from where it left the plot to the popup's near edge keeps the active part.
 */
import { use, useCallback, useMemo } from "react";

import { PolarContext } from "./chart-polar-context";
import type { AnchorInput, AnchorMeasure, ClientPoint, TooltipAnchor } from "./chart-readout-port";
import { useChartStore } from "./chart-store";
import type { GlideRoute } from "./chart-tooltip-glide";
import { inTriangle, nearEdge, nearestSide, orbitTurns, rayCentre } from "./layout/polar-orbit";

const STRAIGHT: GlideRoute = { kind: "straight" };

/** The gap between the rim and the popup, in CSS pixels, the overlay's 8 px. */
const RIM_GAP = 8;

/** The dial in client pixels: the listbox's box, the centre, and CSS pixels per unit of the outer radius. */
type Dial = { readonly centre: ClientPoint; readonly scale: number };

/**
 * A polar Root's tooltip anchor over the active ray.
 *
 * @param input - The tooltip's active option, positioner and measure count.
 * @returns The anchor.
 */
export function usePolarTooltipAnchor(input: AnchorInput): TooltipAnchor {
  const polar = use(PolarContext);
  if (polar === null)
    throw new Error("A polar Tooltip renders inside its polar Root, which provides the context.");
  const { model, kernel, box } = polar;
  const { active, positioner, measures } = input;
  const near = useChartStore(kernel.store, (snapshot) => snapshot.near);
  const ray = active === null ? null : model.ray(active, near);
  const angle = ray?.angle ?? null;
  const radius = ray?.radius ?? null;
  const surfaceOf = useCallback(() => document.getElementById(`${kernel.id}-surface`), [kernel.id]);
  const dialOf = useCallback((): Dial | null => {
    const rect = surfaceOf()?.getBoundingClientRect();
    const width = box.right - box.left;
    if (rect === undefined || !(width > 0)) return null;
    const scale = rect.width / width;
    return { centre: { x: rect.left - box.left * scale, y: rect.top - box.top * scale }, scale };
  }, [surfaceOf, box]);
  const virtual = useMemo(() => {
    if (angle === null || radius === null) return null;
    const measure = (): AnchorMeasure => {
      const dial = dialOf();
      if (dial === null) return { box: new DOMRect(), shift: 0, route: STRAIGHT };
      const popup = positioner.current?.getBoundingClientRect() ?? new DOMRect();
      const offset = rayCentre(angle, radius * dial.scale, RIM_GAP, {
        width: popup.width,
        height: popup.height,
      });
      return {
        box: new DOMRect(dial.centre.x + offset.x, dial.centre.y + offset.y, 0, 0),
        shift: 0,
        route: {
          kind: "path",
          keeps: "centre",
          turns: (from, to, size) => orbitTurns(from, to, size, dial.centre),
        },
      };
    };
    let latest: AnchorMeasure | null = null;
    return {
      getBoundingClientRect: () => {
        latest = measure();
        return latest.box;
      },
      get contextElement() {
        return surfaceOf() ?? undefined;
      },
      placed: () => latest ?? measure(),
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- a new `measures` count asks Base UI to place the popup again
  }, [angle, radius, dialOf, surfaceOf, positioner, measures]);
  // New data moves the popup at once.
  const revision = useMemo(() => ({ model }), [model]);
  const forget = useCallback(() => undefined, []);
  const watch = useCallback(() => undefined, []);
  const freezes = (from: ClientPoint, to: ClientPoint): boolean => {
    const node = positioner.current;
    if (node === null) return false;
    const rect = node.getBoundingClientRect();
    const [a, b] = nearEdge(from, rect);
    return inTriangle(to, from, a, b);
  };
  return {
    virtual,
    side: angle === null ? "top" : nearestSide(angle),
    bridge: false,
    revision,
    forget,
    watch,
    freezes,
    // The anchor is a point on the ray, so half the popup's size along the side centres it there.
    sideOffset: (placed, size) => -(placed === "top" || placed === "bottom" ? size.height : size.width) / 2,
    alignOffset: () => 0,
  };
}
