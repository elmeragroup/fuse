/**
 * The sections of each component page of a file the plugin applied the whole kit to, on the
 * in-memory file in `fake-figma.ts`. Unit under test: the page layout in `page-docs.ts`. Oracles,
 * written by hand: each page's sets in order and its four previews in `test/kit-inventory.ts`, and
 * the layout the owner chose from UX's Obra pages. Sections run down the page in the order title,
 * each set, `Themes`, `Examples`. Each section's label sits in one column at the page's left edge,
 * level with the section's top, and its content starts right of that column at one left edge. The
 * previews sit side by side, and no two top-level nodes overlap. The label column is 240px wide, and a
 * label too wide for it widens it.
 *
 * The fake measures a text as 0 high, so the vertical checks read frames and sets, which have
 * heights, and a text only by its top.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { inventoryPage, KIT_PAGES, pageKey, previewsOn } from "../../test/kit-inventory.ts";
import type { InventoryPage } from "../../test/kit-inventory.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** A box on the page. */
type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A section of a page: its label's box and its content's boxes. */
type Section = {
  readonly name: string;
  readonly label: Box;
  /** The boxes right of the label column, such as a set's headers and the set. */
  readonly content: readonly Box[];
};

/** A node's box, offset by its parent's place where the parent is not the page. */
function boxOf(node: SceneNode, parent?: SceneNode): Box {
  return {
    x: node.x + (parent?.x ?? 0),
    y: node.y + (parent?.y ?? 0),
    width: node.width,
    height: node.height,
  };
}

/** The box around boxes. */
function around(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - top,
  };
}

/** Whether two boxes share any point inside both, edges excluded. */
function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** A top-level node of the page by its key. */
function topLevel(page: PageNode, key: string): SceneNode {
  const node = page.children.find((child) => keyOf(child) === key);
  if (node === undefined) {
    throw new Error(`${page.name} has no node ${key}`);
  }
  return node;
}

/** A layer of a frame by its key. */
function layer(frame: SceneNode, key: string): SceneNode {
  const node = frame.type === "FRAME" ? frame.children.find((child) => keyOf(child) === key) : undefined;
  if (node === undefined) {
    throw new Error(`${frame.name} has no layer ${key}`);
  }
  return node;
}

/** A page's title and its sections. */
type PageSections = {
  readonly title: Box;
  /** Top to bottom, as the inventory orders them. */
  readonly sections: readonly Section[];
};

/** A page's title and its sections, top to bottom as the inventory orders them. */
function sectionsOf(page: PageNode, inventory: InventoryPage): PageSections {
  const docs = `docs/${inventory.slug}`;
  const sets: Section[] = inventory.sets.map((set) => {
    const frame = topLevel(page, `${docs}/labels/${set.key}`);
    const headers = frame.type === "FRAME" ? frame.children.filter((child) => keyOf(child) !== "name") : [];
    return {
      name: set.name,
      label: boxOf(layer(frame, "name"), frame),
      content: [boxOf(topLevel(page, set.key)), ...headers.map((header) => boxOf(header, frame))],
    };
  });
  return {
    title: boxOf(topLevel(page, `${docs}/title`)),
    sections: [
      ...sets,
      {
        name: "Themes",
        label: boxOf(topLevel(page, `${docs}/themes-header`)),
        content: previewsOn(inventory).map((preview) => boxOf(topLevel(page, preview.key))),
      },
      {
        name: "Examples",
        label: boxOf(topLevel(page, `${docs}/examples-header`)),
        content: [boxOf(topLevel(page, `${docs}/example`))],
      },
    ],
  };
}

describe("the sections of each component page", () => {
  let file: FakeFigma;

  beforeAll(async () => {
    file = await appliedFile();
  });

  it.each(KIT_PAGES.map((inventory) => [inventory.name, inventory] as const))(
    "%s runs its sections down the page, each below the last",
    async (_name, inventory) => {
      const { title, sections } = sectionsOf(await kitPage(file, pageKey(inventory)), inventory);
      const tops = sections.map((section) => around(section.content).y);
      const bottoms = sections.map((section) => {
        const box = around(section.content);
        return box.y + box.height;
      });
      expect(tops[0] ?? Number.NaN).toBeGreaterThan(title.y);
      expect(
        sections
          .slice(1)
          .map((section, index) => [section.name, (tops[index + 1] ?? 0) > (bottoms[index] ?? 0)])
      ).toEqual(sections.slice(1).map((section) => [section.name, true]));
    }
  );

  it.each(KIT_PAGES.map((inventory) => [inventory.name, inventory] as const))(
    "%s puts every section's label in one column left of one content edge, level with its section",
    async (_name, inventory) => {
      const { title, sections } = sectionsOf(await kitPage(file, pageKey(inventory)), inventory);
      const contentLeft = around(sections.flatMap((section) => section.content)).x;
      expect(
        sections.map((section) => ({
          name: section.name,
          labelLeft: section.label.x,
          labelTop: section.label.y,
          labelEndsBeforeContent: section.label.x + section.label.width < contentLeft,
          contentLeft: around(section.content).x,
        }))
      ).toEqual(
        sections.map((section) => ({
          name: section.name,
          labelLeft: title.x,
          labelTop: around(section.content).y,
          labelEndsBeforeContent: true,
          contentLeft,
        }))
      );
    }
  );

  it.each(KIT_PAGES.map((inventory) => [inventory.name, inventory] as const))(
    "%s overlaps no two top-level nodes, but for a labels frame and its set",
    async (_name, inventory) => {
      const page = await kitPage(file, pageKey(inventory));
      const docs = `docs/${inventory.slug}/labels/`;
      const nodes = page.children.filter((node) => node.visible);
      const owns = (frame: SceneNode, set: SceneNode): boolean => keyOf(frame) === `${docs}${keyOf(set)}`;
      const clashes = nodes.flatMap((a, index) =>
        nodes
          .slice(index + 1)
          .filter((b) => !owns(a, b) && !owns(b, a) && overlap(boxOf(a), boxOf(b)))
          .map((b) => `${a.name} × ${b.name}`)
      );
      expect(clashes).toEqual([]);
    }
  );

  it("grows the Button page's Themes section to the right, its previews side by side", async () => {
    const inventory = inventoryPage("button");
    const page = await kitPage(file, pageKey(inventory));
    const previews = previewsOn(inventory).map((preview) => boxOf(topLevel(page, preview.key)));
    const [first] = previews;
    expect(previews.map((preview) => preview.y)).toEqual(previews.map(() => first?.y));
    expect(
      previews.slice(1).map((preview, index) => {
        const before = previews[index];
        return before === undefined ? false : preview.x > before.x + before.width;
      })
    ).toEqual([true, true, true]);
  });
});

describe("a section label wider than the label column", () => {
  it("widens the column from 240px to the label and a 32px gap, so the label still ends before the content", async () => {
    const inventory = inventoryPage("badge");
    /** The label column's width on the Badge page: from the title's left edge to the content's. */
    const columnOn = async (file: FakeFigma): Promise<{ readonly column: number; readonly themes: Box }> => {
      const { title, sections } = sectionsOf(await kitPage(file, pageKey(inventory)), inventory);
      const contentLefts = sections.map((section) => around(section.content).x);
      const [contentLeft = Number.NaN] = contentLefts;
      expect(contentLefts).toEqual(sections.map(() => contentLeft));
      const themes = sections.find((section) => section.name === "Themes")?.label;
      if (themes === undefined) {
        throw new Error("the Badge page has no Themes section");
      }
      expect(themes.x).toBe(title.x);
      return { column: contentLeft - title.x, themes };
    };
    // Badge's labels all fit the least width, so the column holds at 240px.
    expect((await columnOn(await appliedFile())).column).toBe(240);

    const { kit } = await kitFixture();
    const wide = "Themes in every identity, color scheme and density";
    const widened = {
      ...kit,
      docs: kit.docs.map((record) =>
        record.page === "page/badge"
          ? { ...record, themesHeader: { ...record.themesHeader, text: wide } }
          : record
      ),
    };
    const file = await appliedFile();
    await reconcileKit(file.figma, widened, true);
    file.reopen();
    const { column, themes } = await columnOn(file);
    // The fake measures the label wider than 208px, so the column must grow past its least width.
    expect(themes.width).toBeGreaterThan(240 - 32);
    expect(column).toBe(Math.ceil(themes.width) + 32);
  });
});
