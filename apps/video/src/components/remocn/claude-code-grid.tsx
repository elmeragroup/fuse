import type { CSSProperties, ReactElement, ReactNode } from "react";

import { Check } from "@elmeragroup/fuse/icons";

// Part of the Claude Code component (see `claude-code.tsx`): the terminal's character grid and
// the glyphs drawn on it. The bundled face carries Latin only, so box drawing, bullets, the
// spinner and the task boxes are drawn rather than typed; a fallback face would differ between
// machines.

/** The terminal's width and padding, in its own pixels before it scales to its window. */
export const TERMINAL_WIDTH = 500;
export const PAD_X = 16;
const FONT_SIZE = 13;
/** One row of the grid. */
export const ROW = 20;
/** JetBrains Mono advances every glyph by 600 of its 1000 units per em. */
export const CHAR_WIDTH = FONT_SIZE * 0.6;
/** Character cells per row; lines wrap at word boundaries inside them. */
export const COLUMNS = Math.floor((TERMINAL_WIDTH - 2 * PAD_X) / CHAR_WIDTH);
/** The cells before a bullet's text, and before a tool result after its connector. */
export const GUTTER = 2;
export const RESULT_INDENT = 5;
/** The mascot's size in the welcome box. */
export const MASCOT = 44;

/** Frames per spinner glyph; Claude Code turns its spinner about eight times a second. */
const SPINNER_FRAMES_PER_GLYPH = 4;

/**
 * The grid's type on whole rows, every space kept. The grid draws in the video's mono face,
 * JetBrains Mono, which `index.css` bundles as `--font-mono`.
 */
export const MONO: CSSProperties = {
  fontSize: FONT_SIZE,
  lineHeight: `${String(ROW)}px`,
  whiteSpace: "pre",
};

/**
 * Splits text into rows of at most `width` cells at word boundaries, as a terminal wraps a line.
 * A word longer than a row breaks inside it.
 *
 * @param text - One line of text.
 * @param width - The row's width in character cells.
 * @returns The rows, at least one.
 */
export function wrapRows(text: string, width: number): readonly string[] {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(" ")) {
    let rest = word;
    while (rest.length > width) {
      if (row !== "") {
        rows.push(row);
        row = "";
      }
      rows.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    const next = row === "" ? rest : `${row} ${rest}`;
    if (next.length > width) {
      rows.push(row);
      row = rest;
    } else {
      row = next;
    }
  }
  rows.push(row);
  return rows;
}

/** A filled dot in the gutter: a reply's bullet, or a tool call's, blinking until it is done. */
export function Bullet({
  tone,
  blink,
}: {
  readonly tone: "text" | "done" | "running";
  readonly blink: number;
}): ReactElement {
  return (
    <span
      aria-hidden
      className={
        tone === "done" ? "bg-success" : tone === "running" ? "bg-muted-foreground" : "bg-card-foreground"
      }
      style={{
        position: "absolute",
        left: 1,
        top: (ROW - 7) / 2,
        width: 7,
        height: 7,
        borderRadius: 999,
        opacity: tone === "running" ? blink : 1,
      }}
    />
  );
}

/** The corner that ties a result to its call, drawn where Claude Code types `⎿`. */
export function Connector(): ReactElement {
  return (
    <span
      aria-hidden
      className="border-muted-foreground"
      style={{
        position: "absolute",
        left: GUTTER * CHAR_WIDTH + 1,
        top: 2,
        width: CHAR_WIDTH,
        height: ROW / 2 - 1,
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderStyle: "solid",
        borderTopWidth: 0,
        borderRightWidth: 0,
      }}
    />
  );
}

/** A row of the transcript, its text after `indent` cells. */
export function Row({
  indent,
  className,
  children,
}: {
  readonly indent: number;
  readonly className?: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      className={className}
      style={{ position: "relative", height: ROW, paddingLeft: indent * CHAR_WIDTH }}>
      {children}
    </div>
  );
}

/**
 * The spinner Claude Code turns while it works, drawn as its asterisk glyphs: a dot that grows
 * arms, from four to eight, and back.
 */
export function SpinnerGlyph({ frame }: { readonly frame: number }): ReactElement {
  const arms = [0, 4, 6, 8, 8, 6][Math.floor(frame / SPINNER_FRAMES_PER_GLYPH) % 6] ?? 0;
  const size = FONT_SIZE;
  const centre = size / 2;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className="text-sh-keyword"
      style={{ position: "absolute", left: 0, top: (ROW - size) / 2 }}>
      {arms === 0 ? (
        <circle cx={centre} cy={centre} r={1.5} fill="currentColor" />
      ) : (
        Array.from({ length: arms }, (_, arm) => {
          const angle = (arm / arms) * Math.PI;
          const reach = centre - 1;
          return (
            <line
              key={arm}
              x1={centre - Math.cos(angle) * reach}
              y1={centre - Math.sin(angle) * reach}
              x2={centre + Math.cos(angle) * reach}
              y2={centre + Math.sin(angle) * reach}
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          );
        })
      )}
    </svg>
  );
}

/** A todo's box: empty while pending, ticked once done. */
export function TodoBox({ done }: { readonly done: boolean }): ReactElement {
  return (
    <span
      aria-hidden
      className={done ? "border-muted-foreground text-muted-foreground" : "border-card-foreground"}
      style={{
        position: "absolute",
        left: RESULT_INDENT * CHAR_WIDTH,
        top: (ROW - 10) / 2,
        width: 10,
        height: 10,
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      {done ? <Check style={{ width: 9, height: 9 }} /> : null}
    </span>
  );
}

/** Claude Code's mascot, from the stock component, in the theme's accent. */
export function Mascot(): ReactElement {
  return (
    <svg aria-hidden width={MASCOT} height={MASCOT} viewBox="0 0 24 24" className="shrink-0 text-sh-keyword">
      <path
        clipRule="evenodd"
        d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
