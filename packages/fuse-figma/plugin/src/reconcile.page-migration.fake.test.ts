/**
 * `reconcileKit` end to end on files the plugin laid out before the kit took its current pages,
 * against the in-memory file in `fake-figma.ts`, with the kit `buildKit()` writes from the recipes
 * and the variables `fuseVariableSet()` syncs. The oracles are hand-written: the pages, sets and
 * previews of `test/kit-inventory.ts`, from which the change lines Plan must list are built, the
 * README's two-phase Apply for a run that moves a node, and a moved node keeping its ids.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { walkLayers } from "../../src/components/kit-spec.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import { ICONS_PAGE, inventoryPage, KIT_PAGES, pageKey } from "../../test/kit-inventory.ts";
import type { InventoryPage } from "../../test/kit-inventory.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import {
  componentSet,
  CREATE_AND_PLACE_PREVIEWS,
  CREATE_PAGES,
  iconLibrary,
  kitFixture,
  kitPage,
  listed,
  previewNames,
  setOn,
  syncedFile,
} from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  ({ kit, collections } = await kitFixture());
}, 60_000);

/** The page the plugin put the whole kit on before each component got a page of its own. */
const LEGACY_PAGE = { key: "page/components", name: "Fuse components" };

/**
 * The kit in the layout the plugin wrote before each component got a page: the sets, the icons
 * and the previews on the legacy page, with each preview keyed by its theme and density.
 */
function singlePageKit(): KitSpec {
  const page = LEGACY_PAGE.key;
  return {
    ...kit,
    pages: [LEGACY_PAGE],
    icons: { ...kit.icons, page },
    componentSets: kit.componentSets.map((set) => ({ ...set, page })),
    previews: kit.previews.map((preview) => {
      const key = `${preview.key}/dense`;
      const groups = preview.groups.map((group) => ({ ...group, key: `${key}/${group.componentSet}` }));
      return { ...preview, key, page, groups };
    }),
  };
}

/** A synced file the plugin applied the single-page kit to, opened again for the next run. */
async function singlePageFile(): Promise<FakeFigma> {
  const file = syncedFile(collections);
  await reconcileKit(file.figma, singlePageKit(), true);
  file.reopen();
  return file;
}

/** Each child's id, by its name. */
function idsByName(parent: ChildrenMixin): ReadonlyMap<string, string> {
  return new Map(parent.children.map((node) => [node.name, node.id]));
}

describe("a file the plugin laid out on one page", () => {
  it("moves the sets and the icons onto their pages with their ids, then deletes the old page", async () => {
    const file = await singlePageFile();
    const legacy = await kitPage(file, LEGACY_PAGE.key);
    const before = idsByName(legacy);
    const variantsBefore = [setOn(legacy, "Button"), setOn(legacy, "Icon button")].map(idsByName);
    const pagePhase = [
      ...CREATE_PAGES,
      ...KIT_PAGES.flatMap(previewNames).map((name) => `Fuse components: delete ${name}`),
      "Fuse components: move Icons to the Icons page",
      ...KIT_PAGES.flatMap((page) =>
        page.sets.map((set) => `Fuse components: move ${set.name} to the ${page.name} page`)
      ),
    ];
    // The icon library and every set move.
    const moves = KIT_PAGES.flatMap((page) => page.sets).length + 1;

    expect(await reconcileKit(file.figma, kit, false)).toEqual({
      changes: [...pagePhase, `Document: plan the rest of the kit again once the ${moves} moves land`],
      warnings: [],
    });
    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied).toEqual({
      changes: [...pagePhase, ...CREATE_AND_PLACE_PREVIEWS, "Document: delete the page Fuse components"],
      warnings: [],
    });
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });

    expect(legacy.removed).toBe(true);
    expect(file.figma.root.children.map((page) => page.name)).toEqual([
      "Page 1",
      ...[...KIT_PAGES, ICONS_PAGE].map((page) => page.name),
    ]);
    const button = await componentSet(file, "Button");
    const iconButton = await componentSet(file, "Icon button");
    expect([button.id, iconButton.id, (await iconLibrary(file)).id]).toEqual([
      before.get("Button"),
      before.get("Icon button"),
      before.get("Icons"),
    ]);
    expect([button, iconButton].map(idsByName)).toEqual(variantsBefore);
  });

  it("keeps the old page and warns while it holds a layer the kit does not own", async () => {
    const file = await singlePageFile();
    const legacy = await kitPage(file, LEGACY_PAGE.key);
    const notes = file.figma.createFrame();
    legacy.appendChild(notes);
    notes.name = "Notes";
    const warning =
      "Fuse components: the kit no longer uses this page, and keeps it for Notes, which the kit does not own";

    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied.warnings).toEqual([warning]);
    expect(applied.changes).not.toContain("Document: delete the page Fuse components");
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [warning] });
    await legacy.loadAsync();
    expect(legacy.children).toEqual([notes]);
  });

  it("leaves pages named Button and Icons that it does not own alone, and creates its own", async () => {
    const file = syncedFile(collections);
    const imported = ["Button", "Icons"].map((name) => {
      const page = file.figma.createPage();
      page.name = name;
      const frame = file.figma.createFrame();
      page.appendChild(frame);
      frame.name = name;
      return { page, frame };
    });
    file.reopen();

    const applied = await reconcileKit(file.figma, kit, true);
    expect(applied.changes.slice(0, CREATE_PAGES.length)).toEqual(CREATE_PAGES);
    expect(file.figma.root.children.map((page) => page.name)).toEqual([
      "Page 1",
      "Button",
      "Icons",
      ...[...KIT_PAGES, ICONS_PAGE].map((page) => page.name),
    ]);
    for (const { page, frame } of imported) {
      await page.loadAsync();
      expect(page.children).toEqual([frame]);
      expect([keyOf(page), keyOf(frame)]).toEqual(["", ""]);
    }
  });
});

// Unit under test: `reconcileKit` on a file the plugin applied before Label moved to the Field page.
// Oracle: the Field page's row in `test/kit-inventory.ts`, the README's two-phase Apply for a run that
// moves a node, and a moved node keeping its id and its variants' ids and component keys.
describe("a file with Label on the page it used to sit on alone", () => {
  const FIELD = inventoryPage("field");
  /** The Label set, rest and disabled. */
  const LABEL = { key: "label", name: "Label", variants: 2, previewed: 2 };
  /** The page Label sat on alone, with its own four previews. */
  const LABEL_PAGE: InventoryPage = { slug: "label", name: "Label", sets: [LABEL] };
  const TEXTAREA = inventoryPage("textarea");
  /** The Textarea page's set that shows Field description and Field error, which came after them. */
  const TEXTAREA_FIELD = { key: "textarea-field", name: "Textarea field", variants: 5, previewed: 5 };

  /**
   * The kit as the plugin wrote it before the Field page: Label alone on its own page, previewed
   * there, and none of the sets that joined it on the Field page, nor a later set that shows one of
   * them, as Textarea field shows Field description.
   */
  function labelPageKit(): KitSpec {
    const field = pageKey(FIELD);
    const label = { key: pageKey(LABEL_PAGE), name: LABEL_PAGE.name };
    const previewKey = (key: string) => key.replace(`preview/${FIELD.slug}/`, `preview/${LABEL_PAGE.slug}/`);
    const joined = new Set(
      kit.componentSets.filter((set) => set.page === field && set.key !== LABEL.key).map((set) => set.key)
    );
    const later = new Set(
      kit.componentSets
        .filter((set) =>
          set.variants.some((variant) =>
            walkLayers(variant.root).some(
              (layer) => layer.kind === "instance" && joined.has(layer.componentSet)
            )
          )
        )
        .map((set) => set.key)
    );
    return {
      ...kit,
      pages: kit.pages.map((page) => (page.key === field ? label : page)),
      componentSets: kit.componentSets.flatMap((set) => {
        if (later.has(set.key)) {
          return [];
        }
        if (set.page !== field) {
          return [set];
        }
        return set.key === LABEL.key ? [{ ...set, page: label.key }] : [];
      }),
      previews: kit.previews.map((preview) =>
        preview.page === field
          ? {
              ...preview,
              key: previewKey(preview.key),
              name: preview.name.replace(`${FIELD.name} / `, `${LABEL_PAGE.name} / `),
              page: label.key,
              groups: preview.groups
                .filter((group) => group.componentSet === LABEL.key)
                .map((group) => ({ ...group, key: previewKey(group.key) })),
            }
          : {
              ...preview,
              groups: preview.groups.filter((group) => !later.has(group.componentSet)),
            }
      ),
    };
  }

  it("moves Label to the Field page with its ids, then deletes the Label page, in one Apply", async () => {
    const file = syncedFile(collections);
    await reconcileKit(file.figma, labelPageKit(), true);
    file.reopen();
    const old = await kitPage(file, pageKey(LABEL_PAGE));
    const label = setOn(old, LABEL.name);
    const before = {
      set: label.id,
      variants: idsByName(label),
      keys: label.children.map((variant) => (variant.type === "COMPONENT" ? variant.key : "")),
    };
    const pagePhase = [
      `Document: create the page ${FIELD.name}`,
      ...previewNames(LABEL_PAGE).map((name) => `${LABEL_PAGE.name}: delete ${name}`),
      `${LABEL_PAGE.name}: move ${LABEL.name} to the ${FIELD.name} page`,
    ];

    expect(await reconcileKit(file.figma, kit, false)).toEqual({
      changes: [...pagePhase, "Document: plan the rest of the kit again once the move lands"],
      warnings: [],
    });
    expect(await reconcileKit(file.figma, kit, true)).toEqual({
      changes: [
        ...pagePhase,
        ...FIELD.sets
          .filter((set) => set.key !== LABEL.key)
          .map((set) => `${FIELD.name}: create the component set ${set.name} with ${set.variants} variants`),
        `${TEXTAREA.name}: create the component set ${TEXTAREA_FIELD.name} with ${TEXTAREA_FIELD.variants} variants`,
        ...previewNames(FIELD).map((name) => `${FIELD.name}: create the preview ${name}`),
        `${FIELD.name}: place ${listed(FIELD.sets.map((set) => set.name))} in a row and stack 4 previews below them`,
        ...previewNames(TEXTAREA).map((name) => `${name}: create the group ${TEXTAREA_FIELD.name}`),
        `${TEXTAREA.name}: place ${listed(TEXTAREA.sets.map((set) => set.name))} in a row and stack 4 previews below them`,
        `Document: delete the page ${LABEL_PAGE.name}`,
      ],
      warnings: [],
    });
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });

    expect(old.removed).toBe(true);
    // The plugin creates a missing page after the last one and never reorders pages.
    expect(file.figma.root.children.map((page) => page.name)).toEqual([
      "Page 1",
      ...[...KIT_PAGES.filter((page) => page !== FIELD), ICONS_PAGE, FIELD].map((page) => page.name),
    ]);
    const page = await kitPage(file, pageKey(FIELD));
    expect(page.children.map((node) => node.name)).toEqual([
      ...FIELD.sets.map((set) => set.name),
      ...previewNames(FIELD),
    ]);
    const moved = setOn(page, LABEL.name);
    expect({
      set: moved.id,
      variants: idsByName(moved),
      keys: moved.children.map((variant) => (variant.type === "COMPONENT" ? variant.key : "")),
    }).toEqual(before);
  });
});
