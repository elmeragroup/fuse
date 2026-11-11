import { Activity, createElement } from "react";

import { afterAll, assert, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { renderToString } from "react-dom/server";

import { Capture } from "../src/capture.ts";
import { planShots } from "../src/shot-plan.ts";
import { shotOptions } from "./parse-argv.ts";

/**
 * The fixture pages: a demo stage holding a textbox, a 2000px page with no demo stage, a page
 * whose target needs a theme, controls that open popups outside their own box, and React pages: one
 * whose buttons mount a part whose code loads on demand, a page that frames it, a server-rendered
 * Activity that never hydrates, a Next page whose React never reports, a page that frames it, a
 * framed preview whose reload never arrives, and a renderer the reading does not know.
 */
const pages = new Map([
  ["/demo", await readFile(path.join(import.meta.dirname, "fixture/demo.html"))],
  ["/page", await readFile(path.join(import.meta.dirname, "fixture/page.html"))],
  ["/themed", await readFile(path.join(import.meta.dirname, "fixture/themed.html"))],
  ["/popup", await readFile(path.join(import.meta.dirname, "fixture/popup.html"))],
  ["/lazy", await readFile(path.join(import.meta.dirname, "fixture/lazy.html"))],
  ["/unhooked", await readFile(path.join(import.meta.dirname, "fixture/unhooked.html"))],
  ["/framed", await readFile(path.join(import.meta.dirname, "fixture/framed.html"))],
  ["/framed-unhooked", await readFile(path.join(import.meta.dirname, "fixture/framed-unhooked.html"))],
  ["/reloading", await readFile(path.join(import.meta.dirname, "fixture/reloading.html"))],
  [
    "/ssr-activity",
    Buffer.from(
      (await readFile(path.join(import.meta.dirname, "fixture/ssr-activity.html"), "utf8")).replace(
        "<!--server-->",
        renderToString(
          createElement(Activity, { mode: "visible", children: createElement("div", { id: "side" }) })
        )
      )
    ),
  ],
  ["/foreign-renderer", await readFile(path.join(import.meta.dirname, "fixture/foreign-renderer.html"))],
]);

/**
 * React's production build as one classic script that sets `React` and `ReactDOMClient`, so the
 * lazy fixture runs the React a deployed page runs, without a bundler. Each CommonJS module is
 * wrapped in a function and resolved through a small `require`.
 */
async function reactScript(): Promise<string> {
  const fromHere = createRequire(import.meta.url);
  const fromReactDom = createRequire(fromHere.resolve("react-dom/package.json"));
  const file = (resolve: NodeJS.Require, name: string) =>
    path.join(path.dirname(resolve.resolve(`${name}/package.json`)), "cjs");
  const modules = {
    react: path.join(file(fromHere, "react"), "react.production.js"),
    scheduler: path.join(file(fromReactDom, "scheduler"), "scheduler.production.js"),
    "react-dom": path.join(file(fromHere, "react-dom"), "react-dom.production.js"),
    "react-dom/client": path.join(file(fromHere, "react-dom"), "react-dom-client.production.js"),
  };
  const sources = await Promise.all(
    Object.entries(modules).map(
      async ([name, source]) =>
        `${JSON.stringify(name)}: function (module, exports, require) {\n${await readFile(source, "utf8")}\n}`
    )
  );
  return `(() => {
  const sources = {${sources.join(",\n")}};
  const cache = {};
  const require = (name) => {
    if (!(name in cache)) {
      const module = { exports: {} };
      cache[name] = module;
      sources[name](module, module.exports, require);
    }
    return cache[name].exports;
  };
  window.React = require("react");
  window.ReactDOMClient = require("react-dom/client");
})();`;
}

const react = await reactScript();

let server: Server;
/** How many times the reloading fixture's preview has been asked for. */
let previewRequests = 0;
let origin: URL;
/** Holds one directory per shot, since shots of different tests can share a file name. */
let outRoot: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/react.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(react);
      return;
    }
    if (request.url === "/chunk/now") {
      response.writeHead(200).end();
      return;
    }
    // The reloading fixture's preview: answered once, then held, so its reload never commits.
    if (request.url === "/preview") {
      previewRequests += 1;
      if (previewRequests === 1) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pages.get("/lazy"));
      }
      return;
    }
    const page = pages.get(new URL(request.url ?? "/", "http://fixture").pathname);
    if (page !== undefined) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || !(address instanceof Object)) {
    throw new Error("The fixture server reported no port");
  }
  origin = new URL(`http://127.0.0.1:${String(address.port)}`);
  outRoot = await mkdtemp(path.join(tmpdir(), "pr-shots-"));
});

afterAll(async () => {
  // The held preview reload keeps its connection open.
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(outRoot, { recursive: true, force: true });
});

/** A PNG's width and height, read from its IHDR chunk. */
function pngSize(png: Buffer) {
  expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Pure red, the color of every popup in the popup fixture. */
const RED = [255, 0, 0] as const;
/** Pure blue, the color of the lazy fixture's loaded part. */
const BLUE = [0, 0, 255] as const;

/** Whether any pixel of a PNG is exactly `rgb`. */
function hasPixel(png: Buffer, [red, green, blue]: readonly [number, number, number]) {
  const { data } = PNG.sync.read(png);
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] === red && data[index + 1] === green && data[index + 2] === blue) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the run's frame on the fixture server, as a run does on its after source, and takes
 * the after shot of its first row. Returns the frame and the PNG.
 */
function shoot(argv: readonly string[]) {
  return Effect.gen(function* () {
    const options = shotOptions(argv);
    const capture = yield* Capture;
    const frame = yield* capture.resolveFrame({ origin, sourceLabel: "fixture", options });
    const [row] = planShots(options, frame);
    if (row === undefined) {
      return yield* Effect.die("The run planned no shots");
    }
    const outDir = yield* Effect.promise(() => mkdtemp(path.join(outRoot, "shot-")));
    yield* capture.capture({ origin, sourceLabel: "fixture", options, shots: [row.after], outDir });
    const png = yield* Effect.promise(() => readFile(path.join(outDir, row.after.file)));
    return { frame, file: row.after.file, png };
  });
}

/** The failure of an after shot on the fixture server, with the frame given on the command line. */
function failedShot(argv: readonly string[], frame: "stage" | "target" | "viewport") {
  return Effect.gen(function* () {
    const options = shotOptions(argv);
    const capture = yield* Capture;
    const [row] = planShots(options, frame);
    if (row === undefined) {
      return yield* Effect.die("The run planned no shots");
    }
    const outDir = yield* Effect.promise(() => mkdtemp(path.join(outRoot, "shot-")));
    return yield* Effect.flip(
      capture.capture({ origin, sourceLabel: "fixture", options, shots: [row.after], outDir })
    );
  });
}

describe.concurrent("Capture", () => {
  // These two wait out a 15 s timeout, the click step's and the settle's, so they start first and
  // the other shots run beside them.
  it.live("names the click step whose control never opens what it claims to", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(
        ["fixture", "--route", "/popup", "--click", "button:Stuck"],
        "viewport"
      );
      assert.strictEqual(failure._tag, "CaptureFailed");
      assert.include(
        failure.message,
        '--click step 1 of 1: button "Stuck" did not open: no popup it holds open shows (/popup on fixture)'
      );
    }).pipe(Effect.provide(Capture.layer))
  );

  // Unit under test: the capture's wait on React. Oracle: each fixture's part, whose code never
  // arrives, behind a boundary that marks nothing, as a deployed page's would. Each case waits out the 15 s settle timeout.
  it.live.each([
    { case: "a part a click step suspended", route: "/lazy", clicks: ["--click", "button:Stall"], where: "" },
    {
      case: "a part in a painted frame",
      route: "/framed",
      clicks: [],
      where: " in the frame at {origin}/lazy?part=stall",
    },
    { case: "a server-rendered Activity's hydration", route: "/ssr-activity", clicks: [], where: "" },
  ])("fails a shot while React never finishes $case", ({ route, clicks, where }) =>
    Effect.gen(function* () {
      const failure = yield* failedShot(["fixture", "--route", route, ...clicks], "viewport");
      assert.strictEqual(failure._tag, "CaptureFailed");
      assert.include(
        failure.message,
        `React still had a part loading${where.replace("{origin}", origin.origin)} after 15 s (${route} on fixture)`
      );
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("resolves auto to stage for a target in a demo stage, and clips the stage plus padding", () =>
    Effect.gen(function* () {
      const { frame, file, png } = yield* shoot([
        "fixture",
        "--route",
        "/demo",
        "--target",
        "textbox:Mobile",
        "--fill",
        "123123",
        "--pad",
        "12",
        "--scale",
        "2",
      ]);
      assert.strictEqual(frame, "stage");
      assert.isTrue(file.endsWith("-1280x900-stage.png"));
      // The fixture stage is 300 × 120 CSS px; 12 px of padding on each side, at scale 2.
      assert.deepStrictEqual(pngSize(png), { width: (300 + 2 * 12) * 2, height: (120 + 2 * 12) * 2 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("resolves auto to target for a target outside any demo stage, and clips it plus padding", () =>
    Effect.gen(function* () {
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/page",
        "--target",
        "searchbox:Search",
        "--pad",
        "8",
        "--scale",
        "1",
      ]);
      assert.strictEqual(frame, "target");
      // The search field is 200 × 30 CSS px; 8 px of padding on each side, at scale 1.
      assert.deepStrictEqual(pngSize(png), { width: 200 + 2 * 8, height: 30 + 2 * 8 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("resolves auto after picking the theme, for a target that only the picked theme renders", () =>
    Effect.gen(function* () {
      // The Dashboard region exists only in the Neutral identity; the page opens Branded.
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/themed",
        "--themes",
        "neutral-fkas-private",
        "--target",
        "region:Dashboard",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      assert.strictEqual(frame, "target");
      assert.deepStrictEqual(pngSize(png), { width: 320, height: 160 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("shoots the whole page at the document's height times the scale", () =>
    Effect.gen(function* () {
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/page",
        "--frame",
        "page",
        "--viewports",
        "640x480",
        "--scale",
        "1",
      ]);
      assert.strictEqual(frame, "page");
      // The fixture's document is 2000 CSS px tall, taller than the 480 px window.
      assert.deepStrictEqual(pngSize(png), { width: 640, height: 2000 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("refuses --themes on a page without a theme picker, naming the flag and the route", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(
        ["fixture", "--route", "/page", "--themes", "neutral-fkas-private"],
        "viewport"
      );
      assert.strictEqual(failure._tag, "ThemesUnsupported");
      assert.include(
        failure.message,
        "--themes needs a theme picker on the page, and /page on fixture has none"
      );
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live.each([{ extra: [] }, { extra: ["--densities", "dense"] }])(
    "refuses --frame stage for a target outside any demo stage, naming the frame and the route, $extra",
    ({ extra }: { readonly extra: readonly string[] }) =>
      Effect.gen(function* () {
        const failure = yield* failedShot(
          ["fixture", "--route", "/page", "--target", "searchbox:Search", "--frame", "stage", ...extra],
          "stage"
        );
        assert.strictEqual(failure._tag, "FrameNotFound");
        assert.include(
          failure.message,
          '--frame stage found nothing to clip on /page on fixture: the searchbox "Search" is not inside a [data-demo-stage]'
        );
      }).pipe(Effect.provide(Capture.layer))
  );

  it.live("refuses --frame target without a target, naming the frame and the route", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(["fixture", "--route", "/page", "--frame", "target"], "target");
      assert.strictEqual(failure._tag, "FrameNotFound");
      assert.include(failure.message, "--frame target found nothing to clip on /page on fixture");
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("names the role, the name and the route when the target is missing", () =>
    Effect.gen(function* () {
      const capture = yield* Capture;
      const failure = yield* Effect.flip(
        capture.resolveFrame({
          origin,
          sourceLabel: "fixture",
          options: shotOptions(["fixture", "--route", "/demo", "--target", "textbox:Email"]),
        })
      );
      assert.strictEqual(failure._tag, "CaptureFailed");
      assert.match(failure.message, /No textbox named "Email".*\/demo on fixture/);
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("finds a target that the modal dialog its click opened hides from the accessibility tree", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Move",
        "--target",
        "button:Move",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The trigger spans (900, 40) to (1100, 70) and the dialog (860, 120) to (1160, 320).
      assert.deepStrictEqual(pngSize(png), { width: 300, height: 280 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("waits on the trigger that replaced the one a step clicked", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Swap",
        "--target",
        "button:Swap",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The new trigger spans (40, 700) to (240, 730) and its menu (40, 740) to (240, 800).
      assert.deepStrictEqual(pngSize(png), { width: 200, height: 100 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("waits for the popup of a control that reports itself expanded before the popup mounts", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Eager",
        "--target",
        "button:Eager",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The trigger spans (40, 850) to (240, 880) and the menu it mounts a second after the
      // click (60, 900) to (300, 1020).
      assert.deepStrictEqual(pngSize(png), { width: 260, height: 170 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("finds a modal-hidden target behind an earlier, boxless match of the same name", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Edit@1",
        "--target",
        "button:Edit",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The trigger spans (900, 800) to (1100, 830) and its dialog (860, 860) to (1160, 960).
      assert.deepStrictEqual(pngSize(png), { width: 300, height: 160 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("keeps the scroll position the clicks left for a window shot", () =>
    Effect.gen(function* () {
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Far",
        "--viewports",
        "640x480",
        "--scale",
        "1",
      ]);
      assert.strictEqual(frame, "viewport");
      // The list opens at y 1640, below the first 480px window, so it shows only if the shot
      // stays where clicking Far scrolled the page.
      assert.isTrue(hasPixel(png, RED));
    }).pipe(Effect.provide(Capture.layer))
  );

  // The stalled parts above show the shot waits; these show what does not hold it. A part that has
  // loaded ends the wait. A part that never loads under `opacity: 0`, or in a hidden Activity,
  // which leaves React work pending for good, shows nothing, so it does not hold the shot.
  it.live.each([
    { case: "has loaded", clicks: ["button:Show"], shown: true },
    { case: "never loads under opacity: 0", clicks: ["button:Stall hidden"], shown: false },
    { case: "never loads in a hidden Activity", clicks: ["button:Stall offscreen"], shown: false },
  ])("shoots a part a click step mounts that $case", ({ clicks, shown }) =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/lazy",
        ...clicks.flatMap((click) => ["--click", click]),
        "--viewports",
        "640x480",
        "--scale",
        "1",
      ]);
      // The part is the only blue on the page.
      assert.strictEqual(hasPixel(png, BLUE), shown);
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("fails a page whose React renderer the reading was not checked against, naming it", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(["fixture", "--route", "/foreign-renderer"], "viewport");
      assert.strictEqual(failure._tag, "CaptureFailed");
      assert.include(
        failure.message,
        "The page runs react-dom 20.0.0, which the run cannot read; it reads react-dom 19 (/foreign-renderer on fixture)"
      );
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live(
    "fails a shot while a framed preview's reload never arrives, rather than reading its old page",
    () =>
      Effect.gen(function* () {
        const failure = yield* failedShot(
          ["fixture", "--route", "/reloading", "--click", "button:Reload preview"],
          "viewport"
        );
        assert.strictEqual(failure._tag, "CaptureFailed");
        assert.include(
          failure.message,
          `The page in the frame at ${origin.origin}/preview was still loading ${origin.origin}/preview after 15 s (/reloading on fixture)`
        );
      }).pipe(Effect.provide(Capture.layer))
  );

  // Each case waits out the 15 s settle timeout for React to register.
  it.live.each([
    { case: "page", route: "/unhooked", where: "" },
    {
      case: "page in a painted frame",
      route: "/framed-unhooked",
      where: " in the frame at {origin}/unhooked",
    },
  ])(
    "fails a Next $case whose React never reports its commits, rather than shooting it unchecked",
    ({ route, where }) =>
      Effect.gen(function* () {
        const failure = yield* failedShot(["fixture", "--route", route], "viewport");
        assert.strictEqual(failure._tag, "CaptureFailed");
        assert.include(
          failure.message,
          `The page's React never reported its commits${where.replace("{origin}", origin.origin)}, so the run cannot tell when what it loads has rendered (${route} on fixture)`
        );
      }).pipe(Effect.provide(Capture.layer))
  );

  it.live("reports the status a source answers for a route", () =>
    Effect.gen(function* () {
      const capture = yield* Capture;
      assert.strictEqual(yield* capture.probe(origin, "/demo"), 200);
      assert.strictEqual(yield* capture.probe(origin, "/not-deployed"), 404);
    }).pipe(Effect.provide(Capture.layer))
  );
});
