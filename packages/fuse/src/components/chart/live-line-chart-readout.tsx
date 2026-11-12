"use client";

import { useLayoutEffect, useRef } from "react";
import type { FocusEvent, KeyboardEvent, PointerEvent, ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { listboxProps, SurfaceName, useOptionHandoff } from "./chart-listbox";
import { glideFrom, snapGlide } from "./chart-spring";
import { tooltipPopupClass } from "./chart-tooltip-popup";
import type { ChartLayerProps } from "./chart-types";
import type { LiveClock, LiveFrame } from "./layout/live-clock";
import { indexAt, livePixel, liveValueAt, liveX, liveY, nearestIndex, timeShare } from "./layout/live-window";
import type { LiveGeometry, LivePoint } from "./layout/live-window";
import { FOLLOW_SPEEDS } from "./layout/motion";
import { followSpring } from "./layout/spring";
import {
  useLiveActive,
  useLiveFrame,
  useLivePlot,
  useLiveRoot,
  useShownFeed,
} from "./live-line-chart-context";
import type { LiveStore } from "./live-line-chart-context";
import { liveName, liveOptionName, liveTimeText, liveValueText } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Crosshair`, a closed part.
 *
 * @beta
 */
export type LiveLineChartCrosshairProps = ChartLayerProps;

/**
 * Props for `LiveLineChart.Tooltip`, a closed part.
 *
 * @beta
 */
export type LiveLineChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default, and "frosted" lets the plot show through. */
  variant?: "default" | "frosted";
};

/** Make the reading nearest a place across the plot active, as the pointer picks it. */
function pickAt(frame: LiveFrame, store: LiveStore, share: number): void {
  const { start, end } = frame.window;
  const point = frame.points[nearestIndex(frame.points, frame.span, start + share * (end - start))];
  store.activate(point === undefined ? null : { time: point.time, source: "pointer" });
}

/**
 * Keep the active reading on what a frame shows: a resting pointer picks the reading nearest it as
 * the readings scroll under it, and a keyboard reading that scrolls out at the left edge moves on to
 * the oldest reading the window still shows.
 *
 * @param frame - The frame.
 * @param store - Root's store.
 */
function follow(frame: LiveFrame, store: LiveStore): void {
  const share = store.pointer();
  const active = store.active();
  if (share !== null && active?.source !== "keyboard") {
    pickAt(frame, store, share);
    return;
  }
  if (active?.source !== "keyboard" || active.time >= frame.window.start) return;
  const oldest = frame.span.first < frame.span.end ? frame.points[frame.span.first] : undefined;
  store.activate(oldest === undefined ? null : { time: oldest.time, source: "keyboard" });
}

/**
 * Root's subscription that keeps the active reading on every frame the clock shows, through
 * `follow`.
 *
 * @param clock - Root's clock.
 * @param store - Root's store.
 */
export function useActiveFollowsFrame(clock: LiveClock, store: LiveStore): void {
  useLayoutEffect(
    () =>
      clock.subscribe(() => {
        follow(clock.get(), store);
      }),
    [clock, store]
  );
}

/** A reading's place in a frame, at the value it draws, or null when the window no longer shows it. */
function placeOf(
  frame: LiveFrame,
  geometry: LiveGeometry,
  time: number
): { readonly point: LivePoint; readonly x: number; readonly y: number } | null {
  const index = indexAt(frame.points, time);
  const point = frame.points[index];
  if (point === undefined || index < frame.span.first || index >= frame.span.end) return null;
  // The reading sits where the line draws it, by the line's own rule.
  const value = liveValueAt(frame.points, index, frame.now, frame.tip, frame.held);
  return { point, x: liveX(geometry, point.time), y: liveY(geometry, value) };
}

/** The key steps the walk takes. Arrow directions are physical, so time runs left to right under RTL. */
function stepOf(key: string): "previous" | "next" | "first" | "last" | undefined {
  switch (key) {
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/**
 * The plot's single tab stop, the listbox of `chart-listbox.tsx`, whose one option names the
 * active reading, or the latest one before the reader steps. Left and Right step through the
 * readings the window shows, Home and End go to the oldest and the latest, and Escape lets go. A
 * reading that scrolls out at the left edge hands the option to the oldest one the window still
 * shows. The surface is also the plot's one pointer target: a pointer picks the nearest reading
 * and never moves focus.
 */
export function LiveSurface({
  labelledBy,
}: {
  readonly labelledBy: string | undefined;
}): ReactElement | null {
  const context = useLiveRoot("LiveLineChart.Root");
  const { store, clock, id, name, text } = context;
  // The option names what the plot shows, which a paused chart holds while the feed moves on.
  const { points } = useShownFeed(context);
  const plot = useLivePlot(context);
  const listbox = useRef<HTMLDivElement>(null);
  const handoff = useOptionHandoff(id, listbox, () => ({}));
  const active = useLiveActive(context);
  // The option sits over its reading, a 24 px target where a touch reader's double tap lands.
  const currentId = handoff.current?.id;
  useLiveFrame(context, plot, (frame, geometry) => {
    const option =
      currentId === undefined
        ? null
        : listbox.current?.querySelector<HTMLElement>(`[id="${CSS.escape(currentId)}"]`);
    if (option === null || option === undefined) return;
    const shown = store.active();
    const place = placeOf(frame, geometry, shown?.time ?? frame.points.at(-1)?.time ?? Number.NaN);
    writeStyle(option, "--chart-option-x", place === null ? null : `${String(place.x)}px`);
    writeStyle(option, "--chart-option-y", place === null ? null : `${String(place.y)}px`);
  });
  const current = handoff.current;
  const latest = points.at(-1);
  if (current === undefined || latest === undefined) return null;
  const walked = active?.source === "keyboard" ? points[indexAt(points, active.time)] : undefined;
  const named = walked ?? latest;
  const position = (walked === undefined ? points.length - 1 : indexAt(points, walked.time)) + 1;

  const step = (to: "previous" | "next" | "first" | "last"): void => {
    const frame = clock.get();
    const shown = frame.points;
    const first = frame.span.first < frame.span.end ? frame.span.first : 0;
    const last = shown.length - 1;
    const now = store.active();
    const at =
      now?.source === "keyboard" ? nearestIndex(shown, { first: 0, end: shown.length }, now.time) : last;
    const index =
      to === "first"
        ? first
        : to === "last"
          ? last
          : Math.max(first, Math.min(last, at + (to === "next" ? 1 : -1)));
    const point = shown[index];
    if (point === undefined) return;
    if (now?.source === "keyboard" && now.time === point.time) return;
    handoff.step({});
    store.activate({ time: point.time, source: "keyboard" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "option") return;
    const to = stepOf(event.key);
    if (to !== undefined) step(to);
    else if (event.key === "Escape") {
      if (store.active() === null) return;
      // The one dismissal, which the next step undoes.
      store.activate(null);
      event.stopPropagation();
    } else return;
    event.preventDefault();
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event)) {
      // The old option leaves in the commit after the new one took focus.
      handoff.prune();
      return;
    }
    const newest = clock.get().points.at(-1);
    if (newest !== undefined) store.activate({ time: newest.time, source: "keyboard" });
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event) || handoff.kept(event)) return;
    if (store.active()?.source === "keyboard") store.activate(null);
    // The next entry meets a new option that carries the description again.
    handoff.reset({});
  };

  const shareOf = (event: PointerEvent<HTMLDivElement>): number => {
    const box = event.currentTarget.getBoundingClientRect();
    return box.width <= 0 ? 1 : Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  };

  const release = (): void => {
    store.point(null);
    if (store.active()?.source === "pointer") store.activate(null);
  };

  const naming = { id, name, labelledBy, locale: text.locale };
  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      role="listbox"
      {...listboxProps(naming, false, "horizontal")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={(event) => {
        const share = shareOf(event);
        store.point(share);
        pickAt(clock.get(), store, share);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        const share = shareOf(event);
        store.point(share);
        pickAt(clock.get(), store, share);
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== "mouse") release();
      }}
      onPointerCancel={release}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") release();
      }}>
      <SurfaceName {...naming} />
      {handoff.options.map((option) => (
        <div
          key={option.id}
          id={option.id}
          // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- nothing is selectable, so options mark no selection
          role="option"
          data-slot="live-line-chart-option"
          data-focus-ring-control=""
          tabIndex={option === current ? 0 : -1}
          aria-label={liveOptionName(text, named)}
          aria-posinset={position}
          aria-setsize={points.length}
          aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
        />
      ))}
    </div>
  );
}

/**
 * A vertical line through the active reading and a ring on it, which ride the reading as the window
 * scrolls and glide to the next one on the crosshair's spring: the pointer's follow spring, or the
 * fastest one for a key, so a held arrow never trails. Reduced motion moves it at once.
 *
 * @beta
 */
export function LiveLineChartCrosshair({ className, style }: LiveLineChartCrosshairProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Crosshair");
  const plot = useLivePlot(context);
  const group = useRef<SVGGElement>(null);
  const rule = useRef<SVGLineElement>(null);
  // A new active reading renders the part, so a step draws it with no frame running, as on a paused
  // chart or between the redraws of reduced motion. A frame reads the store itself, which a pointer
  // pick in the frame before this render already moved.
  useLiveActive(context);
  // Where the crosshair last rested, which a step to another reading glides from.
  const shown = useRef<{ readonly time: number; readonly x: number; readonly y: number } | null>(null);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = group.current;
    if (node === null || rule.current === null) return;
    const active = context.store.active();
    const place = active === null ? null : placeOf(frame, geometry, active.time);
    writeAttribute(node, "data-hidden", place === null ? "" : null);
    if (active === null || place === null) {
      shown.current = null;
      snapGlide(node);
      return;
    }
    const { x, y } = place;
    writeAttribute(node, "transform", `translate(${livePixel(x)} ${livePixel(y)})`);
    writeAttribute(rule.current, "y1", -y);
    writeAttribute(rule.current, "y2", geometry.height - y);
    const before = shown.current;
    shown.current = { time: place.point.time, x, y };
    // Reduced motion stops a glide that is running too, as when the preference turns on mid-glide.
    if (context.reduced) {
      snapGlide(node);
      return;
    }
    if (before === null || before.time === place.point.time) return;
    const spring = followSpring(active.source === "keyboard" ? FOLLOW_SPEEDS.fast : null);
    glideFrom(node, [before.x - x, before.y - y], spring);
  });
  return (
    <svg data-slot="live-line-chart-crosshair" aria-hidden="true" className={className} style={style}>
      {plot === null ? null : (
        <g ref={group} data-hidden="">
          <line ref={rule} data-slot="live-line-chart-crosshair-rule" x1={0} x2={0} />
          <circle data-slot="chart-dot" r={4} />
        </g>
      )}
    </svg>
  );
}

/**
 * The active reading's time and value in a popup at the top of the plot, which rides the reading
 * as the window scrolls and stays inside the plot at either edge. It is hidden from screen readers,
 * which read the same reading from the plot's option.
 *
 * @beta
 */
export function LiveLineChartTooltip({
  variant = "default",
  className,
  style,
}: LiveLineChartTooltipProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Tooltip");
  const plot = useLivePlot(context);
  const active = useLiveActive(context);
  const layer = useRef<HTMLDivElement>(null);
  useLiveFrame(context, plot, (frame) => {
    const node = layer.current;
    const now = context.store.active();
    if (node === null || now === null) return;
    writeStyle(node, "--chart-at", String(timeShare(frame.window, now.time)));
  });
  const { text } = context;
  const { points } = useShownFeed(context);
  const point = active === null ? undefined : points[indexAt(points, active.time)];
  return (
    <div ref={layer} data-slot="live-line-chart-tooltip" aria-hidden="true">
      {point === undefined || plot === null ? null : (
        <div
          data-slot="chart-tooltip"
          data-variant={variant}
          // It opens as an anchored popup below its anchor does, fading in and dropping into place.
          data-open=""
          data-side="bottom"
          className={tooltipPopupClass(variant, className)}
          style={style}>
          <div data-slot="chart-tooltip-label">{liveTimeText(text, point.time, "full").text}</div>
          <div data-slot="chart-tooltip-items">
            <div data-slot="chart-tooltip-item">
              <span>{liveName(text)}</span>
              <span data-slot="chart-tooltip-value">{liveValueText(text, point.value, "full").text}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(LiveSurface, { displayName: "LiveLineChart.Root.Surface" });
Object.assign(LiveLineChartCrosshair, { displayName: "LiveLineChart.Crosshair" });
Object.assign(LiveLineChartTooltip, { displayName: "LiveLineChart.Tooltip" });
