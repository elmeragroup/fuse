/**
 * Packs rendered lines of notes into Slack section texts: at most four, each within Block Kit's
 * 3000-character limit, never splitting a link, code span, emphasis span, escaped entity or grapheme
 * cluster (`text-cut.ts`), and closing and reopening a code block that crosses sections.
 */

import { Option } from "effect";

import { codeText, link, linkTarget, render, renderUnit } from "./mrkdwn.ts";
import type { Inline, MrkdwnLine } from "./mrkdwn.ts";
import { NOTE_SECTION_LIMIT, SECTION_TEXT_LIMIT } from "./render-protocol.ts";
import { cutEscaped } from "./text-cut.ts";

/** Section texts for a version's notes, and why notes were left out, if they were. */
export type PackedSections = {
  readonly sections: readonly string[];
  readonly shortenedBy: Option.Option<"section-limit" | "oversized-unit">;
};

/** Room a code line needs besides itself: a fence to reopen its block and one to close it. */
const FENCE_ROOM = "```\n".length + "\n```".length;

/** What the block renderer feeds the section packer, item by item. */
type SectionPacker = {
  /** Adds a rendered line, inside a code block when `code`. */
  readonly addLine: (line: MrkdwnLine, options: { readonly code: boolean }) => void;
  /** Notes that a code block opens; it is written with its first line. */
  readonly openFence: () => void;
  /** Notes that the open code block closes. */
  readonly closeFence: () => void;
  /** Whether no further line can be shown. */
  readonly full: () => boolean;
  /** Ends the last section. */
  readonly finish: () => PackedSections;
};

/**
 * Packs rendered lines into at most four section texts of at most 3000 characters, splitting
 * between lines and, for a line longer than a section, inside it (`splitLongLine`).
 *
 * Code is packed by the section's own state: a block is written into a section only when one of
 * its lines lands there, is closed by its end or by the section's end, and is reopened in the next
 * section only for a line that lands there. Each code line reserves room for its section's closing
 * fence, so a closing fence always fits. Blank lines collapse and are dropped at a section's
 * edges. Notes are reported cut when a line with content does not fit in the fourth section, or
 * when fitting a unit into a section shortened it.
 */
export function sectionPacker(): SectionPacker {
  const sections: string[] = [];
  let lines: string[] = [];
  let size = 0;
  // Whether the emitted section has a code block open.
  let open = false;
  // A blank line waiting for the next line in this section, and one that came before the fence of
  // a block not written yet, each as its source wrote it (Changesets indents some).
  let blank: string | undefined;
  let blankBeforeFence: string | undefined;
  let full = false;
  let shortened = false;
  const push = (text: string): void => {
    size += (lines.length === 0 ? 0 : 1) + text.length;
    lines.push(text);
  };
  const flush = (): void => {
    if (lines.length === 0) return;
    if (open) push("```");
    sections.push(lines.join("\n"));
    lines = [];
    size = 0;
    open = false;
    blank = undefined;
    blankBeforeFence = undefined;
  };
  /** The lines placing `piece` writes: blank gaps, a fence to open its block, and the piece. */
  const writes = (piece: string, code: boolean): string[] => {
    const written: string[] = [];
    if (code && !open) {
      if (blankBeforeFence !== undefined && lines.length > 0) written.push(blankBeforeFence);
      written.push("```");
    }
    if (blank !== undefined && (lines.length > 0 || written.length > 0)) written.push(blank);
    written.push(piece);
    return written;
  };
  const cost = (written: readonly string[], code: boolean): number => {
    let total = size;
    let count = lines.length;
    for (const text of written) {
      total += (count === 0 ? 0 : 1) + text.length;
      count += 1;
    }
    return total + (code ? "\n```".length : 0);
  };
  /** Places a piece, or reports the notes cut; returns whether packing can go on. */
  const place = (piece: string, code: boolean): boolean => {
    if (cost(writes(piece, code), code) > SECTION_TEXT_LIMIT && lines.length > 0) {
      // A blank line of code that does not fit carries nothing worth a new section.
      if (piece.trim() === "") return true;
      flush();
    }
    if (sections.length === NOTE_SECTION_LIMIT) {
      full = true;
      return false;
    }
    for (const text of writes(piece, code)) push(text);
    if (code) open = true;
    blank = undefined;
    blankBeforeFence = undefined;
    return true;
  };
  return {
    addLine(line, { code }) {
      if (full) return;
      const text = render(line);
      if (text.trim() === "") {
        // The first blank line of a run separates; the rest of the run is dropped.
        if (blank === undefined && (lines.length > 0 || (code && blankBeforeFence !== undefined)))
          blank = text;
        return;
      }
      const lose = (): void => {
        shortened = true;
      };
      for (const piece of splitLongLine(line, text, SECTION_TEXT_LIMIT - FENCE_ROOM, lose)) {
        if (!place(piece, code)) return;
      }
    },
    openFence() {
      blankBeforeFence = blank;
      blank = undefined;
    },
    closeFence() {
      if (open) {
        push("```");
        open = false;
      } else {
        // An empty block writes nothing; a blank line before it still separates what follows.
        blank = blankBeforeFence;
      }
      blankBeforeFence = undefined;
    },
    full: () => full,
    finish() {
      flush();
      return {
        sections,
        shortenedBy: full
          ? Option.some("section-limit")
          : shortened
            ? Option.some("oversized-unit")
            : Option.none(),
      };
    },
  };
}

/**
 * Renders a line as pieces of at most `limit` characters. It breaks at whitespace and never
 * inside a span, link, code span or escaped entity; a word longer than `limit` breaks between its
 * units, and a unit longer than `limit` is fitted by `fitUnit`, which calls `lose` when it leaves
 * something out. Pieces are produced as packing takes them, so packing that stops early leaves the
 * rest unrendered.
 */
function* splitLongLine(
  line: MrkdwnLine,
  whole: string,
  limit: number,
  lose: () => void
): Generator<string, void, undefined> {
  if (whole.length <= limit) {
    yield whole;
    return;
  }
  let current = "";
  let made = 0;
  const ready: string[] = [];
  const place = (piece: string): void => {
    if (current.length + piece.length > limit) {
      // An indent alone is dropped rather than kept beside a unit it leaves no room for.
      if (current.trim() !== "") {
        ready.push(current.trimEnd());
        made += 1;
      }
      current = "";
    }
    // A continuation piece starts at its first visible unit; the first keeps the indent.
    current += current === "" && made > 0 ? piece.trimStart() : piece;
  };
  for (const word of words(line)) {
    const rendered = render(word);
    if (rendered.length <= limit) place(rendered);
    else for (const unit of word) for (const part of fitUnit(unit, limit, lose)) place(part);
    for (const piece of ready) yield piece;
    ready.length = 0;
  }
  if (current.trim() !== "") yield current.trimEnd();
}

/** Groups a line's units into words, each with the whitespace before it. */
function words(line: MrkdwnLine): Inline[][] {
  const grouped: Inline[][] = [];
  for (const unit of line) {
    const last = grouped.at(-1);
    const lastUnit = last?.at(-1);
    if (last === undefined || (unit.kind === "space" && lastUnit?.kind !== "space")) grouped.push([unit]);
    else last.push(unit);
  }
  return grouped;
}

/**
 * Renders one unit as pieces that each fit `limit`. A span drops its marks and fits its
 * children, so no section holds a mark without its partner. A link keeps its URL and shortens its
 * label, or, when the URL alone leaves no room, becomes its label as text; a code span shortens its
 * code inside its backticks. Text and whitespace are cut between grapheme clusters, outside any
 * escaped entity.
 * Shortening a label or code, or dropping a link's URL, leaves content out, so it calls `lose`.
 */
function fitUnit(unit: Inline, limit: number, lose: () => void): string[] {
  const rendered = renderUnit(unit);
  if (rendered.length <= limit) return [rendered];
  switch (unit.kind) {
    case "span": {
      const pieces: string[] = [];
      for (const child of unit.children) for (const piece of fitUnit(child, limit, lose)) pieces.push(piece);
      return pieces;
    }
    case "link": {
      const target = linkTarget(unit.url);
      const label = unit.label.length === 0 ? [{ kind: "text", text: unit.url } as const] : unit.label;
      const room = limit - target.length - "<|>".length;
      lose();
      return [room >= 2 ? link(unit.url, shortenUnits(label, room)) : shortenUnits(label, limit)];
    }
    case "code":
      lose();
      return [`\`${cutEscaped(codeText(unit.code), limit - 3)}…\``];
    case "text":
    case "space":
    case "raw": {
      const pieces: string[] = [];
      let rest = rendered;
      while (rest.length > limit) {
        const piece = cutEscaped(rest, limit);
        pieces.push(piece);
        rest = rest.slice(piece.length);
      }
      pieces.push(rest);
      return pieces;
    }
  }
}

/**
 * Renders units shortened to `limit` characters with an ellipsis. Whole units are kept and only
 * text is cut, so a code span or entity is kept closed or left out.
 */
function shortenUnits(units: readonly Inline[], limit: number): string {
  const whole = render(units);
  if (whole.length <= limit) return whole;
  const budget = limit - 1;
  let kept = "";
  for (const unit of units) {
    const rendered = renderUnit(unit);
    if (kept.length + rendered.length <= budget) {
      kept += rendered;
      continue;
    }
    if (unit.kind === "text") kept += cutEscaped(rendered, budget - kept.length);
    break;
  }
  return `${kept.trimEnd()}…`;
}
