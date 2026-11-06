"use client";

/**
 * The tooltip every chart family shares: the popup over the active datum, which a pointer can move
 * into and pin, its glide between steps and its dismissals. It reads the Root through its readout,
 * and the family's Tooltip part hands it the anchor the popup rests on and the content it shows.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { flushSync } from "react-dom";

import { OverlayPortal } from "../overlay/overlay-portal";
import { useChartFollower } from "./chart-followers";
import { useActiveIndex, useChartReadout } from "./chart-readout";
import type { TooltipPlacer } from "./chart-readout-port";
import { ChartHeldIndexContext, ChartLiveContext } from "./chart-scope-contexts";
import { shareCorridor } from "./chart-tooltip-corridor";
import { createTooltipGlider } from "./chart-tooltip-glide";
import type { GlideRoute, TooltipGlider } from "./chart-tooltip-glide";
import { chartTakesPress, TOOLTIP_POSITIONER, tooltipPopupClass, watchOverflow } from "./chart-tooltip-popup";
import type { ChartLayerProps } from "./chart-types";

/** What a family's Tooltip part passes the shared body. */
export type ChartTooltipBodyProps = ChartLayerProps & {
  /** The popup's surface. */
  readonly variant: "default" | "frosted";
  /** The Tooltip's `anchor` prop, which the family's anchor reads. */
  readonly placement: "point" | "top";
  /** The family's anchor. */
  readonly placer: TooltipPlacer;
  /** The popup's content. */
  readonly children: ReactNode;
};

const STRAIGHT: GlideRoute = { kind: "straight" };

/**
 * The positioner props of a popup that keeps its lane: Base UI puts its corner at the lane's anchor
 * and never moves it to avoid a collision, since the anchor places it inside the Root's figure.
 */
function laneProps(figure: HTMLElement | null) {
  return {
    ...TOOLTIP_POSITIONER,
    align: "start",
    collisionAvoidance: { side: "none", align: "none" },
    collisionPadding: 0,
    collisionBoundary: figure ?? "clipping-ancestors",
  } as const;
}

/**
 * The popup over the active datum. A pointer, key or touch step to another datum glides it there
 * over `--chart-glide` on a spring that never overshoots, unless the reader prefers reduced motion,
 * and opening, scrolling, resizing, a data update, a change of side and a route with no way move it
 * at once. Touch passes through the popup to the plot, except on a popup that scrolls, where a drag
 * scrolls it and a tap dismisses it. The popup stays while the pointer is on the plot or inside the
 * popup and while the option has focus. It is hidden from screen readers, which read the same values
 * from the plot's option.
 *
 * @param props - The family's anchor, the Tooltip's props and the popup's content.
 * @returns The tooltip.
 */
export function ChartTooltipBody({
  variant,
  placement,
  placer,
  className,
  style,
  children,
}: ChartTooltipBodyProps): ReactElement {
  const readout = useChartReadout("Chart.Tooltip");
  // A lane keeps its side inside the Root's figure and moves itself, so it never glides.
  const lane = placer.keeps === "lane";
  const { store, id, root: rootOf } = readout;
  const active = useActiveIndex(readout, true);
  const open = active !== null;
  // Once open, the portal stays mounted. Its node sits after the scope's last child, so mounting
  // and dropping it on each open and close flips that child's :last-child and restyles all of it,
  // the whole chart when the chart is the scope's last child.
  const [kept, setKept] = useState(false);
  if (open && !kept) setKept(true);
  // The index the popup showed last, which its content keeps while it fades out.
  const [shown, setShown] = useState<number | null>(null);
  if (active !== null && active !== shown) setShown(active);
  const positioner = useRef<HTMLDivElement | null>(null);
  // A count that asks Base UI to place the popup again, after the marks draw something new or a
  // data update's tween lands, so the anchor measures afresh.
  const [measures, setMeasures] = useState(0);
  // The index a reader's pointer, key or touch step moved to last. Root carries the active index
  // over a data update as a commit, which never lands here, so that move shows at once.
  const stepped = useRef<number | null>(null);
  useChartFollower("Chart.Tooltip", (current, cause) => {
    if (cause === "step") stepped.current = current?.slot ?? null;
  });
  const { virtual, side, bridge, revision, forget, watch, freezes, sideOffset, alignOffset } =
    placer.useAnchor({
      active,
      positioner,
      placement,
      measures,
    });
  const pick = readout.usePick();
  // While the popup shows, the plot reads its anchor's corridor, so a pointer heading for the popup
  // keeps the active part over what it crosses and across the gap (B1).
  const latestFreezes = useRef(freezes);
  useLayoutEffect(() => {
    latestFreezes.current = freezes;
  });
  useEffect(() => {
    if (!open) return undefined;
    shareCorridor(store, (from, to) =>
      latestFreezes.current(from, to, positioner.current?.getAttribute("data-side") ?? null)
    );
    return () => {
      shareCorridor(store, null);
    };
  }, [open, store]);
  const glider = useRef<TooltipGlider | null>(null);
  const watchPositioner = useCallback(
    (node: HTMLDivElement | null) => {
      positioner.current = node;
      glider.current = node === null || lane ? null : createTooltipGlider(node, rootOf());
      return () => {
        glider.current?.dispose();
        glider.current = null;
        positioner.current = null;
      };
    },
    [rootOf, lane]
  );
  // The anchor Base UI measures last, whose route a glide armed before that measure reads.
  const latestAnchor = useRef(virtual);
  // A step glides the popup to its next place. Opening, a data update and a resize of the plot
  // move it at once, and closing forgets where it rested.
  const before = useRef<{ active: number | null; revision: object }>({ active: null, revision });
  useLayoutEffect(() => {
    latestAnchor.current = virtual;
  }, [virtual]);
  useLayoutEffect(() => {
    const last = before.current;
    before.current = { active, revision };
    // The anchor reads the marks again when the popup opens and after every commit.
    if (active === null) forget("closed");
    else if (last.active === null || last.revision !== revision) forget("moved");
    // Only a reader's step glides. A data update moves the popup at once, the active index Root
    // carries over with it included.
    const steps =
      last.active !== null &&
      active !== null &&
      last.active !== active &&
      stepped.current === active &&
      last.revision === revision;
    stepped.current = null;
    if (steps) glider.current?.arm(() => latestAnchor.current?.placed().route ?? STRAIGHT);
    else glider.current?.stop();
  }, [active, revision, forget]);
  // While the popup shows, the anchor watches the marks and asks for a new place before the browser
  // paints when they draw something it should measure afresh.
  useEffect(() => {
    if (!open) return undefined;
    return watch(() => {
      glider.current?.stop();
      flushSync(() => setMeasures((count) => count + 1));
    });
  }, [open, watch]);
  // Whether the pointer entered the popup by moving straight toward it from the active datum, which
  // holds the active index while the pointer crosses the popup.
  const frozen = useRef(false);
  // The input that last moved the active index, read on each render the index change causes.
  const touchInput = ["touch", "pen"].includes(store.pointer()?.type ?? "");
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next || chartTakesPress(details, rootOf())) return;
        store.dismiss();
      }}>
      <OverlayPortal portal={TooltipPrimitive.Portal} keepMounted={kept}>
        <TooltipPrimitive.Positioner
          {...(lane ? laneProps(rootOf()) : TOOLTIP_POSITIONER)}
          anchor={virtual}
          side={side}
          // The family's anchor sets where the popup sits on the side Base UI tries, and how far it
          // moves along it.
          sideOffset={({ side: placed, positioner: size }) => sideOffset(placed, size)}
          alignOffset={({ side: placed }) => {
            const node = positioner.current;
            return node === null ? 0 : alignOffset(placed, node);
          }}
          ref={watchPositioner}>
          <TooltipPrimitive.Popup
            data-slot="chart-tooltip"
            data-variant={variant}
            data-input={touchInput ? "touch" : undefined}
            aria-hidden="true"
            ref={watchOverflow}
            className={tooltipPopupClass(variant, className)}
            style={style}
            onClick={(event) => {
              // A popup that scrolls takes touch, so a tap on it, which never scrolled, takes the
              // one dismissal a tap beside the chart would.
              if (event.currentTarget.dataset.input === "touch") store.dismiss();
            }}
            onPointerEnter={(event) => {
              const from = store.pointer();
              frozen.current =
                from !== null &&
                freezes(
                  from,
                  { x: event.clientX, y: event.clientY },
                  event.currentTarget.getAttribute("data-side")
                );
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
            <ChartLiveContext value={true}>
              <ChartHeldIndexContext value={open ? null : shown}>{children}</ChartHeldIndexContext>
            </ChartLiveContext>
            {bridge ? <span data-slot="chart-tooltip-bridge" /> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </OverlayPortal>
    </TooltipPrimitive.Root>
  );
}

Object.assign(ChartTooltipBody, { displayName: "Chart.TooltipBody" });
