import { describe, expect, it } from "vitest";

import type { StudioDocument } from "../../src/studio/lib/edits";
import { decodeShare, encodeShare } from "../../src/studio/lib/share-codec";
import { MAX_SHARE_LENGTH, MAX_VALUE_LENGTH } from "../../src/studio/lib/size-policy";
import { STUDIO_TOKEN_NAMES, TOKEN_TABLE, isLightOnly } from "../../src/studio/lib/tokens";

const EDITED: StudioDocument = {
  theme: { variant: "external", brand: "elma", segment: "private" },
  overrides: { light: { primary: "#ff0000" }, dark: {}, shared: { radius: "1rem" } },
};

/** base64url, unpadded, of a compact JSON payload written out by hand. */
function payload(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

/** The share text of a document the encoder accepts. */
function shareText(document: StudioDocument): string {
  const encoded = encodeShare(document);
  if (!encoded.ok) {
    throw new Error(`the encoder refused the document: ${encoded.reason}`);
  }
  return encoded.text;
}

/** A light payload holding one edit, for the decoder's per-kind checks. */
function lightEdit(name: string, css: string): string {
  return `1.${payload(JSON.stringify({ t: "external-elma-private", l: { [name]: css } }))}`;
}

/** A shared payload holding one edit of a light-only token. */
function sharedEdit(name: string, css: string): string {
  return `1.${payload(JSON.stringify({ t: "external-elma-private", s: { [name]: css } }))}`;
}

/**
 * Every scheme-dependent color token edited in both schemes to a long oklch() literal: a session
 * a visitor can build with the knobs, whose share text is longer than the limit.
 */
const TOO_LARGE: StudioDocument = (() => {
  const long = "oklch(0.1234567 0.1234567 123.4567891)";
  const colors = STUDIO_TOKEN_NAMES.filter(
    (name) => TOKEN_TABLE[name].kind === "color" && !isLightOnly(name)
  );
  const group = Object.fromEntries(colors.map((name) => [name, long]));
  return { theme: EDITED.theme, overrides: { light: group, dark: group, shared: {} } };
})();

describe("encodeShare", () => {
  it("writes the version, then the compact payload as unpadded base64url", () => {
    // The base64url of {"t":"external-elma-private","l":{"primary":"#ff0000"},"s":{"radius":"1rem"}},
    // produced with `base64 | tr '+/' '-_' | tr -d '='`. Empty override groups are left out.
    expect(shareText(EDITED)).toBe(
      "1.eyJ0IjoiZXh0ZXJuYWwtZWxtYS1wcml2YXRlIiwibCI6eyJwcmltYXJ5IjoiI2ZmMDAwMCJ9LCJzIjp7InJhZGl1cyI6IjFyZW0ifX0"
    );
  });

  it("carries non-ASCII text in a value as UTF-8", () => {
    const document: StudioDocument = {
      theme: { variant: "internal", brand: "fkas", segment: "private" },
      overrides: { light: {}, dark: { "font-sans": '"Søk", serif' }, shared: {} },
    };
    // {"t":"internal-fkas-private","d":{"font-sans":"\"Søk\", serif"}}, ø as the bytes C3 B8.
    expect(shareText(document)).toBe(
      "1.eyJ0IjoiaW50ZXJuYWwtZmthcy1wcml2YXRlIiwiZCI6eyJmb250LXNhbnMiOiJcIlPDuGtcIiwgc2VyaWYifX0"
    );
    expect(decodeShare(shareText(document))).toEqual(document);
  });

  it("refuses a session whose share text would be longer than the decoder reads", () => {
    expect(encodeShare(TOO_LARGE)).toEqual({ ok: false, reason: "too-large" });
  });

  it("refuses a value the decoder would reject, rather than writing it", () => {
    const long: StudioDocument = {
      ...EDITED,
      overrides: { light: {}, dark: {}, shared: { "font-heading": `a${", b".repeat(MAX_VALUE_LENGTH)}` } },
    };
    expect(encodeShare(long)).toEqual({ ok: false, reason: "invalid" });
    const garbage: StudioDocument = {
      ...EDITED,
      overrides: { light: { primary: "garbage" }, dark: {}, shared: {} },
    };
    expect(encodeShare(garbage)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("decodeShare", () => {
  it("round-trips a document", () => {
    expect(decodeShare(shareText(EDITED))).toEqual(EDITED);
  });

  it("reads a document with no edits", () => {
    const empty: StudioDocument = { ...EDITED, overrides: { light: {}, dark: {}, shared: {} } };
    expect(decodeShare(shareText(empty))).toEqual(empty);
  });

  it.each([
    ["an empty string", ""],
    ["garbage", "not a share link"],
    ["a payload that is not base64url", "1.%%%"],
    ["a payload that is not JSON", `1.${payload("not json")}`],
    ["a JSON array", `1.${payload("[1,2]")}`],
    ["an old version", `0.${payload('{"t":"external-elma-private"}')}`],
    ["a future version", `2.${payload('{"t":"external-elma-private"}')}`],
    ["an illegal theme", `1.${payload('{"t":"external-elma-company2"}')}`],
    ["a missing theme", `1.${payload('{"l":{"primary":"#ff0000"}}')}`],
    ["an unknown token", `1.${payload('{"t":"external-elma-private","l":{"brand-new":"#ff0000"}}')}`],
    [
      "a light-only token in a scheme group",
      `1.${payload('{"t":"external-elma-private","d":{"radius":"1rem"}}')}`,
    ],
    [
      "a scheme token in the shared group",
      `1.${payload('{"t":"external-elma-private","s":{"primary":"#f00"}}')}`,
    ],
    ["a value that is not a string", `1.${payload('{"t":"external-elma-private","l":{"primary":1}}')}`],
    [
      "a value that ends the declaration",
      `1.${payload('{"t":"external-elma-private","l":{"primary":"red;color:blue"}}')}`,
    ],
    ["a value that opens a block", `1.${payload('{"t":"external-elma-private","l":{"primary":"red}a{"}}')}`],
    ["an empty value", `1.${payload('{"t":"external-elma-private","l":{"primary":""}}')}`],
  ])("reads %s as no state", (_label, text) => {
    expect(decodeShare(text)).toBeUndefined();
  });

  // The decoder's per-value check is `parseTokenValue`'s, whose own suite holds each refusal and
  // each accepted form. These rows prove the wiring: a refused value in a scheme group and in the
  // shared group, and the cycle check against the base theme, for an alias and for a formula.
  it.each([
    ["a color that is not a CSS color", lightEdit("primary", "garbage")],
    // Every theme declares destructive: var(--error), so this edit closes a cycle.
    ["an alias that closes a cycle through the base theme", lightEdit("error", "var(--destructive)")],
    ["a radius step other than 0px or 2px", sharedEdit("radius-step", "1px")],
    // Every theme declares secondary-hover from --secondary, so this formula closes a cycle.
    [
      "a color formula that closes a cycle",
      lightEdit("secondary", "color-mix(in oklch, var(--secondary-hover), #ffffff)"),
    ],
  ])("reads %s as no state", (_label, text) => {
    expect(decodeShare(text)).toBeUndefined();
  });

  it.each([
    ["a hex color", lightEdit("primary", "#ff0000")],
    ["a lab() color, the studio's canonical form", lightEdit("primary", "lab(54.29 80.8198 69.8997)")],
    ["an alias to a font family token", sharedEdit("font-heading", "var(--font-sans)")],
  ])("reads %s", (_label, text) => {
    expect(decodeShare(text)).toBeDefined();
  });

  it("reads a hash longer than the limit as no state, before decoding it", () => {
    const padded = `1.${payload(`{"t":"external-elma-private","l":{"primary":"#ff0000"},"x":"${"a".repeat(MAX_SHARE_LENGTH)}"}`)}`;
    expect(padded.length).toBeGreaterThan(MAX_SHARE_LENGTH);
    expect(decodeShare(padded)).toBeUndefined();
  });
});
