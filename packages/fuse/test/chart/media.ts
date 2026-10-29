/**
 * Media helpers for the chart forced-colours and print judges. They emulate media through
 * Playwright, read the page's pixels from a screenshot, and read the fill operations of a print
 * PDF's content streams.
 */
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    emulateMedia: (media: "screen" | "print", forcedColors: "active" | "none") => Promise<void>;
    screenshotPage: () => Promise<string>;
    printPdf: () => Promise<string>;
  }
}

/**
 * Emulate a media type and the forced-colors feature for the rest of the test.
 *
 * @param media - "screen" or "print".
 * @param forcedColors - "active" or "none".
 */
export async function emulateMedia(
  media: "screen" | "print",
  forcedColors: "active" | "none"
): Promise<void> {
  await commands.emulateMedia(media, forcedColors);
}

/** A rectangle in CSS pixels from the page's top left. */
export type PageRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A screenshot's pixels, with the device pixels per CSS pixel. */
export type PagePixels = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly scale: number;
};

/**
 * Read a screenshot of the test page's viewport.
 *
 * @returns The pixels and their scale.
 */
export async function pagePixels(): Promise<PagePixels> {
  const image = new Image();
  image.src = `data:image/png;base64,${await commands.screenshotPage()}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2d context");
  context.drawImage(image, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    scale: image.naturalWidth / innerWidth,
  };
}

/**
 * The spread of a pixel's RGB channels, 0 for a grey and 255 for a pure hue.
 *
 * @param pixels - The screenshot.
 * @param x - A device pixel column.
 * @param y - A device pixel row.
 * @returns The chroma.
 */
export function chromaAt(pixels: PagePixels, x: number, y: number): number {
  const index = (Math.round(y) * pixels.width + Math.round(x)) * 4;
  const red = pixels.data[index] ?? 0;
  const green = pixels.data[index + 1] ?? 0;
  const blue = pixels.data[index + 2] ?? 0;
  return Math.max(red, green, blue) - Math.min(red, green, blue);
}

/**
 * Count the chromatic pixels inside each rectangle of a viewport screenshot, the pixels whose
 * channels spread by more than 40 of 255, after pass 2's critic/media/media.mjs.
 *
 * @param rects - The rectangles, in viewport CSS pixels.
 * @returns One count per rectangle.
 */
export async function chromaticPixels(rects: readonly PageRect[]): Promise<number[]> {
  const image = new Image();
  image.src = `data:image/png;base64,${await commands.screenshotPage()}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2d context");
  context.drawImage(image, 0, 0);
  const scale = image.naturalWidth / innerWidth;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return rects.map((rect) => {
    let count = 0;
    const x0 = Math.floor(rect.x * scale);
    const x1 = Math.ceil((rect.x + rect.width) * scale);
    const y0 = Math.floor(rect.y * scale);
    const y1 = Math.ceil((rect.y + rect.height) * scale);
    for (let y = Math.max(0, y0); y < Math.min(y1, canvas.height); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(x1, canvas.width); x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index] ?? 0;
        const green = pixels[index + 1] ?? 0;
        const blue = pixels[index + 2] ?? 0;
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 40) count += 1;
      }
    }
    return count;
  });
}

/** The decompressed Flate streams of a PDF, each read to the exact length its dictionary gives. */
async function contentStreams(pdf: Uint8Array): Promise<string[]> {
  const text = new TextDecoder("latin1").decode(pdf);
  const streams: string[] = [];
  for (const match of text.matchAll(/<<([^<>]*?)\/Length (\d+)([^<>]*?)>>\s*stream\r?\n/gu)) {
    if (!`${match[1] ?? ""}${match[3] ?? ""}`.includes("/FlateDecode")) continue;
    const start = match.index + match[0].length;
    const bytes = pdf.slice(start, start + Number(match[2]));
    try {
      const inflated = await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))
      ).arrayBuffer();
      streams.push(new TextDecoder("latin1").decode(inflated));
    } catch {
      // A stream that is not zlib data holds no fill operations.
    }
  }
  return streams;
}

/**
 * Count the fill operations of a print PDF that paint a chromatic colour, the colours whose
 * channels spread by more than 0.15. Chromium sets a fill colour with `rg`, then fills.
 *
 * @returns The count, and the PDF's chromatic fill colours as `r g b` strings.
 */
export async function chromaticPdfFills(): Promise<{
  readonly fills: number;
  readonly colours: readonly string[];
}> {
  const binary = atob(await commands.printPdf());
  const pdf = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  let fills = 0;
  const colours = new Set<string>();
  for (const stream of await contentStreams(pdf)) {
    let chromatic = false;
    let colour = "";
    for (const line of stream.split(/\r?\n/u)) {
      const set = /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (?:rg|sc|scn)\b/u.exec(line);
      if (set !== null) {
        const [red, green, blue] = [Number(set[1]), Number(set[2]), Number(set[3])];
        chromatic = Math.max(red, green, blue) - Math.min(red, green, blue) > 0.15;
        colour = `${String(red)} ${String(green)} ${String(blue)}`;
      }
      if (/(?:^|\s)(?:f\*?|B\*?|b\*?)$/u.test(line.trim()) && chromatic) {
        fills += 1;
        colours.add(colour);
      }
    }
  }
  return { fills, colours: [...colours] };
}
