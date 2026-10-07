/**
 * Compares a before and an after PNG pixel by pixel with pixelmatch. The comparison is pure:
 * PNG bytes in, a changed-pixel count and a diff PNG out, or the two sizes when they differ.
 */

import { Result, Schema } from "effect";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** pixelmatch's own default: how far apart two colors may be before a pixel counts as changed. */
export const DEFAULT_THRESHOLD = 0.1;

/** A PNG's bytes and the file name messages call it by. */
export type PngFile = {
  /** The file name. */
  readonly file: string;
  /** The encoded PNG. */
  readonly bytes: Uint8Array;
};

/** An image's size in device pixels. */
export type Size = { readonly width: number; readonly height: number };

/** What comparing a pair found. */
export type PixelDiff =
  | {
      /** Both images have one size, so every pixel was compared. */
      readonly _tag: "compared";
      /** Pixels that differ beyond the threshold, not counting anti-aliasing. */
      readonly changed: number;
      /** Every pixel in one image. */
      readonly total: number;
      /** The diff image: changed pixels red, anti-aliasing yellow, over the faded before image. */
      readonly png: Uint8Array;
    }
  | {
      /** The images differ in size, which is a finding of its own, so nothing was compared. */
      readonly _tag: "size-changed";
      /** The before image's size. */
      readonly before: Size;
      /** The after image's size. */
      readonly after: Size;
    };

/** A file that should hold a PNG could not be decoded. */
export class PngUnreadable extends Schema.TaggedError<PngUnreadable>()("PngUnreadable", {
  message: Schema.String,
  /** The file that failed. */
  file: Schema.String,
}) {}

/**
 * Compare two PNGs.
 *
 * @param before - The before shot.
 * @param after - The after shot.
 * @param threshold - pixelmatch's matching threshold, 0 to 1; smaller is more sensitive.
 * @returns The count and the diff image, the two sizes when they differ, or `PngUnreadable`.
 */
export function diffPngs(
  before: PngFile,
  after: PngFile,
  threshold: number
): Result.Result<PixelDiff, PngUnreadable> {
  const beforeImage = decode(before);
  if (Result.isFailure(beforeImage)) {
    return Result.fail(beforeImage.failure);
  }
  const afterImage = decode(after);
  if (Result.isFailure(afterImage)) {
    return Result.fail(afterImage.failure);
  }
  const { width, height } = beforeImage.success;
  if (width !== afterImage.success.width || height !== afterImage.success.height) {
    return Result.succeed({
      _tag: "size-changed",
      before: { width, height },
      after: { width: afterImage.success.width, height: afterImage.success.height },
    });
  }
  const diff = new PNG({ width, height });
  const changed = pixelmatch(beforeImage.success.data, afterImage.success.data, diff.data, width, height, {
    threshold,
  });
  return Result.succeed({ _tag: "compared", changed, total: width * height, png: PNG.sync.write(diff) });
}

function decode({ file, bytes }: PngFile): Result.Result<PNG, PngUnreadable> {
  return Result.try({
    try: () => PNG.sync.read(Buffer.from(bytes)),
    catch: () => new PngUnreadable({ message: `Could not read ${file} as a PNG`, file }),
  });
}
