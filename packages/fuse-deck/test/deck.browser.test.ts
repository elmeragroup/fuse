import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** The built bin, the file the packed tarball ships. Turbo builds it before this suite runs. */
declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- only an interface merges into the DOM's Window
  interface Window {
    /** The view transitions the page started, recorded by the init script in `deckPage`. */
    viewTransitions?: ViewTransition[];
    /** For each view transition, the pseudo-elements it animates once it is ready. */
    viewTransitionPseudos?: Promise<string[]>[];
  }
}

const BIN = fileURLToPath(new URL("../dist/bin.mjs", import.meta.url));

const SLIDES = {
  cover: '---\nlayout: cover\n---\n\n<Morph name="logo"> <span>Fuse</span> </Morph>\n\n# Talk\n',
  intro:
    '# Why Fuse\n\n<Morph name="logo"><span>Fuse</span></Morph>\n\n<Step>One library</Step>\n\n<Step>[Every brand](#brands)</Step>\n\n<Step>Both densities</Step>\n',
  outro:
    '---\nlayout: section\n---\n\nimport { Button } from "@elmeragroup/fuse/button";\n\n# Thanks\n\n<Button>Ask a question</Button>\n\n<div role="slider" tabIndex={0} aria-label="Volume" aria-valuenow={5} onKeyDown={(event) => event.preventDefault()} />\n',
};

let workspace = "";
let site = "";
let browser: Browser;
let close: () => Promise<void> = () => Promise.resolve();

function fuseDeck(cwd: string, args: readonly string[]): void {
  const run = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(`fuse-deck ${args.join(" ")} exited ${String(run.status)}: ${run.stdout}${run.stderr}`);
  }
}

function contentType(extension: string): string {
  switch (extension) {
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".css":
      return "text/css";
    default:
      return "application/octet-stream";
  }
}

/** Serves the built deck, the way any static host would. */
async function serve(root: string): Promise<{ readonly url: string; readonly close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://deck").pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    stat(file).then(
      () => {
        response.writeHead(200, {
          "content-type": contentType(path.extname(file)),
        });
        createReadStream(file).pipe(response);
      },
      () => {
        response.writeHead(404).end();
      }
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  // SAFETY: a TCP server listening on a port reports an AddressInfo, never a pipe name or null.
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

beforeAll(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "fuse-deck-browser-"));
  fuseDeck(workspace, ["create", "talk", "--brief", "Show Fuse."]);
  const deck = path.join(workspace, "talk");
  fuseDeck(deck, ["slides", "add", "intro"]);
  fuseDeck(deck, ["slides", "add", "outro"]);
  for (const [id, text] of Object.entries(SLIDES)) {
    await writeFile(path.join(deck, "slides", `${id}.mdx`), text);
  }
  fuseDeck(deck, ["build"]);
  const server = await serve(path.join(deck, "dist"));
  site = server.url;
  close = server.close;
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser.close();
  await close();
  await rm(workspace, { recursive: true, force: true });
});

/** A page that counts the view transitions the document starts. */
async function deckPage(hash = "", colorScheme: "light" | "dark" = "light"): Promise<Page> {
  const page = await browser.newPage({ colorScheme });
  await page.addInitScript(() => {
    const started: ViewTransition[] = [];
    const pseudos: Promise<string[]>[] = [];
    window.viewTransitions = started;
    window.viewTransitionPseudos = pseudos;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (...args: Parameters<typeof start>) => {
      const transition = start(...args);
      started.push(transition);
      pseudos.push(
        transition.ready.then(() =>
          document
            .getAnimations()
            .map((animation) =>
              animation.effect instanceof KeyframeEffect ? animation.effect.pseudoElement : null
            )
            .filter((pseudo): pseudo is string => pseudo !== null)
        )
      );
      return transition;
    };
  });
  await page.goto(`${site}${hash}`);
  await page.locator("[aria-roledescription=slide]").waitFor();
  return page;
}

/** The pseudo-elements each view transition animated, in order. */
function viewTransitionPseudos(page: Page): Promise<string[][]> {
  return page.evaluate(() => Promise.all(window.viewTransitionPseudos ?? []));
}

/** How many view transitions the page has started, once every one has finished. */
function viewTransitionCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const started = window.viewTransitions ?? [];
    await Promise.all(started.map((transition) => transition.finished.catch(() => undefined)));
    return started.length;
  });
}

async function at(page: Page, hash: string): Promise<void> {
  await page.waitForFunction((expected) => location.hash === expected, hash);
}

/** Which of the slide's steps are revealed, in document order. */
function revealed(page: Page): Promise<boolean[]> {
  return page
    .locator("[aria-roledescription=slide] [inert], [aria-roledescription=slide] [data-revealed]")
    .evaluateAll((steps) => steps.map((step) => step.hasAttribute("data-revealed")));
}

describe("a built deck", () => {
  it("animates slide changes and never step changes, from the keyboard", async () => {
    const page = await deckPage();
    expect(await viewTransitionCount(page)).toBe(0);
    await page.keyboard.press("ArrowRight");
    await at(page, "#/intro");
    expect(await viewTransitionCount(page)).toBe(1);
    for (const step of [1, 2, 3]) {
      await page.keyboard.press("ArrowRight");
      await at(page, `#/intro/${String(step)}`);
    }
    expect(await revealed(page)).toEqual([true, true, true]);
    expect(await viewTransitionCount(page)).toBe(1);
    await page.keyboard.press("ArrowRight");
    await at(page, "#/outro");
    expect(await viewTransitionCount(page)).toBe(2);
    await expect.poll(() => page.locator("[aria-live]").textContent()).toBe("Slide 3 of 3");
    await page.close();
  });

  it("moves a Morph to its partner on the next slide, and lets an unpaired one fade", async () => {
    const page = await deckPage();
    await page.keyboard.press("ArrowRight");
    await at(page, "#/intro");
    await page.keyboard.press("End");
    await at(page, "#/outro");
    const morph = "::view-transition-group(deck-morph-logo)";
    const [toIntro, toOutro] = await viewTransitionPseudos(page);
    expect([toIntro?.includes(morph), toOutro?.includes(morph)]).toEqual([true, false]);
    await page.close();
  });

  it("opens a deep link at its step, with no view transition", async () => {
    const page = await deckPage("#/intro/2");
    expect(await page.locator("[aria-roledescription=slide]").getAttribute("aria-label")).toBe("Why Fuse");
    expect(await revealed(page)).toEqual([true, true, false]);
    expect(await page.locator("[aria-live]").textContent()).toBe("Slide 2 of 3");
    expect(await viewTransitionCount(page)).toBe(0);
    await page.close();
  });

  it("animates Back and Forward across slides, and not across steps", async () => {
    const page = await deckPage("#/intro/2");
    await page.keyboard.press("ArrowRight");
    await at(page, "#/intro/3");
    await page.keyboard.press("ArrowRight");
    await at(page, "#/outro");
    expect(await viewTransitionCount(page)).toBe(1);

    await page.goBack();
    await at(page, "#/intro/3");
    await expect
      .poll(() => page.locator("[aria-roledescription=slide]").getAttribute("aria-label"))
      .toBe("Why Fuse");
    expect(await viewTransitionCount(page)).toBe(2);

    await page.goBack();
    await at(page, "#/intro/2");
    await expect.poll(() => revealed(page)).toEqual([true, true, false]);
    expect(await viewTransitionCount(page)).toBe(2);

    await page.goForward();
    await expect.poll(() => revealed(page)).toEqual([true, true, true]);
    expect(await viewTransitionCount(page)).toBe(2);

    await page.goForward();
    await at(page, "#/outro");
    await expect
      .poll(() => page.locator("[aria-roledescription=slide]").getAttribute("aria-label"))
      .toBe("Thanks");
    expect(await viewTransitionCount(page)).toBe(3);
    await page.close();
  });

  it("corrects an address past the last step in place, so Back leaves it", async () => {
    const page = await deckPage("#/intro");
    await page.evaluate(() => {
      location.hash = "#/intro/99";
    });
    await at(page, "#/intro/3");
    await page.goBack();
    await at(page, "#/intro");
    await expect.poll(() => revealed(page)).toEqual([false, false, false]);
    await page.close();
  });

  it("keeps unrevealed steps out of focus and out of sight", async () => {
    const page = await deckPage("#/intro/1");
    const link = page.getByRole("link", { name: "Every brand", includeHidden: true });
    const step = page
      .locator("[aria-roledescription=slide] :is([inert], [data-revealed])")
      .filter({ has: link });
    expect(
      await step.evaluate((element) => [
        element instanceof HTMLElement && element.inert,
        getComputedStyle(element).opacity,
      ])
    ).toEqual([true, "0"]);
    await link.focus();
    expect(await link.evaluate((element) => element === document.activeElement)).toBe(false);

    await page.keyboard.press("ArrowRight");
    await at(page, "#/intro/2");
    await link.focus();
    expect(await link.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });

  it("leaves keys to a focused control that uses them, and renders a Fuse component a slide imports", async () => {
    const page = await deckPage("#/outro");
    const button = page.getByRole("button", { name: "Ask a question" });
    expect(await button.getAttribute("data-slot")).toBe("button");
    await button.evaluate((element) => {
      element.addEventListener("click", () => {
        element.dataset.clicks = String(Number(element.dataset.clicks ?? 0) + 1);
      });
    });
    await button.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    expect(await button.getAttribute("data-clicks")).toBe("2");
    expect(await page.evaluate(() => location.hash)).toBe("#/outro");
    // The slider handles its arrows and prevents their default, so the deck stays put.
    await page.getByRole("slider", { name: "Volume" }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Home");
    expect(await page.evaluate(() => location.hash)).toBe("#/outro");
    await button.focus();
    await page.keyboard.press("ArrowLeft");
    await at(page, "#/intro/3");
    await page.close();
  });

  it("paints the theme and each color scheme's background before any module runs", async () => {
    const backgrounds: string[] = [];
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ colorScheme });
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(site);
      const paint = await page.evaluate(() => ({
        identity: document.documentElement.dataset.themeIdentity,
        brand: document.documentElement.dataset.themeBrand,
        segment: document.documentElement.dataset.themeSegment,
        density: document.documentElement.dataset.density,
        scheme: document.documentElement.dataset.theme,
        background: getComputedStyle(document.body).backgroundColor,
        rendered: document.querySelector("[aria-roledescription=slide]") !== null,
      }));
      expect(paint).toMatchObject({
        identity: "neutral",
        brand: "elma",
        segment: "private",
        density: "comfortable",
        scheme: colorScheme,
        rendered: false,
      });
      backgrounds.push(paint.background);
      await page.close();
    }
    expect(backgrounds).not.toContain("rgba(0, 0, 0, 0)");
    expect(new Set(backgrounds).size).toBe(2);

    const html = await (await fetch(site)).text();
    const stylesheet = html.search(/<link[^>]*rel="stylesheet"/);
    const bootstrap = html.indexOf("<script>");
    const entry = html.search(/<script[^>]*type="module"/);
    expect(stylesheet).toBeGreaterThan(-1);
    expect([stylesheet < bootstrap, bootstrap < entry]).toEqual([true, true]);
  });
});
