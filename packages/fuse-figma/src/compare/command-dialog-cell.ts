/// <reference lib="dom" />
/**
 * The client renderers of the Command dialog sets, the docs Dialog demo's palette mounted open on the
 * compare page in a host as large as the viewport the definitions declare, its popup and scrim
 * portalled into that host, which is their containing block, as `viewport-host.ts` says.
 *
 * - `commandPalette`: the palette, measured alone; the page hides the scrim.
 * - `commandDialogOpen`: the palette over the scrim, measured together, the scrim as large as the
 *   viewport.
 *
 * The palette's `top-[max(--spacing(4),12dvh)]` and `max-h-[calc(100dvh-2*max(--spacing(4),12dvh))]`
 * read the page's window, which the host cannot resize, so the host restates both against the
 * viewport: a 60px top and a 380px cap in the 640 × 500 viewport, as `COMMAND_DIALOG_VIEWPORT` says.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Command } from "../../../fuse/dist/command.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  COMMAND_DIALOG_COMMANDS,
  COMMAND_DIALOG_TOP,
  COMMAND_DIALOG_VIEWPORT,
} from "../components/command-dialog-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { viewportHost } from "./viewport-host.ts";

/** The palette's `dvh` lengths, restated against the declared viewport. */
const VIEWPORT_CSS = `[data-slot="command-content"]{top:${String(COMMAND_DIALOG_TOP)}px!important;max-height:${String(
  COMMAND_DIALOG_VIEWPORT.height - 2 * COMMAND_DIALOG_TOP
)}px!important}`;

/** The demo's palette, open. */
function openPalette() {
  return viewportHost(
    COMMAND_DIALOG_VIEWPORT,
    (host) =>
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(Command.Root, {
          items: COMMAND_DIALOG_COMMANDS,
          defaultOpen: true,
          children: createElement(Command.Content, {
            container: host,
            children: [
              createElement(Command.Input, { key: "input" }),
              createElement(Command.Empty, { key: "empty" }),
              createElement(Command.List, {
                key: "list",
                children: (command: string) =>
                  createElement(Command.Item, { key: command, value: command }, command),
              }),
              createElement(Command.Footer, {
                key: "footer",
                children: [
                  createElement(Command.NavigateHint, { key: "navigate" }),
                  createElement(Command.SelectHint, { key: "select", children: "Run" }),
                  createElement(Command.CloseHint, { key: "close" }),
                ],
              }),
            ],
          }),
        }),
      }),
    VIEWPORT_CSS
  );
}

/** The open palette. */
export const commandPalette: ClientCellRendering = {
  element: () => openPalette(),
};

/** The open Command dialog, its scrim and its palette. */
export const commandDialogOpen: ClientCellRendering = {
  element: () => openPalette(),
  union: ["dialog-overlay", "command-content"],
};
