/**
 * The docs Command Dialog demo's copy, free of imports for the client bundle, which
 * `command-dialog-kit.ts` draws and `compare/command-dialog-cell.ts` renders.
 */

/** The demo's commands, in order: Base UI highlights the first in an open palette. */
export const COMMAND_DIALOG_COMMANDS = [
  "New customer",
  "Register meter reading",
  "Create credit note",
  "Open invoices",
  "Open contracts",
  "Open settings",
] as const;

/** `Command.Empty`'s en-US message, `empty` in the Command dictionary, which shows only while no row matches. */
export const COMMAND_DIALOG_EMPTY_TEXT = "No results.";

/** The footer's hints, as `Command.NavigateHint`, `Command.SelectHint` with "Run" and `Command.CloseHint` render them in en-US. */
export const COMMAND_DIALOG_HINTS = [
  { key: "navigate", keys: ["↑", "↓"], label: "Navigate" },
  { key: "select", keys: ["↵"], label: "Run" },
  { key: "close", keys: ["Esc"], label: "Close" },
] as const;

/**
 * The viewport the palette and its open example sit in, 640 × 500. The palette is `w-[calc(100%-2rem)]`
 * up to `max-w-xl`, 576px, which it reaches from 608px, and sits `max(1rem, 12dvh)` below the top,
 * capped at `100dvh` less twice that. At 500px tall `12dvh` is 60px, on the pixel grid, and the cap is
 * 380px, above the palette's natural 289px dense and 341px comfortable, so it shows every row: the
 * shortest such height is 449px, which a 448px compare slot cannot hold, so the page grows these cells'
 * row (`slotRects`).
 */
export const COMMAND_DIALOG_VIEWPORT = { width: 640, height: 500 } as const;

/** The palette's top in that viewport: `max(1rem, 12dvh)`, 60px. */
export const COMMAND_DIALOG_TOP = Math.max(16, (12 * COMMAND_DIALOG_VIEWPORT.height) / 100);
