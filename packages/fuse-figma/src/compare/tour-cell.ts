/// <reference lib="dom" />
/**
 * The client renderers of the `tour-popup` and `tour-step` sets: the docs Beacon demo's tour and
 * popup at its one step, and the default demo's tour and step card at the first of its two steps,
 * each in `LocaleProvider` at `en-US`, the popup portalled into the cell's slot.
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
import type { TourDefinition } from "../../../fuse/dist/tour.js";
import type { Cell } from "../components/component-spec.ts";
import {
  TOUR_STEP_DESCRIPTION,
  TOUR_STEP_ID,
  TOUR_STEP_STEPS,
  TOUR_STEP_TITLE,
  TOUR_TIP_DESCRIPTION,
  TOUR_TIP_ID,
  TOUR_TIP_STEP,
  TOUR_TIP_TITLE,
} from "../components/tour-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

const exportTip = defineTour({
  id: TOUR_TIP_ID,
  steps: [TOUR_TIP_STEP],
  content: { [TOUR_TIP_STEP]: { title: TOUR_TIP_TITLE, description: TOUR_TIP_DESCRIPTION } },
});

const overview = defineTour({ id: TOUR_STEP_ID, steps: TOUR_STEP_STEPS });

/** Starts a demo tour once it mounts. */
function StartTour<Step extends string>({ tour }: { readonly tour: TourDefinition<Step> }) {
  const { start } = useTour(tour);
  useEffect(() => {
    start();
  }, [start]);
  return null;
}

/** The step's element, a 1px box the page shows, which a run waits for until it has a size. */
const STEP_ELEMENT = createElement("div", { style: { visibility: "visible", width: "1px", height: "1px" } });

/** The Beacon demo's tip, open at its one step. */
export const tourPopup: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        Tour.Provider,
        { storage: memoryTourStorage() },
        createElement(StartTour, { tour: exportTip }),
        createElement(Tour.Target, { tour: exportTip, step: TOUR_TIP_STEP, render: STEP_ELEMENT }),
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

/** The default demo's step card, open at the first of its two steps. */
export const tourStep: ClientCellRendering = {
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        Tour.Provider,
        { storage: memoryTourStorage() },
        createElement(StartTour, { tour: overview }),
        createElement(Tour.Target, {
          tour: overview,
          step: TOUR_STEP_STEPS[0],
          title: TOUR_STEP_TITLE,
          description: TOUR_STEP_DESCRIPTION,
          render: STEP_ELEMENT,
        }),
        createElement(
          Tour.Popup,
          { tour: overview, container, align: "start" },
          createElement(Tour.Header, null, createElement(Tour.Progress), createElement(Tour.Close)),
          createElement(Tour.Title),
          createElement(Tour.Description),
          createElement(
            Tour.Footer,
            null,
            createElement(Tour.Skip),
            createElement(Tour.Prev),
            createElement(Tour.Next)
          )
        )
      ),
    }),
};
