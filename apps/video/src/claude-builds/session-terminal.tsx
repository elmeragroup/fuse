import type { ReactElement } from "react";

import { densityAttributes, themeAttributes } from "@elmeragroup/fuse/theme";

import { INSTALL_COMMAND } from "../brand/fuse-facts";
import { splitWidths } from "../components/remocn/chat-to-preview-layout";
import type { ColumnSize } from "../components/remocn/chat-to-preview-layout";
import { ClaudeCode } from "../components/remocn/claude-code";
import type { Activity, Todo } from "../components/remocn/claude-code";
import type { DiffLine, TranscriptEntry } from "../components/remocn/claude-code-transcript";
import { useCopy, useVideoLocale } from "../copy/copy";
import { bars } from "../music/beat-grid";
import { themeFor } from "../primitives/scene-theme";
import { STOP_BAR } from "./grid";
import { MachineTheme } from "./machine-theme";
import {
  BUILT_AT,
  CHAT_REST,
  CLICK,
  DONE_AT,
  FLIPS,
  HOME_LOOK,
  INSTALL,
  PROMPT,
  REPLY_AT,
  THINKING,
  TODOS,
  WRITES,
} from "./session-script";
import type { Look } from "./session-script";
import { SITE_SECTIONS } from "./site/site-layout";

/** The file whose root element carries the theme, which every flip edits. */
const LAYOUT_PATH = "src/app/layout.tsx";

/** The working directory the session runs in. */
const CWD = "~/src/elmera";

/** The chat column's width once the split has opened, where the terminal stops scaling down. */
const REST_WIDTH = splitWidths(CHAT_REST).chat;

/**
 * The root element's attributes for a look, as the page stamps them: Fuse's theme attributes for
 * the brand's external theme, `data-theme="dark"` in the dark scheme, and Fuse's density
 * attribute. The layout file writes one attribute per line, in this order.
 */
function rootAttributes(look: Look): readonly (readonly [string, string])[] {
  const scheme: readonly (readonly [string, string])[] =
    look.scheme === "dark" ? [["data-theme", "dark"]] : [];
  return [
    ...Object.entries(themeAttributes(themeFor(look.brand, "external"))),
    ...scheme,
    ...Object.entries(densityAttributes(look.density)),
  ];
}

/**
 * The lines a flip changes in the layout file: for each attribute that differs, its old line
 * removed and its new one added, in the file's order.
 */
function rootDiff(before: Look, after: Look): readonly DiffLine[] {
  const old = new Map(rootAttributes(before));
  const next = new Map(rootAttributes(after));
  // A dark look carries every attribute, so its order is the file's.
  const order = rootAttributes({ ...after, scheme: "dark" }).map(([name]) => name);
  return order.flatMap((name): DiffLine[] => {
    const from = old.get(name);
    const to = next.get(name);
    const removed: DiffLine[] =
      from === undefined || from === to ? [] : [{ sign: "-", text: `${name}="${from}"` }];
    const added: DiffLine[] = to === undefined || from === to ? [] : [{ sign: "+", text: `${name}="${to}"` }];
    return [...removed, ...added];
  });
}

/**
 * The Claude Code session: the prompt, the reply and the install, a write per section in step
 * with the preview, the click that raises the site's toast, an edit per flip of the page's look,
 * and the last word once the drums stop.
 *
 * @param props.size - The chat column's size this frame.
 * @returns The terminal.
 */
export function SessionTerminal({ size }: { readonly size: ColumnSize }): ReactElement {
  const { terminal, site } = useCopy().claudeBuilds;
  const seconds = new Intl.NumberFormat(useVideoLocale(), { maximumFractionDigits: 1 });

  const writes = SITE_SECTIONS.map((section): TranscriptEntry => ({
    kind: "tool",
    at: WRITES[section].at,
    doneAt: WRITES[section].lands,
    name: "Write",
    target: WRITES[section].path,
    result: terminal.wrote(WRITES[section].lines, WRITES[section].path),
  }));
  const flips = FLIPS.map((flip, index): TranscriptEntry => ({
    kind: "tool",
    at: flip.at,
    doneAt: flip.at,
    name: "Update",
    target: LAYOUT_PATH,
    diff: rootDiff(FLIPS[index - 1]?.look ?? HOME_LOOK, flip.look),
  }));
  const entries: readonly TranscriptEntry[] = [
    { kind: "reply", at: REPLY_AT, text: terminal.reply },
    {
      kind: "tool",
      at: INSTALL.at,
      doneAt: INSTALL.doneAt,
      name: "Bash",
      target: INSTALL_COMMAND,
      result: terminal.installed(seconds.format(INSTALL.seconds)),
    },
    { kind: "tool", at: TODOS.at, doneAt: TODOS.at, name: terminal.todosTool },
    ...writes,
    {
      kind: "tool",
      at: CLICK.call,
      doneAt: CLICK.at,
      name: "playwright - browser_click (MCP)",
      target: `element: "${site.order}"`,
      result: terminal.clicked(site.toast.title),
    },
    { kind: "reply", at: BUILT_AT, text: terminal.built },
    ...flips,
    { kind: "reply", at: DONE_AT, text: terminal.done },
  ];
  const transcript = entries.toSorted((left, right) => left.at - right.at);

  // Each task is current from the moment the one before it is done. The calculator is done once
  // its order is tried, and the brands once the drums stop; the spinner turns on to the last word.
  const steps = [
    ...SITE_SECTIONS.map((section) => ({
      copy: terminal.todos[section],
      doneAt: section === "calculator" ? CLICK.at : WRITES[section].lands,
    })),
    { copy: terminal.todos.brands, doneAt: bars(STOP_BAR) },
  ];
  const todos = steps.map((step, index): Todo => ({
    label: step.copy.label,
    startAt: steps[index - 1]?.doneAt ?? TODOS.at,
    doneAt: step.doneAt,
  }));
  const activities: readonly Activity[] = [
    { at: THINKING.at, until: THINKING.until, label: terminal.thinking },
    ...todos.map((todo, index): Activity => ({
      at: todo.startAt,
      until: index === todos.length - 1 ? DONE_AT : todo.doneAt,
      label: steps[index]?.copy.working ?? terminal.thinking,
    })),
  ];

  return (
    <MachineTheme className="absolute inset-0 font-sans">
      <ClaudeCode
        title={terminal.title}
        welcome={terminal.welcome(terminal.user)}
        model={terminal.model}
        cwd={CWD}
        placeholder={terminal.placeholder}
        prompt={terminal.prompt}
        typeAt={PROMPT.typeAt}
        charsPerSecond={PROMPT.charsPerSecond}
        sendAt={PROMPT.sendAt}
        transcript={transcript}
        activities={activities}
        todos={{ at: TODOS.at, until: TODOS.until, items: todos }}
        interruptHint={terminal.interrupt}
        shortcutsHint={terminal.shortcuts}
        size={size}
        restWidth={REST_WIDTH}
      />
    </MachineTheme>
  );
}
