"use client";

/**
 * The marks that follow the active slot: the crosshair, the active bar overlays, ActiveValue and
 * ActiveValueLine. Each one registers a paint function with Root, and Root calls them with the
 * active slot on every pointer or key step, so a step writes attributes and renders nothing in
 * React. Every commit calls them once more after Root has carried the active slot over to new data,
 * and each follower asks the shared commit classifier how to get there, so it moves with the bars
 * on a data update and snaps on a range step or an orientation change.
 */
import { useLayoutEffect, useRef } from "react";

import { useChartRoot } from "./chart-context";

/** The active slot inside the effective window and the nearest series, or null when none shows. */
export type ActiveSlot = { readonly slot: number; readonly near: number | null } | null;

/**
 * Draws one follower at the active slot. A "step" is a pointer or key step, which draws at once, and
 * a "commit" asks the follower's own commit classifier.
 */
export type FollowerPaint = (active: ActiveSlot, cause: FollowerCause) => void;

/** Why a follower draws. */
export type FollowerCause = "step" | "commit";

type Follower = { paint: FollowerPaint; stale: boolean };

/** Root's followers. */
export type ChartFollowers = {
  /** Register a follower while it is mounted. The result unregisters it. */
  readonly add: (follower: Follower) => () => void;
  /** Repaint a follower whose own inputs changed, after the commit settles. */
  readonly invalidate: (follower: Follower) => void;
  /**
   * Repaint every follower after the commit settles, as when a path that followers join leaves, so
   * each joins what still draws its series.
   */
  readonly refresh: () => void;
  /** Paint every follower at the active slot now, which later repaints reuse. */
  readonly paint: (active: ActiveSlot, cause: FollowerCause) => void;
};

/**
 * Create a Root's follower registry. Root paints it on every pointer or key step and after every
 * commit, so the slot it last painted is the current one.
 *
 * @returns The registry.
 */
export function createChartFollowers(): ChartFollowers {
  const followers = new Set<Follower>();
  let current: ActiveSlot = null;
  let queued = false;
  // A follower that re-rendered without Root paints after every layout effect of the commit, so
  // it reads the active slot that Root carried over to new data.
  const flush = (): void => {
    queued = false;
    for (const follower of followers) {
      if (!follower.stale) continue;
      follower.stale = false;
      follower.paint(current, "commit");
    }
  };
  return {
    add(follower) {
      followers.add(follower);
      return () => {
        followers.delete(follower);
      };
    },
    invalidate(follower) {
      follower.stale = true;
      if (queued) return;
      queued = true;
      queueMicrotask(flush);
    },
    refresh() {
      for (const follower of followers) this.invalidate(follower);
    },
    paint(active, cause) {
      current = active;
      for (const follower of followers) {
        follower.stale = false;
        follower.paint(active, cause);
      }
    },
  };
}

/**
 * Follow the active slot. The paint function may change on every render, and the latest one paints.
 *
 * @param part - The calling part's display name.
 * @param paint - Draws the follower.
 */
export function useChartFollower(part: string, paint: FollowerPaint): void {
  const { followers } = useChartRoot(part);
  const follower = useRef<Follower>({ paint, stale: true });
  useLayoutEffect(() => {
    follower.current.paint = paint;
    followers.invalidate(follower.current);
  });
  useLayoutEffect(() => followers.add(follower.current), [followers]);
}
