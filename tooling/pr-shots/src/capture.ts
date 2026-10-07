/**
 * Takes a run's screenshots with Playwright: opens the route, sets the theme through the page's
 * own picker like a user, runs the click steps, stamps a density override, types into the target,
 * waits for the page to hydrate and settle, and writes the frame: a padded clip of the target or
 * its demo stage, widened to any popup a control in it holds open, the window, or the whole page.
 */

import { Context, Effect, Layer, Schema } from "effect";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import type { Browser, BrowserType, Locator, Page } from "playwright";

import { segmentLabel, variantLabel } from "./options.ts";
import type {
  ClickStep,
  Engine,
  Frame,
  ResolvedFrame,
  ShotOptions,
  Target,
  ThemeChoice,
  Viewport,
} from "./options.ts";
import { firstCoordinate } from "./shot-plan.ts";
import type { Coordinate, Shot } from "./shot-plan.ts";

/** How long the target may take to appear after the page loads. */
const TARGET_TIMEOUT_MS = 15_000;

/** How often a wait that Playwright cannot express polls the page. */
const POLL_MS = 50;

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

/**
 * Which elements a role and name lookup sees. `accessible` takes the accessibility tree as it
 * is. `accessible-then-shown` prefers the same match while it is visible, and otherwise takes
 * the match among the elements visible on screen, those hidden from the tree included. A modal
 * dialog hides the page behind it, its own trigger included, from the tree. The fallback is only
 * a fallback because a lookup that includes hidden elements also puts aria-hidden text, such as
 * a shortcut hint, into the names it compares.
 */
type Lookup = "accessible" | "accessible-then-shown";

/** The locators a role and name lookup reads. */
function candidates(page: Page, { role, name }: Target, nth: number) {
  const accessible = page.getByRole(role, { name, exact: true }).nth(nth);
  const shown = page
    .getByRole(role, { name, exact: true, includeHidden: true })
    .filter({ visible: true })
    .nth(nth);
  // Only a visible accessible match may win, so a boxless one earlier in the document cannot
  // stand in front of the visible element behind a modal.
  return { accessible, shown, either: accessible.filter({ visible: true }).or(shown).first() };
}

/** Finds the target by role and name, waiting for it to show, or fails naming what is missing. */
const findTarget = Effect.fnUntraced(function* (
  page: Page,
  target: Target,
  nth: number,
  lookup: Lookup,
  fail: (reason: string) => CaptureFailed
) {
  const { accessible, shown, either } = candidates(page, target, nth);
  const found = yield* attempt(
    () =>
      (lookup === "accessible" ? accessible : either)
        .waitFor({ state: "visible", timeout: TARGET_TIMEOUT_MS })
        .then(
          () => true,
          () => false
        ),
    fail
  );
  if (!found) {
    const count = yield* attempt(
      () => page.getByRole(target.role, { name: target.name, exact: true }).count(),
      fail
    );
    const matched = nth === 0 || count === 0 ? "nothing matched" : `only ${String(count)} matched`;
    return yield* fail(`No ${target.role} named "${target.name}" at index ${String(nth)}: ${matched}`);
  }
  if (lookup === "accessible") {
    return accessible;
  }
  return (yield* attempt(() => accessible.isVisible(), fail)) ? accessible : shown;
});

/**
 * Clicks a step's element. A collapsed control, one with `aria-expanded="false"`, opens
 * something, and it may open it late: a Base UI submenu opens after a delay, after the page
 * would otherwise have settled, and a control may report itself expanded before its popup
 * mounts. So the step waits until the control holds open a popup the clip would take in, as
 * `openPopupBoxes` finds them. A control that never gets there fails the step: shooting the
 * closed state would pass for the open one and hide the change under review. A control without
 * `aria-expanded`, such as a tab or a plain button, or one already expanded, is only clicked.
 */
const clickStep = Effect.fnUntraced(function* (
  page: Page,
  element: Locator,
  step: ClickStep,
  fail: (reason: string) => CaptureFailed
) {
  const collapsed = (yield* attempt(() => element.getAttribute("aria-expanded"), fail)) === "false";
  // The clicked node stays the control while it is in the document, also once a modal it opened
  // hides it from the role lookup. A click that re-renders it as a new node, as a React key
  // change does, is followed to the node that has the role and name now.
  const clicked = collapsed ? yield* attempt(() => element.elementHandle(), fail) : null;
  yield* attempt(() => element.click(), fail);
  if (clicked === null) {
    return;
  }
  const { either } = candidates(page, step, step.nth);
  const opened = yield* attempt(async () => {
    for (const deadline = Date.now() + TARGET_TIMEOUT_MS; Date.now() < deadline;) {
      // A replacement that is not rendered yet counts as not open, so the poll goes on.
      const popups = (await clicked.evaluate((node) => node.isConnected))
        ? await clicked.evaluate(openPopupBoxes)
        : await either.evaluate(openPopupBoxes, undefined, { timeout: POLL_MS }).catch(() => []);
      if (popups.length > 0) {
        return true;
      }
      await page.waitForTimeout(POLL_MS);
    }
    return false;
  }, fail);
  if (!opened) {
    return yield* fail(`${step.role} "${step.name}" did not open: no popup it holds open shows`);
  }
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
 * wait for the picker's scroll lock to go, run the click steps, find the target and the frame's
 * element, stamp a density override on it, type the fill, and settle. The frame is checked before
 * anything is stamped or typed, so a frame with nothing to clip fails as `FrameNotFound` at once.
 * The clicks run before the target is looked up, because a step may be what renders it.
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

  // Each step leaves what it opened open: nothing blurs the element or presses Escape, so a
  // Select or a menu is still open for the shot.
  for (const [index, step] of options.clicks.entries()) {
    const stepFail = (reason: string) =>
      fail(`--click step ${String(index + 1)} of ${String(options.clicks.length)}: ${reason}`);
    const element = yield* findTarget(page, step, step.nth, "accessible", stepFail);
    yield* clickStep(page, element, step, stepFail);
  }

  // A step may open a modal dialog that hides the rest of the page, the target included, from
  // the accessibility tree, so after clicks the target is looked up among what is on screen.
  const lookup: Lookup = options.clicks.length === 0 ? "accessible" : "accessible-then-shown";
  const target =
    options.target === null ? null : yield* findTarget(page, options.target, options.nth, lookup, fail);
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
    // The window at the top of the page, whatever typing into the target scrolled. After click
    // steps the window stays where they and the fill left it: clicking scrolls each element into
    // view, and what it opened is near it.
    if (shot.frame === "viewport" && options.clicks.length === 0) {
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
 * The frame's box, widened to every popup a control in it holds open, plus padding, in page
 * coordinates for a full-page screenshot. Edges round outwards to whole CSS pixels and stop at
 * the page's edges.
 *
 * @returns The clip, or `null` when the frame has no layout box.
 */
async function paddedClip(page: Page, frame: Locator, pad: number): Promise<Clip | null> {
  const box = await frame.boundingBox();
  if (box === null) {
    return null;
  }
  const popups = await frame.evaluate(openPopupBoxes);
  const extent = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  const boxes = [box, ...popups];
  const left = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x)) + extent.scrollX - pad));
  const top = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y)) + extent.scrollY - pad));
  const right = Math.min(
    extent.width,
    Math.ceil(Math.max(...boxes.map((b) => b.x + b.width)) + extent.scrollX + pad)
  );
  const bottom = Math.min(
    extent.height,
    Math.ceil(Math.max(...boxes.map((b) => b.y + b.height)) + extent.scrollY + pad)
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Runs in the page. The window-relative boxes of the popups that the frame, or a control inside
 * it, holds open: `aria-expanded="true"` and the visible elements its `aria-controls` names.
 * A portaled popup renders outside the frame, so its box is not in the frame's. Base UI's Select
 * trigger names its list in `aria-controls` only while the list is open. For an expanded control
 * that names no visible element, every visible listbox, menu and dialog on the page counts. Each
 * popup found is searched the same way, so a submenu that an item of an open menu holds open
 * counts too. A popup counts only if it paints: a closed one that keeps its layout under
 * `visibility: hidden` or `opacity: 0` does not widen the clip.
 */
function openPopupBoxes(frame: Element): readonly Clip[] {
  const shown = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return (
      element.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const opensFrom = (scope: Element) =>
    [scope, ...scope.querySelectorAll("[aria-expanded]")]
      .filter((control) => control.getAttribute("aria-expanded") === "true")
      .flatMap((control) => {
        const controlled = (control.getAttribute("aria-controls") ?? "").split(/\s+/u).flatMap((id) => {
          const element = id === "" ? null : document.getElementById(id);
          return element !== null && shown(element) ? [element] : [];
        });
        return controlled.length > 0
          ? controlled
          : [...document.querySelectorAll('[role="listbox"], [role="menu"], [role="dialog"]')].filter(shown);
      });
  // Breadth first over the popups found, each searched once, so popups that name each other
  // cannot loop.
  const popups = new Set<Element>();
  const pending = [...opensFrom(frame)];
  for (let popup = pending.shift(); popup !== undefined; popup = pending.shift()) {
    if (popup !== frame && !popups.has(popup)) {
      popups.add(popup);
      pending.push(...opensFrom(popup));
    }
  }
  return [...popups].map((popup) => {
    const { x, y, width, height } = popup.getBoundingClientRect();
    return { x, y, width, height };
  });
}
