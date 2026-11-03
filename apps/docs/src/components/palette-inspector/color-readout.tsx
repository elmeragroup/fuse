"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";

import { copyText } from "../../lib/copy-with-toast";
import { alphaPercent, formatRatio, GRADE_LABELS } from "../../lib/palettes";
import type { ContrastGrade, PaletteTone } from "../../lib/palettes";

const colorReadout = tv({
  slots: {
    swatch: "flex-none rounded-sm border border-foreground/15 bg-(--swatch)",
    readout: "flex min-w-0 flex-col gap-1.5 py-0.5",
    readoutTitle: "font-medium font-mono",
    values: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono tabular-nums",
    term: "text-background/70",
    note: "text-background/70",
    // Visible, since a tap on a phone opens no tooltip to say a value was copied.
    status: "min-w-0 truncate",
    ratio: "tabular-nums",
  },
  variants: {
    size: {
      sm: { swatch: "size-4" },
      md: { swatch: "size-6" },
    },
  },
});

const styles = colorReadout();

/** A tone's swatch, painted with the tone itself. */
export function Swatch({ tone, size = "sm" }: { tone: PaletteTone; size?: "sm" | "md" }): ReactElement {
  return (
    <span
      aria-hidden
      className={colorReadout({ size }).swatch()}
      style={{ "--swatch": tone.oklch }}
      data-palette-swatch
    />
  );
}

type ToneReadoutProps = {
  /** What the readout describes, such as `--primary` or `Tone 12`. */
  title: string;
  tone: PaletteTone;
  /** Lines below the values, such as the roles that share the tone. */
  children?: ReactNode;
  /** Whether the last click copied this value. */
  copied: boolean;
};

/** A tooltip's body: the tone's OKLCH, hex and alpha, then any notes and the copy hint. */
export function ToneReadout({ title, tone, children, copied }: ToneReadoutProps): ReactElement {
  const alpha = alphaPercent(tone);
  return (
    <div className={styles.readout()} data-palette-readout>
      <span className={styles.readoutTitle()}>{title}</span>
      <dl className={styles.values()}>
        <dt className={styles.term()}>OKLCH</dt>
        <dd data-value="oklch">{tone.oklch}</dd>
        <dt className={styles.term()}>Hex</dt>
        <dd data-value="hex">{tone.hex}</dd>
        {alpha === undefined ? null : (
          <>
            <dt className={styles.term()}>Alpha</dt>
            <dd data-value="alpha">{alpha}</dd>
          </>
        )}
      </dl>
      {children}
      <span className={styles.note()}>{copied ? "Copied OKLCH" : "Click to copy OKLCH"}</span>
    </div>
  );
}

/** How long a copied value says so, in ms. */
const COPIED_MS = 1600;

/** What the last copy did: nothing yet, or copied or failed for the value under `key`. */
type CopyState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "copied"; readonly key: string; readonly text: string }
  | { readonly _tag: "failed"; readonly key: string };

/** The inspector's copy action and its feedback, shared by every swatch. */
export type CopyFeedback = {
  readonly state: CopyState;
  /** Copies `text` and marks the value under `key` as copied for a moment. */
  readonly copy: (key: string, text: string) => void;
};

/** One copy action for the whole inspector, so one value at a time reads as copied. */
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
      {state._tag === "failed" ? "Could not copy: the browser refused the clipboard" : null}
    </span>
  );
}

/** The Badge variant a grade wears. Below AA is a filled destructive badge, so it never blends in. */
function gradeVariant(grade: ContrastGrade) {
  switch (grade) {
    case "AAA":
    case "AA":
      return "outline-success";
    case "below-aa":
      return "destructive";
  }
}

/** A pair's WCAG level and ratio. */
export function GradeBadge({ grade, ratio }: { grade: ContrastGrade; ratio: number }): ReactElement {
  return (
    <Badge size="sm" variant={gradeVariant(grade)} data-contrast-grade={grade}>
      {/* One text run: the Badge is a flex row, which drops a bare space between two items. */}
      <span className={styles.ratio()}>{`${GRADE_LABELS[grade]} ${formatRatio(ratio)}`}</span>
    </Badge>
  );
}
