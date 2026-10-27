/**
 * This module types the messages between the plugin's main thread and its UI in `ui.html`. The UI
 * posts a request string, and the main thread answers with a `UiMessage`.
 */

import { Result } from "effect";

import type { KitSnapshot } from "../../src/compare/snapshot.ts";
import { UnknownRequest } from "./errors.ts";

/** The requests the UI posts. */
const REQUESTS = ["plan", "apply", "snapshots"] as const;

/** What the UI asks the main thread for. */
export type Request = (typeof REQUESTS)[number];

/** A message the main thread posts to the UI. */
export type UiMessage =
  | { readonly kind: "plan"; readonly changes: readonly string[]; readonly warnings: readonly string[] }
  | {
      readonly kind: "applied";
      readonly changes: readonly string[];
      readonly remaining: readonly string[];
      readonly warnings: readonly string[];
    }
  | { readonly kind: "progress"; readonly done: number; readonly total: number }
  | { readonly kind: "snapshots"; readonly snapshot: KitSnapshot }
  | { readonly kind: "error"; readonly message: string };

/**
 * Parse a message the UI posted.
 *
 * @param message - What `figma.ui.onmessage` received.
 * @returns The request, or `UnknownRequest` for anything else.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- UI message boundary: this is the parser for what `figma.ui.onmessage` receives
export function parseRequest(message: unknown): Result.Result<Request, UnknownRequest> {
  const request = REQUESTS.find((candidate) => candidate === message);
  return request === undefined
    ? Result.fail(
        new UnknownRequest({ message: `The plugin UI sent an unknown request: ${String(message)}` })
      )
    : Result.succeed(request);
}
