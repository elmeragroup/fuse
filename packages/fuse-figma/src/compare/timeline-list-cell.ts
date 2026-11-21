/**
 * The renderers of the `timeline-list` and `timeline-list-links` sets: the real Fuse `TimelineList`
 * holding the docs default demo's three events, or the links demo's two, in a host as wide as the
 * kit's preview width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { TimelineList } from "../../../fuse/dist/timeline-list.js";
import {
  TIMELINE_EVENTS,
  TIMELINE_LINK_EVENTS,
  TIMELINE_LIST_PREVIEW_WIDTH,
} from "../components/timeline-list-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The `timeline-list` cell: the default demo's list. */
export const timelineList: CellRendering = {
  element: () =>
    createElement(
      "div",
      { style: { width: `${TIMELINE_LIST_PREVIEW_WIDTH}px` } },
      createElement(
        TimelineList.Root,
        null,
        ...TIMELINE_EVENTS.map((event) =>
          createElement(
            TimelineList.Item,
            { key: event.date },
            createElement(TimelineList.Title, null, event.title),
            createElement(TimelineList.Time, { date: event.date }, event.time),
            createElement(TimelineList.Description, null, event.description)
          )
        )
      )
    ),
};

/** The `timeline-list-links` cell: the links demo's list, each description ending in its link. */
export const timelineListLinks: CellRendering = {
  element: () =>
    createElement(
      "div",
      { style: { width: `${TIMELINE_LIST_PREVIEW_WIDTH}px` } },
      createElement(
        TimelineList.Root,
        null,
        ...TIMELINE_LINK_EVENTS.map((event) =>
          createElement(
            TimelineList.Item,
            { key: event.date },
            createElement(TimelineList.Title, null, event.title),
            createElement(TimelineList.Time, { date: event.date }, event.time),
            createElement(
              TimelineList.Description,
              null,
              event.description,
              " ",
              createElement("a", { href: event.link.href, className: "underline" }, event.link.text)
            )
          )
        )
      )
    ),
};
