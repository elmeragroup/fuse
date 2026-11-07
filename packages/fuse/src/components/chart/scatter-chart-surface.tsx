"use client";

import { useRef } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from "react";

import { listboxProps, StatusRegion, SurfaceName, useGestureEnd, useOptionHandoff } from "./chart-listbox";
import { useTapLift } from "./chart-tap-lift";
import type { ScatterDomains } from "./layout/domain-glide";
import { buildPointIndex, nearestPoint } from "./layout/point-index";
import type { PointIndex } from "./layout/point-index";
import { dotCentre } from "./layout/scatter-frame";
import { focusPoint, pointOf, pointShares, stepPoint, walkPosition } from "./layout/scatter-model";
import type { ScatterModel, ScatterStep } from "./layout/scatter-model";
import { useScatterFrame, useScatterRoot, useWalkPlace, walkOf } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { useScatterStore } from "./scatter-chart-store";
import { scatterOptionName } from "./scatter-chart-text";

/**
 * The hit radius in CSS pixels around the pointer, inside which the nearest point becomes active:
 * a 48 px catchment for a mouse, and 64 px for a finger or a pen, whose contact point is coarse.
 * Both reach well past the 24 px target floor, so a lone point is easy to hit.
 */
const HIT_RADIUS = { fine: 24, coarse: 32 } as const;

/** The step a key makes. Arrow directions are physical, so x runs left to right under RTL too. */
function stepOf(key: string): ScatterStep | undefined {
  switch (key) {
    case "ArrowRight":
      return "next";
    case "ArrowLeft":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** Each model's spatial index, built on the first pointer move after a data change. */
const indexes = new WeakMap<ScatterModel, PointIndex>();

/** A model's spatial index, built once per model over shares of its own domains. */
function indexOf(model: ScatterModel): PointIndex {
  const known = indexes.get(model);
  if (known !== undefined) return known;
  const index = buildPointIndex(pointShares(model));
  indexes.set(model, index);
  return index;
}

/** A domain's span, or 1 for an empty one, as `pointShares` divides by. */
function spanOf(domain: readonly [number, number]): number {
  return domain[1] - domain[0] || 1;
}

/**
 * The point under a client point, wherever the pointer is, the one query the plot's surface and the
 * tooltip popup share. The pointer maps through the domains the marks draw under now, which glide
 * on a data update, into shares of the model's domains, which the index holds, and the hit radius
 * measures in the pixels the marks draw at, so a point is found where it shows.
 *
 * @param context - The Root's model and its domain glide.
 * @param surface - The plot's surface, whose client box spans the plot, or null before it mounts.
 * @param event - The pointer's client point and type.
 * @returns The point id, or -1 when none lies within the hit radius.
 */
export function pickPoint(
  context: Pick<ScatterRootContextValue, "model" | "glide">,
  surface: Element | null,
  event: { readonly clientX: number; readonly clientY: number; readonly pointerType: string }
): number {
  const { model } = context;
  if (surface === null || model.empty) return -1;
  const box = surface.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return -1;
  const drawn: ScatterDomains = context.glide.get();
  const [mx0, mx1] = model.x.domain;
  const [my0, my1] = model.y.domain;
  const dataX = drawn.x[0] + ((event.clientX - box.left) / box.width) * spanOf(drawn.x);
  const dataY = drawn.y[0] + (1 - (event.clientY - box.top) / box.height) * spanOf(drawn.y);
  const coarse = event.pointerType === "touch" || event.pointerType === "pen";
  return nearestPoint(
    indexOf(model),
    {
      x: (dataX - mx0) / spanOf([mx0, mx1]),
      y: (dataY - my0) / spanOf([my0, my1]),
      // A share of the model's domain spans this many drawn pixels.
      width: (box.width * spanOf([mx0, mx1])) / spanOf(drawn.x),
      height: (box.height * spanOf([my0, my1])) / spanOf(drawn.y),
    },
    coarse ? HIT_RADIUS.coarse : HIT_RADIUS.fine
  );
}

/**
 * A touch or pen tap at a client point, wherever it lands, the plot or the popup over it: it
 * records the input, picks the point under it through `pickPoint` in the current model and drawn
 * frame, and presses it.
 *
 * @param context - The Root.
 * @param surface - The plot's surface.
 * @param event - The tap's client point and pointer type.
 */
export function tapPoint(
  context: Pick<ScatterRootContextValue, "model" | "store" | "glide">,
  surface: Element | null,
  event: { readonly clientX: number; readonly clientY: number; readonly pointerType: string }
): void {
  context.store.press(context.model, trackedPick(context, surface, event));
}

/**
 * Record the pointer's position and type, then pick the point under it through `pickPoint`, as
 * every pointer event the plot or its popup acts on does.
 *
 * @param context - The Root.
 * @param surface - The plot's surface.
 * @param event - The pointer's client point and type.
 * @returns The point id, or -1 when none lies within the hit radius.
 */
function trackedPick(
  context: Pick<ScatterRootContextValue, "model" | "store" | "glide">,
  surface: Element | null,
  event: { readonly clientX: number; readonly clientY: number; readonly pointerType: string }
): number {
  context.store.track(event.clientX, event.clientY, event.pointerType);
  return pickPoint(context, surface, event);
}

/**
 * The plot's single tab stop, the listbox of `chart-listbox.tsx`, whose one option names the walk's
 * place. The point and the focus it names live in the store, so a data update carries them in the
 * one transition Root runs, and an option is only its element. The surface is also the plot's one
 * pointer target. A pointer picks the nearest point through `pickPoint` and never moves focus or
 * the place.
 */
export function ScatterSurface({
  labelledBy,
}: {
  readonly labelledBy: string | undefined;
}): ReactElement | null {
  const context = useScatterRoot("ScatterChart.Root");
  const { model, store, id, locale, name } = context;
  const listbox = useRef<HTMLDivElement>(null);
  const handoff = useOptionHandoff(id, listbox, () => ({}));
  /**
   * Whether a touch or pen press is under way. It holds no point id, since a data update may land
   * between the press and its lift.
   */
  const pressing = useRef(false);
  const lift = useTapLift();
  const frame = useScatterFrame(context);
  const pinned = useScatterStore(store, (snapshot) => snapshot.pinned);
  const { place, focus } = useWalkPlace(context);
  useGestureEnd(place !== null, lift, pressing, false);

  const current = handoff.current;
  if (place === null || current === undefined) return null;

  /** The walk in the current model, as an event finds it. */
  const walk = () => walkOf(store.get(), model);

  const move = (point: number, nextFocus: number): void => {
    handoff.step({});
    store.step(model, point, nextFocus);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "option") return;
    const now = walk();
    const at = now.place ?? place;
    const step = stepOf(event.key);
    const seriesStep = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step !== undefined) {
      move(stepPoint(model, at, now.focus, step), now.focus);
    } else if (seriesStep !== 0) {
      // The focus cycles "all series" first, then each series with points, in config order.
      const drawn = [
        -1,
        ...model.series.flatMap(({ xs, seriesIndex }) => (xs.length > 0 ? [seriesIndex] : [])),
      ];
      const index = drawn.indexOf(now.focus);
      const nextFocus = drawn[Math.max(0, Math.min(drawn.length - 1, index + seriesStep))] ?? -1;
      if (nextFocus !== now.focus) move(focusPoint(model, at, nextFocus), nextFocus);
    } else if (event.key === "Enter" || event.key === " ") {
      store.togglePin(model);
    } else if (event.key === "Escape") {
      const snapshot = store.get();
      if (snapshot.active === null && !snapshot.pinned) return;
      // The one dismissal, which a pointer that stays on the point does not undo.
      store.dismiss(model);
      event.stopPropagation();
    } else {
      return;
    }
    event.preventDefault();
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event)) {
      // The old option leaves in the commit after the new one took focus.
      handoff.prune();
      return;
    }
    // A tap focuses the option after its lift, and the point the finger picked stays active.
    if (lift.tapFocus() || pressing.current) return;
    store.enter(model);
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (handoff.within(event) || handoff.kept(event)) return;
    if (!lift.tapFocus() && !pressing.current) store.release();
    // The next entry meets a new option that carries the description again.
    handoff.reset({});
  };

  const pointAt = (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>): number =>
    trackedPick(context, event.currentTarget, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: "pointerType" in event ? event.pointerType : "mouse",
    });

  const naming = { id, name, labelledBy, locale };
  const placed = pointOf(model, place);
  const centre = frame === null ? null : dotCentre(frame, placed.x, placed.y, 0);
  const { position, size } = walkPosition(model, place, focus);
  const label = scatterOptionName(context, place);

  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      role="listbox"
      {...listboxProps(naming, pinned, "horizontal")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={(event) => {
        // A touch's moves pick as it scrubs, and its lift pins.
        store.hover(model, pointAt(event));
      }}
      onMouseDown={() => {
        lift.mouseDown();
      }}
      onPointerDown={(event) => {
        lift.press();
        if (event.pointerType === "mouse") return;
        pressing.current = true;
        // A new tap ends a dismissal, so a third tap on the same point opens the tooltip again.
        store.reopen();
        store.hover(model, pointAt(event));
      }}
      onPointerUp={(event) => {
        const started = pressing.current;
        pressing.current = false;
        if (event.pointerType === "mouse" || !started) return;
        lift.lift();
        // A lift picks its point in the model and frame of the lift, and pins it, and on the
        // pinned point or on empty plot it dismisses.
        tapPoint(context, event.currentTarget, event);
      }}
      onPointerCancel={() => {
        pressing.current = false;
      }}
      onPointerLeave={(event) => {
        // A pointer that moves into the tooltip keeps the point, so the popup stays hoverable.
        const intoPopup =
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('[data-slot="chart-tooltip"]') !== null;
        if (intoPopup || event.pointerType !== "mouse") return;
        store.leave();
      }}
      onClick={(event) => {
        // A touch or pen press already acted on its lift, so only a mouse click and a keyboard or
        // assistive click, which reports a detail of 0, act here.
        if (!lift.clickActs(event)) return;
        // A tap or a click pins the point under the pointer, and on the pinned point dismisses it.
        if (event.detail === 0) {
          store.press(model, walk().active ?? place);
          return;
        }
        store.press(model, pointAt(event));
      }}>
      <SurfaceName {...naming} />
      {handoff.options.map((option) => (
        // Once the plot is measured, the option covers the place's point, where a touch reader's
        // double tap lands. An outgoing option names the same point until it leaves.
        <div
          key={option.id}
          id={option.id}
          // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- nothing is selectable, so options mark no selection
          role="option"
          data-slot="chart-scatter-option"
          data-focus-ring-control=""
          tabIndex={option === current ? 0 : -1}
          aria-label={label}
          aria-posinset={position}
          aria-setsize={size}
          aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
          style={
            centre === null
              ? undefined
              : { "--chart-option-x": `${String(centre.x)}px`, "--chart-option-y": `${String(centre.y)}px` }
          }
        />
      ))}
    </div>
  );
}

/** Root's status region, which announces what Root's store says. */
export function ScatterStatus(): ReactElement {
  const { store } = useScatterRoot("ScatterChart.Root");
  const text = useScatterStore(store, (snapshot) => snapshot.announcement.text);
  const count = useScatterStore(store, (snapshot) => snapshot.announcement.count);
  return <StatusRegion text={text} count={count} />;
}

Object.assign(ScatterSurface, { displayName: "ScatterChart.Root.Surface" });
Object.assign(ScatterStatus, { displayName: "ScatterChart.Root.Status" });
