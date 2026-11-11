import type { ReactElement } from "react";

import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { onTestFinished } from "vitest";

import { Carousel } from "../src/components/carousel/index";

/**
 * The carousel suites' slides: `count` slides 80px tall, each the viewport's width, or a third of
 * it with `perView` 3. The width is inline, as the suites' stylesheet holds only the classes the
 * package itself writes.
 *
 * @param count - How many slides.
 * @param perView - How many show at once.
 * @returns The slides, keyed by place, each reading "Slide body N".
 */
export function carouselSlides(count: number, perView: 1 | 3): ReactElement[] {
  return Array.from({ length: count }, (_, index) => (
    <Carousel.Slide key={index} style={perView === 3 ? { flexBasis: `${100 / 3}%` } : undefined}>
      <div style={{ height: 80 }}>Slide body {index + 1}</div>
    </Carousel.Slide>
  ));
}

/** A tree the server rendered into the document, which the client has not hydrated yet. */
type ServerRendered = {
  /** Hydrate the server's HTML, as the client bundle does once it loads. */
  readonly hydrate: () => void;
  /** Every error React reported through `onRecoverableError`, such as a hydration mismatch. */
  readonly recoverableErrors: readonly unknown[];
};

/**
 * Server-render `tree` into a host in the document and leave it unhydrated, so a test can act on
 * the server's HTML first, as a user does while scripts load. The test's end unmounts it.
 *
 * @param tree - The tree, rendered alike on the server and the client.
 * @returns The hydrate step and the errors hydration reported.
 */
export function serverRendered(tree: ReactElement): ServerRendered {
  const host = document.createElement("div");
  host.innerHTML = renderToString(tree);
  document.body.append(host);
  const recoverableErrors: unknown[] = [];
  let root: Root | null = null;
  onTestFinished(() => {
    root?.unmount();
    host.remove();
  });
  return {
    hydrate() {
      root = hydrateRoot(host, tree, { onRecoverableError: (error) => recoverableErrors.push(error) });
    },
    recoverableErrors,
  };
}

/** An ancestor scale that moves at each slide read while started. */
type UnsteadyReadings = {
  /** Put on the carousel's ancestor, which starts at half scale. */
  readonly ancestor: (element: HTMLElement | null) => void;
  /** Put on each slide whose box reads should move the ancestor's scale. */
  readonly slide: (element: HTMLElement | null) => void;
  /** Move the scale at every slide read from now. */
  readonly start: () => void;
  /** Leave the scale where it got to, so readings hold still again. */
  readonly stop: () => void;
};

/**
 * Readings of a carousel's boxes that never hold still while started. WebKit samples a running
 * transform afresh at each layout read, so a measurement taken during an ancestor's scale animation
 * finds the viewport's box at one scale and the slides' at others. Chromium does not, so this
 * stands in for it: once started, the ancestor's scale moves up a hundredth each time a slide's
 * box is read, and rests where it got to once stopped.
 *
 * @returns The refs to attach and the switch that starts and stops the scale moving.
 */
export function unsteadyReadings(): UnsteadyReadings {
  let host: HTMLElement | null = null;
  let moving = false;
  let read = 0;
  return {
    ancestor: (element) => {
      host = element;
      if (element !== null) {
        element.style.transform = "scale(0.5)";
        element.style.transformOrigin = "0 0";
      }
    },
    slide: (element) => {
      if (element === null) {
        return;
      }
      const readRects = element.getClientRects.bind(element);
      element.getClientRects = () => {
        if (moving && host !== null) {
          // From half to 0.69 and round again, so no two reads of the viewport around the slides'
          // ever agree.
          read += 1;
          host.style.transform = `scale(${0.5 + (read % 20) / 100})`;
        }
        return readRects();
      };
    },
    start: () => {
      moving = true;
    },
    stop: () => {
      moving = false;
    },
  };
}
