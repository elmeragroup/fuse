import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { onTestFinished } from "vitest";

/** An empty same-origin document. A `srcdoc` document takes the origin of the page that embeds it. */
export const SAME_ORIGIN = { srcdoc: "<!doctype html><body></body>" } as const;

/** An empty cross-origin document. A data URL's document has an opaque origin. */
export const CROSS_ORIGIN = { src: "data:text/html,<!doctype html><body></body>" } as const;

/**
 * Appends an iframe for the rest of the test.
 *
 * @returns Navigates the frame to a `srcdoc` or a `src`, and settles with its window once the
 *   next document loads.
 */
export function navigableFrame(): (target: { srcdoc: string } | { src: string }) => Promise<Window> {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  onTestFinished(() => {
    frame.remove();
  });
  return async (target) => {
    const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    // A `srcdoc` attribute wins over `src`, so a frame that showed one drops it first.
    if ("src" in target) frame.removeAttribute("srcdoc");
    Object.assign(frame, target);
    await loaded;
    if (frame.contentWindow === null) throw new Error("expected the frame's window");
    return frame.contentWindow;
  };
}

/**
 * Copies the page's stylesheets into `view`'s document, for a test whose frame lays out Fuse's
 * styles.
 *
 * @returns Settles once each copied linked stylesheet loads, and rejects when one fails.
 */
export async function adoptPageStyles(view: Window): Promise<void> {
  const loads: Array<Promise<unknown>> = [];
  for (const sheet of document.querySelectorAll("style, link[rel=stylesheet]")) {
    const copy = sheet.cloneNode(true);
    if (copy instanceof HTMLLinkElement) {
      loads.push(
        new Promise((resolve, reject) => {
          copy.addEventListener("load", resolve, { once: true });
          copy.addEventListener("error", () => reject(new Error(`expected ${copy.href} to load`)), {
            once: true,
          });
        })
      );
    }
    view.document.head.append(copy);
  }
  await Promise.all(loads);
}

/**
 * Has `request` give out ids in a document that numbers them from the start until it gives out
 * `id`, the id an earlier document gave a callback that a cleanup may still hold. All of its
 * requests run before this returns. Callbacks run in the order they were requested, so the
 * callback with `id` runs before the one requested after it unless a cleanup canceled `id`.
 *
 * @param request - Requests a callback in the document and returns its id, such as its window's
 *   `requestAnimationFrame`, or `setTimeout` with one delay for every call.
 * @param id - The id the earlier document gave out.
 * @returns Settles with whether the callback with `id` ran.
 */
export function reuseId(request: (callback: () => void) => number, id: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  let reserved = 0;
  while (reserved < id - 1) reserved = request(() => undefined);
  if (request(() => resolve(true)) !== id)
    throw new Error(`expected the document to give out id ${String(id)} again`);
  request(() => resolve(false));
  return promise;
}

/**
 * Creates a React root in a new element of `view`'s document, unmounted when the test finishes.
 *
 * @returns Renders a node with its effects run, unmounts the root, and lists the errors its
 *   effects and their cleanups threw.
 */
export function frameRoot(view: Window) {
  const uncaught: unknown[] = [];
  const root = createRoot(view.document.body.appendChild(view.document.createElement("div")), {
    onUncaughtError: (error) => uncaught.push(error),
  });
  // A second unmount does nothing, so a test that unmounts itself is left as it was.
  onTestFinished(() => {
    root.unmount();
  });
  return {
    render: (node: ReactNode): void => {
      flushSync(() => {
        root.render(node);
      });
    },
    unmount: () => root.unmount(),
    uncaught,
  };
}
