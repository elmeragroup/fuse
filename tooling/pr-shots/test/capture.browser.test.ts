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

/** The fixture pages: a demo stage holding a textbox, and a 2000px page with no demo stage. */
const pages = new Map([
  ["/demo", await readFile(path.join(import.meta.dirname, "fixture/demo.html"))],
  ["/page", await readFile(path.join(import.meta.dirname, "fixture/page.html"))],
  ["/themed", await readFile(path.join(import.meta.dirname, "fixture/themed.html"))],
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
      const image = PNG.sync.read(png);
      const index = (132 * image.width + 60) * 4;
      assert.deepStrictEqual([...image.data.subarray(index, index + 3)], [255, 0, 0]);
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

  it.live("reports the status a source answers for a route", () =>
    Effect.gen(function* () {
      const capture = yield* Capture;
      assert.strictEqual(yield* capture.probe(origin, "/demo"), 200);
      assert.strictEqual(yield* capture.probe(origin, "/not-deployed"), 404);
    }).pipe(Effect.provide(Capture.layer))
  );
});
