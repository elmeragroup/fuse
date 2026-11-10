"use client";

/**
 * Where a cartesian tooltip rests. On a vertical chart the popup centres on the active slot, held
 * inside the chart Root's box, and rests 8 px above the highest mark under its own width: bars,
 * stack tops, line and area strokes between readings, and dots. A step that raises it raises it over
 * the whole span it travels, and a step that would lower it by 16 px or less keeps its height. Under
 * `anchor="top"` and with Panels it keeps the plot's top lane, and on a horizontal chart it sits
 * above or below the active row. A step's glide follows the roof, so it clears every mark on the way.
 */
import { useCallback, useMemo, useState } from "react";

import { useChartRoot } from "./chart-context";
import { clientScale, writeStyle } from "./chart-dom";
import { useCartesianPick } from "./chart-pick";
import { useRootFrame } from "./chart-plot";
import type { AnchorInput, AnchorMeasure, ClientPoint, TooltipAnchor } from "./chart-readout-port";
import type { GlideRoute } from "./chart-tooltip-glide";
import { viewportSize } from "./chart-tooltip-popup";
import { createChartRoof } from "./chart-tooltip-roof";
import { WHOLE_BAND, barSpan, centreOf, optionBand } from "./layout/plot-frame";
import { TOOLTIP_EDGE, glidePath, roofRest, tooltipSideOffset } from "./layout/tooltip-place";
import type { PopupPlace } from "./layout/tooltip-place";
import { roofOver } from "./layout/tooltip-roof";

const STRAIGHT: GlideRoute = { kind: "straight" };

/**
 * Where the popup rested over the plot before the active slot's step, and where it rests at that
 * slot, so a slot's repeated measures all start from the same place and the next step starts from
 * the last one.
 */
type RestMemory = { slot: number | null; from: PopupPlace | null; last: PopupPlace | null };

/** The popup's resting place at a slot, which remembers it as the next step's start. */
function restAt(
  memory: RestMemory,
  slot: number,
  place: (from: PopupPlace | null) => PopupPlace
): PopupPlace {
  if (memory.slot !== slot) {
    memory.from = memory.last;
    memory.slot = slot;
  }
  const rest = place(memory.from);
  memory.last = rest;
  return rest;
}

/**
 * The cartesian tooltip's anchor over the active slot, measured from the plot surface at position
 * time.
 *
 * @param input - The tooltip's active slot, positioner, placement and measure count.
 * @returns The anchor.
 */
export function useCartesianTooltipAnchor(input: AnchorInput): TooltipAnchor {
  const { active: slot, positioner, placement, measures } = input;
  const context = useChartRoot("Chart.Tooltip");
  const { store, model, id, xScale, orientation, root: rootOf, motion, riders } = context;
  const window = model.window;
  const drawn = useRootFrame("Chart.Tooltip");
  const pick = useCartesianPick(context, "Chart.Tooltip");
  // Where the popup rested, which closing forgets.
  const [memory] = useState<RestMemory>(() => ({ slot: null, from: null, last: null }));
  // The marks' roof, which the anchor reads at most once per commit.
  const [roofs] = useState(createChartRoof);
  // With Panels each Panel has a value axis of its own, so the popup keeps the plot's top lane.
  const roofed = placement === "point" && orientation === "vertical" && context.panels.length === 0;
  const virtual = useMemo(() => {
    if (slot === null || window === null || drawn === null) return null;
    const { frame, metrics } = drawn;
    const position = slot - window.first;
    const surfaceOf = () => document.getElementById(`${id}-surface`);
    const measure = (): AnchorMeasure => {
      const surface = surfaceOf()?.getBoundingClientRect();
      if (surface === undefined) return { box: new DOMRect(), shift: 0, route: STRAIGHT };
      const { box } = frame;
      // Plot coordinates are layout pixels, and the surface's client box carries every transform
      // above the plot, so a coordinate scales by the client box's share of the layout box.
      const scaleX = box.width === 0 ? 1 : surface.width / box.width;
      const scaleY = box.height === 0 ? 1 : surface.height / box.height;
      const client = (x: number, y: number, width: number, height: number) =>
        new DOMRect(surface.left + x * scaleX, surface.top + y * scaleY, width * scaleX, height * scaleY);
      // The anchor's span along the slot axis, resolved before the orientation: the point itself
      // under a point scale, the drawn bar row on a horizontal band chart, so the popup's edge
      // meets the bars, and the focused option's and the crosshair's columns on a vertical one.
      const along = (): readonly [number, number] => {
        if (xScale === "point") {
          const centre = centreOf(frame, position, "point");
          return [centre, centre];
        }
        if (orientation === "vertical") return optionBand(frame, position, "band");
        return barSpan(frame, position, metrics, WHOLE_BAND);
      };
      const [start, end] = along();
      // A horizontal anchor spans the plot's width. The popup sits beside it, so it never covers it.
      if (orientation === "horizontal") {
        return { box: client(0, start, box.width, end - start), shift: 0, route: STRAIGHT };
      }
      // Under anchor="top" and with Panels, a vertical anchor runs the plot's whole height.
      // Otherwise it runs from the popup's resting edge down to the plot's bottom, so the popup
      // touches it there.
      const root = roofed ? rootOf() : null;
      if (root === null) return { box: client(start, 0, end - start, box.height), shift: 0, route: STRAIGHT };
      const outer = root.getBoundingClientRect();
      const popup = positioner.current?.getBoundingClientRect() ?? new DOMRect();
      const width = popup.width / scaleX;
      const centre = (start + end) / 2;
      const plotX = (x: number) => (x - surface.left) / scaleX;
      const within = [plotX(outer.left), plotX(outer.right)] as const;
      const viewport = viewportSize();
      const profile = roofs.read({
        root,
        surface,
        scale: { x: scaleX, y: scaleY },
        // The Root's box holds the popup, and no series mark draws outside it.
        stretch: [Math.min(0, within[0]), Math.max(box.width, within[1])],
        frame,
        motion,
        riders,
      });
      const roof = (spanStart: number, spanEnd: number) => roofOver(profile, spanStart, spanEnd);
      const rest = restAt(memory, slot, (from) =>
        roofRest({
          centre,
          width,
          within,
          viewport: [plotX(TOOLTIP_EDGE), plotX(viewport.width - TOOLTIP_EDGE)],
          roof,
          floor: box.height,
          from,
        })
      );
      const column = client(start, rest.bottom, end - start, box.height - rest.bottom);
      // The bridge under a popup that rests above the plot reaches down to the plot's top, past the
      // gap over the roof, so a pointer moving straight up never leaves both the surface and the
      // popup. Over the plot the surface already holds the slot, and keeps its clicks.
      const node = positioner.current;
      if (node !== null) {
        const bridge = (Math.max(0, -rest.bottom) * scaleY) / clientScale(node).x;
        writeStyle(node, "--_bridge", `${String(bridge)}px`);
      }
      // A popup on the top side rests on the roof and glides over it, and on any other side it
      // glides straight. When no side of the column holds the popup, it overlays the plot at the
      // viewport's top gap, under the roof, so any path over the roof leaves the viewport and the
      // step jumps.
      const clientRoof = (left: number, right: number) => {
        const top = roof(plotX(left), plotX(right));
        return top === null ? null : surface.top + top * scaleY;
      };
      return {
        box: column,
        shift: (rest.left + width / 2 - centre) * scaleX,
        route: {
          kind: "path",
          turns: (from, to, size, side) =>
            side === "top" ? glidePath(from, to, size, clientRoof, TOOLTIP_EDGE) : [from, to],
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- a new `measures` count asks Base UI to place the popup again over marks that drew something new
  }, [slot, window, xScale, model, roofed, id, orientation, drawn, rootOf, motion, roofs, measures]);
  // A data update or a resize of the plot moves the popup at once.
  const revision = useMemo(() => ({ model, drawn }), [model, drawn]);
  const forget = useCallback(
    (reason: "moved" | "closed") => {
      // The roof reads the marks again when the popup opens and after every commit.
      roofs.forget();
      if (reason === "closed") {
        memory.slot = null;
        memory.from = null;
        memory.last = null;
      }
    },
    [roofs, memory]
  );
  // While the popup shows, marks that draw something new, such as a new curve, style or transform,
  // place it again before the browser paints. A tween's frames change the marks too, and its
  // commit already read where they land, so they place the popup again only once the tween ends.
  const watch = useCallback(
    (again: () => void) => {
      const root = rootOf();
      if (!roofed || root === null) return undefined;
      const measureAgain = () => {
        roofs.forget();
        again();
      };
      const unwatch = roofs.watch(root, measureAgain, () => motion.running());
      let frame = 0;
      if (motion.running()) {
        frame = requestAnimationFrame(function landing() {
          if (motion.running()) frame = requestAnimationFrame(landing);
          else measureAgain();
        });
      }
      return () => {
        unwatch();
        cancelAnimationFrame(frame);
      };
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- a new model or plot is a new revision, which the tooltip watches again
    [roofed, motion, model, drawn, roofs, rootOf]
  );
  // Whether the pointer entered the popup by moving straight toward it from the active slot. Only
  // that entry freezes the slot, as CONTRACT section 9.5's safe triangle does for polar charts, so
  // a scrub that crosses the popup keeps following x. The surface records the last plot position.
  const freezes = (from: ClientPoint, to: ClientPoint, side: string | null): boolean => {
    // The pointer must come from the active slot and move along the axis that leads to the popup,
    // up or down to a popup above or below and across to one beside a row.
    const start = pick(from.x, from.y);
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const toward = side === "top" || side === "bottom" ? dy > dx : dx > dy;
    return start !== null && start.slot === store.get().active && toward;
  };
  // The popup touches its anchor, so a pointer that crosses to it never leaves both. Its height
  // stops at the viewport's, where it scrolls.
  const sideOffset = (placed: string, size: { readonly width: number; readonly height: number }) =>
    virtual === null ? 0 : tooltipSideOffset(placed, virtual.placed().box, size, viewportSize());
  // Above or below, the popup moves along x to stay inside the chart Root's box. Base UI applies the
  // offset in the positioner's own pixels, and Floating UI mirrors it in a right-to-left popup, so
  // the client shift is scaled and mirrored back.
  const alignOffset = (placed: string, node: HTMLElement) => {
    if (virtual === null || (placed !== "top" && placed !== "bottom")) return 0;
    const mirror = getComputedStyle(node).direction === "rtl" ? -1 : 1;
    return (virtual.placed().shift / clientScale(node).x) * mirror;
  };
  return { virtual, side: "top", bridge: roofed, revision, forget, watch, freezes, sideOffset, alignOffset };
}
