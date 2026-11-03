"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { copyText } from "../../lib/copy-with-toast";
import { GRADE_LABELS } from "../../lib/palettes";
import type { ContrastGrade, PaletteTone } from "../../lib/palettes";

const colorReadout = tv({
  slots: {
    // The checker shows only through a translucent tone, so its alpha reads at a glance.
    swatch:
      "palette-checker relative size-4 flex-none overflow-hidden rounded-sm border border-foreground/15 after:absolute after:inset-0 after:bg-(--swatch)",
    readout: "flex min-w-0 flex-col gap-1.5 py-0.5",
    readoutTitle: "font-medium font-mono",
    values: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono tabular-nums",
    term: "font-sans text-background/70",
    note: "text-background/70",
    status: "min-w-0 truncate",
    grade: "text-xs font-medium tabular-nums",
  },
  variants: {
    grade: {
      AAA: { grade: "text-success" },
      AA: { grade: "text-success" },
      "below-aa": { grade: "text-error-soft-foreground" },
    },
  },
});

const styles = colorReadout();

/** A tone's swatch, painted with the tone itself over a checker its alpha lets through. */
export function Swatch({ tone }: { tone: PaletteTone }): ReactElement {
  return (
    <span aria-hidden className={styles.swatch()} style={{ "--swatch": tone.oklch }} data-palette-swatch />
  );
}

/** One line of a readout: a term and its value. */
export type ReadoutLine = { readonly term: string; readonly value: string };

type ReadoutProps = {
  /** What the readout describes, such as `--primary · Fjordkraft`. */
  title: string;
  lines: readonly ReadoutLine[];
  /** A note below the values, such as whether the contrast gate holds a pair. */
  children?: ReactNode;
  /** Whether the last click copied this cell's value. */
  copied: boolean;
};

/** A tooltip's body: its title, its values as terms, any note and the copy hint. */
export function Readout({ title, lines, children, copied }: ReadoutProps): ReactElement {
  return (
    <div className={styles.readout()} data-palette-readout>
      <span className={styles.readoutTitle()}>{title}</span>
      <dl className={styles.values()}>
        {lines.map(({ term, value }) => (
          <div key={term} className="contents">
            <dt className={styles.term()}>{term}</dt>
            <dd data-value={term.toLowerCase()}>{value}</dd>
          </div>
        ))}
      </dl>
      {children === undefined ? null : <span className={styles.note()}>{children}</span>}
      <span className={styles.note()}>{copied ? "Copied" : "Click to copy"}</span>
    </div>
  );
}

/** A tone's readout lines: hex, OKLCH and, for a translucent tone, its alpha. */
export function toneLines(tone: PaletteTone, prefix = ""): ReadoutLine[] {
  const lines = [
    { term: `${prefix}Hex`, value: tone.hex },
    { term: `${prefix}OKLCH`, value: tone.oklch },
  ];
  return tone.alpha < 1
    ? [...lines, { term: `${prefix}Alpha`, value: `${String(Math.round(tone.alpha * 1000) / 10)}%` }]
    : lines;
}

/** How long a copied value says so, in ms. */
const COPIED_MS = 1600;

/** What the last copy did: nothing yet, or copied or failed for the value under `key`. */
type CopyState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "copied"; readonly key: string; readonly text: string }
  | { readonly _tag: "failed"; readonly key: string };

/** The table's copy action and its feedback, shared by every cell. */
export type CopyFeedback = {
  readonly state: CopyState;
  /** Copies `text` and marks the value under `key` as copied for a moment. */
  readonly copy: (key: string, text: string) => void;
};

/** One copy action for the whole table, so one value at a time reads as copied. */
export function useCopyFeedback(): CopyFeedback {
  const [state, setState] = useState<CopyState>({ _tag: "idle" });
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);
  return {
    state,
    copy: (key, text) => {
      void copyText(text).then((copied) => {
        setState(copied ? { _tag: "copied", key, text } : { _tag: "failed", key });
        window.clearTimeout(resetTimer.current);
        resetTimer.current = window.setTimeout(() => setState({ _tag: "idle" }), COPIED_MS);
      });
    },
  };
}

/** Whether the last copy copied the value under `key`. */
export function isCopied(feedback: CopyFeedback, key: string): boolean {
  return feedback.state._tag === "copied" && feedback.state.key === key;
}

/** A polite live region that says what the last copy did, on screen and to a screen reader. */
export function CopyStatus({ copy }: { copy: CopyFeedback }): ReactElement {
  const { state } = copy;
  return (
    <span role="status" className={styles.status()}>
      {state._tag === "copied" ? `Copied ${state.text}` : null}
      {state._tag === "failed" ? "Could not copy. The browser refused the clipboard." : null}
    </span>
  );
}

/** A pair's WCAG level as a short label, colored by whether it holds AA. */
export function GradeLabel({ grade }: { grade: ContrastGrade }): ReactElement {
  return (
    <span className={colorReadout({ grade }).grade()} data-contrast-grade={grade}>
      {GRADE_LABELS[grade]}
    </span>
  );
}
