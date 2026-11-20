/// <reference lib="dom" />
/**
 * The client renderer of the `tour-popup` set: the docs Beacon demo's tour and popup in
 * `LocaleProvider` at `en-US`, its one step shown, the popup portalled into the cell's slot.
 *
 * - The step's element is a `Tour.Target` in place of the demo's `Tour.Beacon`, a 1px box the page
 *   shows. A run waits for its step's element until the element is visible and has a size, and the
 *   page hides a client slot but for its measured parts.
 * - The popup aligns to the element's start, below it, so it starts on the slot's pixel grid, as the
 *   Popover content cell does. The demo opens it to the right, which moves the popup and changes
 *   nothing in it.
 * - The run starts in an effect on mount, so the popup opens while the page mounts its cells, as a
 *   `defaultOpen` popup does. `useAutoStartTour` starts it on a timer, even at `delayMs: 0`, which
 *   opens the popup after the page cleared focus from the slot, and the popup then holds focus.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement, useEffect } from "react";

import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { Tour, defineTour, memoryTourStorage, useTour } from "../../../fuse/dist/tour.js";
import type { Cell } from "../components/component-spec.ts";
import { TOUR_TIP_DESCRIPTION, TOUR_TIP_ID, TOUR_TIP_STEP, TOUR_TIP_TITLE } from "../components/tour-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

const exportTip = defineTour({
  id: TOUR_TIP_ID,
  steps: [TOUR_TIP_STEP],
  content: { [TOUR_TIP_STEP]: { title: TOUR_TIP_TITLE, description: TOUR_TIP_DESCRIPTION } },
});

/** Starts the demo tour once it mounts. */
function StartTour() {
  const { start } = useTour(exportTip);
  useEffect(() => {
    start();
  }, [start]);
  return null;
}

/** The Beacon demo's tip, open at its one step. */
export const tourPopup: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        Tour.Provider,
        { storage: memoryTourStorage() },
        createElement(StartTour),
        createElement(Tour.Target, {
          tour: exportTip,
          step: TOUR_TIP_STEP,
          render: createElement("div", { style: { visibility: "visible", width: "1px", height: "1px" } }),
        }),
        createElement(
          Tour.Popup,
          { tour: exportTip, container, align: "start" },
          createElement(Tour.Header, null, createElement(Tour.Title), createElement(Tour.Close)),
          createElement(Tour.Description),
          createElement(Tour.Footer, null, createElement(Tour.Next))
        )
      ),
    }),
};
