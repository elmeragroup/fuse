"use client";

import { useEffect } from "react";
import type { MouseEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { isTypingTarget } from "../../lib/typing-target";
import { ChromeScope } from "./chrome-scope";
import { OVERLAYS } from "./studio-shortcuts";

export const CANVAS_ID = "studio-canvas";
export const INSPECTOR_ID = "studio-inspector";

const REGION = "[data-studio-region]";

/**
 * Makes an element one of the editor's regions, which F6 and the skip links focus as a whole, as
 * in Figma: the top bar, the Pages and Layers panel, the canvas, its toolbar and the inspector.
 * Its recipe adds the keyboard focus ring.
 */
export const regionProps = { "data-studio-region": true, tabIndex: -1 } as const;

const skipLinks = tv({
  slots: {
    // The docs' SkipNav, at the studio bar's height and above it.
    link: "absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0_0_0_0)] focus-visible:top-0 focus-visible:left-0 focus-visible:z-50 focus-visible:m-0 focus-visible:inline-flex focus-visible:h-12 focus-visible:w-auto focus-visible:items-center focus-visible:overflow-visible focus-visible:bg-background focus-visible:px-3 focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:[clip-path:none] focus-visible:[clip:auto]",
  },
});

const styles = skipLinks();

/** Whether `element` is laid out: below `lg` the side panels are not, as Sheets stand in. */
function shown(element: Element): boolean {
  return element.getClientRects().length > 0;
}

type SkipLinksProps = {
  /** Shows the inspector where its panel is not laid out, by opening the phone's Sheet. */
  onHiddenInspector: () => void;
};

/**
 * The studio's skip links, first in the Tab order: past the bar and the panels to the canvas, and
 * past every artboard control to the inspector. They move focus themselves, because the address's
 * hash is the share link.
 */
export function StudioSkipLinks({ onHiddenInspector }: SkipLinksProps): ReactElement {
  const skip = (id: string, hidden?: () => void) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const region = document.getElementById(id);
    if (region !== null && shown(region)) {
      region.focus();
    } else {
      hidden?.();
    }
  };
  return (
    <>
      <ChromeScope className={styles.link()} render={<a href={`#${CANVAS_ID}`} onClick={skip(CANVAS_ID)} />}>
        Skip to canvas
      </ChromeScope>
      <ChromeScope
        className={styles.link()}
        render={<a href={`#${INSPECTOR_ID}`} onClick={skip(INSPECTOR_ID, onHiddenInspector)} />}>
        Skip to inspector
      </ChromeScope>
    </>
  );
}

/**
 * The stops F6 visits: the regions on screen in document order, then each notifications viewport
 * while it holds a toast, the studio's and a screen's on the canvas alike, since the cycle takes
 * the F6 a viewport would otherwise answer itself.
 */
function stops(): HTMLElement[] {
  const notifications = [...document.querySelectorAll<HTMLElement>('[data-slot="toast-viewport"]')].filter(
    (viewport) => viewport.querySelector('[data-slot="toast-root"]') !== null
  );
  return [...document.querySelectorAll<HTMLElement>(REGION), ...notifications].filter(shown);
}

/**
 * F6 and Shift+F6 move focus to the next or previous region on screen, wrapping, as in Figma. A
 * key typed into a field or an open overlay belongs to it. The cycle is F6's one owner: it listens
 * in the capture phase and stops every F6 there, as Fuse's Toast viewport would otherwise take
 * each one, defaulted or not, and pull focus out of a field.
 */
export function useRegionCycle(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F6") {
        return;
      }
      event.stopImmediatePropagation();
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        isTypingTarget(event.target, OVERLAYS)
      ) {
        return;
      }
      const regions = stops();
      if (regions.length === 0) {
        return;
      }
      event.preventDefault();
      // The innermost stop holding focus: a stop inside another, as the toolbar sits in the
      // canvas and the notifications in the bar, comes after it.
      const index = regions.findLastIndex((region) => region.contains(document.activeElement));
      const step = event.shiftKey ? -1 : 1;
      const next =
        index === -1
          ? event.shiftKey
            ? regions.length - 1
            : 0
          : (index + step + regions.length) % regions.length;
      regions[next]?.focus();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);
}
