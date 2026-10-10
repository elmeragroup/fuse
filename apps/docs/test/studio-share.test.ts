import { describe, expect, it } from "vitest";

import type { StudioDocument } from "../src/lib/studio/edits";
import { decodeShare, encodeShare } from "../src/lib/studio/share-codec";
import { MAX_SHARE_LENGTH, MAX_VALUE_LENGTH } from "../src/lib/studio/size-policy";
import { STUDIO_TOKEN_NAMES, TOKEN_TABLE, isLightOnly } from "../src/lib/studio/tokens";

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

  it.each([
    ["a color that is not a CSS color", lightEdit("primary", "garbage")],
    ["an alias to an unknown property", lightEdit("primary", "var(--nope)")],
    ["an alias to a token of another kind", lightEdit("primary", "var(--radius)")],
    ["an alias to itself", lightEdit("primary", "var(--primary)")],
    // Every theme declares destructive: var(--error), so this edit closes a cycle.
    ["an alias that closes a cycle through the base theme", lightEdit("error", "var(--destructive)")],
    ["a radius step other than 0px or 2px", sharedEdit("radius-step", "1px")],
    ["a dimension in another unit", sharedEdit("radius", "1em")],
    ["a dimension with no digit after its point", sharedEdit("radius", "1.px")],
    ["a dimension with no number", sharedEdit("radius", ".px")],
    ["a dimension with an empty exponent", sharedEdit("radius", "1e")],
    ["a font name that is not an identifier", lightEdit("font-sans", "123, serif")],
    [
      "a color formula that reads an unknown token",
      lightEdit("secondary-hover", "color-mix(in oklch, var(--nope), #ffffff)"),
    ],
    // Every theme declares secondary-hover from --secondary, so this formula closes a cycle.
    [
      "a color formula that closes a cycle",
      lightEdit("secondary", "color-mix(in oklch, var(--secondary-hover), #ffffff)"),
    ],
    ["a color-mix() with one color", lightEdit("secondary-hover", "color-mix(in oklch, var(--secondary))")],
    [
      "a color-mix() that reads currentcolor",
      lightEdit("primary", "color-mix(in srgb, var(--secondary), currentcolor)"),
    ],
    ["relative color syntax", lightEdit("border", "oklch(from var(--primary) l c h / 0.5)")],
    ["a negative dimension", sharedEdit("radius", "-4px")],
    ["a font stack with a function in it", lightEdit("font-sans", "url(x), serif")],
    ["a font stack with an unquoted CSS-wide keyword", lightEdit("font-sans", "inherit, serif")],
    ["a font weight above 1000", sharedEdit("selection-title-weight", "1001")],
    ["a font weight below 1", sharedEdit("selection-title-weight", "0")],
    ["a value longer than the limit", lightEdit("font-sans", `a${", b".repeat(MAX_VALUE_LENGTH)}`)],
  ])("reads %s as no state", (_label, text) => {
    expect(decodeShare(text)).toBeUndefined();
  });

  it.each([
    ["a hex color", lightEdit("primary", "#ff0000")],
    ["an oklch() color with alpha", lightEdit("border", "oklch(1 0 0 / 0.1)")],
    ["a lab() color, the studio's canonical form", lightEdit("primary", "lab(54.29 80.8198 69.8997)")],
    ["an alias to a color token", lightEdit("primary", "var(--secondary)")],
    ["an alias to a primitive", lightEdit("primary", "var(--neutral-500)")],
    ["a rem dimension", sharedEdit("radius", "0.75rem")],
    ["a 2px radius step", sharedEdit("radius-step", "2px")],
    ["a font stack with a quoted family", lightEdit("font-sans", '"Søk Sans", ui-serif, serif')],
    ["a font stack with a quoted CSS-wide keyword", lightEdit("font-sans", '"inherit", serif')],
    ["an alias to a font family token", sharedEdit("font-heading", "var(--font-sans)")],
    ["a font weight of 650", sharedEdit("selection-title-weight", "650")],
    [
      "a live color formula",
      lightEdit("secondary-hover", "color-mix(in oklch, var(--secondary), var(--foreground) 10%)"),
    ],
  ])("reads %s", (_label, text) => {
    expect(decodeShare(text)).toBeDefined();
  });

  it("reads a hash longer than the limit as no state, before decoding it", () => {
    const padded = `1.${payload(`{"t":"external-elma-private","l":{"primary":"#ff0000"},"x":"${"a".repeat(MAX_SHARE_LENGTH)}"}`)}`;
    expect(padded.length).toBeGreaterThan(MAX_SHARE_LENGTH);
    expect(decodeShare(padded)).toBeUndefined();
  });
});
