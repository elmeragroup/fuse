import { afterAll, assert, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import { Capture } from "../src/capture.ts";
import { planShots } from "../src/shot-plan.ts";
import { shotOptions } from "./parse-argv.ts";

/**
 * The fixture pages: a demo stage holding a textbox, a 2000px page with no demo stage, a page
 * whose target needs a theme, and controls that open popups outside their own box.
 */
const pages = new Map([
  ["/demo", await readFile(path.join(import.meta.dirname, "fixture/demo.html"))],
  ["/page", await readFile(path.join(import.meta.dirname, "fixture/page.html"))],
  ["/themed", await readFile(path.join(import.meta.dirname, "fixture/themed.html"))],
  ["/popup", await readFile(path.join(import.meta.dirname, "fixture/popup.html"))],
]);

let server: Server;
let origin: URL;
let outDir: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const page = pages.get(request.url ?? "");
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
  outDir = await mkdtemp(path.join(tmpdir(), "pr-shots-"));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(outDir, { recursive: true, force: true });
});

/** A PNG's width and height, read from its IHDR chunk. */
function pngSize(png: Buffer) {
  expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** The RGB of the pixel at (x, y) in a PNG. */
function pixelAt(png: Buffer, x: number, y: number) {
  const image = PNG.sync.read(png);
  const index = (y * image.width + x) * 4;
  return [...image.data.subarray(index, index + 3)];
}

/** Whether any pixel of a PNG is pure red, the color of every popup in the popup fixture. */
function hasRed(png: Buffer) {
  const { data } = PNG.sync.read(png);
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] === 255 && data[index + 1] === 0 && data[index + 2] === 0) {
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
    return yield* Effect.flip(
      capture.capture({ origin, sourceLabel: "fixture", options, shots: [row.after], outDir })
    );
  });
}

describe("Capture", () => {
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

  it.live(
    "resolves auto to viewport without a target, and shoots the window at its size times the scale",
    () =>
      Effect.gen(function* () {
        const { frame, file, png } = yield* shoot([
          "fixture",
          "--route",
          "/page",
          "--viewports",
          "640x480",
          "--scale",
          "2",
        ]);
        assert.strictEqual(frame, "viewport");
        assert.isTrue(file.endsWith("-640x480-viewport.png"));
        assert.deepStrictEqual(pngSize(png), { width: 640 * 2, height: 480 * 2 });
      }).pipe(Effect.provide(Capture.layer))
  );

  it.live("resolves auto after picking the theme, for a target that only the picked theme renders", () =>
    Effect.gen(function* () {
      // The Dashboard region exists only in the Internal variant; the page opens External.
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/themed",
        "--themes",
        "internal-fkas-private",
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

  it.live("stamps a density override on the document root of a page without a density scope", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/page",
        "--densities",
        "dense",
        "--viewports",
        "640x480",
        "--scale",
        "1",
      ]);
      // The swatch, at (40, 110) to (80, 150), turns red under `data-density="dense"`.
      assert.deepStrictEqual(pixelAt(png, 60, 132), [255, 0, 0]);
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("refuses --themes on a page without a theme picker, naming the flag and the route", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(
        ["fixture", "--route", "/page", "--themes", "internal-fkas-private"],
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

  it.live("runs the clicks in order and clips the target together with the list it opened", () =>
    Effect.gen(function* () {
      // Rows per page renders only after Internal is clicked, so the order of the steps matters.
      const { frame, png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Internal",
        "--click",
        "combobox:Rows per page",
        "--target",
        "combobox:Rows per page",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      assert.strictEqual(frame, "target");
      // The trigger spans (40, 40) to (240, 70) and its portaled listbox (60, 90) to (300, 210),
      // so the union spans (40, 40) to (300, 210).
      assert.deepStrictEqual(pngSize(png), { width: 260, height: 170 });
      // The listbox's middle, (180, 150) on the page, is red while the list is open.
      assert.deepStrictEqual(pixelAt(png, 180 - 40, 150 - 40), [255, 0, 0]);
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live(
    "clicks the match a step's @n picks, and frames the open menu of a control without aria-controls",
    () =>
      Effect.gen(function* () {
        const { png } = yield* shoot([
          "fixture",
          "--route",
          "/popup",
          "--click",
          "button:Actions@1",
          "--target",
          "button:Actions",
          "--nth",
          "1",
          "--frame",
          "target",
          "--pad",
          "0",
          "--scale",
          "1",
        ]);
        // The second Actions button spans (400, 100) to (600, 130) and its menu (380, 150) to
        // (540, 240). The first button's menu, at (700, 300), is closed but keeps its layout
        // under visibility: hidden, and the menu at (1000, 600) is laid out at opacity 0.
        // Neither shows, so neither widens the clip.
        assert.deepStrictEqual(pngSize(png), { width: 220, height: 140 });
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

  it.live("takes in a submenu that an item of the open menu holds open", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:More",
        "--click",
        "menuitem:Share",
        "--target",
        "button:More",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The trigger spans (40, 480) to (240, 510), its menu (40, 520) to (240, 620), and the
      // Share submenu, which only the menu's item names, (250, 520) to (440, 580).
      assert.deepStrictEqual(pngSize(png), { width: 400, height: 140 });
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live(
    "finds a target by its accessible name after an unrelated click, ignoring aria-hidden text in it",
    () =>
      Effect.gen(function* () {
        const { png } = yield* shoot([
          "fixture",
          "--route",
          "/popup",
          "--click",
          "button:Internal",
          "--target",
          "button:Inbox",
          "--frame",
          "target",
          "--pad",
          "0",
          "--scale",
          "1",
        ]);
        // The Inbox button, named without its aria-hidden " 9", spans (900, 400) to (1100, 430).
        assert.deepStrictEqual(pngSize(png), { width: 200, height: 30 });
      }).pipe(Effect.provide(Capture.layer))
  );

  it.live("waits for a control a step clicked to open its popup when it opens late", () =>
    Effect.gen(function* () {
      const { png } = yield* shoot([
        "fixture",
        "--route",
        "/popup",
        "--click",
        "button:Later",
        "--target",
        "button:Later",
        "--frame",
        "target",
        "--pad",
        "0",
        "--scale",
        "1",
      ]);
      // The trigger spans (900, 480) to (1100, 510) and the menu it opens 500ms after the click
      // (900, 520) to (1100, 600).
      assert.deepStrictEqual(pngSize(png), { width: 200, height: 120 });
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
      assert.isTrue(hasRed(png));
    }).pipe(Effect.provide(Capture.layer))
  );

  it.live("names the click step, the element and the route when a step finds nothing", () =>
    Effect.gen(function* () {
      const failure = yield* failedShot(
        ["fixture", "--route", "/popup", "--click", "button:Internal", "--click", "button:Nope"],
        "viewport"
      );
      assert.strictEqual(failure._tag, "CaptureFailed");
      assert.include(
        failure.message,
        '--click step 2 of 2: No button named "Nope" at index 0: nothing matched (/popup on fixture)'
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
