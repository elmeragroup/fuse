"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from "react";

import { withinFocusRingClass } from "../../styles/utils";
import { useTapLift } from "./chart-tap-lift";
import { CHART_STRINGS } from "./format/chart-strings";
import type { ScatterDomains } from "./layout/domain-glide";
import { buildPointIndex, nearestPoint } from "./layout/point-index";
import type { PointIndex } from "./layout/point-index";
import { dotCentre } from "./layout/scatter-frame";
import { focusPoint, pointOf, pointShares, stepPoint, walkPosition } from "./layout/scatter-model";
import type { ScatterModel, ScatterStep } from "./layout/scatter-model";
import { useScatterFrame, useScatterRoot, useWalk, walkOf } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { useScatterStore } from "./scatter-chart-store";
import { scatterOptionName } from "./scatter-chart-text";

/**
 * The hit radius in CSS pixels around the pointer, inside which the nearest point becomes active:
 * a 48 px catchment for a mouse, and 64 px for a finger or a pen, whose contact point is coarse.
 * Both reach well past the 24 px target floor, so a lone point is easy to hit.
 */
const HIT_RADIUS = { fine: 24, coarse: 32 } as const;

/**
 * One rendered option. The point and the focus it names live in the store, as the walk's place,
 * so a data update carries them in the one transition Root runs. An option is only its element.
 */
type OptionState = {
  readonly id: string;
  /** True for the option that receives focus from outside, which carries the description. */
  readonly entry: boolean;
};

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
  context.store.track(event.clientX, event.clientY, event.pointerType);
  context.store.press(context.model, pickPoint(context, surface, event));
}

/**
 * The plot's single tab stop. A `listbox` over the plot holds exactly one `option`, the walk's
 * place, and that option holds DOM focus. Each step renders the next option beside the current
 * one, focuses it in a layout effect and removes the old one in the next commit, so focus never
 * passes through `body`. The surface is also the plot's one pointer target. A pointer picks the
 * nearest point through `pickPoint` and never moves focus or the place.
 */
export function ScatterSurface({
  name,
  labelledBy,
}: {
  readonly name: string | undefined;
  readonly labelledBy: string | undefined;
}): ReactElement | null {
  const context = useScatterRoot("ScatterChart.Root");
  const { model, store, id, locale } = context;
  const counter = useRef(0);
  const nextId = (): string => {
    counter.current += 1;
    return `${id}-option-${String(counter.current)}`;
  };
  const [options, setOptions] = useState<readonly OptionState[]>(() => [
    { id: `${id}-option-0`, entry: true },
  ]);
  const focusTarget = useRef<string | null>(null);
  /**
   * Whether a touch or pen press is under way. It holds no point id, since a data update may land
   * between the press and its lift.
   */
  const pressing = useRef(false);
  const lift = useTapLift();
  const listbox = useRef<HTMLDivElement>(null);
  const frame = useScatterFrame(context);
  const pinned = useScatterStore(store, (snapshot) => snapshot.pinned);
  const { place, focus } = useWalk(context);
  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (target === null) return;
    focusTarget.current = null;
    listbox.current
      ?.querySelector<HTMLElement>(`[id="${CSS.escape(target)}"]`)
      ?.focus({ preventScroll: true });
  });

  // An empty model takes the surface's element away, mid-press too, so no later press inherits the
  // gesture: the element's cleanup ends it.
  const shown = place !== null;
  useLayoutEffect(
    () =>
      shown
        ? () => {
            pressing.current = false;
            lift.press();
          }
        : undefined,
    [shown, lift]
  );

  const current = options.at(-1);
  if (place === null || current === undefined) return null;

  /** The walk in the current model, as an event finds it. */
  const walk = () => walkOf(store.get(), model);

  const move = (point: number, nextFocus: number): void => {
    const next = { id: nextId(), entry: false };
    focusTarget.current = next.id;
    setOptions((list) => [...list.slice(-1), next]);
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
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      // The old option leaves in the commit after the new one took focus.
      if (options.length > 1) setOptions((list) => list.slice(-1));
      return;
    }
    // A tap focuses the option after its lift, and the point the finger picked stays active.
    if (lift.tapFocus() || pressing.current) return;
    store.enter(model);
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    if (!lift.tapFocus() && !pressing.current) store.release();
    // The next entry meets a new option that carries the description again.
    setOptions([{ id: nextId(), entry: true }]);
  };

  const pointAt = (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>): number => {
    const pointerType = "pointerType" in event ? event.pointerType : "mouse";
    store.track(event.clientX, event.clientY, pointerType);
    return pickPoint(context, event.currentTarget, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType,
    });
  };

  /** A tap or a click: it pins the point under the pointer, and on the pinned point dismisses it. */
  const press = (point: number): void => {
    store.press(model, point);
  };

  const strings = CHART_STRINGS[locale];
  const placed = pointOf(model, place);
  const centre = frame === null ? null : dotCentre(frame, placed.x, placed.y, 0);
  const { position, size } = walkPosition(model, place, focus);
  const label = scatterOptionName(context, place);

  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      id={`${id}-surface`}
      role="listbox"
      data-slot="chart-surface"
      data-pinned={pinned ? "" : undefined}
      aria-orientation="horizontal"
      {...(labelledBy === undefined
        ? { "aria-label": strings.surfaceName(name ?? "") }
        : { "aria-labelledby": `${labelledBy} ${id}-surface-name` })}
      className={withinFocusRingClass}
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
        if (event.detail === 0) {
          press(walk().active ?? place);
          return;
        }
        press(pointAt(event));
      }}>
      {labelledBy === undefined ? null : (
        <span id={`${id}-surface-name`} hidden>
          {strings.surfaceName("").replace(/^,\s*/u, "")}
        </span>
      )}
      {options.map((option) => (
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

/**
 * Root's status region. It is mounted empty on the server and never unmounts. A repeated message
 * gets an alternating trailing U+00A0, so the region announces it again.
 */
export function ScatterStatus(): ReactElement {
  const { store } = useScatterRoot("ScatterChart.Root");
  const text = useScatterStore(store, (snapshot) => snapshot.announcement.text);
  const count = useScatterStore(store, (snapshot) => snapshot.announcement.count);
  return (
    <div role="status" data-slot="chart-status">
      {text === "" ? "" : `${text}${count % 2 === 0 ? " " : ""}`}
    </div>
  );
}

Object.assign(ScatterSurface, { displayName: "ScatterChart.Root.Surface" });
Object.assign(ScatterStatus, { displayName: "ScatterChart.Root.Status" });
