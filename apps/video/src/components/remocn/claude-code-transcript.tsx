import type { ReactElement } from "react";

import { Bullet, COLUMNS, Connector, GUTTER, RESULT_INDENT, Row, wrapRows } from "./claude-code-grid";

// Part of the Claude Code component (see `claude-code.tsx`): the transcript's entries, the rows
// each takes on a frame and how each row is drawn.

/** A diff line under an edit's result, added or removed. */
export type DiffLine = {
  readonly sign: "+" | "-";
  readonly text: string;
};

/** One entry of the transcript, shown from frame `at`. */
export type TranscriptEntry =
  | {
      readonly kind: "reply";
      readonly at: number;
      readonly text: string;
    }
  | {
      readonly kind: "tool";
      readonly at: number;
      /** The frame the call finishes on: its bullet turns from blinking to done and its result shows. */
      readonly doneAt: number;
      /** The tool's name, such as `Write`. */
      readonly name: string;
      /** What it acts on, shown in parentheses after the name; a call on nothing shows its name alone. */
      readonly target?: string;
      readonly result?: string;
      readonly diff?: readonly DiffLine[];
    };

/**
 * One row of the transcript as it is drawn: the first row of a reply or a call carries its
 * bullet, the first row of a result its connector, and a diff row its fill.
 */
export type TranscriptRow =
  | { readonly kind: "reply"; readonly text: string; readonly lead: boolean }
  | {
      readonly kind: "call";
      readonly text: string;
      readonly lead: boolean;
      /** The tool's name, which the lead row sets in bold. */
      readonly name: string;
      readonly done: boolean;
    }
  | { readonly kind: "result"; readonly text: string; readonly lead: boolean }
  | { readonly kind: "diff"; readonly text: string; readonly sign: DiffLine["sign"] };

/** Wrapped rows, each marked with whether it leads its block. */
type LeadRow = { readonly text: string; readonly lead: boolean };

function leading(rows: readonly string[]): readonly LeadRow[] {
  return rows.map((text, index) => ({ text, lead: index === 0 }));
}

/** A tool call as Claude Code prints it: its name, then what it acts on in parentheses. */
function callText(entry: Extract<TranscriptEntry, { kind: "tool" }>): string {
  return entry.target === undefined ? entry.name : `${entry.name}(${entry.target})`;
}

/** A diff line's rows: its sign before the first, and a hanging indent under it on the rest. */
function diffRows(line: DiffLine): readonly TranscriptRow[] {
  return wrapRows(line.text, COLUMNS - RESULT_INDENT - 2).map((row, index): TranscriptRow => ({
    kind: "diff",
    text: index === 0 ? `${line.sign} ${row}` : `  ${row}`,
    sign: line.sign,
  }));
}

/**
 * The rows an entry takes on a frame. A reply wraps after its bullet; a tool call wraps its call
 * and, once done, its result after the connector and its diff. The session scrolls by the count
 * of these rows and draws these same rows, so the two never disagree.
 *
 * @param entry - The entry.
 * @param frame - The session's frame.
 * @returns The rows, top to bottom.
 */
export function transcriptRows(entry: TranscriptEntry, frame: number): readonly TranscriptRow[] {
  if (entry.kind === "reply") {
    return leading(wrapRows(entry.text, COLUMNS - GUTTER)).map((row): TranscriptRow => ({
      kind: "reply",
      ...row,
    }));
  }
  const done = frame >= entry.doneAt;
  const call = leading(wrapRows(callText(entry), COLUMNS - GUTTER)).map((row): TranscriptRow => ({
    kind: "call",
    ...row,
    name: entry.name,
    done,
  }));
  if (!done) {
    return call;
  }
  const result = entry.result === undefined ? [] : wrapRows(entry.result, COLUMNS - RESULT_INDENT);
  return [
    ...call,
    ...leading(result).map((row): TranscriptRow => ({ kind: "result", ...row })),
    ...(entry.diff ?? []).flatMap(diffRows),
  ];
}

/** One transcript row, drawn at the indent and in the colours of its kind. */
function TranscriptRowView({
  row,
  blink,
}: {
  readonly row: TranscriptRow;
  readonly blink: number;
}): ReactElement {
  switch (row.kind) {
    case "reply":
      return (
        <Row indent={GUTTER}>
          {row.lead ? <Bullet tone="text" blink={1} /> : null}
          {row.text}
        </Row>
      );
    case "call":
      return (
        <Row indent={GUTTER}>
          {row.lead ? (
            <>
              <Bullet tone={row.done ? "done" : "running"} blink={blink} />
              <span className="font-bold">{row.name}</span>
              <span>{row.text.slice(row.name.length)}</span>
            </>
          ) : (
            row.text
          )}
        </Row>
      );
    case "result":
      return (
        <Row indent={RESULT_INDENT} className="text-muted-foreground">
          {row.lead ? <Connector /> : null}
          {row.text}
        </Row>
      );
    case "diff":
      return (
        <Row
          indent={RESULT_INDENT}
          // The soft fills at half strength over the card, as Claude Code dims its diff rows.
          className={
            row.sign === "+"
              ? "bg-success-soft/45 text-success-soft-foreground"
              : "bg-error-soft/45 text-error-soft-foreground"
          }>
          {row.text}
        </Row>
      );
  }
}

/**
 * An entry's rows, as {@link transcriptRows} laid them out.
 *
 * @param props.rows - The entry's rows on this frame.
 * @param props.blink - A running call's bullet opacity on this frame.
 * @returns The entry.
 */
export function TranscriptEntryView({
  rows,
  blink,
}: {
  readonly rows: readonly TranscriptRow[];
  readonly blink: number;
}): ReactElement {
  return (
    <div>
      {rows.map((row, index) => (
        <TranscriptRowView key={index} row={row} blink={blink} />
      ))}
    </div>
  );
}
