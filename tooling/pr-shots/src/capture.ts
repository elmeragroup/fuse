/**
 * Takes a run's screenshots with Playwright: opens the route, sets the theme through the page's
 * own picker like a user, stamps a density override, types into the target, waits for the page
 * to hydrate and settle, and writes the frame: a padded clip of the target or its demo stage,
 * the window, or the whole page.
 */

import { Context, Effect, Layer, Schema } from "effect";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import type { Browser, BrowserType, Locator, Page } from "playwright";

import { segmentLabel, variantLabel } from "./options.ts";
import type { Engine, Frame, ResolvedFrame, ShotOptions, Target, ThemeChoice, Viewport } from "./options.ts";
import { firstCoordinate } from "./shot-plan.ts";
import type { Coordinate, Shot } from "./shot-plan.ts";

/** How long the target may take to appear after the page loads. */
const TARGET_TIMEOUT_MS = 15_000;

/** How long hydration and a released scroll lock may take. */
const SETTLE_TIMEOUT_MS = 15_000;

/** A shot could not be taken. */
export class CaptureFailed extends Schema.TaggedError<CaptureFailed>()("CaptureFailed", {
  message: Schema.String,
  /** The file name of the shot that failed. */
  file: Schema.String,
}) {}

/** The route could not be fetched from a source at all. */
export class SourceUnreachable extends Schema.TaggedError<SourceUnreachable>()("SourceUnreachable", {
  message: Schema.String,
  /** The URL that failed. */
  url: Schema.String,
}) {}

/** The page has nothing for `--frame stage` or `--frame target` to clip. */
export class FrameNotFound extends Schema.TaggedError<FrameNotFound>()("FrameNotFound", {
  message: Schema.String,
  /** The frame that found nothing. */
  frame: Schema.Literals(["stage", "target"]),
  /** The docs path. */
  route: Schema.String,
}) {}

/** `--themes` was given for a page without a theme control the tool can drive. */
export class ThemesUnsupported extends Schema.TaggedError<ThemesUnsupported>()("ThemesUnsupported", {
  message: Schema.String,
  /** The docs path. */
  route: Schema.String,
}) {}

/** One source's shots of a run. */
export type CaptureRequest = {
  /** The source's origin. */
  readonly origin: URL;
  /** How errors name the source, such as `prod`. */
  readonly sourceLabel: string;
  /** The parsed run. */
  readonly options: ShotOptions;
  /** The shots to take, all of one state. */
  readonly shots: readonly Shot[];
  /** The directory the PNGs go into. */
  readonly outDir: string;
};

/** The source a run resolves `--frame auto` on. */
export type FrameProbe = {
  /** The source's origin. */
  readonly origin: URL;
  /** How errors name the source, such as `local checkout`. */
  readonly sourceLabel: string;
  /** The parsed run. */
  readonly options: ShotOptions;
};

/** Screenshots of docs pages. */
export class Capture extends Context.Service<
  Capture,
  {
    /** Ask a source for the route and report the HTTP status, following redirects. */
    readonly probe: (origin: URL, route: string) => Effect.Effect<number, SourceUnreachable>;

    /**
     * What `--frame` covers on this source: an explicit frame as given, and `auto` as `stage`
     * for a target inside a demo stage, `target` for one outside, and `viewport` without a
     * target. Resolving `auto` with a target prepares the page once, as for the run's first
     * shot, theme included.
     */
    readonly resolveFrame: (
      probe: FrameProbe
    ) => Effect.Effect<ResolvedFrame, CaptureFailed | FrameNotFound | ThemesUnsupported>;

    /**
     * Take one source's shots and write them into the request's directory. Each engine's
     * browser and each shot's context close when the shots are done, fail or are interrupted.
     */
    readonly capture: (
      request: CaptureRequest
    ) => Effect.Effect<void, CaptureFailed | FrameNotFound | ThemesUnsupported>;
  }
>()("@elmeragroup/pr-shots/Capture") {
  /** Playwright's bundled browsers. */
  static readonly layer = Layer.sync(Capture, () =>
    Capture.of({ probe: probeRoute, resolveFrame, capture: captureShots })
  );
}

const probeRoute = Effect.fn("Capture.probe")(function* (origin: URL, route: string) {
  const url = new URL(route, origin);
  return yield* Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(url, { signal });
      await response.arrayBuffer();
      return response.status;
    },
    catch: () => new SourceUnreachable({ message: `Could not reach ${url.href}`, url: url.href }),
  });
});

const resolveFrame = Effect.fn("Capture.resolveFrame")(function* (probe: FrameProbe) {
  const { sourceLabel, options } = probe;
  if (options.frame !== "auto") {
    return options.frame;
  }
  if (options.target === null) {
    return "viewport" as const;
  }
  // The page is prepared exactly as for the run's first shot, theme included, because the
  // target may exist only in the theme the run picks.
  const first = firstCoordinate(options);
  const label = "resolving --frame auto";
  const fail = (reason: string) =>
    new CaptureFailed({ message: `${label}: ${reason} (${options.route} on ${sourceLabel})`, file: label });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const browser = yield* launch(first.engine, label);
      const { frame } = yield* preparePage(browser, probe, first, "auto", fail);
      return frame;
    })
  );
});

const captureShots = Effect.fn("Capture.capture")(function* (request: CaptureRequest) {
  // Sequential on purpose: parallel browsers against one `next dev` race its first compile of
  // the route, and a loaded machine shifts font and layout timing between concurrent pages.
  for (const engine of request.options.engines) {
    const shots = request.shots.filter((shot) => shot.engine === engine);
    const [first] = shots;
    if (first === undefined) {
      continue;
    }
    yield* Effect.scoped(
      Effect.gen(function* () {
        const browser = yield* launch(engine, first.file);
        for (const shot of shots) {
          yield* takeShot(browser, request, shot);
        }
      })
    );
  }
});

function launch(engine: Engine, file: string) {
  return Effect.acquireRelease(
    Effect.tryPromise({
      try: () => browserType(engine).launch(),
      catch: () =>
        new CaptureFailed({
          message: `${file}: Could not launch ${engine}. Install it with \`pnpm exec playwright install ${engine}\`.`,
          file,
        }),
    }),
    (browser) => Effect.promise(() => browser.close())
  );
}

function browserType(engine: Engine): BrowserType {
  return { chromium, webkit, firefox }[engine];
}

/** Runs one Playwright call, turning its rejection into the caller's failure. */
function attempt<A>(run: () => Promise<A>, fail: (reason: string) => CaptureFailed) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => fail(cause instanceof Error ? cause.message : "Playwright failed"),
  });
}

/**
 * Opens the route in a fresh context of `viewport`'s size and waits until the page has loaded
 * and, on a Next page, hydrated. The context closes with the scope.
 */
const openPage = Effect.fnUntraced(function* (
  browser: Browser,
  origin: URL,
  options: ShotOptions,
  viewport: Viewport,
  fail: (reason: string) => CaptureFailed
) {
  const context = yield* Effect.acquireRelease(
    attempt(
      () =>
        browser.newContext({
          viewport,
          deviceScaleFactor: options.scale,
          colorScheme: options.colorScheme,
          reducedMotion: "reduce",
        }),
      fail
    ),
    (context) => Effect.promise(() => context.close())
  );
  const page = yield* attempt(() => context.newPage(), fail);
  const response = yield* attempt(
    () => page.goto(new URL(options.route, origin).href, { waitUntil: "networkidle" }),
    fail
  );
  if (response !== null && !response.ok()) {
    return yield* fail(`The route answered ${String(response.status())}`);
  }
  // The Next dev overlay's badge can sit over a stage near the bottom of the window.
  yield* attempt(() => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }), fail);
  yield* attempt(() => waitForHydration(page), fail);
  return page;
});

/** Finds the target by role and name, waiting for it to show, or fails naming what is missing. */
const findTarget = Effect.fnUntraced(function* (
  page: Page,
  { role, name }: Target,
  nth: number,
  fail: (reason: string) => CaptureFailed
) {
  const matches = page.getByRole(role, { name, exact: true });
  const target = matches.nth(nth);
  const visible = yield* attempt(
    () =>
      target.waitFor({ state: "visible", timeout: TARGET_TIMEOUT_MS }).then(
        () => true,
        () => false
      ),
    fail
  );
  if (!visible) {
    const count = yield* attempt(() => matches.count(), fail);
    const found = nth === 0 || count === 0 ? "nothing matched" : `only ${String(count)} matched`;
    return yield* fail(`No ${role} named "${name}" at index ${String(nth)}: ${found}`);
  }
  return target;
});

/** The target's closest demo stage, which may match nothing. */
function stageOf(target: Locator): Locator {
  return target.locator("xpath=ancestor-or-self::*[@data-demo-stage][1]");
}

/** What preparing a page found. */
type Prepared = {
  /** The page, themed, stamped, filled and settled. */
  readonly page: Page;
  /** What the shot covers, with `auto` resolved. */
  readonly frame: ResolvedFrame;
  /** The element a stage or target frame clips, or `null` for the window or the page. */
  readonly element: Locator | null;
};

/**
 * Brings a page to the state a shot shows, the same way for resolving `auto` and for every
 * shot: open the route at the coordinate's window size and wait for hydration, pick the theme,
 * wait for the picker's scroll lock to go, find the target and the frame's element, stamp a
 * density override on it, type the fill, and settle. The frame is checked before anything is
 * stamped or typed, so a frame with nothing to clip fails as `FrameNotFound` at once.
 */
const preparePage = Effect.fnUntraced(function* (
  browser: Browser,
  { origin, sourceLabel, options }: FrameProbe,
  at: Coordinate,
  wanted: Frame,
  fail: (reason: string) => CaptureFailed
) {
  const frameNotFound = (frame: "stage" | "target", reason: string) =>
    new FrameNotFound({
      message: `--frame ${frame} found nothing to clip on ${options.route} on ${sourceLabel}: ${reason}`,
      frame,
      route: options.route,
    });
  // A stage or target frame without a target has nothing to clip whatever the page shows, so it
  // fails before the page opens.
  if (options.target === null && (wanted === "stage" || wanted === "target")) {
    return yield* frameNotFound(
      wanted,
      wanted === "stage"
        ? "it needs --target, an element inside a [data-demo-stage]"
        : "it needs --target, the element to clip"
    );
  }

  const page = yield* openPage(browser, origin, options, at.viewport, fail);
  // Read before any picker opens: a modal's scroll lock writes these, and the shot waits for
  // them to come back.
  const unlocked = yield* attempt(() => documentStyles(page), fail);

  const picked = yield* attempt(() => pickTheme(page, at.theme), fail);
  if (picked._tag === "no-control") {
    return yield* new ThemesUnsupported({
      message: `--themes needs a theme picker on the page, and ${options.route} on ${sourceLabel} has none the tool can drive: ${picked.reason}. Leave --themes out to shoot the page in its own theme.`,
      route: options.route,
    });
  }
  if (picked._tag === "failed") {
    return yield* fail(picked.reason);
  }
  yield* attempt(() => waitForScrollUnlock(page, unlocked), fail);

  const target = options.target === null ? null : yield* findTarget(page, options.target, options.nth, fail);
  const stage = target === null ? null : stageOf(target);
  const inStage = stage === null ? false : (yield* attempt(() => stage.count(), fail)) > 0;
  const frame: ResolvedFrame =
    wanted !== "auto" ? wanted : target === null ? "viewport" : inStage ? "stage" : "target";
  let element: Locator | null = null;
  if (frame === "stage") {
    if (stage === null || !inStage) {
      const subject =
        options.target === null ? "the target" : `${options.target.role} "${options.target.name}"`;
      return yield* frameNotFound("stage", `the ${subject} is not inside a [data-demo-stage]`);
    }
    element = stage;
  } else if (frame === "target") {
    element = target;
  }

  if (at.density._tag === "override") {
    const density = at.density.density;
    // The frame's closest density scope, such as the target's demo stage, or the document
    // root for a frame that covers the page.
    const scope = element ?? page.locator("html");
    yield* attempt(
      () =>
        scope.evaluate((node, value) => {
          const owner = node.closest("[data-density]") ?? document.documentElement;
          owner.setAttribute("data-density", value);
        }, density),
      fail
    );
  }

  if (options.fill !== null && target !== null) {
    const fill = options.fill;
    yield* attempt(async () => {
      await target.click();
      await target.pressSequentially(fill);
      await target.blur();
    }, fail);
  }

  yield* attempt(() => settle(page), fail);
  return { page, frame, element } satisfies Prepared;
});

const takeShot = Effect.fn("Capture.takeShot")(function* (
  browser: Browser,
  { origin, sourceLabel, options, outDir }: CaptureRequest,
  shot: Shot
) {
  yield* Effect.annotateCurrentSpan({ file: shot.file });
  const fail = (reason: string) =>
    new CaptureFailed({
      message: `${shot.file}: ${reason} (${options.route} on ${sourceLabel})`,
      file: shot.file,
    });

  const { page, element } = yield* preparePage(
    browser,
    { origin, sourceLabel, options },
    shot,
    shot.frame,
    fail
  );
  const file = path.join(outDir, shot.file);
  const still = { animations: "disabled", caret: "hide" } as const;
  if (element === null) {
    if (shot.frame === "viewport") {
      // The window at the top of the page, whatever typing into the target scrolled.
      yield* attempt(async () => {
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await settle(page);
      }, fail);
    }
    yield* attempt(() => page.screenshot({ path: file, fullPage: shot.frame === "page", ...still }), fail);
    return;
  }
  const clip = yield* attempt(() => paddedClip(page, element, options.pad), fail);
  if (clip === null) {
    return yield* fail("The frame has no layout box");
  }
  yield* attempt(() => page.screenshot({ path: file, clip, fullPage: true, ...still }), fail);
}, Effect.scoped);

/** A theme the run picks. */
type Picked = Extract<ThemeChoice, { readonly _tag: "picked" }>;

/** What picking a theme came to. */
type PickResult =
  | { readonly _tag: "picked" }
  | { readonly _tag: "no-control"; readonly reason: string }
  | { readonly _tag: "failed"; readonly reason: string };

/**
 * Picks the theme through whichever picker the page has, by roles and names like a user: the
 * docs header's theme settings menu, which themes the demo stages, or the landing's theme chip,
 * which themes the document. Both name brands by display name, so the brand is found by choosing
 * each brand until the themed element reports the requested code.
 */
async function pickTheme(page: Page, theme: ThemeChoice): Promise<PickResult> {
  if (theme._tag === "page-default") {
    return { _tag: "picked" };
  }
  const docsPicker = page.getByRole("button", { name: "Theme settings", exact: true });
  if ((await docsPicker.count()) > 0) {
    const stage = page.locator("[data-demo-stage]").first();
    if ((await stage.count()) === 0) {
      return {
        _tag: "no-control",
        reason: "the docs theme picker themes demo stages, and the page has none",
      };
    }
    return pickInDocsMenu(page, docsPicker, stage, theme);
  }
  const chip = page.getByRole("banner").getByRole("button", { name: /^Theme: /u });
  if ((await chip.count()) > 0) {
    return pickInLandingDialog(page, chip.first(), theme);
  }
  return {
    _tag: "no-control",
    reason: "it has neither the docs theme settings menu nor a theme chip in its banner",
  };
}

/** The docs header's menu: variant, brand and segment radio items, checked on the first stage. */
async function pickInDocsMenu(
  page: Page,
  button: Locator,
  stage: Locator,
  theme: Picked
): Promise<PickResult> {
  await button.click();
  const menu = page.getByRole("menu", { name: "Theme settings", exact: true });
  await menu.waitFor();
  const checked = (item: Locator) => item.and(page.locator('[aria-checked="true"]'));

  await choose(menu.getByRole("menuitemradio", { name: variantLabel(theme.variant), exact: true }), checked);
  const brands = menu.getByRole("group", { name: "Brand", exact: true }).getByRole("menuitemradio");
  if (!(await chooseBrand(brands, stage, theme.brand, checked))) {
    return { _tag: "failed", reason: `The theme picker has no brand with the code "${theme.brand}"` };
  }
  const segment = menu.getByRole("menuitemradio", { name: segmentLabel(theme.segment), exact: true });
  if (await segment.isDisabled()) {
    return {
      _tag: "failed",
      reason: `The theme picker does not offer the ${theme.segment} segment for ${theme.brand}`,
    };
  }
  await choose(segment, checked);

  const applied = await themeOf(stage);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await dropPickerFocus(page);
  return applied === theme.slug
    ? { _tag: "picked" }
    : { _tag: "failed", reason: `The demo stage shows ${applied} after picking ${theme.slug}` };
}

/** The landing's theme dialog: variant, brand and segment toggle buttons, checked on `<html>`. */
async function pickInLandingDialog(page: Page, chip: Locator, theme: Picked): Promise<PickResult> {
  await chip.click();
  const dialog = page.getByRole("dialog", { name: "Theme", exact: true });
  await dialog.waitFor();
  const root = page.locator("html");
  const pressed = (item: Locator) => item.and(page.locator('[aria-pressed="true"]'));
  const axis = (name: string, label: string) =>
    dialog.getByRole("group", { name, exact: true }).getByRole("button", { name: label, exact: true });

  await choose(axis("Variant", variantLabel(theme.variant)), pressed);
  const brands = dialog.getByRole("group", { name: "Brand", exact: true }).getByRole("button");
  if (!(await chooseBrand(brands, root, theme.brand, pressed))) {
    return { _tag: "failed", reason: `The theme picker has no brand with the code "${theme.brand}"` };
  }
  // A segment the brand does not serve stays focusable for its tooltip, so it is aria-disabled.
  const segment = axis("Segment", segmentLabel(theme.segment));
  if ((await segment.getAttribute("aria-disabled")) === "true") {
    return {
      _tag: "failed",
      reason: `The theme picker does not offer the ${theme.segment} segment for ${theme.brand}`,
    };
  }
  await choose(segment, pressed);

  const applied = await themeOf(root);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await dropPickerFocus(page);
  return applied === theme.slug
    ? { _tag: "picked" }
    : { _tag: "failed", reason: `The page shows ${applied} after picking ${theme.slug}` };
}

/**
 * Closing a picker returns focus to the button that opened it, which then shows its focus ring
 * and, on the landing, its "Theme" tooltip. Neither is part of the page under review, so the
 * focus is dropped and the shot waits for the tooltip to go.
 */
async function dropPickerFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.getByRole("tooltip").waitFor({ state: "hidden", timeout: SETTLE_TIMEOUT_MS });
}

/** Chooses each brand in turn until `themed` reports `code`. Returns whether it got there. */
async function chooseBrand(
  brands: Locator,
  themed: Locator,
  code: string,
  selected: (item: Locator) => Locator
): Promise<boolean> {
  let found = (await themed.getAttribute("data-theme-brand")) === code;
  for (let index = 0, count = await brands.count(); !found && index < count; index += 1) {
    await choose(brands.nth(index), selected);
    found = (await themed.getAttribute("data-theme-brand")) === code;
  }
  return found;
}

/** Clicks a picker item and waits until it reports itself selected. */
async function choose(item: Locator, selected: (item: Locator) => Locator): Promise<void> {
  await item.click();
  await selected(item).waitFor();
}

/** The `<variant>-<brand>-<segment>` slug an element's theme attributes spell. */
async function themeOf(themed: Locator): Promise<string> {
  return themed.evaluate((element) =>
    ["data-theme-variant", "data-theme-brand", "data-theme-segment"]
      .map((name) => element.getAttribute(name))
      .join("-")
  );
}

/**
 * Waits until a Next page has hydrated, as the landing tests do (`apps/docs/test/landing-page.ts`):
 * a click before hydration reaches no handler. Next's router mounts its announcer once the page
 * has hydrated. A page without Next's scripts, such as the test fixture, has nothing to wait for.
 */
async function waitForHydration(page: Page): Promise<void> {
  if ((await page.locator("script[src*='/_next/']").count()) === 0) {
    return;
  }
  await page.locator("next-route-announcer").waitFor({ state: "attached", timeout: SETTLE_TIMEOUT_MS });
  // Landing only: a server-rendered Dashboard's toast region portals in once the Dashboard has
  // hydrated. No other page renders a region named Dashboard, so elsewhere this waits for nothing.
  const app = page.getByRole("region", { name: "Dashboard", exact: true });
  if ((await app.count()) > 0) {
    await app
      .getByRole("region", { name: "Dashboard notifications" })
      .waitFor({ state: "attached", timeout: SETTLE_TIMEOUT_MS });
  }
}

/** The inline styles of `<html>` and `<body>`, where a modal's scroll lock writes. */
async function documentStyles(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      `${document.documentElement.getAttribute("style") ?? ""}|${document.body.getAttribute("style") ?? ""}`
  );
}

/**
 * Waits until the scroll lock a picker took is released. Base UI drops it a task after the last
 * modal unmounts, so it is polled, as the landing tests do, until the styles are what they were
 * before the picker opened.
 */
async function waitForScrollUnlock(page: Page, unlocked: string): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while ((await documentStyles(page)) !== unlocked) {
    if (Date.now() >= deadline) {
      throw new Error("The page kept its scroll lock after the theme picker closed");
    }
    await page.waitForTimeout(20);
  }
}

/**
 * Waits for the network, the web fonts, every finite animation to end and two frames of layout.
 * Reduced motion is on for every context and the screenshot stops what still runs; finishing
 * the animations first keeps the frame's box from being measured mid-transition.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().endTime !== Infinity) {
        animation.finish();
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/** A screenshot clip in page coordinates. */
type Clip = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/**
 * The frame's box plus padding, in page coordinates for a full-page screenshot. Edges round
 * outwards to whole CSS pixels and stop at the page's edges.
 *
 * @returns The clip, or `null` when the frame has no layout box.
 */
async function paddedClip(page: Page, frame: Locator, pad: number): Promise<Clip | null> {
  const box = await frame.boundingBox();
  if (box === null) {
    return null;
  }
  const extent = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  const left = Math.max(0, Math.floor(box.x + extent.scrollX - pad));
  const top = Math.max(0, Math.floor(box.y + extent.scrollY - pad));
  const right = Math.min(extent.width, Math.ceil(box.x + extent.scrollX + box.width + pad));
  const bottom = Math.min(extent.height, Math.ceil(box.y + extent.scrollY + box.height + pad));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
