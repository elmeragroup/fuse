/// <reference lib="dom" />
/**
 * The client renderers of the Tooltip sets, each the docs Basic demo's Tooltip mounted open on the
 * compare page with its popup portalled into the cell's slot, as `tooltip-kit.ts` draws it.
 *
 * - `tooltipContent`: the popup, measured alone; the page hides its trigger, the anchor.
 * - `tooltipOpen`: the popup and the trigger, measured together.
 *
 * Both keep the demo's centred popup, since Base UI writes the arrow's `left` from the trigger's
 * centre. The popup is as wide as its text, which is no whole number of pixels, so each centres the
 * trigger in a host as wide as the popup, which it measures once the popup mounts and again as its
 * font loads: the centred popup then starts at the host's start, on the slot's pixel grid, as
 * `popover-cell.ts` centres its trigger in the popup's `w-72`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Info } from "../../../fuse/dist/icons.js";
import { Tooltip } from "../../../fuse/dist/tooltip.js";
import type { Cell } from "../components/component-spec.ts";
import { TOOLTIP_TEXT } from "../components/tooltip-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/**
 * The host's layout, which centres the trigger in it, 48px below the slot's top, so the popup above
 * it, at most 32px tall and 4px above the trigger, and the page's crop around it stay inside the slot.
 */
const HOST = "flex justify-center pt-12";

/**
 * A host as wide as the popup the slot holds, which it measures after each layout and as the popup
 * resizes, so the trigger it centres puts the centred popup at its start.
 */
function PopupWideHost({
  container,
  children,
}: {
  readonly container: HTMLElement;
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
    { className: HOST, style: width === undefined ? undefined : { width } },
    children
  );
}

/** The docs Basic demo's Tooltip, open, its popup portalled into `container`. */
function basicTooltip(container: HTMLElement) {
  return createElement(PopupWideHost, {
    container,
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
        createElement(Tooltip.Content, { container }, TOOLTIP_TEXT)
      )
    ),
  });
}

/** The open Tooltip's popup. */
export const tooltipContent: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => basicTooltip(container),
};

/** The open Tooltip, its popup and its trigger. */
export const tooltipOpen: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) => basicTooltip(container),
  union: ["tooltip-content", "tooltip-trigger"],
};
