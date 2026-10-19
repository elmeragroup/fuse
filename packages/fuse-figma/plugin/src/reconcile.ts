/**
 * Plan or apply the whole kit. A plan walks the same code as an apply with writes turned
 * off, so the change list it returns is what an apply would do.
 *
 * The run takes the plugin API as an argument rather than reading the `figma` global, so a
 * test can hand it a fake file.
 */

import type {
  ColorSpec,
  KitSpec,
  NumberSpec,
  StringSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { syncComponentSet } from "./component-set.ts";
import type { SyncedSet } from "./component-set.ts";
import type { Run } from "./fields.ts";
import { findOwned, setKey, staleOwned } from "./identity.ts";
import { change, create, newLedger } from "./ledger.ts";
import { syncPreviews } from "./previews.ts";
import { loadKitVariables } from "./variables.ts";
import type { KitVariables } from "./variables.ts";

/** What a run changed, or would change, and what it could not represent. */
export type ReconcileReport = {
  readonly changes: readonly string[];
  readonly warnings: readonly string[];
};

const isPage = (node: BaseNode): node is PageNode => node.type === "PAGE";

function variableRefs(spec: NumberSpec | ColorSpec | StringSpec | undefined): VariableRef[] {
  return spec?.kind === "variable" ? [spec.variable] : [];
}

/**
 * Look up every variable and mode the kit names before the run writes anything, so a file
 * that misses one fails with nothing half written.
 */
function checkReferences(variables: KitVariables, kit: KitSpec): void {
  for (const set of kit.componentSets) {
    for (const { root } of set.variants) {
      const refs = [
        root.height,
        root.minWidth,
        root.paddingTop,
        root.paddingRight,
        root.paddingBottom,
        root.paddingLeft,
        root.itemSpacing,
        root.cornerRadius,
        root.fill,
        root.stroke?.color,
        root.stroke?.weight,
        ...root.shadows.map((shadow) => shadow.color),
        ...root.children.flatMap((child) =>
          child.kind === "text"
            ? [child.fontFamily, child.fontSize, child.lineHeight, child.color]
            : [child.size, child.color]
        ),
      ].flatMap(variableRefs);
      for (const ref of refs) {
        variables.variable(ref);
      }
    }
  }
  for (const preview of kit.previews) {
    for (const ref of preview.modes) {
      variables.mode(ref);
    }
  }
}

/**
 * Plan or apply the kit on the current file.
 *
 * @param figma - The plugin API.
 * @param kit - The kit the spec builder wrote.
 * @param apply - Whether to write the changes or only list them.
 * @returns The changes and the warnings.
 */
export async function reconcileKit(figma: PluginAPI, kit: KitSpec, apply: boolean): Promise<ReconcileReport> {
  const ledger = newLedger(apply);
  for (const font of kit.fonts) {
    await figma.loadFontAsync(font);
  }
  const variables = await loadKitVariables(figma);
  checkReferences(variables, kit);
  const run: Run = { figma, variables, ledger };

  const document = "Document";
  let page = findOwned(ledger, figma.root.children, document, kit.page.key, kit.page.name, isPage);
  page ??= create(ledger, document, `create the page ${kit.page.name}`, () => {
    const made = figma.createPage();
    made.name = kit.page.name;
    setKey(made, kit.page.key);
    return made;
  });
  if (page === undefined) {
    for (const set of kit.componentSets) {
      create(
        ledger,
        kit.page.name,
        `create the component set ${set.name} with ${set.variants.length} variants`,
        () => set
      );
    }
    for (const preview of kit.previews) {
      create(ledger, kit.page.name, `create the preview ${preview.name}`, () => preview);
    }
    return { changes: ledger.changes, warnings: ledger.warnings };
  }
  await page.loadAsync();

  const keep = new Set([
    ...kit.componentSets.map((set) => set.key),
    ...kit.previews.map((preview) => preview.key),
  ]);
  for (const stale of staleOwned(page.children, keep)) {
    change(ledger, page.name, `delete ${stale.name}`, () => stale.remove());
  }

  const sets = new Map<string, SyncedSet>();
  for (const spec of kit.componentSets) {
    sets.set(spec.key, await syncComponentSet(run, page, spec));
  }
  await syncPreviews(run, page, kit.previews, sets);

  if (apply) {
    await figma.setCurrentPageAsync(page);
  }
  return { changes: ledger.changes, warnings: ledger.warnings };
}
