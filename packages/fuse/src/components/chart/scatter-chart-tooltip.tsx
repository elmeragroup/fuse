"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";
import { tooltipShellClass } from "../../styles/inner-corner/tooltip";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import { tooltipPopup, watchOverflow } from "./chart-tooltip-popup";
import type { ChartDomProps, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { dotCentre } from "./layout/scatter-frame";
import { pointOf } from "./layout/scatter-model";
import { ROOF_GAP, TOOLTIP_EDGE } from "./layout/tooltip-place";
import { scatterPaint, useScatterFrame, useScatterRoot, useWalk, walkOf } from "./scatter-chart-context";
import type { ScatterMark, ScatterRootContextValue } from "./scatter-chart-context";
import { useScatterStore } from "./scatter-chart-store";
import { pickPoint, tapPoint } from "./scatter-chart-surface";
import { axisNames, scatterSeriesLabel, xValueText, yValueText } from "./scatter-chart-text";

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

/** The active point's id in the Root's model, or null, which the readout parts render on. */
function useActive(context: ScatterRootContextValue): number | null {
  return useWalk(context).active;
}

/** A mark's dot diameter: a Points part's, or 0 for a line or no mark. */
function dotOf(mark: ScatterMark | undefined): number {
  return mark?.kind === "points" ? mark.diameter : 0;
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
  // Once open, the portal stays mounted, so a chart that is its scope's last child never restyles.
  const [kept, setKept] = useState(false);
  if (open && !kept) setKept(true);
  // The active point's dot diameter, which follows a change of its Points part's size, so the
  // popup moves clear of a larger point while it stays open.
  const activeKey = active === null ? null : pointOf(model, active).key;
  const diameter = useSyncExternalStore(
    marks.subscribe,
    () => (activeKey === null ? 0 : dotOf(marks.of(activeKey))),
    () => 0
  );
  const anchor = useMemo(() => {
    if (active === null || frame === null) return null;
    const point = pointOf(model, active);
    const centre = dotCentre(frame, point.x, point.y, diameter);
    // The anchor spans the point and the gap above it, so the popup rests clear of the point.
    const reach = diameter / 2 + ROOF_GAP;
    const surfaceOf = () => document.getElementById(`${id}-surface`);
    return {
      getBoundingClientRect: () => {
        const surface = surfaceOf()?.getBoundingClientRect();
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
        return surfaceOf() ?? undefined;
      },
    };
  }, [active, frame, model, diameter, id]);
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
  const plotSurface = () => document.getElementById(`${id}-surface`);
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        // A press on the chart picks or pins a point. Every other dismissal Base UI reports, such
        // as a press outside the chart or Escape with focus elsewhere, takes the one dismissal.
        const target = details.event.target;
        if (
          details.reason === "outside-press" &&
          target instanceof Node &&
          context.root()?.contains(target) === true
        )
          return;
        store.dismiss(model);
      }}>
      <OverlayPortal portal={TooltipPrimitive.Portal} keepMounted={kept}>
        <TooltipPrimitive.Positioner
          anchor={anchor}
          side="top"
          align="center"
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
          // Base UI's flip adds 1 px to the collision padding, and 1 px more on the side opposite
          // the preferred top, so these paddings make every flip test read TOOLTIP_EDGE, 8 px.
          collisionPadding={{
            top: TOOLTIP_EDGE - 1,
            right: TOOLTIP_EDGE - 1,
            bottom: TOOLTIP_EDGE - 2,
            left: TOOLTIP_EDGE - 1,
          }}
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
              else tapPoint(context, plotSurface(), event);
            }}
            onPointerEnter={(event) => {
              const from = store.pointer();
              const snapshot = store.get();
              const active = walkOf(snapshot, model).active;
              // The pointer must come from the active point and move along the axis that leads to
              // the popup, up or down to a popup above or below it.
              const start =
                from === null
                  ? -1
                  : pickPoint(context, plotSurface(), {
                      clientX: from.x,
                      clientY: from.y,
                      pointerType: from.type,
                    });
              const dx = Math.abs(from === null ? 0 : event.clientX - from.x);
              const dy = Math.abs(from === null ? 0 : event.clientY - from.y);
              frozen.current = active !== null && start === active && dy > dx;
            }}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse") store.track(event.clientX, event.clientY, "mouse");
              // The popup lies over the plot, so a pointer that scrubs across it picks the points
              // under it, through the surface's own query.
              if (frozen.current || store.get().source === "keyboard") return;
              store.hover(model, pickPoint(context, plotSurface(), event));
            }}
            onPointerLeave={(event) => {
              frozen.current = false;
              const surface = plotSurface();
              if (
                surface !== null &&
                event.relatedTarget instanceof Node &&
                surface.contains(event.relatedTarget)
              )
                return;
              store.leave();
            }}>
            {content}
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

/** The swatch of a series, a dot in its paint, as decoration. */
function SeriesSwatch({
  seriesKey,
  context,
}: {
  readonly seriesKey: string;
  readonly context: ScatterRootContextValue;
}) {
  return (
    <span
      data-slot="chart-swatch"
      data-variant="circle"
      aria-hidden="true"
      style={{ "--chart-swatch-paint": scatterPaint(context.config, seriesKey) }}
    />
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
                <SeriesSwatch seriesKey={key} context={context} />
                {scatterSeriesLabel(context, key).text}
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
    text =
      format !== undefined
        ? formatValue(context.locale, value, format, "full").text
        : axis === "x"
          ? xValueText(context, value, "full").text
          : yValueText(context, point.key, value, "full").text;
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
