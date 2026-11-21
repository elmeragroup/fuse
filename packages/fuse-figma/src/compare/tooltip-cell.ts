/// <reference lib="dom" />
/**
 * The client renderers of the Tooltip sets, each the docs Basic demo's Tooltip mounted open on the
 * compare page with its popup portalled into the cell's slot, as `tooltip-kit.ts` draws it.
 *
 * - `tooltipContent`: the popup, measured alone; the page hides its trigger, the anchor.
 * - `tooltipOpen`: the popup and the trigger, measured together.
 *
 * Each opens the popup on the cell's `side` and keeps it centred on the trigger, since Base UI writes
 * the arrow's offset along that side from the trigger's centre. The popup is as wide as its text,
 * which is no whole number of pixels, so the host puts its start on the slot's pixel grid from the
 * width it measures once the popup mounts and again as its font loads. Above or below the trigger,
 * the host is as wide as the popup and centres the trigger, as `popover-cell.ts` centres its trigger
 * in the popup's `w-72`. On the trigger's left, the host pads the trigger's start by the popup's
 * width and the side offset; on its right, the trigger starts the host.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement, useLayoutEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Info } from "../../../fuse/dist/icons.js";
import { Tooltip } from "../../../fuse/dist/tooltip.js";
import type { Cell } from "../components/component-spec.ts";
import { TOOLTIP_SIDE_OFFSET, tooltipSideOf } from "../components/tooltip-sides.ts";
import type { TooltipSide } from "../components/tooltip-sides.ts";
import { TOOLTIP_TEXT } from "../components/tooltip-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/**
 * The host's layout, which centres the trigger in it, 48px below the slot's top, so the popup above
 * it, at most 32px tall and 4px above the trigger, and the page's crop around it stay inside the slot.
 * A popup on the trigger's left or right starts the host's row as {@link hostStyle} sets it.
 */
const HOST = "flex justify-center pt-12";

/**
 * The host's style for a popup `width` wide on `side`, which puts the popup's start at the host's.
 */
function hostStyle(side: TooltipSide, width: number): CSSProperties {
  switch (side) {
    case "top":
    case "bottom":
      return { width };
    case "left":
      return { justifyContent: "flex-start", paddingLeft: width + TOOLTIP_SIDE_OFFSET };
    case "right":
      return { justifyContent: "flex-start" };
  }
}

/**
 * A host that aligns the popup the slot holds to the slot's pixel grid: the popup is as wide as its
 * text, a fraction of a pixel, so the host starts it on a whole pixel from the width it measures
 * after each layout and as the popup resizes.
 */
function PixelAlignedHost({
  container,
  side,
  children,
}: {
  readonly container: HTMLElement;
  readonly side: TooltipSide;
  readonly children: ReactNode;
}) {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const attach = () => {
      const popup = container.querySelector("[data-slot=tooltip-content]");
      if (popup === null) {
        frame = requestAnimationFrame(attach);
        return;
      }
      const measure = () => {
        setWidth(popup.getBoundingClientRect().width);
      };
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(popup);
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [container]);
  return createElement(
    "div",
    { className: HOST, style: width === undefined ? undefined : hostStyle(side, width) },
    children
  );
}

/** The docs Basic demo's Tooltip, open on `side`, its popup portalled into `container`. */
function basicTooltip(container: HTMLElement, side: TooltipSide) {
  return createElement(PixelAlignedHost, {
    container,
    side,
    children: createElement(
      Tooltip.Provider,
      null,
      createElement(
        Tooltip.Root,
        { defaultOpen: true },
        createElement(
          Tooltip.Trigger,
          {
            render: createElement(Button, { variant: "ghost", size: "icon", "aria-label": TOOLTIP_TEXT }),
          },
          createElement(Info, { "aria-hidden": true })
        ),
        createElement(Tooltip.Content, { container, side }, TOOLTIP_TEXT)
      )
    ),
  });
}

/** The open Tooltip's popup. */
export const tooltipContent: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    basicTooltip(container, tooltipSideOf(cell)),
};

/** The open Tooltip, its popup and its trigger. */
export const tooltipOpen: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    basicTooltip(container, tooltipSideOf(cell)),
  union: ["tooltip-content", "tooltip-trigger"],
};
