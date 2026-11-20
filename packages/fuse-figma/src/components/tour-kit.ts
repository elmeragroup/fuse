/**
 * Tour's popup, as two component sets on a page of their own. The root of each is `Tour.Popup`'s
 * Base UI popup, `<div data-slot="tour-popup">`, on the Popover shell, 320px wide from `w-80`.
 *
 * `Tour popup` is the docs Beacon demo's tip, the one step of its `export-tip` tour, 1 cell. It holds:
 *
 * - the header row, `Tour.Header`, around `Tour.Title` and `Tour.Close`, the ghost `icon-sm` Icon
 *   button with X, at the row's two ends;
 * - `Tour.Description`;
 * - the footer row, `Tour.Footer`, around `Tour.Next` at its end, the default `sm` Button labeled
 *   `Done`, since the tour has one step.
 *
 * `Tour step` is the docs default demo's step card, the first of its `usage-overview` tour's two
 * steps, 1 cell. It holds:
 *
 * - the header row around `Tour.Progress`, its two dots and the `1 of 2` count, and `Tour.Close`;
 * - `Tour.Title` and `Tour.Description`;
 * - the footer row around `Tour.Skip`, the ghost `sm` Button at the row's start by `me-auto`, and
 *   `Tour.Prev` and `Tour.Next`, the outline and default `sm` Buttons, at its end, as
 *   `readRestAtEnd` in `auto-margins.ts` reads the margin. `Tour.Prev` is disabled at the first step,
 *   which Button's `state=disabled` draws.
 *
 * The titles and descriptions are the steps' words, which the `Title` and `Description` properties
 * set, and the step card's `Count` property sets its count. The tip's title hugs its text in the
 * header row, so a title longer than the room beside Close runs past it, where CSS wraps it there
 * (#825). The step card is its own set: a TEXT property holds one default, so in one set the two
 * cells' words could not share `Title` and `Description`. The sets draw no spotlight, ring or
 * beacon, and no placement against the step's element.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import {
  TOUR_STEP_ACTIONS,
  TOUR_STEP_COUNT,
  TOUR_STEP_DESCRIPTION,
  TOUR_STEP_TITLE,
  TOUR_TIP_DESCRIPTION,
  TOUR_TIP_DONE,
  TOUR_TIP_TITLE,
} from "./tour-text";

/**
 * The popup's manifest, which the capture-backed build reads with `captures/tour-popup.json`, as
 * `<Tour.Popup>` holding the Beacon demo's header, description and footer renders it.
 */
export const TOUR_POPUP_MANIFEST: SetManifest = {
  key: "tour-popup",
  name: "Tour popup",
  api: { page: "tour", parts: ["Tour.Popup"] },
  slot: "tour-popup",
  axes: [{ name: "content", values: ["tip"] }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "tour-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "tour-title",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: TOUR_TIP_TITLE,
            textProperty: "Title",
            shownIn: always,
          },
          iconsFor: () => [],
        },
        {
          kind: "instance",
          key: "close",
          of: ICON_BUTTON_MANIFEST,
          slot: "tour-close",
          cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
          properties: () => ({ swap: { Icon: "X" } }),
          shownIn: always,
          exposed: true,
        },
      ],
    },
    {
      key: "description",
      slot: "tour-description",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: TOUR_TIP_DESCRIPTION,
        textProperty: "Description",
        shownIn: always,
      },
      iconsFor: () => [],
    },
    {
      key: "footer",
      slot: "tour-footer",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          kind: "instance",
          key: "next",
          of: BUTTON_MANIFEST,
          slot: "tour-next",
          cell: () => ({ variant: "default", size: "sm", state: "rest", icon: "none" }),
          properties: () => ({ text: { Label: TOUR_TIP_DONE } }),
          shownIn: always,
          exposed: true,
        },
      ],
    },
  ],
  swapProperties: [],
};

/** One of the step card's footer actions, a `sm` Button instance with its en-US label. */
function stepAction(
  key: keyof typeof TOUR_STEP_ACTIONS,
  slot: string,
  variant: "ghost" | "outline" | "default",
  state: "rest" | "disabled"
): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: BUTTON_MANIFEST,
    slot,
    cell: () => ({ variant, size: "sm", state, icon: "none" }),
    properties: () => ({ text: { Label: TOUR_STEP_ACTIONS[key] } }),
    shownIn: always,
    exposed: true,
  };
}

/** One of `Tour.Progress`'s two dots, by its place in the progress row. */
function progressDot(index: 0 | 1): PartManifest {
  return {
    key: `dot-${String(index + 1)}`,
    slot: undefined,
    place: `tour-progress/0/${String(index)}`,
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
  };
}

/**
 * The step card's manifest, which the capture-backed build reads with `captures/tour-step.json`, as
 * `<Tour.Popup>` holding the default demo's header, title, description and footer renders it at the
 * first of its two steps.
 */
export const TOUR_STEP_MANIFEST: SetManifest = {
  key: "tour-step",
  name: "Tour step",
  api: { page: "tour", parts: ["Tour.Popup"] },
  slot: "tour-popup",
  axes: [{ name: "content", values: ["step"] }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "tour-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "progress",
          slot: "tour-progress",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            {
              key: "dots",
              slot: undefined,
              place: "tour-progress/0",
              shownIn: always,
              label: undefined,
              iconsFor: () => [],
              parts: [progressDot(0), progressDot(1)],
            },
            {
              key: "count",
              slot: undefined,
              place: "tour-progress/1",
              shownIn: always,
              label: {
                key: "text",
                name: "text",
                characters: TOUR_STEP_COUNT,
                textProperty: "Count",
                shownIn: always,
              },
              iconsFor: () => [],
            },
          ],
        },
        {
          kind: "instance",
          key: "close",
          of: ICON_BUTTON_MANIFEST,
          slot: "tour-close",
          cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
          properties: () => ({ swap: { Icon: "X" } }),
          shownIn: always,
          exposed: true,
        },
      ],
    },
    {
      key: "title",
      slot: "tour-title",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: TOUR_STEP_TITLE,
        textProperty: "Title",
        shownIn: always,
      },
      iconsFor: () => [],
    },
    {
      key: "description",
      slot: "tour-description",
      shownIn: always,
      label: {
        key: "text",
        name: "text",
        characters: TOUR_STEP_DESCRIPTION,
        textProperty: "Description",
        shownIn: always,
      },
      iconsFor: () => [],
    },
    {
      key: "footer",
      slot: "tour-footer",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        stepAction("skip", "tour-skip", "ghost", "rest"),
        stepAction("back", "tour-prev", "outline", "disabled"),
        stepAction("next", "tour-next", "default", "rest"),
      ],
    },
  ],
  swapProperties: [],
};
