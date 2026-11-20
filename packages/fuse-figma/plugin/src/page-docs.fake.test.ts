/**
 * The Badge page of a file the plugin applied the whole kit to, on the in-memory file in
 * `fake-figma.ts`. Unit under test: the page's doc nodes and their layout. Oracles, written by hand:
 * the Badge set's axes, its 19 variants down the rows and its 3 sizes across the columns, the page's
 * name, and the text styles the docs link.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** Badge's variants, its rows, as the recipe lists them. */
const VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "soft-destructive",
  "soft-success",
  "soft-warning",
  "soft-info",
  "outline",
  "outline-secondary",
  "outline-destructive",
  "outline-success",
  "outline-warning",
  "outline-info",
  "muted",
  "accent",
  "card",
];

/** Badge's sizes, its columns. */
const SIZES = ["default", "sm", "lg"];

const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";

/** A top-level node of the page by its key. */
function topLevel(page: PageNode, key: string): SceneNode {
  const node = page.children.find((child) => keyOf(child) === key);
  if (node === undefined) {
    throw new Error(`${page.name} has no node ${key}`);
  }
  return node;
}

/** A text style's id by its name. */
async function styleId(file: FakeFigma, name: string): Promise<string | undefined> {
  return (await file.figma.getLocalTextStylesAsync()).find((style) => style.name === name)?.id;
}

describe("the Badge page of an applied file", () => {
  let file: FakeFigma;
  let page: PageNode;

  beforeAll(async () => {
    file = await appliedFile();
    page = await kitPage(file, "page/badge");
  });

  it("titles the page and heads its example with the kit's text styles", async () => {
    const title = topLevel(page, "docs/badge/title");
    const header = topLevel(page, "docs/badge/examples-header");
    expect([title.type, title.name, isText(title) ? title.characters : ""]).toEqual([
      "TEXT",
      "Header",
      "Badge",
    ]);
    expect(isText(title) ? title.textStyleId : "").toBe(await styleId(file, "Heading/2"));
    expect([header.name, isText(header) ? header.characters : ""]).toEqual(["Header", "Examples"]);
    expect(isText(header) ? header.textStyleId : "").toBe(await styleId(file, "Text/sm/medium"));
  });

  it("labels the set's grid by its name, its sizes across and its variants down", async () => {
    const labels = topLevel(page, "docs/badge/labels/badge");
    if (labels.type !== "FRAME") {
      throw new Error("the labels are no frame");
    }
    const texts = labels.children.filter(isText);
    expect(texts.map((text) => [keyOf(text), text.characters])).toEqual([
      ["name", "Badge"],
      ...SIZES.map((size) => [`column/${size}`, size]),
      ...VARIANTS.map((variant, row) => [`row/${String(row)}`, variant]),
    ]);
    // The frame sits below the set, so a click inside the set's bounds lands on a variant.
    expect(page.children.indexOf(labels)).toBeLessThan(page.children.indexOf(setOn(page, "Badge")));
    const axis = await styleId(file, "Span/xs/regular");
    expect(texts.slice(1).every((text) => text.textStyleId === axis)).toBe(true);
  });

  it("puts each column header over its column and each row header beside its row", () => {
    const labels = topLevel(page, "docs/badge/labels/badge");
    const set = setOn(page, "Badge");
    if (labels.type !== "FRAME") {
      throw new Error("the labels are no frame");
    }
    const texts = new Map(labels.children.filter(isText).map((text) => [keyOf(text), text]));
    const variant = (variantName: string, size: string): ComponentNode => {
      const found = set.children.find(
        (child) => keyOf(child) === `badge/variant=${variantName},size=${size}`
      );
      if (found?.type !== "COMPONENT") {
        throw new Error(`Badge has no variant ${variantName} at ${size}`);
      }
      return found;
    };
    for (const size of SIZES) {
      const header = texts.get(`column/${size}`);
      expect([size, (header?.x ?? Number.NaN) + labels.x]).toEqual([
        size,
        set.x + variant("default", size).x,
      ]);
      expect((header?.y ?? Number.NaN) + labels.y).toBeLessThan(set.y);
    }
    for (const [row, variantName] of VARIANTS.entries()) {
      const header = texts.get(`row/${String(row)}`);
      const cell = variant(variantName, "default");
      const middle = (header?.y ?? Number.NaN) + labels.y + (header?.height ?? 0) / 2;
      expect([variantName, Math.abs(middle - (set.y + cell.y + cell.height / 2)) <= 1]).toEqual([
        variantName,
        true,
      ]);
      expect((header?.x ?? Number.NaN) + labels.x + (header?.width ?? 0)).toBeLessThan(set.x);
    }
  });

  it("shows the default Badge as the page's example", async () => {
    const example = topLevel(page, "docs/badge/example");
    if (example.type !== "FRAME") {
      throw new Error("the example is no frame");
    }
    const [instance, ...others] = example.children;
    expect(others).toEqual([]);
    if (instance?.type !== "INSTANCE") {
      throw new Error("the example holds no instance");
    }
    const main = await instance.getMainComponentAsync();
    expect(main === null ? undefined : keyOf(main)).toBe("badge/variant=default,size=default");
  });
});

describe("a Badge page a designer edited", () => {
  /** The Plan lines a run lists for the Badge page. */
  const badgeLines = (changes: readonly string[]): readonly string[] =>
    changes.filter((line) => line.startsWith("Badge:") || line.startsWith("Badge /"));

  it("loads every font a title holds before Apply writes it back", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const page = await kitPage(file, "page/badge");
    const title = topLevel(page, "docs/badge/title");
    if (!isText(title)) {
      throw new Error("the title is no text");
    }
    for (const font of title.getRangeAllFontNames(0, title.characters.length)) {
      await file.figma.loadFontAsync(font);
    }
    await file.figma.loadFontAsync({ family: "Inter", style: "Medium" });
    title.characters = "Badges";
    title.setRangeFontName(0, 1, { family: "Inter", style: "Medium" });
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    expect(title.characters).toBe("Badge");
  });

  it("lays the page out again when the plan writes back a text style its labels link", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const axis = (await file.figma.getLocalTextStylesAsync()).find(
      (style) => style.name === "Span/xs/regular"
    );
    if (axis === undefined) {
      throw new Error("the file has no Span/xs/regular");
    }
    await file.figma.loadFontAsync(axis.fontName);
    axis.fontSize = 80;
    file.reopen();
    const changes = (await reconcileKit(file.figma, kit, false)).changes;
    expect(changes).toContain("Text styles / Span/xs/regular: fontSize → 12");
    expect(badgeLines(changes)).toEqual([
      "Badge: place Badge, with their labels and the page's title and example, in sections, and 4 previews side by side",
    ]);
  });

  it("adopts an unkeyed Header once, for the title, and makes the section headers anew", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const page = await kitPage(file, "page/badge");
    for (const node of page.children.filter((child) => keyOf(child).startsWith("docs/badge/"))) {
      if (isText(node)) {
        node.remove();
      }
    }
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const header = file.figma.createText();
    page.appendChild(header);
    header.characters = "A designer's header";
    header.name = "Header";
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const applied = await kitPage(file, "page/badge");
    const texts = applied.children.filter(isText).map((text) => [keyOf(text), text.characters]);
    expect(texts).toEqual([
      ["docs/badge/title", "Badge"],
      ["docs/badge/themes-header", "Themes"],
      ["docs/badge/examples-header", "Examples"],
    ]);
    expect(badgeLines((await reconcileKit(file.figma, kit, false)).changes)).toEqual([]);
  });
});

describe("a page whose headers are wider than their columns' variants", () => {
  it("widens each column to its header, so no Checkbox header runs into the next", async () => {
    const file = await appliedFile();
    const page = await kitPage(file, "page/checkbox");
    const labels = topLevel(page, "docs/checkbox/labels/checkbox");
    const set = setOn(page, "Checkbox");
    if (labels.type !== "FRAME") {
      throw new Error("the labels are no frame");
    }
    const headers = ["rest", "focus", "disabled", "invalid"].map((state) => {
      const header = labels.children.find((child) => keyOf(child) === `column/${state}`);
      if (header === undefined) {
        throw new Error(`Checkbox has no header ${state}`);
      }
      return header;
    });
    // Each header starts at its column's left edge, as the first variant there does, and ends before
    // the next header starts.
    const columnX = (state: string): number => {
      const variant = set.children.find(
        (child) => keyOf(child) === `checkbox/checked=false,indeterminate=false,state=${state}`
      );
      return set.x + (variant?.x ?? Number.NaN);
    };
    expect(
      headers.map(
        (header, index) =>
          header.x + labels.x === columnX(["rest", "focus", "disabled", "invalid"][index] ?? "")
      )
    ).toEqual([true, true, true, true]);
    expect(
      headers
        .slice(1)
        .map((header, index) => (headers[index]?.x ?? 0) + (headers[index]?.width ?? 0) <= header.x)
    ).toEqual([true, true, true]);
  });
});

describe("a labels frame a designer gave an auto layout", () => {
  it("frees the frame's layers again, so Apply converges", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const page = await kitPage(file, "page/badge");
    const labels = topLevel(page, "docs/badge/labels/badge");
    if (labels.type !== "FRAME") {
      throw new Error("the labels are no frame");
    }
    const header = labels.children.find((child) => keyOf(child) === "column/default");
    if (header === undefined) {
      throw new Error("Badge has no header default");
    }
    header.x = 0;
    header.y = 0;
    labels.layoutMode = "HORIZONTAL";
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const changes = (await reconcileKit(file.figma, kit, false)).changes;
    expect(changes.filter((line) => line.startsWith("Badge:") || line.startsWith("Badge /"))).toEqual([]);
  });
});
