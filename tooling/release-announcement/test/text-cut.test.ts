import { describe, expect, it } from "vitest";

import { cutEscaped, cutText } from "../src/text-cut.ts";

// Unit under test: the text-cut module. Oracles: Unicode's grapheme clusters (UAX #29) for the
// characters here, written out by hand: an emoji, a flag of two regional indicators, a family of
// three emoji joined by ZWJs, and a letter with combining accents; and the entities escapeText
// writes, `&amp;`, `&lt;` and `&gt;`.

describe("cutting text", () => {
  it.each([
    { text: "ab😀", length: 3, cut: "ab" },
    { text: "ab🇳🇴", length: 5, cut: "ab" },
    { text: "a👨‍👩‍👧", length: 8, cut: "a" },
    { text: "aé", length: 2, cut: "a" },
    { text: "a字", length: 2, cut: "a字" },
  ])("ends $text before the character that does not fit in $length", ({ text, length, cut }) => {
    expect(cutText(text, length)).toBe(cut);
  });

  it.each([
    // The cluster alone is longer than the length, so it is cut between code points.
    { text: `a${"́".repeat(10)}`, length: 5, cut: `a${"́".repeat(4)}` },
    { text: "👨‍👩‍👧", length: 5, cut: "👨‍👩" },
    { text: "👨‍👩‍👧", length: 4, cut: "👨‍" },
  ])("cuts a cluster longer than $length between code points", ({ text, length, cut }) => {
    expect(cutText(text, length)).toBe(cut);
  });

  it.each([
    { text: "ab&amp;cd", length: 4, cut: "ab" },
    { text: "ab&amp;cd", length: 6, cut: "ab" },
    { text: "ab&amp;cd", length: 7, cut: "ab&amp;" },
    { text: "a&lt;&gt;", length: 8, cut: "a&lt;" },
  ])("cuts escaped $text in $length outside its entities", ({ text, length, cut }) => {
    expect(cutEscaped(text, length)).toBe(cut);
  });
});
