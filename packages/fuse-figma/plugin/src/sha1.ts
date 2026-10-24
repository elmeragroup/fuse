/**
 * SHA-1 (FIPS 180-4 §6.1), the hash Figma names a stored image by. On 2026-10-22 `createImage` gave
 * Avatar's portrait the hash `shasum -a 1` gives its bytes, in lowercase hex (probe P9b). The
 * plugin's main thread has no Node `crypto`, so the kit check hashes an image's bytes here to compare
 * them with the hash the build wrote, and the in-memory fake names its images the same way.
 */

/** The round constant of each 20-round stage. */
const ROUND_CONSTANTS = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6] as const;

/** The stage function of round `round` over the words `b`, `c` and `d`. */
function stage(round: number, b: number, c: number, d: number): number {
  if (round < 20) {
    return (b & c) | (~b & d);
  }
  if (round >= 40 && round < 60) {
    return (b & c) | (b & d) | (c & d);
  }
  return b ^ c ^ d;
}

function rotateLeft(word: number, by: number): number {
  return ((word << by) | (word >>> (32 - by))) >>> 0;
}

/**
 * The SHA-1 of a byte string.
 *
 * @param bytes - The message.
 * @returns The 160-bit hash as 40 lowercase hex digits.
 */
export function sha1Hex(bytes: Uint8Array): string {
  // The message, a 1 bit, zeros, and its length in bits as a 64-bit big-endian number, in 64-byte blocks.
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = bytes.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(padded.length - 4, bits >>> 0);

  const hash = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const schedule = new Array<number>(80).fill(0);
  for (let block = 0; block < padded.length; block += 64) {
    for (let index = 0; index < 80; index += 1) {
      schedule[index] =
        index < 16
          ? view.getUint32(block + index * 4)
          : rotateLeft(
              (schedule[index - 3] ?? 0) ^
                (schedule[index - 8] ?? 0) ^
                (schedule[index - 14] ?? 0) ^
                (schedule[index - 16] ?? 0),
              1
            );
    }
    let [a = 0, b = 0, c = 0, d = 0, e = 0] = hash;
    for (let round = 0; round < 80; round += 1) {
      const constant = ROUND_CONSTANTS[Math.floor(round / 20)] ?? 0;
      const next = (rotateLeft(a, 5) + stage(round, b, c, d) + e + constant + (schedule[round] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }
    for (const [index, word] of [a, b, c, d, e].entries()) {
      hash[index] = ((hash[index] ?? 0) + word) >>> 0;
    }
  }
  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}
