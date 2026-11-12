"use client";

/**
 * A live line Root's plot surface: the plot's single tab stop and its one pointer target, and the
 * subscription that keeps the active reading on what each frame shows. The readout parts, the
 * Crosshair and the Tooltip, only read the active reading the surface sets.
 */
import { useLayoutEffect, useRef } from "react";
import type { FocusEvent, KeyboardEvent, PointerEvent, ReactElement } from "react";

import { writeAttribute, writeStyle } from "./chart-dom";
import { listboxProps, stepOf, SurfaceName, useOptionHandoff } from "./chart-listbox";
import type { LiveClock, LiveFrame } from "./layout/live-clock";
import { indexAt, liveValueAt, liveX, liveY, nearestIndex, stepIndex, walkRange } from "./layout/live-window";
import type { LiveGeometry, LivePoint, LiveStep } from "./layout/live-window";
import {
  useLiveActive,
  useLiveFrame,
  useLivePlot,
  useLiveRoot,
  useShownFeed,
} from "./live-line-chart-context";
import type { LiveActive, LiveStore } from "./live-line-chart-context";
import { liveOptionName } from "./live-line-chart-text";

/** Make the reading nearest a place across the plot active, as the pointer picks it. */
function pickAt(frame: LiveFrame, store: LiveStore, share: number): void {
  const { start, end } = frame.window;
  const { points } = frame.feed;
  const point = points[nearestIndex(points, frame.span, start + share * (end - start))];
  store.activate(point === undefined ? null : { time: point.time, source: "pointer" });
}

/**
 * The reading the option names: the keyboard's reading, or the latest one when no key has picked
 * one or the feed has dropped it.
 *
 * @param points - The readings in time order.
 * @param active - The active reading.
 * @returns The index, or -1 with no reading.
 */
function namedIndex(points: readonly LivePoint[], active: LiveActive | null): number {
  const walked = active?.source === "keyboard" ? indexAt(points, active.time) : -1;
  return walked === -1 ? points.length - 1 : walked;
}

/**
 * Keep the active reading on what a frame shows: a resting pointer picks the reading nearest it as
 * the readings scroll under it, unless Escape dismissed the readout. A keyboard reading stays while
 * its instant is in the window or the walk, even once the feed drops it, so the option names the
 * latest reading; one that scrolls out at the left edge moves on to the oldest reading the walk
 * still reaches, and none is left when the feed holds no reading.
 *
 * @param frame - The frame.
 * @param store - Root's store.
 */
function follow(frame: LiveFrame, store: LiveStore): void {
  const share = store.pointer();
  const active = store.active();
  if (share !== null && active?.source !== "keyboard") {
    if (!store.dismissed()) pickAt(frame, store, share);
    return;
  }
  if (active?.source !== "keyboard") return;
  const { points } = frame.feed;
  const oldest = points[walkRange(points, frame.span).first];
  if (oldest === undefined) {
    store.activate(null);
    return;
  }
  if (active.time >= Math.min(frame.window.start, oldest.time)) return;
  store.activate({ time: oldest.time, source: "keyboard" });
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

/** A reading's place in a frame, at the value it draws. */
export type LivePlace = { readonly point: LivePoint; readonly x: number; readonly y: number };

/**
 * A reading's place in a frame, at the value the line draws it at, by the line's own rule.
 *
 * @param frame - The frame.
 * @param geometry - The frame in the plot's pixels.
 * @param time - The reading's instant.
 * @returns The place, or null when the window no longer shows the reading.
 */
export function placeOf(frame: LiveFrame, geometry: LiveGeometry, time: number): LivePlace | null {
  const { points } = frame.feed;
  const index = indexAt(points, time);
  const point = points[index];
  if (point === undefined || index < frame.span.first || index >= frame.span.end) return null;
  const value = liveValueAt(points, index, frame.now, frame.tip, frame.held);
  return { point, x: liveX(geometry, point.time), y: liveY(geometry, value) };
}

/**
 * The plot's single tab stop, the listbox of `chart-listbox.tsx`, whose one option names the
 * active reading, or the latest one before the reader steps. Left and Right step through the
 * readings the window shows, Home and End go to the oldest and the latest, and Escape lets go until
 * the pointer moves or a key steps. A reading that scrolls out at the left edge hands the option
 * to the oldest one the window still shows. The option's position and set size count the readings
 * the walk can reach, which each frame writes as the window scrolls. The surface is also the
 * plot's one pointer target: a pointer picks the nearest reading and never moves focus.
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
  const currentOption = useRef<HTMLDivElement>(null);
  const handoff = useOptionHandoff(id, listbox, () => ({}));
  const active = useLiveActive(context);
  useLiveFrame(context, plot, (frame, geometry) => {
    const option = currentOption.current;
    if (option === null) return;
    const { points: framed } = frame.feed;
    const named = namedIndex(framed, store.active());
    // The option counts the readings the keys can reach, as the walk does.
    const { first, end } = walkRange(framed, frame.span);
    writeAttribute(option, "aria-posinset", named - first + 1);
    writeAttribute(option, "aria-setsize", end - first);
    // The option sits over its reading, a 24 px target where a touch reader's double tap lands.
    const place = placeOf(frame, geometry, framed[named]?.time ?? Number.NaN);
    writeStyle(option, "--chart-option-x", place === null ? null : `${String(place.x)}px`);
    writeStyle(option, "--chart-option-y", place === null ? null : `${String(place.y)}px`);
  });
  const current = handoff.current;
  const latest = points.at(-1);
  if (current === undefined || latest === undefined) return null;
  const named = points[namedIndex(points, active)] ?? latest;

  const step = (to: LiveStep): void => {
    const frame = clock.get();
    const { points: shown } = frame.feed;
    const now = store.active();
    const from = now?.source === "keyboard" ? now.time : null;
    const point = shown[stepIndex(shown, frame.span, from, to)];
    if (point === undefined) return;
    if (from === point.time) return;
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
      // The one dismissal, which a pointer that rests on the plot does not undo, and the next
      // step or pointer move does.
      store.dismiss();
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
    const newest = clock.get().feed.points.at(-1);
    if (newest !== undefined) store.activate({ time: newest.time, source: "keyboard" });
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event) || handoff.kept(event)) return;
    if (store.active()?.source === "keyboard") store.activate(null);
    // The next entry meets a new option that carries the description again.
    handoff.reset({});
  };

  /** Record where the pointer rests across the plot, and pick the reading nearest it. */
  const track = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = box.width <= 0 ? 1 : Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    store.point(share);
    pickAt(clock.get(), store, share);
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
      onPointerMove={track}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") track(event);
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
          ref={option === current ? currentOption : undefined}
          id={option.id}
          // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- nothing is selectable, so options mark no selection
          role="option"
          data-slot="live-line-chart-option"
          data-focus-ring-control=""
          tabIndex={option === current ? 0 : -1}
          aria-label={liveOptionName(text, named)}
          aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
        />
      ))}
    </div>
  );
}

Object.assign(LiveSurface, { displayName: "LiveLineChart.Root.Surface" });
