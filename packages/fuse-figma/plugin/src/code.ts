/**
 * The plugin's main thread. The UI asks for a plan, an apply or a snapshot export. An apply
 * plans again afterwards and reports the changes that remain, so a run that leaves the file out
 * of line with the kit shows it at once. A snapshot export reads the preview frames for
 * `figma:compare` and writes nothing.
 *
 * Each request runs as one Effect program. Any failure or defect reaches the UI as an error
 * message.
 *
 * `figma:plugin` replaces `__FUSE_KIT__` with the spec it builds from the Fuse recipes.
 */

import { Cause, Effect } from "effect";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { parseRequest } from "./protocol.ts";
import type { Request, UiMessage } from "./protocol.ts";
import { reconcile } from "./reconcile.ts";
import { FigmaPlugin, Kit, runPlugin } from "./services.ts";
import { exportSnapshots } from "./snapshots.ts";

declare const __FUSE_KIT__: KitSpec;

/** The kit, inlined once by the build. */
const kit: KitSpec = __FUSE_KIT__;

/** Post a message to the UI. */
const post = (message: UiMessage) =>
  FigmaPlugin.useSync((plugin) => {
    plugin.ui.postMessage(message);
  });

/** The message an error shows, or the thrown value as text when it is no `Error`. */
function messageOf(cause: Cause.Cause<unknown>): string {
  const error = Cause.squash(cause);
  return error instanceof Error ? error.message : String(error);
}

/** Answer one request, and post the answer to the UI. */
const respond = (request: Request) =>
  Effect.gen(function* () {
    if (request === "plan") {
      const plan = yield* reconcile(false);
      yield* post({ kind: "plan", changes: plan.changes, warnings: plan.warnings });
      return;
    }
    if (request === "apply") {
      const applied = yield* reconcile(true);
      const remaining = yield* reconcile(false);
      yield* post({
        kind: "applied",
        changes: applied.changes,
        remaining: remaining.changes,
        warnings: applied.warnings,
      });
      return;
    }
    const plugin = yield* FigmaPlugin;
    const { pages } = yield* Kit;
    const snapshot = yield* exportSnapshots(
      pages.map((page) => page.key),
      (done, total) =>
        Effect.sync(() => {
          plugin.ui.postMessage({ kind: "progress", done, total } satisfies UiMessage);
        })
    );
    yield* post({ kind: "snapshots", snapshot });
  });

figma.showUI(__html__, { width: 560, height: 640, themeColors: true });
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- UI message boundary: Figma's handler receives whatever the UI posted, and `parseRequest` parses it
figma.ui.onmessage = (message: unknown) => {
  const program = Effect.fromResult(parseRequest(message)).pipe(
    Effect.flatMap(respond),
    Effect.catchCause((cause) => post({ kind: "error", message: messageOf(cause) }))
  );
  void runPlugin(program, figma, kit);
};
