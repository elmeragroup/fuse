import { parseThemeSlug, themeSlug } from "@elmeragroup/fuse/theme";

import type { StudioDocument, TokenOverrides } from "./edits";
import { MAX_SHARE_LENGTH } from "./size-policy";
import { documentCycles, parseTokenValue } from "./token-values";
import { isLightOnly, isTokenName } from "./tokens";

/**
 * The share format's version. A link or autosave in another version reads as no state, so a
 * format change bumps it rather than misreading old data.
 */
const SHARE_VERSION = "1";

/** The compact payload: the theme slug, then each non-empty override group. */
type Payload = { t: string; l?: TokenOverrides; d?: TokenOverrides; s?: TokenOverrides };

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(text: string): string | undefined {
  if (!/^[A-Za-z0-9_-]*$/u.test(text)) {
    return undefined;
  }
  try {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function nonEmpty(group: TokenOverrides): TokenOverrides | undefined {
  return Object.keys(group).length === 0 ? undefined : group;
}

/**
 * A document's share text, or why there is none: `too-large` when the text would be longer than
 * the decoder reads, `invalid` when the decoder would refuse a value in it.
 */
export type ShareEncoding =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: "too-large" | "invalid" };

/**
 * The document as share text: the version, a dot, then the compact JSON payload as unpadded
 * base64url, which a URL hash and a storage value both carry unescaped. It never returns text
 * {@link decodeShare} would refuse, so a copied link or an autosave always restores.
 */
export function encodeShare(document: StudioDocument): ShareEncoding {
  const { light, dark, shared } = document.overrides;
  const payload: Payload = {
    t: themeSlug(document.theme),
    l: nonEmpty(light),
    d: nonEmpty(dark),
    s: nonEmpty(shared),
  };
  const text = `${SHARE_VERSION}.${base64UrlEncode(JSON.stringify(payload))}`;
  if (text.length > MAX_SHARE_LENGTH) {
    return { ok: false, reason: "too-large" };
  }
  return decodeShare(text) === undefined ? { ok: false, reason: "invalid" } : { ok: true, text };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- share-text I/O boundary: this module is the parser for untrusted link and storage text
function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- share-text I/O boundary: this module is the parser for untrusted link and storage text
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One override group, or `undefined` when any entry is not a legal edit for the group. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- share-text I/O boundary: this module is the parser for untrusted link and storage text
function readGroup(value: unknown, lightOnly: boolean): TokenOverrides | undefined {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const group: Partial<Record<string, string>> = {};
  for (const [name, css] of Object.entries(value)) {
    if (
      !isTokenName(name) ||
      isLightOnly(name) !== lightOnly ||
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- share-text I/O boundary: this module is the parser for untrusted link and storage text
      typeof css !== "string"
    ) {
      return undefined;
    }
    const parsed = parseTokenValue(name, css);
    if (!parsed.ok) {
      return undefined;
    }
    group[name] = parsed.css;
  }
  return group;
}

/**
 * The document in share text, or `undefined` for anything else: garbage, another version, an
 * illegal theme, an unknown token, a value in the wrong group, a value its token does not
 * accept ({@link parseTokenValue}), or edits that close an alias cycle in the theme
 * ({@link documentCycles}). It never throws, so a corrupt link or autosave cannot break the page.
 */
export function decodeShare(text: string): StudioDocument | undefined {
  if (text.length > MAX_SHARE_LENGTH) {
    return undefined;
  }
  const dot = text.indexOf(".");
  if (dot === -1 || text.slice(0, dot) !== SHARE_VERSION) {
    return undefined;
  }
  const json = base64UrlDecode(text.slice(dot + 1));
  if (json === undefined) {
    return undefined;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return undefined;
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- share-text I/O boundary: this module is the parser for untrusted link and storage text
  if (!isRecord(payload) || typeof payload.t !== "string") {
    return undefined;
  }
  const theme = parseThemeSlug(payload.t);
  const light = readGroup(payload.l, false);
  const dark = readGroup(payload.d, false);
  const shared = readGroup(payload.s, true);
  if (theme === null || light === undefined || dark === undefined || shared === undefined) {
    return undefined;
  }
  const document: StudioDocument = { theme, overrides: { light, dark, shared } };
  return documentCycles(document).length === 0 ? document : undefined;
}
