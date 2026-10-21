/**
 * The plugin's main thread. The UI asks for a plan, an apply or a snapshot export. An apply
 * plans again afterwards and reports the changes that remain, so a run that leaves the file out
 * of line with the kit shows it at once. A snapshot export reads the preview frames for
 * `figma:compare` and writes nothing.
 *
 * `figma:plugin` replaces `__FUSE_KIT__` with the spec it builds from the Fuse recipes.
 */

import type { KitSnapshot } from "../../src/compare/snapshot.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { reconcileKit } from "./reconcile.ts";
import { exportSnapshots } from "./snapshots.ts";

declare const __FUSE_KIT__: KitSpec;

/** The kit, inlined once by the build. */
const kit: KitSpec = __FUSE_KIT__;

/** A message to the UI. */
type UiMessage =
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

function post(message: UiMessage): void {
  figma.ui.postMessage(message);
}

async function respond(request: string): Promise<void> {
  try {
    if (request === "plan") {
      const plan = await reconcileKit(figma, kit, false);
      post({ kind: "plan", changes: plan.changes, warnings: plan.warnings });
      return;
    }
    if (request === "apply") {
      const applied = await reconcileKit(figma, kit, true);
      const remaining = await reconcileKit(figma, kit, false);
      post({
        kind: "applied",
        changes: applied.changes,
        remaining: remaining.changes,
        warnings: applied.warnings,
      });
      return;
    }
    if (request === "snapshots") {
      const snapshot = await exportSnapshots(
        figma,
        kit.pages.map((page) => page.key),
        (done, total) => {
          post({ kind: "progress", done, total });
        }
      );
      post({ kind: "snapshots", snapshot });
      return;
    }
    throw new Error(`The plugin UI sent an unknown request: ${request}`);
  } catch (error) {
    post({ kind: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

figma.showUI(__html__, { width: 560, height: 640, themeColors: true });
// The UI is this plugin's own `ui.html`, which posts only the strings "plan", "apply" and
// "snapshots".
figma.ui.onmessage = (request: string) => {
  void respond(request);
};
