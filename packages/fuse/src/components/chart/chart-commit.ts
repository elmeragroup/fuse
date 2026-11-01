"use client";

/**
 * How Root classifies each change of its model, the one owner of `ChartUpdate`. Each render hands
 * the classifier Root's model and the inputs it came from, and the classifier keeps the commit it
 * saw last, so it tells a data update from a range step, a Panel's registration from either, and
 * decides which keys glide between two domains and whether the update relays the plot. Marks read
 * the result through Root's context and compare its identity to tell an update from a re-render.
 */
import { useState } from "react";

import type { ChartUpdate, PanelEntry } from "./chart-context";
import type { ChartMotion } from "./chart-motion";
import { layoutDomain } from "./layout/cartesian-model";
import type { CartesianModel } from "./layout/cartesian-model";
import { pathMotion } from "./layout/path-motion";
import { mountedSeries, relaysPlot } from "./layout/relay";
import { windowSlots } from "./layout/series-path";
import { pairSlotKeys } from "./layout/slot-keys";
import type { SlotKeys } from "./layout/slot-keys";

/** Each config key's layout value domain, by key. */
export type KeyDomains = ReadonlyMap<string, readonly [number, number]>;

/** One commit's motion facts, kept across renders so the next commit can compare. */
export type ChartCommit = {
  readonly model: CartesianModel;
  readonly data: unknown;
  readonly config: unknown;
  /** The steady range object, which changes only when the range names other values. */
  readonly range: unknown;
  readonly update: ChartUpdate;
  readonly keys: SlotKeys;
  /** The value domain of the layout each key draws in. */
  readonly domains: KeyDomains;
  /**
   * The keys whose layout's value domain moved since the motion loop last rested, so a tween that
   * glides one Panel between two domains leaves the other Panels alone. A domain that returns to
   * where it started mid-tween stays moved, because its marks still glide back.
   */
  readonly moved: ReadonlySet<string>;
};

/** What Root renders a commit from. */
export type CommitInputs = {
  readonly model: CartesianModel;
  /** Root's `data`, compared by identity, so new rows are a data update. */
  readonly data: unknown;
  /** Root's steady config, compared by identity. */
  readonly config: unknown;
  /** Root's steady range, compared by identity, so a new range alone is a range step. */
  readonly range: unknown;
  readonly domains: KeyDomains;
  readonly panels: readonly PanelEntry[];
  readonly orientation: "vertical" | "horizontal";
};

/** A mounted Bar's registration, which names the key it draws. */
type DrawnBar = { readonly key: string };

/**
 * The value domain each config key draws in: its Panel's, or the default layout's without Panels.
 * Root computes a Panel's domain from what the Panel registered, as the Panel computes it during
 * render, so both read the same model.
 *
 * @param model - Root's model.
 * @param stackOffset - Root's stack offset.
 * @param panels - The mounted Panels.
 * @returns Each key's domain.
 */
export function keyDomains(
  model: CartesianModel,
  stackOffset: "diverging" | "expand",
  panels: readonly PanelEntry[]
): KeyDomains {
  if (panels.length === 0) return new Map(model.series.map(({ key }) => [key, model.y.domain]));
  const stacked = { ...model, stackOffset };
  return new Map(
    panels.flatMap(({ layout }) => {
      const { domain } = layoutDomain(stacked, layout);
      return layout.keys.map((key) => [key, domain] as const);
    })
  );
}

/** Whether two key domain maps hold the same domain for a key. */
function sameDomain(a: KeyDomains, b: KeyDomains, key: string): boolean {
  const [lowA, highA] = a.get(key) ?? [0, 1];
  const [lowB, highB] = b.get(key) ?? [0, 1];
  return lowA === lowB && highA === highB;
}

/** The commit of Root's first render, which draws every mark in place. */
function firstCommit({ model, data, config, range, domains }: CommitInputs): ChartCommit {
  const keys = pairSlotKeys(null, model.domain);
  return {
    model,
    data,
    config,
    range,
    update: {
      kind: "initial",
      keys: keys.keys,
      relays: false,
      from: domains,
      mounted: new Set(),
      gliding: new Set(),
      layouts: { relays: false, moved: new Set() },
      window: { mode: "tween", by: 0 },
    },
    keys,
    domains,
    moved: new Set(),
  };
}

/** The commit after `seen` for this render's inputs, or `seen` itself when nothing changed. */
function nextCommit(
  seen: ChartCommit,
  inputs: CommitInputs,
  motion: Pick<ChartMotion, "running">,
  bars: ReadonlyMap<object, DrawnBar>
): ChartCommit {
  const { model, data, config, range, domains, panels, orientation } = inputs;
  if (seen.model === model && seen.domains === domains) return seen;
  const rangeOnly = seen.data === data && seen.config === config && seen.range !== range;
  const keys = pairSlotKeys(seen.keys, model.domain);
  // A layout's marks draw between two value domains while a tween that set out from another runs,
  // unless a Panel relayed the update that started it, which snapped every mark.
  const running = motion.running() && !seen.update.layouts.relays;
  const gliding = running ? new Set([...seen.moved, ...seen.update.layouts.moved]) : new Set<string>();
  // A Panel computes its domain from inputs Root sees only once it registers, so each Panel
  // decides whether an update moves its own domain as it commits, through
  // `reportLayoutDomain`. Root decides for its default layout, and leaves the Panels' keys where
  // they drew.
  const panelKeys = new Set(panels.flatMap(({ layout }) => layout.keys));
  const own = new Map(domains);
  for (const key of panelKeys) own.set(key, seen.domains.get(key) ?? domains.get(key) ?? [0, 1]);
  const drawn = new Set([...bars.values()].map(({ key }) => key));
  const relays =
    !rangeOnly &&
    relaysPlot(
      { model: seen.model, keys: seen.update.keys, domains: seen.domains },
      { model, keys: keys.keys, domains: own },
      orientation,
      gliding,
      drawn
    );
  // Panels that register leave the model alone, and their first domains are no update.
  const registered = seen.model === model;
  return {
    model,
    data,
    config,
    range,
    update: registered
      ? seen.update
      : {
          kind: rangeOnly ? "range" : "data",
          keys: keys.keys,
          relays,
          from: seen.domains,
          mounted: mountedSeries(
            { model: seen.model, keys: seen.update.keys },
            { model, keys: keys.keys },
            orientation,
            drawn
          ),
          gliding,
          layouts: { relays: false, moved: new Set() },
          window: pathMotion(windowSlots(seen.model, seen.update.keys), windowSlots(model, keys.keys)),
        },
    keys,
    domains,
    // A commit that snaps the marks lands them on its domains. One that only registers leaves the
    // running tweens alone, so their keys still glide. One that moves the marks adds the keys
    // whose domain it changes to those the tweens it interrupts still glide.
    moved:
      relays || rangeOnly
        ? new Set()
        : registered
          ? gliding
          : new Set([
              ...gliding,
              ...[...domains.keys()].filter(
                (key) => !panelKeys.has(key) && !sameDomain(seen.domains, domains, key)
              ),
            ]),
  };
}

/**
 * Root's commit for this render: the first one, or the one after the commit Root saw last, kept
 * until the model or the domains change again.
 *
 * @param inputs - Root's model and what it came from, its domains, its Panels and orientation.
 * @param motion - Root's loop, which tells whether tweens still run as an update starts.
 * @param bars - The mounted Bars, which name the keys an update finds drawn as bars.
 * @returns The commit.
 */
export function useChartCommit(
  inputs: CommitInputs,
  motion: Pick<ChartMotion, "running">,
  bars: ReadonlyMap<object, DrawnBar>
): ChartCommit {
  const [seen, setSeen] = useState(() => firstCommit(inputs));
  const commit = nextCommit(seen, inputs, motion, bars);
  if (commit !== seen) setSeen(commit);
  return commit;
}
