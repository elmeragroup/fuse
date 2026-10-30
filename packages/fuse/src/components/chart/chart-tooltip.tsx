"use client";

import { use, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";
import { tooltipShellClass } from "../../styles/inner-corner/tooltip";
import { tv } from "../../styles/tv";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import { ChartPendingRootContext, useChartRoot } from "./chart-context";
import { useChartFrame } from "./chart-plot";
import {
  ChartLiveContext,
  ChartRowContext,
  readingText,
  shareDigits,
  shareText,
  slotShares,
  useActivePoint,
  useReadoutKey,
} from "./chart-readout";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { pointerSlot } from "./chart-surface";
import { slotLabel } from "./chart-text";
import { ChartTooltipTotal } from "./chart-tooltip-total";
import type { ChartDomProps, ChartLayerProps, ChartShareFormat, ValueFormat, XFormat } from "./chart-types";
import { WHOLE_BAND, barSpan, centreOf, frameRect, optionBand, snapY, valueAt } from "./layout/plot-frame";
import { tooltipSideOffset } from "./layout/tooltip-place";

/**
 * Props for `Chart.Tooltip`, a closed part.
 *
 * @beta
 */
export type ChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default. */
  variant?: "default" | "frosted";
  /** "point" follows the active mark. "top" pins the popup to the plot top and tracks x only. */
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
  format?: ChartShareFormat;
};

/**
 * The popup's corner and padding, and its fill per variant. Frosted glass lets the plot show through a translucent popover
 * fill and blurs it. It sits on the utilities layer with the overlay fill it replaces, so the
 * class merge drops the opaque fill.
 */
const tooltipPopup = tv({
  // DESIGN-NOTES "Tooltips" gives the chart popup an 8 px radius and 8 px of block padding. The
  // popup is never taller than the room Base UI measures on its side, and scrolls past it.
  base: "max-h-[calc(100dvh-16px)] overflow-y-auto rounded-lg py-2 [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))] data-[input=touch]:pointer-events-none",
  variants: {
    variant: {
      default: "",
      frosted: "supports-backdrop-filter:backdrop-blur-md bg-popover/70",
    },
  },
});

/** A virtual anchor over the active slot, measured from the plot surface at position time. */
type Anchor = { getBoundingClientRect: () => DOMRect };

/**
 * The popup over the active slot, which a pointer can move into and pin. It sits on the active
 * slot's own column, above the slot and centred, and flips below the plot when the viewport has no
 * room above. On a horizontal chart it sits above or below the active row. When neither side has
 * room, it sits beside the column, and when no side has room, it overlays the plot. It touches its
 * anchor and stays inside the viewport, scrolling when its content is taller. It may leave the chart. A pointer
 * that moves straight up or down stays on the slot, so it reaches the popup with the content
 * unchanged. The popup stays while the pointer is on the plot or inside the popup and while the
 * option has focus. Escape closes it and keeps the reader's place. It is hidden from screen
 * readers, which read the same values from the plot's option.
 *
 * @beta
 */
export function ChartTooltip(props: ChartTooltipProps): ReactElement {
  return use(ChartPendingRootContext) ? <></> : <ChartTooltipBody {...props} />;
}

function ChartTooltipBody({
  variant = "default",
  anchor = "point",
  className,
  style,
  children,
}: ChartTooltipProps): ReactElement {
  const context = useChartRoot("Chart.Tooltip");
  const { store, model, id, xScale, orientation } = context;
  const point = useActivePoint(context, true);
  const window = model.window;
  const open = point.slot !== null;
  const slot = point.slot;
  const drawn = useChartFrame("Chart.Tooltip");
  const virtual = useMemo((): Anchor | null => {
    if (slot === null || window === null || drawn === null) return null;
    const { frame, metrics } = drawn;
    const position = slot - window.first;
    const extents = model.series.flatMap(({ extents: list }) => {
      const extent = list[slot];
      return extent ? [extent[1]] : [];
    });
    // The anchor starts at the column's highest value, or at the plot's top for anchor="top".
    const top =
      anchor === "top" || extents.length === 0 ? 0 : snapY(frame.box, valueAt(frame, Math.max(...extents)));
    return {
      getBoundingClientRect: () => {
        const surface = document.getElementById(`${id}-surface`)?.getBoundingClientRect();
        if (surface === undefined) return new DOMRect();
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
          const row = frameRect(frame, barSpan(frame, position, metrics, WHOLE_BAND), [0, box.width]);
          return [row.y, row.y + row.height];
        };
        const [start, end] = along();
        // A horizontal anchor spans the plot's width, and a vertical one runs from the column's
        // value top down to the plot's bottom. The popup sits beside it, so it never covers it.
        return orientation === "horizontal"
          ? client(0, start, box.width, end - start)
          : client(start, top, end - start, box.height - top);
      },
    };
  }, [slot, window, xScale, model, anchor, id, orientation, drawn]);
  // Whether the pointer entered the popup by moving straight toward it from the active slot. Only
  // that entry freezes the slot, as CONTRACT section 9.5's safe triangle does for polar charts, so
  // a scrub that crosses the popup keeps following x. The surface records the last plot position.
  const frozen = useRef(false);
  const pick = (clientX: number, clientY: number) => {
    const surface = document.getElementById(`${id}-surface`);
    return surface === null ? null : pointerSlot(context, surface.getBoundingClientRect(), clientX, clientY);
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
      <OverlayPortal portal={TooltipPrimitive.Portal}>
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
          sideOffset={({ side, positioner }) =>
            virtual === null
              ? 0
              : tooltipSideOffset(side, virtual.getBoundingClientRect(), positioner, {
                  width: document.documentElement.clientWidth,
                  height: document.documentElement.clientHeight,
                })
          }
          data-slot="chart-tooltip-positioner"
          className={overlayPositionerClass}>
          <TooltipPrimitive.Popup
            data-slot="chart-tooltip"
            data-variant={variant}
            data-input={touchInput ? "touch" : undefined}
            aria-hidden="true"
            className={cn(
              overlayPopupSurfaceClass,
              tooltipShellClass,
              overlayPopupMotionClass,
              tooltipPopup({ variant }),
              className
            )}
            style={style}
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
  return use(ChartPendingRootContext) ? <></> : <ChartTooltipLabelBody {...props} />;
}

function ChartTooltipLabelBody({
  format,
  render,
  className,
  ...props
}: ChartTooltipLabelProps): ReactElement {
  const context = useChartRoot("Chart.TooltipLabel");
  const { slot } = useActivePoint(context);
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
  return use(ChartPendingRootContext) ? <></> : <ChartTooltipItemsBody {...props} />;
}

function ChartTooltipItemsBody({
  render,
  className,
  children,
  ...props
}: ChartTooltipItemsProps): ReactElement {
  const context = useChartRoot("Chart.TooltipItems");
  const rows = context.model.series.map(({ key, seriesIndex }) => (
    <ChartRowContext key={key} value={key}>
      <div
        data-slot="chart-tooltip-item"
        data-series={seriesIndex}
        data-dimmed={context.selectedKey !== null && context.selectedKey !== key ? "" : undefined}>
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
  return use(ChartPendingRootContext) ? <></> : <ChartTooltipValueBody {...props} />;
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
  return use(ChartPendingRootContext) ? <></> : <ChartTooltipShareBody {...props} />;
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
