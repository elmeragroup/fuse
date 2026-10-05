import { inflateSync } from "node:zlib";

/** A decoded 8-bit RGB or RGBA PNG. */
export type DecodedPng = {
  width: number;
  height: number;
  /** The channels of one pixel, alpha last when the image has one. */
  pixel: (x: number, y: number) => readonly number[];
};

const SIGNATURE = "89504e470d0a1a0a";

/** The width and height a PNG's IHDR chunk declares, or `null` when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 8).toString("hex") !== SIGNATURE || buffer.toString("latin1", 12, 16) !== "IHDR") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
}

/**
 * Decodes a non-interlaced 8-bit RGB or RGBA PNG, the form resvg writes, so a test can read a
 * pixel without an image library.
 */
export function decodePng(bytes: Uint8Array): DecodedPng {
  const buffer = Buffer.from(bytes);
  const size = pngSize(buffer);
  if (size === null) {
    throw new Error("Not a PNG");
  }
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const interlace = buffer.readUInt8(28);
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`Unsupported PNG: depth ${String(bitDepth)}, color type ${String(colorType)}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    if (type === "IDAT") {
      chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = size.width * channels;
  const pixels = Buffer.alloc(stride * size.height);
  for (let y = 0; y < size.height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x] ?? 0;
      const left = x >= channels ? (pixels[y * stride + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = x >= channels && y > 0 ? (pixels[(y - 1) * stride + x - channels] ?? 0) : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upLeft)][filter] ?? 0;
      pixels[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return {
    ...size,
    pixel: (x, y) => [...pixels.subarray(y * stride + x * channels, y * stride + (x + 1) * channels)],
  };
}
