/**
 * Tour's popup, as one component set on a page of its own: the docs Beacon demo's tip, the one step
 * of its `export-tip` tour, 1 cell. The root is `Tour.Popup`'s Base UI popup, `<div
 * data-slot="tour-popup">`, on the Popover shell, 320px wide from `w-80`. It holds:
 *
 * - the header row, `Tour.Header`, around `Tour.Title` and `Tour.Close`, the ghost `icon-sm` Icon
 *   button with X, at the row's two ends;
 * - `Tour.Description`;
 * - the footer row, `Tour.Footer`, around `Tour.Next` at its end, the default `sm` Button labeled
 *   `Done`, since the tour has one step.
 *
 * The title and the description are the step's words, which the `Title` and `Description` properties
 * set. The title hugs its text in the header row, so a title longer than the room beside Close runs
 * past it, where CSS wraps it there (#825).
 *
 * The docs default demo's step card stays out (#824). Its footer places `Tour.Skip` at the row's start
 * by `me-auto` and `Tour.Prev` and `Tour.Next` at its end, which no Figma auto-layout row of three
 * layers draws. The set draws no spotlight, ring or beacon, and no placement against the step's element.
 */
import type { SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import { TOUR_TIP_DESCRIPTION, TOUR_TIP_DONE, TOUR_TIP_TITLE } from "./tour-text";

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
