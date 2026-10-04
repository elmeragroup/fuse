import type { Locator, Page } from "playwright";
import { expect } from "vitest";

import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/** WCAG 2.2 target size (minimum), the floor AGENTS.md holds every control to. */
export const TARGET_FLOOR_PX = 24;

/** How a landing suite opens the page. */
export type LandingOptions = {
  /** Let the brand marks load, so the shaders draw. */
  readonly shaders?: boolean;
  /** The context's reduced-motion preference. Only a test that checks motion allows it. */
  readonly reducedMotion?: "reduce" | "no-preference";
  /** The context's colour-scheme preference, which the landing's theme follows. */
  readonly colorScheme?: "light" | "dark";
  /** Runs before navigation, for routes, clocks, permissions and init scripts. */
  readonly prepare?: (page: Page) => Promise<void>;
  /** The query the landing opens with, such as `?theme=internal-fkas-private`. */
  readonly search?: string;
  /**
   * Wait for the app to hydrate, as it does unless set false. A test that keeps the app's scripts
   * out reads only the server's markup, which never hydrates.
   */
  readonly hydrated?: boolean;
};

/** The landing's opener for one suite file, bound to that file's browser. */
export type LandingSuite = {
  readonly openLanding: (
    viewport: { readonly width: number; readonly height: number },
    options?: LandingOptions
  ) => Promise<Page>;
};

/**
 * Launches one browser for the suite file and returns its landing opener. Each call opens the
 * landing in a fresh context and resolves once the hero's heading has rendered and the app has
 * hydrated. The heading is server-rendered, so it shows before React attaches a handler: a click
 * or key sent then does nothing, and a `history.pushState` reaches no router, so hydration starts
 * from the pushed address. Contexts reduce motion unless a test that checks motion asks otherwise.
 *
 * Unless `shaders` is set, the brand marks are refused, so the closing shader never draws and the
 * picker's mark masks stay empty. Processing a mark blurs a large canvas on the main thread, which
 * on a slow runner held a brand pick back for seconds (measured with six shaders on the page: 2.8s
 * at 4x CPU throttling, 0.1s with the marks refused), and only the shader tests look at a shader.
 *
 * `search` is the query every opening of this suite uses unless a test passes its own.
 */
export function launchLandingSuite({
  search: suiteSearch = "",
}: { readonly search?: string } = {}): LandingSuite {
  const browser = launchSuiteBrowser();
  return {
    openLanding: async (
      viewport,
      {
        shaders = false,
        reducedMotion = "reduce",
        colorScheme = "light",
        prepare,
        search = suiteSearch,
        hydrated = true,
      } = {}
    ) => {
      const context = await browser().newContext({ viewport, reducedMotion, colorScheme });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      if (!shaders) {
        await page.route("**/landing/marks/**", async (route) => route.abort());
      }
      await prepare?.(page);
      await page.goto(`${docsBaseUrl()}/${search}`, { waitUntil: "load" });
      // The hero window's site has a heading of its own, so the wait names the landing's.
      await page.getByRole("heading", { level: 1, name: /^One system/u }).waitFor();
      if (hydrated) {
        // DOM audit: Next's router mounts its announcer once the page has hydrated, and the
        // announcer has no accessible name to query.
        await page.locator("next-route-announcer").waitFor({ state: "attached" });
      }
      return page;
    },
  };
}

/** Every unhandled error and rejection the page raises, collected from now on. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Waits two animation frames, so work a layout effect or a late focus return queued has landed. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    async () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
}

/** What the WCAG floor probe found inside one scenario's root. */
export type TargetAudit = { readonly targets: number; readonly misses: readonly string[] };

/**
 * Every kind of control the window renders, including the items of open menus and the palette,
 * the date picker's segments and its calendar's days.
 */
const CONTROLS =
  "button, a[href], input, textarea, [role='button'], [role='spinbutton'], [role='checkbox'], [role='tab'], [role='combobox'], [role='option'], [role='menuitem'], [role='menuitemradio'], [role='menuitemcheckbox']";

/** One probe that missed its control, with the offset from the control's centre it pressed at. */
type ProbeMiss = {
  readonly index: number;
  readonly label: string;
  readonly segment: boolean;
  readonly dx: number;
  readonly dy: number;
  readonly at: string;
};

/**
 * Probes every visible control under `root`: a press 1/4px inside each edge of a 24px box
 * centred on the control must land on it.
 */
export async function auditTargets(root: Locator): Promise<TargetAudit> {
  const controls = root.locator(CONTROLS);
  const { targets, misses } = await controls.evaluateAll(
    (elements, offset) => {
      let targets = 0;
      const misses = elements.flatMap((control, index) => {
        // Base UI pairs each checkbox with an aria-hidden native input for forms; the visible
        // role="checkbox" span is the target. A disabled control takes no press, and a disabled
        // menu item lets the pointer through, so neither is a target.
        if (
          !(control instanceof HTMLElement) ||
          control.closest("[aria-hidden='true']") !== null ||
          control.matches(":disabled, [aria-disabled='true'], [data-disabled]") ||
          !control.checkVisibility({ visibilityProperty: true })
        ) {
          return [];
        }
        control.scrollIntoView({ block: "center", inline: "center" });
        const rect = control.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return [];
        }
        targets += 1;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const offsets = [
          [-offset, 0],
          [offset, 0],
          [0, -offset],
          [0, offset],
        ] as const;
        return offsets.flatMap(([dx, dy]) => {
          const hit = document.elementFromPoint(x + dx, y + dy);
          return hit !== null && control.contains(hit)
            ? []
            : [
                {
                  index,
                  label: control.getAttribute("aria-label") ?? control.textContent.trim(),
                  segment: control.getAttribute("role") === "spinbutton",
                  dx,
                  dy,
                  at: `${String(x + dx)},${String(y + dy)}`,
                },
              ];
        });
      });
      return { targets, misses };
    },
    TARGET_FLOOR_PX / 2 - 0.25
  );
  const confirmed: string[] = [];
  for (const miss of misses) {
    if (!miss.segment || !(await pressFocuses(controls.nth(miss.index), miss))) {
      confirmed.push(`${miss.label} at ${miss.at}`);
    }
  }
  return { targets, misses: confirmed };
}

/**
 * Whether a real press at `miss`'s offset moves focus to the date segment. A segment's edge can
 * sit within a pixel of its literal's, where `elementFromPoint` reports the literal, but
 * react-aria hands that press to the segment, so the press still reaches it. Focus starts on
 * another segment of the same field, so only the press itself can put it on this one.
 */
async function pressFocuses(segment: Locator, miss: ProbeMiss): Promise<boolean> {
  const page = segment.page();
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const elsewhere = await segment.evaluate((element) => {
    const fields = element.closest("[role='group']")?.querySelectorAll("[role='spinbutton']") ?? [];
    const other = [...fields].find((field) => field !== element);
    if (!(other instanceof HTMLElement)) {
      return false;
    }
    other.focus({ preventScroll: true });
    return document.activeElement === other;
  });
  expect(elsewhere, `${miss.label}: focus starts on another segment`).toBe(true);
  const centre = await segment.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(centre.x + miss.dx, centre.y + miss.dy);
  const focused = await segment.evaluate((element) => element === document.activeElement);
  // Later scenarios open overlays from where the audit left the page.
  await page.evaluate(({ x, y }) => {
    window.scrollTo(x, y);
  }, scroll);
  return focused;
}

/** Asserts that `root` holds at least one control and that every one clears the floor. */
export async function expectTargets(root: Locator, scenario: string): Promise<void> {
  const { targets, misses } = await auditTargets(root);
  expect(targets, `${scenario}: controls probed`).toBeGreaterThan(0);
  expect(misses, scenario).toEqual([]);
}
