import { Result } from "effect";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { DEFAULT_THRESHOLD, diffPngs } from "./pixel-diff.ts";

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** An opaque PNG of `width` × `height` in `fill`, with the listed pixels painted. */
function png(
  width: number,
  height: number,
  fill: Rgb,
  painted: readonly (readonly [number, number, Rgb])[] = []
) {
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = painted.find(([px, py]) => px === x && py === y)?.[2] ?? fill;
      image.data.set([...color, 255], (y * width + x) * 4);
    }
  }
  return PNG.sync.write(image);
}

/** The coordinates of the pure red pixels pixelmatch paints for a changed pixel. */
function redPixels(bytes: Uint8Array): (readonly [number, number])[] {
  const image = PNG.sync.read(Buffer.from(bytes));
  const red: (readonly [number, number])[] = [];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      if (image.data[index] === 255 && image.data[index + 1] === 0 && image.data[index + 2] === 0) {
        red.push([x, y]);
      }
    }
  }
  return red;
}

function diff(before: Uint8Array, after: Uint8Array, threshold = DEFAULT_THRESHOLD) {
  return Result.getOrThrow(
    diffPngs({ file: "before.png", bytes: before }, { file: "after.png", bytes: after }, threshold)
  );
}

describe("diffPngs", () => {
  it("counts no change between identical images", () => {
    const result = diff(png(4, 4, WHITE), png(4, 4, WHITE));
    expect(result._tag === "compared" && [result.changed, result.total]).toEqual([0, 16]);
  });

  it("counts exactly the three pixels that turned black and paints them red", () => {
    // Three white pixels of a 4 × 4 white image turn black, no two of them adjacent.
    const changedPixels = [
      [0, 0],
      [2, 1],
      [3, 3],
    ] as const;
    const result = diff(
      png(4, 4, WHITE),
      png(
        4,
        4,
        WHITE,
        changedPixels.map(([x, y]) => [x, y, BLACK] as const)
      )
    );
    expect(result._tag).toBe("compared");
    if (result._tag !== "compared") {
      return;
    }
    expect([result.changed, result.total]).toEqual([3, 16]);
    expect(redPixels(result.png)).toEqual(changedPixels);
  });

  it("passes the threshold through, so a faint change counts only at a strict threshold", () => {
    // One pixel moves from gray 200 to gray 210. Its YIQ distance is about 50, below the
    // default threshold's 352 (35215 × 0.1²) and above threshold 0's 0.
    const before = png(4, 4, WHITE, [[1, 1, [200, 200, 200]]]);
    const after = png(4, 4, WHITE, [[1, 1, [210, 210, 210]]]);
    const strict = diff(before, after, 0);
    const lenient = diff(before, after, DEFAULT_THRESHOLD);
    expect(strict._tag === "compared" && strict.changed).toBe(1);
    expect(lenient._tag === "compared" && lenient.changed).toBe(0);
  });

  it("reports both sizes and compares nothing when the images differ in size", () => {
    expect(diff(png(4, 4, WHITE), png(4, 5, WHITE))).toEqual({
      _tag: "size-changed",
      before: { width: 4, height: 4 },
      after: { width: 4, height: 5 },
    });
  });

  it("names the file that is not a PNG", () => {
    const result = diffPngs(
      { file: "before.png", bytes: png(4, 4, WHITE) },
      { file: "after.png", bytes: new TextEncoder().encode("not a png") },
      DEFAULT_THRESHOLD
    );
    expect(Result.isFailure(result) && [result.failure._tag, result.failure.message]).toEqual([
      "PngUnreadable",
      "Could not read after.png as a PNG",
    ]);
  });
});
