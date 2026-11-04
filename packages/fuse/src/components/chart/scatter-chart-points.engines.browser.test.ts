// Unit under test: the engine's rasteriser over the path data `pointsPath` writes, zero-length
// subpaths with round caps. SVG 2 says a zero-length subpath with round caps paints a dot of the
// stroke's width, and a scatter chart's every point relies on it. Oracle: pixel reads of the
// engine's own rendering, judged against circles placed by hand: a pixel well inside each dot is
// painted, and a pixel past its radius, or between two dots, is not.
import { describe, expect, it } from "vitest";

import { pointsPath } from "./layout/scatter-frame";

const WIDTH = 60;
const HEIGHT = 30;

/** Rasterise an SVG document through the engine's own SVG renderer onto a canvas. */
async function raster(svg: string): Promise<CanvasRenderingContext2D> {
  const image = new Image(WIDTH, HEIGHT);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("No 2D context");
  context.drawImage(image, 0, 0);
  return context;
}

/** The alpha at a pixel's centre. */
function alphaAt(context: CanvasRenderingContext2D, x: number, y: number): number {
  return context.getImageData(x, y, 1, 1).data[3] ?? 0;
}

describe("zero-length round-capped subpaths", () => {
  it("paints each point as a dot of the stroke's width, and nothing between them", async () => {
    // Two points on a 60 by 30 plot over x [0, 6] and y [0, 3]: (1, 1.5) at (10, 15) and (5, 1.5)
    // at (50, 15), 10 px dots, so each covers 5 px around its centre.
    const d = pointsPath(
      { box: { width: WIDTH, height: HEIGHT, dpr: 1, left: 0, top: 0 }, x: [0, 6], y: [0, 3] },
      Float64Array.of(1, 5),
      Float64Array.of(1.5, 1.5),
      10
    );
    expect(d).toBe("M10 15h0M50 15h0");
    const context = await raster(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}">` +
        `<path d="${d}" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round"/></svg>`
    );
    // Inside each dot: its centre pixel and pixels 3 px from it in each direction.
    for (const [x, y] of [
      [10, 15],
      [7, 15],
      [12, 15],
      [10, 12],
      [10, 17],
      [50, 15],
      [47, 15],
      [52, 15],
    ] as const) {
      expect(alphaAt(context, x, y), `inside at ${String(x)},${String(y)}`).toBe(255);
    }
    // Past each dot's 5 px radius, between the dots, and in two corners of the 10 px square a
    // square cap would paint, whose nearest corners lie 4 px across and 4 px down from the
    // centre, 5.7 px away.
    for (const [x, y] of [
      [3, 15],
      [17, 15],
      [10, 7],
      [10, 23],
      [30, 15],
      [14, 19],
      [5, 10],
    ] as const) {
      expect(alphaAt(context, x, y), `outside at ${String(x)},${String(y)}`).toBe(0);
    }
  });
});
