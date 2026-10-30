"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from "react";

import { withinFocusRingClass } from "../../styles/utils";
import { useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { useRootFrame } from "./chart-plot";
import { useChartStore } from "./chart-store";
import { optionName } from "./chart-text";
import type { OptionOrder } from "./chart-text";
import { CHART_STRINGS } from "./format/chart-strings";
import { bandScale, nearestIndex, pointScale } from "./layout/band-scale";
import { invertValue, linearScale } from "./layout/linear-scale";
import { nearestSeries } from "./layout/nearest-series";
import { optionBand } from "./layout/plot-frame";
import { keepSlot, stepSlot } from "./layout/slot-window";
import type { SlotStep, SlotWindow } from "./layout/slot-window";
import { slotX } from "./layout/x-domain";

/**
 * The fallback pattern of CONTRACT section 9.1 changes only this module. There the listbox takes
 * `tabIndex={0}` and DOM focus, the single option loses its tab index, and the listbox sets
 * `aria-activedescendant` to the option's id. Names, positions, descriptions, keys and the status
 * region stay as they are, so a switch ships as a patch with no public change.
 */

/** The slot under a pointer and the series nearest to it, or null when none draws there. */
export type PointerSlot = { readonly slot: number; readonly near: number | null };

/**
 * A touch or pen press in progress: whether a tooltip was pinned, the slot it landed on, and
 * whether that slot's tooltip already showed under a LegendToggleGroup.
 */
type Gesture = { readonly pinned: boolean; readonly slot: number; readonly shown: boolean };

/** One rendered option. Its x, not its index, survives a data update. */
type OptionState = {
  readonly id: string;
  readonly x: string | Date;
  /** The focused series by config order, or -1 for all series. */
  readonly focus: number;
  readonly order: OptionOrder;
  /** True for the option that receives focus from outside, which carries the description. */
  readonly entry: boolean;
};

/**
 * The slot move a key makes. Arrow directions are physical, so time runs left to right under
 * `dir="rtl"` too, and horizontal bars list their categories top to bottom.
 */
function slotStepOf(orientation: "vertical" | "horizontal", key: string): SlotStep | undefined {
  switch (key) {
    case "ArrowRight":
      return orientation === "vertical" ? "next" : undefined;
    case "ArrowLeft":
      return orientation === "vertical" ? "previous" : undefined;
    case "ArrowDown":
      return orientation === "horizontal" ? "next" : undefined;
    case "ArrowUp":
      return orientation === "horizontal" ? "previous" : undefined;
    case "PageDown":
      return "page-next";
    case "PageUp":
      return "page-previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
}

/** The series-focus move a key makes, across the axis the slots run along. */
function seriesStepOf(orientation: "vertical" | "horizontal", key: string): 1 | -1 | undefined {
  if (orientation === "vertical") return key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : undefined;
  return key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : undefined;
}

/** The layout under the pointer: its config keys, its value domain and its plot's client span. */
type PickedLayout = {
  readonly keys: readonly string[];
  readonly domain: readonly [number, number];
  /** The plot's client span across the value axis, its top or left edge and its length. */
  readonly start: number;
  readonly length: number;
};

/**
 * The layout a pointer's value-axis position falls in: the Panel whose plot holds it, or the
 * nearest Panel when it lies in a gap or an axis row, and the default layout without Panels.
 */
function layoutUnder(context: ChartRootContextValue, box: DOMRect, clientY: number): PickedLayout {
  const { model, orientation, panels, domains } = context;
  const whole: PickedLayout = {
    keys: model.series.map(({ key }) => key),
    domain: model.y.domain,
    start: orientation === "vertical" ? box.top : box.left,
    length: orientation === "vertical" ? box.height : box.width,
  };
  let best: PickedLayout | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const { layout, plot } of panels) {
    const rect = plot()?.getBoundingClientRect();
    if (rect === undefined) continue;
    const gap = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    if (gap >= distance) continue;
    distance = gap;
    const first = layout.keys[0];
    best = {
      keys: layout.keys,
      domain: (first === undefined ? undefined : domains.get(first)) ?? [0, 1],
      start: rect.top,
      length: rect.height,
    };
  }
  return best ?? whole;
}

/**
 * The slot and the nearest series under a client point, picked by arithmetic over the plot box.
 * The surface and the tooltip popup both read it, so a pointer over the popup picks as the plot
 * does. With Panels the pointer's y picks the Panel under it, and the nearest series comes from
 * that Panel's series alone, as CONTRACT section 9.5 says.
 *
 * @param context - The Root.
 * @param box - The plot surface's client box.
 * @param clientX - The pointer's client x.
 * @param clientY - The pointer's client y.
 * @returns The slot and the nearest series.
 */
export function pointerSlot(
  context: ChartRootContextValue,
  box: DOMRect,
  clientX: number,
  clientY: number
): PointerSlot {
  const { model, orientation } = context;
  const window = model.window ?? { first: 0, last: 0 };
  const count = window.last - window.first + 1;
  const along =
    orientation === "vertical"
      ? (clientX - box.left) / Math.max(1, box.width)
      : (clientY - box.top) / Math.max(1, box.height);
  const scale =
    context.xScale === "point" ? pointScale({ count, range: [0, 1] }) : bandScale({ count, range: [0, 1] });
  const slot = window.first + nearestIndex(scale, Math.min(Math.max(along, 0), 1));
  const layout = layoutUnder(context, box, clientY);
  const across =
    orientation === "vertical"
      ? 1 - (clientY - layout.start) / Math.max(1, layout.length)
      : (clientX - layout.start) / Math.max(1, layout.length);
  const value = invertValue(linearScale(layout.domain, [0, 1]), across);
  const members = model.series.filter(({ key }) => layout.keys.includes(key));
  const drawn = members.map(({ extents, readings }) => {
    const extent = extents[slot];
    if (!extent || readings[slot]?.kind !== "reading") return null;
    return extent[0] < 0 && extent[1] <= 0 ? extent[0] : extent[1];
  });
  const near = members[nearestSeries(drawn, value)]?.seriesIndex;
  return { slot, near: near ?? null };
}

/** Whether two slot x values name the same slot. */
function sameX(a: string | Date, b: string | Date): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}

/** The slot an option names in the current model, which keeps its x across data updates. */
function slotOfOption(context: ChartRootContextValue, window: SlotWindow, option: OptionState): number {
  return keepSlot(context.model.domain, window, option.x);
}

/**
 * The plot's single tab stop. A `listbox` over the plot holds exactly one `option`, the active
 * one, and that option holds DOM focus. Each step renders the next option beside the current one,
 * focuses it in a layout effect and removes the old one in the next commit, so focus never passes
 * through `body`. The surface is also the plot's one pointer target. A pointer picks the slot by
 * arithmetic and never moves focus or changes the option.
 */
export function ChartSurface({
  name,
  labelledBy,
}: {
  readonly name: string | undefined;
  readonly labelledBy: string | undefined;
}): ReactElement | null {
  const context = useChartRoot("Chart.Root");
  const { model, store, id, orientation, locale } = context;
  const window = model.window;
  const counter = useRef(0);
  const nextId = (): string => {
    counter.current += 1;
    return `${id}-option-${String(counter.current)}`;
  };
  const entrySlot = store.initial.active ?? window?.first ?? 0;
  const [options, setOptions] = useState<readonly OptionState[]>(() => [
    { id: `${id}-option-0`, x: slotX(model.domain, entrySlot), focus: -1, order: "slot-first", entry: true },
  ]);
  const focusTarget = useRef<string | null>(null);
  /** Whether the current press started while a tooltip was pinned, which a touch lift reads. */
  const gesture = useRef<Gesture | null>(null);
  /**
   * Whether a touch or pen lift just acted. WebKit follows a tap with a click whose pointer type
   * reads "mouse", so the flag keeps that click from acting twice, and the focus that follows a
   * tap keeps the slot the finger picked.
   */
  const lifted = useRef(false);
  const listbox = useRef<HTMLDivElement>(null);
  const drawn = useRootFrame("Chart.Root");
  const pinned = useChartStore(store, (snapshot) => snapshot.pinned);
  const emphasis = useChartStore(store, (snapshot) => snapshot.emphasis);
  // One canonical active identity. When new data or a new window drops the option's slot, the
  // option takes the slot Root falls back to, as Root's store does, and a focused series that
  // leaves the config gives way to all series.
  const [seen, setSeen] = useState(() => ({ model, keys: model.series.map(({ key }) => key) }));
  if (seen.model !== model) {
    const keys = model.series.map(({ key }) => key);
    setSeen({ model, keys });
    const latest = options.at(-1);
    if (latest !== undefined && model.window !== null) {
      const x = slotX(model.domain, keepSlot(model.domain, model.window, latest.x));
      const focusKey = latest.focus === -1 ? undefined : seen.keys[latest.focus];
      const focus = focusKey === undefined ? -1 : keys.indexOf(focusKey);
      if (!sameX(x, latest.x) || focus !== latest.focus) {
        setOptions([...options.slice(0, -1), { ...latest, x, focus }]);
      }
    }
  }
  useLayoutEffect(() => {
    // The store's series focus follows the reconciled option while the keyboard drives it.
    const latest = options.at(-1);
    const snapshot = store.get();
    if (latest === undefined || snapshot.source !== "keyboard") return;
    const near = latest.focus === -1 ? null : latest.focus;
    if (snapshot.near !== near) store.set({ near });
  }, [options, store]);

  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (target === null) return;
    focusTarget.current = null;
    listbox.current
      ?.querySelector<HTMLElement>(`[id="${CSS.escape(target)}"]`)
      ?.focus({ preventScroll: true });
  });

  if (window === null || model.empty) return null;
  const current = options.at(-1) ?? options[0];
  if (current === undefined) return null;
  const count = window.last - window.first + 1;
  const keys = model.series.length;

  const move = (patch: Partial<Pick<OptionState, "x" | "focus" | "order">>): void => {
    const next: OptionState = { ...current, ...patch, id: nextId(), entry: false };
    focusTarget.current = next.id;
    setOptions((list) => [...list.slice(-1), next]);
    store.set({
      active: slotOfOption(context, window, next),
      source: "keyboard",
      near: next.focus === -1 ? null : next.focus,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "option") return;
    const slot = slotOfOption(context, window, current);
    const step = slotStepOf(orientation, event.key);
    const seriesStep = seriesStepOf(orientation, event.key);
    if (step !== undefined) {
      move({ x: slotX(model.domain, stepSlot(window, slot, step)), order: "slot-first" });
    } else if (seriesStep !== undefined) {
      const focus = Math.max(-1, Math.min(keys - 1, current.focus + seriesStep));
      if (keys > 1 && focus !== current.focus) move({ focus, order: "series-first" });
    } else if (event.key === "Enter" || event.key === " ") {
      if (context.hasToggles()) {
        // With a LegendToggleGroup mounted, Enter selects the focused series and clears it under "all series".
        const key = current.focus === -1 ? null : (model.series[current.focus]?.key ?? null);
        context.select(key === context.selectedKey ? null : key, "keyboard", event.nativeEvent);
      } else {
        store.set({ pinned: !store.get().pinned, active: slot, source: "keyboard" });
      }
    } else if (event.key === "Escape") {
      const snapshot = store.get();
      if (snapshot.active === null && !snapshot.pinned) return;
      store.set({ active: null, source: null, near: null, pinned: false });
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
    // A tap focuses the option after its lift, at the point Chromium's touch adjustment moved it
    // to, which may be another slot's option. The slot the finger's own point picked stays active.
    if (lifted.current || gesture.current !== null) return;
    store.set({
      active: slotOfOption(context, window, current),
      source: "keyboard",
      near: current.focus === -1 ? null : current.focus,
    });
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    // A tap on the plot moves focus off an option that an earlier tap focused, and the slot it
    // pinned stays.
    const tapped = lifted.current || gesture.current !== null;
    if (!tapped && (store.get().source === "keyboard" || store.get().pinned)) {
      store.set({ active: null, source: null, near: null, pinned: false });
    }
    // The next entry meets a new option that carries the description again.
    setOptions([{ ...current, id: nextId(), entry: true, order: "slot-first" }]);
  };

  /** The slot and the nearest series under a pointer, picked by arithmetic. */
  const slotAt = (event: MouseEvent<HTMLDivElement>): PointerSlot =>
    pointerSlot(context, event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);

  const pick = (event: PointerEvent<HTMLDivElement>): void => {
    store.track(event.clientX, event.clientY, event.pointerType);
    const { pinned: isPinned, dismissed } = store.get();
    if (isPinned) return;
    const { slot, near } = slotAt(event);
    // A dismissed tooltip stays closed while the pointer stays on its slot.
    if (dismissed === slot) return;
    store.set({ active: slot, source: "pointer", near });
  };

  /**
   * A tap or a click on the plot. It pins the slot under the pointer, and on the pinned slot it
   * takes the one dismissal. Under a LegendToggleGroup it selects the nearest series instead.
   */
  const press = (
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    slot: number,
    shown = false
  ): void => {
    const snapshot = store.get();
    // Under a LegendToggleGroup a touch reader selects through the toggles, so a second tap on
    // the slot whose tooltip shows dismisses it, as CONTRACT section 9.5's Touch rule says.
    if (shown) {
      store.dismiss();
      return;
    }
    if (context.hasToggles()) {
      const key = snapshot.near === null ? null : (model.series[snapshot.near]?.key ?? null);
      context.select(key === context.selectedKey ? null : key, "plot", event.nativeEvent);
      return;
    }
    if (snapshot.pinned && snapshot.active === slot) store.dismiss();
    else store.set({ active: slot, source: "pointer", pinned: true });
  };

  const strings = CHART_STRINGS[locale];

  return (
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the active option holds the one tab stop
    <div
      ref={listbox}
      id={`${id}-surface`}
      role="listbox"
      data-slot="chart-surface"
      data-pinned={pinned ? "" : undefined}
      aria-orientation={orientation === "vertical" ? "horizontal" : "vertical"}
      {...(labelledBy === undefined
        ? { "aria-label": strings.surfaceName(name ?? "") }
        : { "aria-labelledby": `${labelledBy} ${id}-surface-name` })}
      className={withinFocusRingClass}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={pick}
      // The span the surface covers can trail a move no commit or resize reported, so a pointer
      // that arrives places it again first.
      onPointerEnter={() => context.placeSpan()}
      onPointerDown={(event) => {
        lifted.current = false;
        if (event.pointerType === "mouse") return;
        const snapshot = store.get();
        const { slot } = slotAt(event);
        gesture.current = {
          pinned: snapshot.pinned,
          slot,
          shown: context.hasToggles() && snapshot.source === "pointer" && snapshot.active === slot,
        };
        // A new tap ends a dismissal, so a third tap on the same slot opens the tooltip again.
        if (snapshot.dismissed !== null) store.set({ dismissed: null });
        pick(event);
      }}
      onPointerUp={(event) => {
        // A touch or pen lift pins the slot it ended on, and a tap on the pinned slot dismisses it.
        const started = gesture.current;
        gesture.current = null;
        if (event.pointerType === "mouse" || started === null) return;
        const snapshot = store.get();
        const slot = started.pinned ? started.slot : snapshot.active;
        if (slot === null) return;
        lifted.current = true;
        press(event, slot, started.shown && slot === started.slot);
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onPointerLeave={(event) => {
        // A pointer that moves into the tooltip keeps the slot, so the popup stays hoverable.
        const intoPopup =
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('[data-slot="chart-tooltip"]') !== null;
        if (
          !intoPopup &&
          event.pointerType === "mouse" &&
          store.get().source === "pointer" &&
          !store.get().pinned
        ) {
          store.set({ active: null, source: null, near: null });
        }
        // Leaving the plot ends a dismissal, so re-entering the same slot opens the popup again.
        if (!intoPopup && event.pointerType === "mouse" && store.get().dismissed !== null) {
          store.set({ dismissed: null });
        }
      }}
      onClick={(event) => {
        // A touch or pen press already acted on its lift, so only a mouse click and a keyboard
        // or assistive click, which reports a detail of 0, act here.
        const native = event.nativeEvent;
        if (native instanceof globalThis.PointerEvent && native.pointerType !== "mouse" && event.detail > 0)
          return;
        const afterTap = lifted.current && event.detail > 0;
        lifted.current = false;
        if (afterTap) return;
        if (event.detail === 0) {
          const { active } = store.get();
          if (active !== null) press(event, active);
          return;
        }
        press(event, slotAt(event).slot);
      }}>
      {labelledBy === undefined ? null : (
        <span id={`${id}-surface-name`} hidden>
          {strings.surfaceName("").replace(/^,\s*/u, "")}
        </span>
      )}
      {options.map((option) => {
        const slot = slotOfOption(context, window, option);
        const isCurrent = option === current;
        // Once the plot is measured, the option covers its slot's pixel columns, the same ones as
        // the crosshair band and the tooltip anchor.
        const band =
          drawn === null ? undefined : optionBand(drawn.frame, slot - window.first, context.xScale);
        return (
          <div
            key={option.id}
            id={option.id}
            // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- the legend owns selection, so options mark none
            role="option"
            data-slot="chart-point"
            data-focus-ring-control=""
            tabIndex={isCurrent ? 0 : -1}
            aria-label={optionName(context, slot, option.focus, option.order, emphasis)}
            aria-posinset={slot - window.first + 1}
            aria-setsize={count}
            aria-describedby={option.entry ? `${id}-description ${id}-instructions` : undefined}
            style={{
              "--chart-col": slot - window.first + 1,
              "--chart-option-start": band === undefined ? undefined : `${String(band[0])}px`,
              "--chart-option-size": band === undefined ? undefined : `${String(band[1] - band[0])}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Root's status region. It is mounted empty on the server and never unmounts. A repeated message
 * gets an alternating trailing U+00A0, so the region announces it again.
 */
export function ChartStatus(): ReactElement {
  const { store } = useChartRoot("Chart.Root");
  const text = useChartStore(store, (snapshot) => snapshot.announcement.text);
  const count = useChartStore(store, (snapshot) => snapshot.announcement.count);
  return (
    <div role="status" data-slot="chart-status">
      {text === "" ? "" : `${text}${count % 2 === 0 ? " " : ""}`}
    </div>
  );
}

Object.assign(ChartSurface, { displayName: "Chart.Root.Surface" });
Object.assign(ChartStatus, { displayName: "Chart.Root.Status" });
