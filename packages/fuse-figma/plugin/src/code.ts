/**
 * The plugin's main thread. The UI asks for a plan or an apply. An apply plans again
 * afterwards and reports the changes that remain, so a run that leaves the file out of line
 * with the kit shows it at once.
 *
 * `figma:plugin` replaces `__FUSE_KIT__` with the spec it builds from the Fuse recipes.
 */

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { reconcileKit } from "./reconcile.ts";

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
    throw new Error(`The plugin UI sent an unknown request: ${request}`);
  } catch (error) {
    post({ kind: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

figma.showUI(__html__, { width: 560, height: 640, themeColors: true });
// The UI is this plugin's own `ui.html`, which posts only the strings "plan" and "apply".
figma.ui.onmessage = (request: string) => {
  void respond(request);
};
