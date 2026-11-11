/**
 * When a page is ready for its shot, as far as what it loads is concerned: every frame the shot can
 * show has finished navigating, and React in it has painted everything it is loading. The page is
 * watched from before its first navigation, so the state lives with it; `react-commits.ts` is the
 * reader that runs inside each frame.
 */

import type { BrowserContext, Frame as PageFrame, Page, Request } from "playwright";

import { COMMIT_READING, installCommitHook, reactRegistered, readReact } from "./react-commits.ts";

/** How long the readiness waits may take, and how often a wait Playwright cannot express polls. */
export type ReadinessTiming = { readonly timeoutMs: number; readonly pollMs: number };

/** A page's readiness, bound to the page it watches. */
export type PageReadiness = {
  /**
   * Waits until React has painted everything it is loading in each frame the shot can show: the
   * page, and every frame whose element is painted, in a painted parent frame, such as a block
   * page's preview (`react-commits.ts`). A frame without React passes at once. A part that never
   * loads fails the shot rather than shooting its fallback, and so does a React the reading was not
   * checked against.
   *
   * A frame that is navigating still holds its old document, so the reading waits for the new one
   * to load first (`watchNavigations`).
   *
   * The reading takes a frame without a registered renderer for one without React, so a Next
   * frame, which always runs React, must register first. Otherwise a frame whose client code failed
   * to load, or whose React never reached the hook, would pass as its server HTML, never hydrated.
   */
  readonly settled: () => Promise<void>;
};

/**
 * Installs React's commit hook in every frame the context opens, before the frame's own scripts.
 *
 * @param context - The context, before it opens a page.
 */
export async function installReadiness(context: BrowserContext): Promise<void> {
  await context.addInitScript(installCommitHook);
}

/**
 * Watches a page's readiness from now on; call it before the page's first navigation, in a context
 * prepared with {@link installReadiness}.
 *
 * @param page - The page to watch.
 * @param timing - The limit for each wait, after which `settled` rejects naming what was not ready.
 * @returns The page's readiness.
 */
export function watchReadiness(page: Page, timing: ReadinessTiming): PageReadiness {
  const navigations = watchNavigations(page, timing);
  return {
    settled: async () => {
      const { timeoutMs } = timing;
      for (const frame of page.frames()) {
        if (!(await framePainted(frame))) {
          continue;
        }
        const where = frame === page.mainFrame() ? "" : ` in the frame at ${frame.url()}`;
        const loading = await navigations.loaded(frame);
        if (loading !== null) {
          throw new Error(
            `The page${where} was still loading ${loading} after ${String(timeoutMs / 1000)} s`
          );
        }
        if (await isNextPage(frame)) {
          await frame.waitForFunction(reactRegistered, undefined, { timeout: timeoutMs }).catch(() => {
            throw new Error(
              `The page's React never reported its commits${where}, so the run cannot tell when what it loads has rendered`
            );
          });
        }
        const verdict = await frame
          .waitForFunction(readReact, COMMIT_READING, { timeout: timeoutMs })
          .then(async (handle) => handle.jsonValue())
          .catch(() => {
            throw new Error(`React still had a part loading${where} after ${String(timeoutMs / 1000)} s`);
          });
        // `waitForFunction` resolves only on a truthy value, so `false` never arrives here.
        if (verdict !== false && verdict._tag === "unsupported") {
          throw new Error(
            `The page runs ${verdict.renderer}${where}, which the run cannot read; it reads react-dom ${COMMIT_READING.majors.join(", ")}`
          );
        }
      }
    },
  };
}

/** The navigations of a page's frames that have started and not yet committed. */
type Navigations = {
  /**
   * Waits until the frame has no navigation in flight and its document has loaded.
   *
   * @returns `null` once it has, or the URL the frame was still loading at the deadline.
   */
  readonly loaded: (frame: PageFrame) => Promise<string | null>;
};

/**
 * Watches a page's navigation requests, by frame, from before its first. A frame that is
 * navigating still shows, and answers for, its old document until the new one commits: a preview
 * reloading in an iframe would read as settled on the page it is leaving. A navigation commits as
 * its response starts, before its request finishes, so one whose request finishes or fails without
 * committing, such as a 204 answer, ends there.
 */
function watchNavigations(page: Page, { timeoutMs, pollMs }: ReadinessTiming): Navigations {
  const inFlight = new Map<PageFrame, Request>();
  const end = (request: Request) => {
    if (inFlight.get(request.frame()) === request) {
      inFlight.delete(request.frame());
    }
  };
  page.on("request", (request) => {
    if (request.isNavigationRequest()) {
      inFlight.set(request.frame(), request);
    }
  });
  page.on("framenavigated", (frame) => inFlight.delete(frame));
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  return {
    loaded: async (frame) => {
      const deadline = Date.now() + timeoutMs;
      for (let request = inFlight.get(frame); request !== undefined; request = inFlight.get(frame)) {
        if (Date.now() >= deadline) {
          return request.url();
        }
        await page.waitForTimeout(pollMs);
      }
      // A committed navigation resets the frame's load state, so this waits for the new document.
      return frame.waitForLoadState("load", { timeout: Math.max(deadline - Date.now(), 1) }).then(
        () => null,
        () => frame.url()
      );
    },
  };
}

/** Whether a frame holds a Next page, by the scripts Next serves from `/_next/`. */
export async function isNextPage(frame: PageFrame): Promise<boolean> {
  return (await frame.locator("script[src*='/_next/']").count()) > 0;
}

/** Whether a frame's element, and each frame element around it, is painted. The page always is. */
async function framePainted(frame: PageFrame): Promise<boolean> {
  for (
    let inner = frame, parent = frame.parentFrame();
    parent !== null;
    inner = parent, parent = parent.parentFrame()
  ) {
    // A frame detached since `frames()` listed it has no element, and shows nothing.
    const element = await inner.frameElement().catch(() => null);
    if (
      element === null ||
      !(await element.evaluate((node: Element) =>
        node.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      ))
    ) {
      return false;
    }
  }
  return true;
}
