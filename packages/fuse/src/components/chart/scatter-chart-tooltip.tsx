"use client";

import { createContext, use, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useRender } from "@base-ui/react/use-render";

import { OverlayPortal } from "../overlay/overlay-portal";
import { chartTakesPress, TOOLTIP_POSITIONER, tooltipPopupClass, watchOverflow } from "./chart-tooltip-popup";
import type { ChartDomProps, ChartLayerProps, ValueFormat } from "./chart-types";
import { seriesLabel } from "./format/series-label";
import { formatValue } from "./format/value-format";
import { dotCentre } from "./layout/scatter-frame";
import { pointOf } from "./layout/scatter-model";
import type { ScatterModel } from "./layout/scatter-model";
import { ROOF_GAP } from "./layout/tooltip-place";
import {
  dotOf,
  scatterPaint,
  useScatterFrame,
  useScatterRoot,
  useWalk,
  walkOf,
} from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { SeriesSwatch } from "./scatter-chart-legend";
import { useScatterStore } from "./scatter-chart-store";
import { pickPoint, tapPoint } from "./scatter-chart-surface";
import { axisNames, yFormatOf } from "./scatter-chart-text";

/**
 * Props for `ScatterChart.Tooltip`, a closed part.
 *
 * @beta
 */
export type ScatterChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default. */
  variant?: "default" | "frosted";
  /**
   * Without children, a TooltipLabel over one row for x and one for y, each with its name and a
   * TooltipValue.
   */
  children?: ReactNode;
};

/**
 * Props for `ScatterChart.TooltipLabel`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ScatterChartTooltipLabelProps = ChartDomProps<"span">;

/**
 * Props for `ScatterChart.TooltipValue`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ScatterChartTooltipValueProps = ChartDomProps<"span"> & {
  /** Which coordinate of the active point to print. */
  axis: "x" | "y";
  /** The value format. Root's `xFormat`, or the series' config `format` over Root's `valueFormat`, by default. */
  format?: ValueFormat;
};

/** How far a touch may move between down and up and still be a tap, in CSS pixels. */
const TAP_SLOP = 10;

/** The plot's surface, the element the pointer's pick measures against, or null before it mounts. */
function plotSurface(id: string): HTMLElement | null {
  return document.getElementById(`${id}-surface`);
}

/** The point a closing tooltip keeps showing, with the model its id belongs to. */
type ScatterHeldPoint = { readonly model: ScatterModel; readonly id: number };

/**
 * The point a closing tooltip keeps showing while it fades out, so its content never empties
 * before the fade, or null while it is open or shut. Its parts read it through `useActive`.
 */
const HeldPointContext = createContext<ScatterHeldPoint | null>(null);

/**
 * The active point's id in the Root's model, or null, which the readout parts render on: the walk's
 * active point, or inside a closing tooltip the point it held, while the model is the one it held it
 * in.
 */
function useActive(context: ScatterRootContextValue): number | null {
  const active = useWalk(context).active;
  const held = use(HeldPointContext);
  return active ?? (held !== null && held.model === context.model ? held.id : null);
}

/**
 * The popup over the active point, which a pointer can move into. It rests above the point, 8 px
 * past the point's ring, and flips below it when the viewport has no room above, staying inside
 * the viewport. It moves to the next point at once, with no glide, since points lie anywhere on the
 * plot. Escape closes it and keeps the reader's place. It is hidden from screen readers, which read
 * the same values from the plot's option.
 *
 * @beta
 */
export function ScatterChartTooltip({
  variant = "default",
  className,
  style,
  children,
}: ScatterChartTooltipProps): ReactElement {
  const context = useScatterRoot("ScatterChart.Tooltip");
  const { store, model, id, marks } = context;
  const active = useActive(context);
  const frame = useScatterFrame(context);
  const open = active !== null && frame !== null;
  // The point the popup showed last, which its content and its anchor keep while it fades out.
  const [shown, setShown] = useState<ScatterHeldPoint | null>(null);
  if (active !== null && (shown?.id !== active || shown.model !== model)) setShown({ model, id: active });
  const held = shown?.model === model ? shown.id : null;
  const placed = active ?? held;
  // Once open, the portal stays mounted, so a chart that is its scope's last child never restyles.
  const [kept, setKept] = useState(false);
  if (open && !kept) setKept(true);
  // The active point's dot diameter, which follows a change of its Points part's size, so the
  // popup moves clear of a larger point while it stays open.
  const activeKey = placed === null ? null : pointOf(model, placed).key;
  const diameter = useSyncExternalStore(
    marks.subscribe,
    () => (activeKey === null ? 0 : dotOf(marks.of(activeKey))),
    () => 0
  );
  const anchor = useMemo(() => {
    if (placed === null || frame === null) return null;
    const point = pointOf(model, placed);
    const centre = dotCentre(frame, point.x, point.y, diameter);
    // The anchor spans the point and the gap above it, so the popup rests clear of the point.
    const reach = diameter / 2 + ROOF_GAP;
    return {
      getBoundingClientRect: () => {
        const surface = plotSurface(id)?.getBoundingClientRect();
        if (surface === undefined) return new DOMRect();
        const { box } = frame;
        const scaleX = box.width === 0 ? 1 : surface.width / box.width;
        const scaleY = box.height === 0 ? 1 : surface.height / box.height;
        return new DOMRect(
          surface.left + centre.x * scaleX,
          surface.top + (centre.y - reach) * scaleY,
          0,
          2 * reach * scaleY
        );
      },
      get contextElement() {
        return plotSurface(id) ?? undefined;
      },
    };
  }, [placed, frame, model, diameter, id]);
  const content = children ?? <DefaultTooltip />;
  // Whether the pointer entered the popup by moving straight toward it from the active point, as
  // Chart's tooltip rules it. Only that entry holds the point while the pointer crosses the popup,
  // so a scrub that passes over the popup keeps picking the points under it.
  const frozen = useRef(false);
  // The kind of pointer the reader last used, which the store announces whenever it changes, so
  // the popup lets taps through to the plot from the first touch, unless it scrolls.
  const input = useScatterStore(store, (snapshot) => snapshot.input);
  const touchInput = input === "touch" || input === "pen";
  // Where a touch the popup took went down, so its lift tells a tap from a scroll.
  const pressed = useRef<{ readonly x: number; readonly y: number } | null>(null);
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next || chartTakesPress(details, context.root())) return;
        store.dismiss(model);
      }}>
      <OverlayPortal portal={TooltipPrimitive.Portal} keepMounted={kept}>
        <TooltipPrimitive.Positioner {...TOOLTIP_POSITIONER} anchor={anchor}>
          <TooltipPrimitive.Popup
            data-slot="chart-tooltip"
            data-variant={variant}
            data-input={touchInput ? "touch" : undefined}
            aria-hidden="true"
            ref={watchOverflow}
            className={tooltipPopupClass(variant, className)}
            style={style}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse") return;
              // A touch that lands on the popup while it still takes the pointer, as after mouse
              // input, switches the input, so the next tap passes through.
              store.track(event.clientX, event.clientY, event.pointerType);
              pressed.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const start = pressed.current;
              pressed.current = null;
              if (event.pointerType === "mouse" || start === null) return;
              // A drag scrolled the popup and is no tap.
              if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP) return;
              // A popup that scrolls keeps touch, so a tap on it takes the one dismissal a tap
              // beside the chart would. Otherwise the tap acts on the plot under it, as one there
              // does.
              if (event.currentTarget.hasAttribute("data-scrolls")) store.dismiss(model);
              else tapPoint(context, plotSurface(id), event);
            }}
            onPointerEnter={(event) => {
              const from = store.pointer();
              const { active } = walkOf(store.get(), model);
              frozen.current = false;
              if (from === null || active === null) return;
              // The pointer must come from the active point and move along the axis that leads to
              // the popup, up or down to a popup above or below it.
              const start = pickPoint(context, plotSurface(id), {
                clientX: from.x,
                clientY: from.y,
                pointerType: from.type,
              });
              const dx = Math.abs(event.clientX - from.x);
              const dy = Math.abs(event.clientY - from.y);
              frozen.current = start === active && dy > dx;
            }}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse") store.track(event.clientX, event.clientY, "mouse");
              // The popup lies over the plot, so a pointer that scrubs across it picks the points
              // under it, through the surface's own query.
              if (frozen.current || store.get().source === "keyboard") return;
              store.hover(model, pickPoint(context, plotSurface(id), event));
            }}
            onPointerLeave={(event) => {
              frozen.current = false;
              const surface = plotSurface(id);
              if (
                surface !== null &&
                event.relatedTarget instanceof Node &&
                surface.contains(event.relatedTarget)
              )
                return;
              store.leave();
            }}>
            {/* A held id is the shown point's, from the model it belongs to, so `shown` is the value. */}
            <HeldPointContext value={open || held === null ? null : shown}>{content}</HeldPointContext>
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </OverlayPortal>
    </TooltipPrimitive.Root>
  );
}

/** The default popup content: the series, then the x and y rows. */
function DefaultTooltip(): ReactElement {
  const context = useScatterRoot("ScatterChart.Tooltip");
  const names = axisNames(context);
  return (
    <>
      <ScatterChartTooltipLabel />
      <div data-slot="chart-tooltip-items">
        <div data-slot="chart-tooltip-item">
          <span>{names.x}</span>
          <ScatterChartTooltipValue axis="x" />
        </div>
        <div data-slot="chart-tooltip-item">
          <span>{names.y}</span>
          <ScatterChartTooltipValue axis="y" />
        </div>
      </div>
    </>
  );
}

/**
 * The active point's series: its swatch and its label.
 *
 * @beta
 */
export function ScatterChartTooltipLabel({
  render,
  className,
  children,
  ...props
}: ScatterChartTooltipLabelProps): ReactElement {
  const context = useScatterRoot("ScatterChart.TooltipLabel");
  const active = useActive(context);
  const key = active === null ? null : pointOf(context.model, active).key;
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-label",
      ...mergeProps<"span">(
        {
          className,
          children:
            children ??
            (key === null ? null : (
              <>
                <SeriesSwatch paint={scatterPaint(context.config, key)} />
                {seriesLabel(context, key).text}
              </>
            )),
        },
        props
      ),
    },
  });
}

/**
 * One coordinate of the active point, x or y, in its format.
 *
 * @beta
 */
export function ScatterChartTooltipValue({
  axis,
  format,
  render,
  className,
  ...props
}: ScatterChartTooltipValueProps): ReactElement {
  const context = useScatterRoot("ScatterChart.TooltipValue");
  const active = useActive(context);
  let text: string | null = null;
  if (active !== null) {
    const point = pointOf(context.model, active);
    const value = axis === "x" ? point.x : point.y;
    const fallback = axis === "x" ? context.xFormat : yFormatOf(context, point.key);
    text = formatValue(context.locale, value, format ?? fallback, "full").text;
  }
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-value",
      ...mergeProps<"span">({ className, children: text }, props),
    },
  });
}

Object.assign(ScatterChartTooltip, { displayName: "ScatterChart.Tooltip" });
Object.assign(ScatterChartTooltipLabel, { displayName: "ScatterChart.TooltipLabel" });
Object.assign(ScatterChartTooltipValue, { displayName: "ScatterChart.TooltipValue" });
