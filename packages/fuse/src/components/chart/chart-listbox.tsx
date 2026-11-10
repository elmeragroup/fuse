"use client";

/**
 * The listbox every chart family's plot surface is: the plot's single tab stop, a `listbox` over the
 * plot that holds exactly one `option`, the active datum's, and that option holds DOM focus. Each
 * step renders the next option beside the current one, focuses it in a layout effect and removes
 * the old one in the next commit, so focus never passes through `body`. Each family's surface keeps
 * its own listbox element where its Root mounts it, with its own keys, pick and option names, and
 * reads the handoff, the naming and the status region from here.
 *
 * The fallback pattern of CONTRACT section 9.1 changes only the families' surfaces and this module.
 * There the listbox takes `tabIndex={0}` and DOM focus, the single option loses its tab index, and
 * the listbox sets `aria-activedescendant` to the option's id. Names, positions, descriptions, keys
 * and the status region stay as they are, so a switch ships as a patch with no public change.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, ReactElement, RefObject } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { withinFocusRingClass } from "../../styles/utils";
import type { TapLift } from "./chart-tap-lift";
import { CHART_STRINGS } from "./format/chart-strings";

/** One rendered option: the family's own state, its element id, and whether it carries the description. */
export type HandoffOption<T extends object> = T & {
  readonly id: string;
  /** True for the option that receives focus from outside, which carries the description. */
  readonly entry: boolean;
};

/** A surface's options and the moves that hand focus from one to the next. */
export type OptionHandoff<T extends object> = {
  /** The rendered options: the current one, and while a step lands, the one it leaves. */
  readonly options: readonly HandoffOption<T>[];
  /** The option that holds the tab stop. */
  readonly current: HandoffOption<T> | undefined;
  /** Render the next option beside the current one, and focus it once it commits. */
  readonly step: (state: T) => void;
  /** Replace the current option's state in place, keeping its id, as a data update reconciles it. */
  readonly revise: (state: T) => void;
  /**
   * Whether a focus event moved focus between the listbox's own options. On focus that is a step
   * landing, which the caller follows with `prune`.
   */
  readonly within: (event: FocusEvent<HTMLElement>) => boolean;
  /**
   * Whether a blur leaves the document's focus where it was, as when the window loses focus: the
   * option stays the active element, and the browser gives it focus back when the window returns.
   * A surface keeps its option and state through such a blur, so the option it gives back exists.
   */
  readonly kept: (event: FocusEvent<HTMLElement>) => boolean;
  /** Remove the option a step left, in the commit after the new one took focus. */
  readonly prune: () => void;
  /** Start over with one option that carries the description, for the next entry from outside. */
  readonly reset: (state: T) => void;
};

/**
 * The option handoff of a surface: an id counter under the Root's prefix, the current option and
 * the one a step leaves, and a layout effect that focuses a new option once it commits.
 *
 * @template T - The family's option state, such as a slot's x and the series focus.
 * @param id - The Root's id prefix.
 * @param listbox - The listbox element, which the focus moves inside.
 * @param initial - The first option's state.
 * @returns The handoff.
 */
export function useOptionHandoff<T extends object>(
  id: string,
  listbox: RefObject<HTMLDivElement | null>,
  initial: () => T
): OptionHandoff<T> {
  const counter = useRef(0);
  const nextId = (): string => {
    counter.current += 1;
    return `${id}-option-${String(counter.current)}`;
  };
  const [options, setOptions] = useState<readonly HandoffOption<T>[]>(() => [
    { ...initial(), id: `${id}-option-0`, entry: true },
  ]);
  const focusTarget = useRef<string | null>(null);
  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (target === null) return;
    focusTarget.current = null;
    listbox.current
      ?.querySelector<HTMLElement>(`[id="${CSS.escape(target)}"]`)
      ?.focus({ preventScroll: true });
  });
  const current = options.at(-1);
  return {
    options,
    current,
    step: (state) => {
      const next: HandoffOption<T> = { ...state, id: nextId(), entry: false };
      focusTarget.current = next.id;
      setOptions((list) => [...list.slice(-1), next]);
    },
    revise: (state) => {
      if (current === undefined) return;
      setOptions([...options.slice(0, -1), { ...state, id: current.id, entry: current.entry }]);
    },
    within: (event) =>
      event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget),
    kept: (event) => event.target === event.currentTarget.ownerDocument.activeElement,
    prune: () => {
      if (options.length > 1) setOptions((list) => list.slice(-1));
    },
    reset: (state) => {
      setOptions([{ ...state, id: nextId(), entry: true }]);
    },
  };
}

/**
 * End a surface's press when its element goes away. An empty model takes the surface's element
 * away, mid-press too, so no later press inherits the gesture: the element's cleanup ends it.
 *
 * @template G - The surface's record of a press in progress.
 * @param shown - Whether the surface's element renders.
 * @param lift - The surface's lift record.
 * @param gesture - The surface's press in progress.
 * @param idle - The record of no press.
 */
export function useGestureEnd<G>(shown: boolean, lift: TapLift, gesture: RefObject<G>, idle: G): void {
  useLayoutEffect(
    () =>
      shown
        ? () => {
            gesture.current = idle;
            lift.press();
          }
        : undefined,
    [shown, lift, gesture, idle]
  );
}

/** What names a surface: its Root's id prefix, `aria-label` or `aria-labelledby`, and locale. */
export type SurfaceNaming = {
  readonly id: string;
  /** The Root's `aria-label`, or undefined when `aria-labelledby` names the chart. */
  readonly name: string | undefined;
  /** The Root's `aria-labelledby`, or undefined. */
  readonly labelledBy: string | undefined;
  readonly locale: SupportedLocale;
};

/**
 * The listbox element's own attributes beside its `role`: its id, slot, pin state, orientation,
 * name and focus ring. With `aria-labelledby` on Root, the listbox reads the chart's name followed by its own
 * hidden name, which `SurfaceName` renders.
 *
 * @param naming - What names the surface.
 * @param pinned - Whether a tooltip is pinned.
 * @param orientation - The axis the options step along.
 * @returns The attributes to spread on the listbox element.
 */
export function listboxProps(naming: SurfaceNaming, pinned: boolean, orientation: "horizontal" | "vertical") {
  const { id, name, labelledBy, locale } = naming;
  return {
    id: `${id}-surface`,
    "data-slot": "chart-surface",
    "data-pinned": pinned ? "" : undefined,
    "aria-orientation": orientation,
    ...(labelledBy === undefined
      ? { "aria-label": CHART_STRINGS[locale].surfaceName(name ?? "") }
      : { "aria-labelledby": `${labelledBy} ${id}-surface-name` }),
    className: withinFocusRingClass,
  };
}

/**
 * The surface's own name, hidden, which the listbox's `aria-labelledby` reads after the chart's
 * name. It renders only under `aria-labelledby`.
 *
 * @param props - What names the surface.
 * @returns The hidden name, or null.
 */
export function SurfaceName({ id, labelledBy, locale }: SurfaceNaming): ReactElement | null {
  if (labelledBy === undefined) return null;
  return (
    <span id={`${id}-surface-name`} hidden>
      {CHART_STRINGS[locale].surfaceName("").replace(/^,\s*/u, "")}
    </span>
  );
}

/**
 * A Root's status region. It is mounted empty on the server and never unmounts. A repeated message
 * gets an alternating trailing U+00A0, so the region announces it again.
 *
 * @param props - The latest message and how many messages came before it.
 * @returns The region.
 */
export function StatusRegion({
  text,
  count,
}: {
  readonly text: string;
  readonly count: number;
}): ReactElement {
  return (
    <div role="status" data-slot="chart-status">
      {text === "" ? "" : `${text}${count % 2 === 0 ? "\u00a0" : ""}`}
    </div>
  );
}

Object.assign(SurfaceName, { displayName: "Chart.SurfaceName" });
Object.assign(StatusRegion, { displayName: "Chart.StatusRegion" });
