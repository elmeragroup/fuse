"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { isHTMLElement, windowOf } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { skeletonClass } from "./skeleton-class";
import { watchFontSet } from "./skeleton-font-watch";
import { measureGhost } from "./skeleton-measure";
import type { Bone } from "./skeleton-measure";
import { PaneExclusion } from "./skeleton-reveal-exclusion";
import { EXITING_ATTRIBUTE } from "./skeleton-reveal-motion";

/** The bar radius: the theme's medium corner, capped at half the bar so a thin bar stays a pill. */
function barRadius(height: number): string {
  return `min(var(--radius-md, 0.375rem), ${String(height / 2)}px)`;
}

/** Draws bones into the layer, reusing the spans already there so the pulse keeps its phase. */
function drawBones(layer: HTMLElement, bones: readonly Bone[]): void {
  while (layer.children.length > bones.length) layer.lastElementChild?.remove();
  bones.forEach((bone, index) => {
    const existing = layer.children.item(index);
    let span: HTMLElement;
    if (isHTMLElement(existing)) {
      span = existing;
    } else {
      span = layer.ownerDocument.createElement("span");
      Object.assign(span.dataset, { slot: "skeleton-reveal-bone" });
      // Each bone is a Skeleton: the pulse and the `muted` surface, its corner set inline.
      span.className = cn(skeletonClass, "absolute");
      layer.append(span);
    }
    Object.assign(span.style, {
      left: `${String(bone.x)}px`,
      top: `${String(bone.y)}px`,
      width: `${String(bone.width)}px`,
      height: `${String(bone.height)}px`,
      borderRadius: bone.corners.kind === "block" ? bone.corners.radius : barRadius(bone.height),
    });
  });
}

/** The attribute on a skeleton whose bones are drawn, which turns off the strike-through fallback. */
const MEASURED_ATTRIBUTE = "data-measured";
/** The attribute on a ghost element drawn as one block, whose own paint the stylesheet hides. */
const COVERED_ATTRIBUTE = "data-skeleton-covered";

/**
 * Package-private. The skeleton pane: the content rendered unseen in the normal flow, so it takes
 * exactly the content's space, and a layer of bones measured from it. Neither is exposed to
 * assistive tech or reachable by keyboard, and the ghost is excluded from forms and overlays.
 * The bones follow the ghost through each commit, a resize, a change inside the ghost that leaves
 * its size alone, an image loading and the document's fonts changing.
 *
 * @param props - The stand-in content to draw, and the ref the reveal tracks its panes with.
 * @returns The skeleton pane, with `data-slot="skeleton-reveal-skeleton"`.
 */
export function SkeletonPane({
  standIn,
  paneRef,
}: {
  standIn: ReactNode;
  paneRef: (element: HTMLDivElement | null) => void;
}): ReactElement {
  const skeletonRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  const measure = (): void => {
    const skeleton = skeletonRef.current;
    const ghost = ghostRef.current;
    const layer = layerRef.current;
    // A leaving skeleton is pinned at its last size; re-measuring it would redraw what is fading out.
    if (skeleton === null || ghost === null || layer === null || skeleton.hasAttribute(EXITING_ATTRIBUTE))
      return;
    const { bones, covered } = measureGhost(ghost, layer);
    for (const element of ghost.querySelectorAll(`[${COVERED_ATTRIBUTE}]`)) {
      if (!covered.has(element)) element.removeAttribute(COVERED_ATTRIBUTE);
    }
    for (const element of covered) {
      if (!element.hasAttribute(COVERED_ATTRIBUTE)) element.setAttribute(COVERED_ATTRIBUTE, "");
    }
    drawBones(layer, bones);
    skeleton.setAttribute(MEASURED_ATTRIBUTE, "");
  };

  // Every commit can change the ghost's layout, so the bones follow it before the browser paints.
  useLayoutEffect(measure);

  // What changes the ghost without a commit of this pane: its size, a part's own state changing
  // its text, an image loading or the document's fonts changing. Each schedules one measure for the
  // next frame.
  useEffect(() => {
    const skeleton = skeletonRef.current;
    const ghost = ghostRef.current;
    if (skeleton === null || ghost === null) return undefined;
    // The pane's own window: in a same-origin frame, the frame's frames, observers and fonts.
    const view = windowOf(skeleton);
    let frame = 0;
    const schedule = (): void => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(measure);
    };
    const resize = new view.ResizeObserver(schedule);
    resize.observe(skeleton);
    const mutations = new view.MutationObserver((records) => {
      // The covered marks are the measure's own writes; following them would measure forever.
      if (records.some((record) => record.attributeName !== COVERED_ATTRIBUTE)) schedule();
    });
    mutations.observe(ghost, { subtree: true, childList: true, characterData: true, attributes: true });
    skeleton.addEventListener("load", schedule, true);
    // A font-set event misses a face added once loaded, so the set's own state is watched.
    const unwatchFonts = watchFontSet(skeleton, schedule);
    return () => {
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      skeleton.removeEventListener("load", schedule, true);
      unwatchFonts();
    };
    // Mount only: `measure` reads refs, and the layout effect above covers each commit.
  }, []);

  return (
    <div
      ref={(element) => {
        skeletonRef.current = element;
        paneRef(element);
      }}
      data-slot="skeleton-reveal-skeleton"
      aria-hidden="true"
      inert
      // Out of scroll anchoring, as the content pane is: a root scrolled when a pane is inserted
      // before another keeps its scroll, so a leaving pane stays where it stood.
      className="pointer-events-none relative select-none [overflow-anchor:none]">
      {/* Layout-transparent, so the content lays out right in the pane as it does in the content
          pane: a percentage height or width resolves against the same boxes in both. */}
      <div ref={ghostRef} data-slot="skeleton-reveal-ghost" className="contents">
        <PaneExclusion excluded>{standIn}</PaneExclusion>
      </div>
      <div ref={layerRef} data-slot="skeleton-reveal-bones" className="absolute inset-0" />
    </div>
  );
}
