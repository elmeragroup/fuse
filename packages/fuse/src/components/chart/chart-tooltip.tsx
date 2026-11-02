"use client";

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useRender } from "@base-ui/react/use-render";
import { flushSync } from "react-dom";

import { cn } from "../../styles/cn";
import { tooltipShellClass } from "../../styles/inner-corner/tooltip";
import { tv } from "../../styles/tv";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import { ChartSelectionContext, useChartRoot } from "./chart-context";
import { writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { usePendingOr } from "./chart-pending-root";
import { useRootFrame } from "./chart-plot";
import {
  ChartLiveContext,
  ChartRowContext,
  readingText,
  shareDigits,
  shareText,
  slotShares,
  useActivePoint,
  useActiveSlot,
  useReadoutKey,
} from "./chart-readout";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { pointerSlot } from "./chart-surface";
import { slotLabel } from "./chart-text";
import { createTooltipGlider, positionerScale } from "./chart-tooltip-glide";
import type { GlideRoute, TooltipGlider } from "./chart-tooltip-glide";
import { createChartRoof } from "./chart-tooltip-roof";
import { ChartTooltipTotal } from "./chart-tooltip-total";
import type {
  ChartDomProps,
  ChartLayerProps,
  ChartFractionDigits,
  ValueFormat,
  XFormat,
} from "./chart-types";
import { WHOLE_BAND, barSpan, centreOf, optionBand } from "./layout/plot-frame";
import { TOOLTIP_EDGE, roofRest, tooltipSideOffset } from "./layout/tooltip-place";
import type { PlaceSize, PopupPlace } from "./layout/tooltip-place";
import { roofOver } from "./layout/tooltip-roof";

/**
 * Props for `Chart.Tooltip`, a closed part.
 *
 * @beta
 */
export type ChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default. */
  variant?: "default" | "frosted";
  /**
   * Where the popup rests on a vertical chart. "point", the default, centres it on the active slot
   * inside the chart's box and rests it 8 px above the highest mark under its own width. "top" pins
   * it to the plot top and tracks x only, as a chart with Panels always does. A horizontal chart
   * places it over or under the active row either way.
   */
  anchor?: "point" | "top";
  /**
   * Without children, TooltipLabel over a TooltipItems template with Swatch, SeriesLabel and
   * TooltipValue, then one TooltipTotal per stack id that holds two or more series. In pie and
   * radial charts the template renders once, for the active slice or ring.
   */
  children?: ReactNode;
};

/**
 * Props for `Chart.TooltipLabel`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipLabelProps = ChartDomProps<"span"> & {
  /** The slot label format. Root's `xFormat` is the default. It does nothing in polar charts. */
  format?: XFormat;
};

/**
 * Props for `Chart.TooltipItems`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipItemsProps = ChartDomProps<"div">;

/**
 * Props for `Chart.TooltipValue`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipValueProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a TooltipItems row the row supplies it. */
  dataKey?: string;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.TooltipShare`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipShareProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a TooltipItems row the row supplies it. */
  dataKey?: string;
  /** The percentage digits. */
  format?: ChartFractionDigits;
};

/**
 * The popup's corner and padding, and its fill per variant. Frosted glass lets the plot show through a translucent popover
 * fill and blurs it. It sits on the utilities layer with the overlay fill it replaces, so the
 * class merge drops the opaque fill.
 */
const tooltipPopup = tv({
  // DESIGN-NOTES "Tooltips" gives the chart popup an 8 px radius and 8 px of block padding. The
  // popup is never taller than the room Base UI measures on its side, and scrolls past it.
  base: "max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain rounded-lg py-2 [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))] data-[input=touch]:not-data-scrolls:pointer-events-none",
  variants: {
    variant: {
      default: "",
      frosted: "supports-backdrop-filter:backdrop-blur-md bg-popover/70",
    },
  },
});

/**
 * Mark the popup with `data-scrolls` while its content overflows it. Under touch the popup lets
 * taps and scrubs through to the plot, except while it scrolls, when it takes the finger so a drag
 * scrolls it. Content that grows inside a popup at its height cap, or at a height a consumer set,
 * leaves the popup's size alone, so the observer follows each of the popup's children as well.
 */
function watchOverflow(popup: HTMLDivElement | null): (() => void) | undefined {
  if (popup === null) return undefined;
  const mark = () => popup.toggleAttribute("data-scrolls", popup.scrollHeight > popup.clientHeight);
  const sizes = new ResizeObserver(mark);
  sizes.observe(popup);
  for (const child of popup.children) sizes.observe(child);
  const children = new MutationObserver((records) => {
    for (const { addedNodes, removedNodes } of records) {
      for (const node of removedNodes) if (node instanceof Element) sizes.unobserve(node);
      for (const node of addedNodes) if (node instanceof Element) sizes.observe(node);
    }
    mark();
  });
  children.observe(popup, { childList: true });
  return () => {
    sizes.disconnect();
    children.disconnect();
  };
}

/**
 * A virtual anchor over the active slot, measured from the plot surface at position time. It names
 * the surface as its context element, so Base UI follows the scroll containers around the plot.
 */
type Anchor = {
  readonly getBoundingClientRect: () => DOMRect;
  readonly contextElement: Element | undefined;
  /** The anchor's last measure. */
  readonly placed: () => Measure;
};

/** One measure of the anchor, in client pixels. */
type Measure = {
  readonly box: DOMRect;
  /** How far the popup moves along x from the anchor's centre to stay inside the chart Root's box. */
  readonly shift: number;
  /** How a step's glide travels to this place. */
  readonly route: GlideRoute;
};

const STRAIGHT: GlideRoute = { kind: "straight" };

/** The viewport's size, which every side test and the popup's place along x keep inside. */
function viewportSize(): PlaceSize {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}

/**
 * Where the popup rested over the plot before the active slot's step, and where it rests at that
 * slot, so a slot's repeated measures all start from the same place and the next step starts from
 * the last one.
 */
type RestMemory = { slot: number | null; from: PopupPlace | null; last: PopupPlace | null };

const FORGOTTEN: RestMemory = { slot: null, from: null, last: null };

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
 * The popup over the active slot, which a pointer can move into and pin. On a vertical chart it
 * centres on the active slot, held inside the chart Root's box, and rests 8 px above the highest
 * mark under its own width: bars, stack tops, line and area strokes between readings, and dots. A
 * step that raises it raises it over the whole span it travels, and a step that would lower it by
 * 16 px or less keeps its height. It flips below the plot when the viewport has no room above. On
 * a horizontal chart it sits above or below the active row. When neither side has room, it sits
 * beside the column, and when no side has room, it overlays the plot. It touches its anchor and
 * stays inside the viewport, scrolling when its content is taller. A pointer, key or touch step to
 * another slot glides it there over `--chart-glide`, unless the reader prefers reduced motion, and
 * opening, scrolling, resizing, a data update, a change of side and a path over the marks that would
 * leave the viewport move it at once. Touch passes
 * through the popup to the plot, except on a popup that scrolls, where a drag scrolls it and a tap
 * dismisses it. It may leave the chart. A pointer that moves straight up or down stays on the slot,
 * so it reaches the popup with the content unchanged. The popup stays while the pointer is on the
 * plot or inside the popup and while the option has focus. Escape closes it and keeps the reader's
 * place. It is hidden from screen readers, which read the same values from the plot's option.
 *
 * @beta
 */
export function ChartTooltip(props: ChartTooltipProps): ReactElement {
  return usePendingOr(props, ChartTooltipBody);
}

function ChartTooltipBody({
  variant = "default",
  anchor = "point",
  className,
  style,
  children,
}: ChartTooltipProps): ReactElement {
  const context = useChartRoot("Chart.Tooltip");
  const { store, model, id, xScale, orientation, root: rootOf, motion } = context;
  const slot = useActiveSlot(context, true);
  const window = model.window;
  const open = slot !== null;
  // Once open, the portal stays mounted. Its node sits after the scope's last child, so mounting
  // and dropping it on each open and close flips that child's :last-child and restyles all of it,
  // the whole chart when the chart is the scope's last child.
  const [kept, setKept] = useState(false);
  if (open && !kept) setKept(true);
  const drawn = useRootFrame("Chart.Tooltip");
  const positioner = useRef<HTMLDivElement | null>(null);
  const memory = useRef<RestMemory>({ ...FORGOTTEN });
  // The marks' roof, which the anchor reads at most once per commit.
  const [roofs] = useState(createChartRoof);
  // A count that asks Base UI to place the popup again, after the marks draw something new or a
  // data update's tween lands, so the anchor measures the roof afresh.
  const [measures, setMeasures] = useState(0);
  // The slot a reader's pointer, key or touch step moved to last. Root carries the active slot over
  // a data update as a commit, which never lands here, so that move shows at once.
  const stepped = useRef<number | null>(null);
  useChartFollower("Chart.Tooltip", (active, cause) => {
    if (cause === "step") stepped.current = active?.slot ?? null;
  });
  // With Panels each Panel has a value axis of its own, so the popup keeps the plot's top lane.
  const roofed = anchor === "point" && orientation === "vertical" && context.panels.length === 0;
  const virtual = useMemo((): Anchor | null => {
    if (slot === null || window === null || drawn === null) return null;
    const { frame, metrics } = drawn;
    const position = slot - window.first;
    const surfaceOf = () => document.getElementById(`${id}-surface`);
    const measure = (): Measure => {
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
      });
      const roof = (spanStart: number, spanEnd: number) => roofOver(profile, spanStart, spanEnd);
      const rest = restAt(memory.current, slot, (from) =>
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
        const bridge = (Math.max(0, -rest.bottom) * scaleY) / positionerScale(node);
        writeStyle(node, "--_bridge", `${String(bridge)}px`);
      }
      // When no side of the column holds the popup, it overlays the plot at the viewport's top gap,
      // under the roof, so any path over the roof leaves the viewport and the step jumps.
      return {
        box: column,
        shift: (rest.left + width / 2 - centre) * scaleX,
        route: {
          kind: "roof",
          roof: (left, right) => {
            const top = roof(plotX(left), plotX(right));
            return top === null ? null : surface.top + top * scaleY;
          },
        },
      };
    };
    let latest: Measure | null = null;
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
  const glider = useRef<TooltipGlider | null>(null);
  const watchPositioner = useCallback(
    (node: HTMLDivElement | null) => {
      positioner.current = node;
      glider.current = node === null ? null : createTooltipGlider(node, rootOf());
      return () => {
        glider.current?.dispose();
        glider.current = null;
        positioner.current = null;
      };
    },
    [rootOf]
  );
  // The anchor Base UI measures last, whose roof a glide armed before that measure reads.
  const latestAnchor = useRef(virtual);
  // A slot step glides the popup to its next place. Opening, a data update and a resize of the plot
  // move it at once, and closing forgets where it rested.
  const before = useRef<{ slot: number | null; model: typeof model; drawn: typeof drawn }>({
    slot: null,
    model,
    drawn,
  });
  useLayoutEffect(() => {
    latestAnchor.current = virtual;
  }, [virtual]);
  useLayoutEffect(() => {
    const last = before.current;
    before.current = { slot, model, drawn };
    if (slot === null) memory.current = { ...FORGOTTEN };
    // The roof reads the marks again when the popup opens and after every commit.
    if (last.slot === null || last.model !== model || last.drawn !== drawn) roofs.forget();
    // Only a reader's step glides. A data update moves the popup at once, the active slot Root
    // carries over with it included.
    const steps =
      last.slot !== null &&
      slot !== null &&
      last.slot !== slot &&
      stepped.current === slot &&
      last.model === model &&
      last.drawn === drawn;
    stepped.current = null;
    if (steps) glider.current?.arm(() => latestAnchor.current?.placed().route ?? STRAIGHT);
    else glider.current?.stop();
  }, [slot, model, drawn, roofs]);
  // While the popup shows, marks that draw something new, such as a new curve, style or transform,
  // place it again before the browser paints. A tween's frames change the marks too, and its
  // commit already read where they land, so they place the popup again only once the tween ends.
  useEffect(() => {
    const root = rootOf();
    if (!roofed || !open || root === null) return undefined;
    const measureAgain = () => {
      roofs.forget();
      glider.current?.stop();
      flushSync(() => setMeasures((count) => count + 1));
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
  }, [roofed, open, motion, model, drawn, roofs, rootOf]);
  // Whether the pointer entered the popup by moving straight toward it from the active slot. Only
  // that entry freezes the slot, as CONTRACT section 9.5's safe triangle does for polar charts, so
  // a scrub that crosses the popup keeps following x. The surface records the last plot position.
  const frozen = useRef(false);
  const pick = (clientX: number, clientY: number) => {
    const surface = document.getElementById(`${id}-surface`);
    return surface === null
      ? null
      : pointerSlot(context, drawn?.frame ?? null, surface.getBoundingClientRect(), clientX, clientY);
  };
  // The input that last moved the active slot, read on each render the slot change causes.
  const touchInput = ["touch", "pen"].includes(store.pointer()?.type ?? "");
  const content = children ?? <DefaultTooltip />;
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        // A press on the chart itself picks or pins a slot. Every other dismissal Base UI reports,
        // such as a press outside the chart or Escape with focus elsewhere, takes the one dismissal.
        const target = details.event.target;
        if (
          details.reason === "outside-press" &&
          target instanceof Node &&
          context.root()?.contains(target) === true
        )
          return;
        store.dismiss();
      }}>
      <OverlayPortal portal={TooltipPrimitive.Portal} keepMounted={kept}>
        <TooltipPrimitive.Positioner
          anchor={virtual}
          side="top"
          align="center"
          // The popup flips above or below the column, or the row of a horizontal chart, so it
          // stays off a sideways scrub. When neither holds its content, as at 400 % zoom, it sits
          // beside the column, and when no side does, it overlays the plot, per CONTRACT section
          // 9.5. It touches its anchor, so a pointer that crosses to it never leaves both. Its
          // height stops at the viewport's, where it scrolls.
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
          // Base UI's flip adds 1 px to the collision padding, and 1 px more on the side opposite
          // the preferred top, so these paddings make every flip test read TOOLTIP_EDGE, 8 px,
          // the same inset the overlay offset tests.
          collisionPadding={{ top: 7, right: 7, bottom: 6, left: 7 }}
          sideOffset={({ side, positioner: size }) =>
            virtual === null ? 0 : tooltipSideOffset(side, virtual.placed().box, size, viewportSize())
          }
          // Above or below, the popup moves along x to stay inside the chart Root's box. Base UI
          // applies the offset in the positioner's own pixels, and Floating UI mirrors it in a
          // right-to-left popup, so the client shift is scaled and mirrored back.
          alignOffset={({ side }) => {
            const node = positioner.current;
            if (virtual === null || node === null || (side !== "top" && side !== "bottom")) return 0;
            const mirror = getComputedStyle(node).direction === "rtl" ? -1 : 1;
            return (virtual.placed().shift / positionerScale(node)) * mirror;
          }}
          ref={watchPositioner}
          data-slot="chart-tooltip-positioner"
          className={overlayPositionerClass}>
          <TooltipPrimitive.Popup
            data-slot="chart-tooltip"
            data-variant={variant}
            data-input={touchInput ? "touch" : undefined}
            aria-hidden="true"
            ref={watchOverflow}
            className={cn(
              overlayPopupSurfaceClass,
              tooltipShellClass,
              overlayPopupMotionClass,
              tooltipPopup({ variant }),
              className
            )}
            style={style}
            onClick={(event) => {
              // A popup that scrolls takes touch, so a tap on it, which never scrolled, takes the
              // one dismissal a tap beside the chart would.
              if (event.currentTarget.dataset.input === "touch") store.dismiss();
            }}
            onPointerEnter={(event) => {
              const from = store.pointer();
              // The pointer must come from the active slot and move along the axis that leads to
              // the popup, up or down to a popup above or below and across to one beside a row.
              const start = from === null ? null : pick(from.x, from.y);
              const dx = Math.abs(from === null ? 0 : event.clientX - from.x);
              const dy = Math.abs(from === null ? 0 : event.clientY - from.y);
              const side = event.currentTarget.getAttribute("data-side");
              const toward = side === "top" || side === "bottom" ? dy > dx : dx > dy;
              frozen.current = start !== null && start.slot === store.get().active && toward;
            }}
            onPointerMove={(event) => {
              const snapshot = store.get();
              if (frozen.current || snapshot.pinned || snapshot.source === "keyboard") return;
              const next = pick(event.clientX, event.clientY);
              if (next !== null && next.slot !== snapshot.active)
                store.set({ active: next.slot, source: "pointer", near: next.near });
            }}
            onPointerLeave={(event) => {
              const surface = document.getElementById(`${id}-surface`);
              if (
                surface !== null &&
                event.relatedTarget instanceof Node &&
                surface.contains(event.relatedTarget)
              )
                return;
              if (store.get().source === "pointer" && !store.get().pinned)
                store.set({ active: null, source: null, near: null });
            }}>
            <ChartLiveContext value={true}>{content}</ChartLiveContext>
            {roofed ? <span data-slot="chart-tooltip-bridge" /> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </OverlayPortal>
    </TooltipPrimitive.Root>
  );
}

/** The default popup content: the slot label, one row per config key and one total per stack. */
function DefaultTooltip(): ReactElement {
  const { model } = useChartRoot("Chart.Tooltip");
  return (
    <>
      <ChartTooltipLabel />
      <ChartTooltipItems>
        <ChartSwatch />
        <ChartSeriesLabel />
        <ChartTooltipValue />
      </ChartTooltipItems>
      {model.stacks.map(({ id }) => (
        <ChartTooltipTotal key={id} stack={id} />
      ))}
    </>
  );
}

/**
 * The active slot's label, or the category's label in pie, radial and radar charts.
 *
 * @beta
 */
export function ChartTooltipLabel(props: ChartTooltipLabelProps): ReactElement {
  return usePendingOr(props, ChartTooltipLabelBody);
}

function ChartTooltipLabelBody({
  format,
  render,
  className,
  ...props
}: ChartTooltipLabelProps): ReactElement {
  const context = useChartRoot("Chart.TooltipLabel");
  const slot = useActiveSlot(context);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-label",
      ...mergeProps<"span">(
        { className, children: slot === null ? null : slotLabel(context, slot, format).text },
        props
      ),
    },
  });
}

/**
 * A row template, rendered once per config key at the active point, or once for the active slice
 * or ring. Each row carries `data-series`, and `data-dimmed` while another series is selected.
 *
 * @beta
 */
export function ChartTooltipItems(props: ChartTooltipItemsProps): ReactElement {
  return usePendingOr(props, ChartTooltipItemsBody);
}

function ChartTooltipItemsBody({
  render,
  className,
  children,
  ...props
}: ChartTooltipItemsProps): ReactElement {
  const context = useChartRoot("Chart.TooltipItems");
  const selectedKey = use(ChartSelectionContext);
  const rows = context.model.series.map(({ key, seriesIndex }) => (
    <ChartRowContext key={key} value={key}>
      <div
        data-slot="chart-tooltip-item"
        data-series={seriesIndex}
        data-dimmed={selectedKey !== null && selectedKey !== key ? "" : undefined}>
        {children}
      </div>
    </ChartRowContext>
  ));
  return useRender({
    defaultTagName: "div",
    render,
    props: { "data-slot": "chart-tooltip-items", ...mergeProps<"div">({ className, children: rows }, props) },
  });
}

/**
 * The reading at the active point, followed by its quality and projection words. A series coarser
 * than Root's interval adds its own slot label. Under `stackOffset="expand"` it prints the raw value.
 *
 * @beta
 */
export function ChartTooltipValue(props: ChartTooltipValueProps): ReactElement {
  return usePendingOr(props, ChartTooltipValueBody);
}

function ChartTooltipValueBody({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartTooltipValueProps): ReactElement {
  const context = useChartRoot("Chart.TooltipValue");
  const point = useActivePoint(context);
  const key = useReadoutKey("Chart.TooltipValue", context, dataKey, point.key);
  const text = key === null || point.slot === null ? null : readingText(context, key, point.slot, format);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-value",
      ...mergeProps<"span">({ className, children: text }, props),
    },
  });
}

/**
 * The reading's share as a percentage, signed as the reading is. In cartesian and radar charts the
 * denominator is the sum of the absolute readings of every series at the active slot or spoke, so a
 * share never passes 100 % in magnitude. A slice divides by the absolute total of the slices, and a
 * ring divides by its own maximum. A zero denominator prints the dictionary dash `–`. The shares at
 * one slot share a denominator, so they round together on their magnitudes and keep their signs.
 * Their magnitudes sum to 100 %, so readings of 3 and −1 print 75 % and −25 %. A ring's share
 * against its own maximum has no set and rounds alone.
 *
 * @beta
 */
export function ChartTooltipShare(props: ChartTooltipShareProps): ReactElement {
  return usePendingOr(props, ChartTooltipShareBody);
}

function ChartTooltipShareBody({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartTooltipShareProps): ReactElement {
  const context = useChartRoot("Chart.TooltipShare");
  const point = useActivePoint(context);
  const key = useReadoutKey("Chart.TooltipShare", context, dataKey, point.key);
  const text =
    key === null || point.slot === null
      ? null
      : shareText(context, slotShares(context, point.slot, shareDigits(format)).get(key) ?? null, format);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-share",
      ...mergeProps<"span">({ className, children: text }, props),
    },
  });
}

Object.assign(ChartTooltip, { displayName: "Chart.Tooltip" });
Object.assign(ChartTooltipLabel, { displayName: "Chart.TooltipLabel" });
Object.assign(ChartTooltipItems, { displayName: "Chart.TooltipItems" });
Object.assign(ChartTooltipValue, { displayName: "Chart.TooltipValue" });
Object.assign(ChartTooltipShare, { displayName: "Chart.TooltipShare" });
