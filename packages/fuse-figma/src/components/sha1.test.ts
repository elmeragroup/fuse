/**
 * Unit under test: `sha1Hex`. Oracle: the SHA-1 test vectors of FIPS 180: the empty message, `abc`
 * in one block, and a 56-byte message that the padding pushes into a second block.
 */
import { describe, expect, it } from "vitest";

import { sha1Hex } from "./sha1.ts";

/** The bytes of an ASCII text. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

describe("sha1Hex", () => {
  it.each([
    ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "84983e441c3bd26ebaae4aa1f95129e5e54670f1"],
  ])("hashes %j as the FIPS 180 vectors say", (message, hash) => {
    expect(sha1Hex(ascii(message))).toBe(hash);
  });
});
