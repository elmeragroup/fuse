import type { ReactElement } from "react";

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { CLAMP } from "../../motion/easing";
import { Caret } from "./caret";
import type { ColumnSize } from "./chat-to-preview-layout";
import {
  CHAR_WIDTH,
  COLUMNS,
  Connector,
  GUTTER,
  MASCOT,
  Mascot,
  MONO,
  PAD_X,
  RESULT_INDENT,
  ROW,
  Row,
  SpinnerGlyph,
  TERMINAL_WIDTH,
  TodoBox,
  wrapRows,
} from "./claude-code-grid";
import { TranscriptEntryView, transcriptRows } from "./claude-code-transcript";
import type { TranscriptEntry, TranscriptRow } from "./claude-code-transcript";
import { typedCount } from "./typewriter";

// From the remocn registry (`@remocn/claude-code`), restyled for Fuse and extended into a whole
// session. The surfaces, text and accent take the enclosing Fuse theme's roles, the accent its
// `sh-keyword` syntax role, and the face is the bundled JetBrains Mono instead of a Google Fonts
// fetch. The welcome box keeps the stock dashed accent border, title and mascot in the single
// column Claude Code shows in a narrow terminal. Past the stock typed prompt, the session sends
// it and plays a transcript the caller times: replies, tool calls with their results and diffs,
// the working spinner and the task list under it. The terminal keeps its columns as its window
// resizes: it scales to the window's width down to a resting width and is clipped below it, so
// no line ever reflows. The grid and its glyphs live in `claude-code-grid.tsx`, the transcript's
// entries in `claude-code-transcript.tsx`.

/** The session's spacing, in the terminal's own pixels before it scales to its window. */
const PAD_TOP = 12;
/** The space between transcript entries and between the session's blocks. */
const ENTRY_GAP = 10;
/** The welcome box: its title over the top border, its padding and its mascot row. */
const WELCOME_TITLE_ROOM = 10;
const WELCOME_PAD = 14;
const WELCOME_HEIGHT = WELCOME_TITLE_ROOM + 2 * WELCOME_PAD + MASCOT + 2;
/** The input box's padding inside its 1px border, and the height they add to its rows. */
const INPUT_PAD_X = 8;
const INPUT_PAD_Y = 5;
const INPUT_CHROME = 2 + 2 * INPUT_PAD_Y;
/**
 * Cells a typed line fills in the input box: its inner width, less the prompt's gutter and one
 * cell for the cursor after the text.
 */
const INPUT_COLUMNS =
  Math.floor((TERMINAL_WIDTH - 2 * PAD_X - 2 - 2 * INPUT_PAD_X) / CHAR_WIDTH) - GUTTER - 1;
/** The window's title bar, in stage pixels: it does not scale with the terminal. */
const BAR = 32;

/** Frames a running tool call's bullet holds each half of its blink. */
const BLINK_FRAMES = 8;

/** The spinner line while Claude works, from frame `at` until frame `until`. */
export type Activity = {
  readonly at: number;
  readonly until: number;
  readonly label: string;
};

/** A todo under the spinner, current from `startAt` and done from `doneAt`. */
export type Todo = {
  readonly label: string;
  readonly startAt: number;
  readonly doneAt: number;
};

/** The todo list under the spinner, shown from `at` until `until`. */
export type TodoList = {
  readonly at: number;
  readonly until: number;
  readonly items: readonly Todo[];
};

/** Props for {@link ClaudeCode}. */
export type ClaudeCodeProps = {
  /** The welcome box's title, on its top border. */
  readonly title: string;
  /** The welcome line, with the user's name in it. */
  readonly welcome: string;
  readonly model: string;
  /** The working directory, which the welcome box shows and the title bar names. */
  readonly cwd: string;
  /** The muted prompt placeholder before typing. */
  readonly placeholder: string;
  /** The command that types into the prompt. */
  readonly prompt: string;
  /** The frame the prompt starts typing on. */
  readonly typeAt: number;
  /** Characters typed per second. */
  readonly charsPerSecond: number;
  /** The frame the prompt is sent on: it leaves the input for the transcript. */
  readonly sendAt: number;
  readonly transcript: readonly TranscriptEntry[];
  readonly activities: readonly Activity[];
  readonly todos?: TodoList;
  /** The spinner's hint after its label, given the seconds the work has run. */
  readonly interruptHint: (seconds: number) => string;
  /** The hint under the input box. */
  readonly shortcutsHint: string;
  /** The window's size on the stage this frame. */
  readonly size: ColumnSize;
  /** The window width below which the terminal stops scaling down and is clipped instead. */
  readonly restWidth: number;
};

function Welcome({
  title,
  welcome,
  model,
  cwd,
}: Pick<ClaudeCodeProps, "title" | "welcome" | "model" | "cwd">): ReactElement {
  return (
    <div style={{ height: WELCOME_HEIGHT, paddingTop: WELCOME_TITLE_ROOM }}>
      <div
        className="relative flex items-center gap-4 border-sh-keyword"
        style={{
          borderWidth: 1,
          borderStyle: "dashed",
          borderRadius: 6,
          padding: `${String(WELCOME_PAD)}px 14px`,
        }}>
        <span
          className="font-bold absolute bg-card text-sh-keyword"
          style={{ top: -ROW / 2, left: 12, padding: "0 6px" }}>
          {title}
        </span>
        <Mascot />
        <div className="flex min-w-0 flex-col">
          <span>{welcome}</span>
          <span className="text-muted-foreground">{`${model} · ${cwd}`}</span>
        </div>
      </div>
    </div>
  );
}

/** The spinner's row: its glyph, the work's label and how long it has run. */
function StatusRow({
  activity,
  frame,
  interruptHint,
}: {
  readonly activity: Activity;
  readonly frame: number;
  readonly interruptHint: ClaudeCodeProps["interruptHint"];
}): ReactElement {
  const { fps } = useVideoConfig();
  return (
    <Row indent={GUTTER}>
      <SpinnerGlyph frame={frame} />
      <span className="text-sh-keyword">{activity.label}</span>
      <span className="text-muted-foreground">{` ${interruptHint(Math.floor((frame - activity.at) / fps))}`}</span>
    </Row>
  );
}

/** The task list under the spinner: done tasks struck through, the current one in bold. */
function TaskRows({ list, frame }: { readonly list: TodoList; readonly frame: number }): ReactElement {
  return (
    <>
      {list.items.map((item, index) => {
        const done = frame >= item.doneAt;
        const current = !done && frame >= item.startAt;
        return (
          <Row
            key={item.label}
            indent={RESULT_INDENT + 2}
            className={done ? "text-muted-foreground line-through" : current ? "font-bold" : undefined}>
            {index === 0 ? <Connector /> : null}
            <TodoBox done={done} />
            {item.label}
          </Row>
        );
      })}
    </>
  );
}

/**
 * The input box and the hint under it. Before anything is typed it shows the stock block cursor
 * and the placeholder; while typing, the text and the cursor after it.
 */
function PromptBox({
  rows,
  placeholder,
  empty,
  typing,
  shortcutsHint,
}: {
  readonly rows: readonly string[];
  readonly placeholder: string;
  /** Whether the box shows its placeholder: nothing is typed and nothing was sent yet. */
  readonly empty: boolean;
  readonly typing: boolean;
  readonly shortcutsHint: string;
}): ReactElement {
  return (
    <>
      <div
        className="border-muted-foreground/50"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: 6,
          padding: `${String(INPUT_PAD_Y)}px ${String(INPUT_PAD_X)}px`,
        }}>
        {rows.map((row, index) => {
          // The stock block cursor, a cell wide and dimmed, on the last row.
          const caret =
            index === rows.length - 1 ? (
              <span style={{ opacity: 0.55 }}>
                <Caret
                  blink={!typing}
                  style={{ width: CHAR_WIDTH, height: ROW - 4, marginLeft: 0, verticalAlign: "-3px" }}
                />
              </span>
            ) : null;
          return (
            <Row key={index} indent={GUTTER}>
              {index === 0 ? <span className="absolute left-0 text-muted-foreground">{">"}</span> : null}
              {empty ? (
                <>
                  {caret}
                  <span className="text-muted-foreground">{` ${placeholder}`}</span>
                </>
              ) : (
                <>
                  {row}
                  {caret}
                </>
              )}
            </Row>
          );
        })}
      </div>
      <Row indent={GUTTER} className="text-muted-foreground">
        {shortcutsHint}
      </Row>
    </>
  );
}

/** The rows and blocks of a session on one frame, from which its height follows. */
type SessionParts = {
  readonly userRows: number;
  /** Each shown entry's rows. */
  readonly entries: readonly (readonly TranscriptRow[])[];
  readonly working: boolean;
  readonly tasks: number;
  readonly inputRows: number;
};

/**
 * The session's height in terminal pixels: the welcome box, the sent prompt, the entries, the
 * spinner and its tasks, and the input box with its hint, each with the gap the render puts after
 * it. The terminal scrolls by it, so it reads the same metrics the parts are drawn with.
 */
function sessionHeight({ userRows, entries, working, tasks, inputRows }: SessionParts): number {
  const user = userRows === 0 ? 0 : userRows * ROW + ENTRY_GAP;
  const transcript = entries.reduce((total, rows) => total + rows.length * ROW + ENTRY_GAP, 0);
  const status = working ? ROW + tasks * ROW + ENTRY_GAP : 0;
  const prompt = INPUT_CHROME + inputRows * ROW + ROW;
  return PAD_TOP + WELCOME_HEIGHT + ENTRY_GAP + user + transcript + status + prompt;
}

/**
 * The Claude Code CLI as a session: the welcome box, the prompt typing in and being sent, and the
 * transcript, spinner and todos the caller times, in a terminal window that fills its parent. It
 * renders no background of its own behind the window; the window takes the theme's card surface.
 *
 * @returns The terminal window.
 */
export function ClaudeCode({
  title,
  welcome,
  model,
  cwd,
  placeholder,
  prompt,
  typeAt,
  charsPerSecond,
  sendAt,
  transcript,
  activities,
  todos,
  interruptHint,
  shortcutsHint,
  size,
  restWidth,
}: ClaudeCodeProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = Math.max(size.width, restWidth) / TERMINAL_WIDTH;
  const screen = (size.height - BAR) / scale;
  const blink = Math.floor(frame / BLINK_FRAMES) % 2 === 0 ? 1 : 0.35;

  const sent = frame >= sendAt;
  const promptChars = Array.from(prompt);
  const typed = sent
    ? ""
    : promptChars.slice(0, typedCount(frame - typeAt, fps, promptChars.length, charsPerSecond)).join("");
  const typing = !sent && typed.length > 0 && typed.length < promptChars.length;
  const inputRows = typed === "" ? [""] : wrapRows(typed, INPUT_COLUMNS);
  const userRows = sent ? wrapRows(prompt, COLUMNS - GUTTER) : [];

  const shown = transcript.filter((entry) => entry.at <= frame).map((entry) => transcriptRows(entry, frame));
  const activity = activities.find((entry) => entry.at <= frame && frame < entry.until);
  const tasks = todos !== undefined && todos.at <= frame && frame < todos.until ? todos : undefined;

  // A terminal scrolls by whole steps as output arrives; it never eases.
  const scroll = Math.max(
    0,
    sessionHeight({
      userRows: userRows.length,
      entries: shown,
      working: activity !== undefined,
      tasks: activity === undefined ? 0 : (tasks?.items.length ?? 0),
      inputRows: inputRows.length,
    }) - screen
  );

  const intro = spring({ fps, frame, config: { damping: 14, stiffness: 110, mass: 0.7 } });

  return (
    <div
      className="rounded-2xl absolute inset-0 overflow-hidden border border-border bg-card text-card-foreground"
      style={{
        opacity: interpolate(intro, [0, 1], [0, 1], CLAMP),
        translate: `0 ${String(interpolate(intro, [0, 1], [28, 0]))}px`,
      }}>
      <div
        className="flex items-center gap-2 border-b border-border bg-muted px-4 text-muted-foreground"
        style={{ height: BAR }}>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-muted-foreground/40" />
        ))}
        <span className="text-xs flex-1 text-center font-mono">{`claude · ${cwd}`}</span>
        <span className="w-12" />
      </div>
      <div
        className="font-mono"
        style={{
          ...MONO,
          position: "absolute",
          top: BAR,
          left: 0,
          width: TERMINAL_WIDTH,
          height: screen,
          overflow: "hidden",
          scale: String(scale),
          transformOrigin: "top left",
        }}>
        <div
          style={{
            padding: `${String(PAD_TOP)}px ${String(PAD_X)}px 0`,
            translate: `0 ${String(-scroll)}px`,
          }}>
          <Welcome title={title} welcome={welcome} model={model} cwd={cwd} />
          <div style={{ height: ENTRY_GAP }} />
          {userRows.length === 0 ? null : (
            <div className="bg-muted" style={{ marginBottom: ENTRY_GAP }}>
              {userRows.map((row, index) => (
                <Row key={index} indent={GUTTER}>
                  {index === 0 ? <span className="absolute left-0 text-muted-foreground">{">"}</span> : null}
                  {row}
                </Row>
              ))}
            </div>
          )}
          {shown.map((rows, index) => (
            <div key={index} style={{ marginBottom: ENTRY_GAP }}>
              <TranscriptEntryView rows={rows} blink={blink} />
            </div>
          ))}
          {activity === undefined ? null : (
            <div style={{ marginBottom: ENTRY_GAP }}>
              <StatusRow activity={activity} frame={frame} interruptHint={interruptHint} />
              {tasks === undefined ? null : <TaskRows list={tasks} frame={frame} />}
            </div>
          )}
          <PromptBox
            rows={inputRows}
            placeholder={placeholder}
            empty={typed === "" && !sent}
            typing={typing}
            shortcutsHint={shortcutsHint}
          />
        </div>
      </div>
    </div>
  );
}
