import type { MouseEvent } from "react";

import type { BaseUIEvent } from "@base-ui/react/types";

/**
 * Cancels activation of an element announced `aria-disabled="true"`. A link cannot take the
 * native `disabled` attribute, and a row that stays focusable keeps pointer events so its
 * Tooltip still opens, so the element must stop its own activation. A keyboard Enter on a link
 * or button fires a click too, so the click is the one place to stop it. A middle-click fires
 * `auxclick` rather than `click`, and opening a link in a new tab is that event's default
 * action, so the same handler guards both events: `preventDefault` keeps a link from navigating
 * or opening a new tab, and `preventBaseUIHandler` skips the handlers merged before this one,
 * the consumer's `onClick` and `onAuxClick` among them. It reads the rendered attribute, so it
 * catches `aria-disabled` from props and from the `render` element alike. A handler on the
 * `render` element itself runs before it, because Base UI merges that element's props last.
 */
function cancelWhenAriaDisabled(event: BaseUIEvent<MouseEvent<HTMLElement>>): void {
  if (event.currentTarget.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    event.preventBaseUIHandler();
  }
}

/**
 * The guard's handlers. Merge them after the consumer's props, as in
 * `mergeProps(defaults, props, ariaDisabledGuard)`, so they run first.
 */
export const ariaDisabledGuard = { onClick: cancelWhenAriaDisabled, onAuxClick: cancelWhenAriaDisabled };
