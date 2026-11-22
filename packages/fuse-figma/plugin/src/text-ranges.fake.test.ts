/**
 * A text layer whose characters take colors of their own, as Code's tokens do, on the in-memory file
 * in `fake-figma.ts`. Unit under test: the text layer's plan through Apply and Plan. Oracles: the
 * typings, under which `setRangeFills` gives a range's characters their own fills, a paint from
 * `setBoundVariableForPaint` binds a range's color, and `getStyledTextSegments(['fills'])` reads each
 * run of characters with one fill; and the fake's rule 65, under which a whole `fills` write gives
 * every character the layer's fills. So a label the run writes holds the spec's ranges, bound to their
 * variables, Plan then lists nothing, and a label a designer recolors as a whole gets its ranges back.
 * An instance shows its main's text until something writes to it, so the kit's Code previews show
 * the main's runs, which no write of the instance stage covers with one fill.
 *
 * A range can also underline and link its characters, as an inline `<a>` in a Timeline list
 * description does. Oracle: the live probe of 2026-11-21 on the private draft file
 * `pPbebn8deYsvOlH1xFxq9w`, which rules 66 and 68 in `fake/text.ts` record. `setRangeTextDecoration`
 * and its field writes gave a range its own line and fields, read back run by run through
 * `getStyledTextSegments` (RD1); a whole NONE cleared every range's line (RD4); a range's color bound
 * through `setBoundVariableForPaint` kept its variable and followed the frame's mode (RD14); and
 * `setRangeHyperlink` linked a range to an absolute URL, which a whole null cleared (RH1, RH6).
 */
import { describe, expect, it } from "vitest";

import type { KitSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, LABEL, nestedKit } from "./button-kit-fixture.ts";
import { aliasOf, childNamed, color, fixtureFile, string } from "./fake-fixtures.ts";
import { appliedFile, kitPage } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** A synced variable as a color field binds it. */
const bound = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;

/** `let a;` with `let` in `sh-keyword` and `a` in `sh-identifier`, the rest in `foreground`. */
const CODE: TextLayerSpec = {
  ...LABEL,
  characters: "let a;",
  fontStyle: "Regular",
  color: bound("foreground"),
  ranges: [
    { start: 0, end: 3, color: bound("sh-keyword") },
    { start: 4, end: 5, color: bound("sh-identifier") },
  ],
};

const kit: KitSpec = nestedKit([CODE]);

/** A synced file holding the three colors and `font-sans`. */
function codeFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    color("Fuse tokens", "foreground", { r: 0, g: 0, b: 0, a: 1 }),
    color("Fuse tokens", "sh-keyword", { r: 1, g: 0.5, b: 0, a: 1 }),
    color("Fuse tokens", "sh-identifier", { r: 0, g: 0.5, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
  ]);
}

/** Each run of the label's characters with one fill, and the variable that fill binds, by name. */
async function runs(file: ReturnType<typeof codeFile>): Promise<readonly (readonly [string, string])[]> {
  const variables = await file.figma.variables.getLocalVariablesAsync();
  const label = childNamed(await buttonVariant(file), "TEXT", "Label");
  return label.getStyledTextSegments(["fills"]).map((segment) => {
    const [paint] = segment.fills;
    const id = paint?.type === "SOLID" ? paint.boundVariables?.color?.id : undefined;
    return [segment.characters, variables.find((variable) => variable.id === id)?.name ?? "unbound"];
  });
}

describe("a label whose characters take colors of their own", () => {
  it("binds each range's fill to its variable, and the next Plan lists nothing", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await runs(file)).toEqual([
      ["let", "sh-keyword"],
      [" ", "foreground"],
      ["a", "sh-identifier"],
      [";", "foreground"],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("writes the ranges again over a label a designer recolored as a whole", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    drifted.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await runs(file)).toEqual([
      ["let", "sh-keyword"],
      [" ", "foreground"],
      ["a", "sh-identifier"],
      [";", "foreground"],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  // `planFont` writes the font first, so every later write needs only the new font (rule 7), and a
  // designer's font Figma cannot load is repaired.
  it("repairs a label a designer set in a font Figma cannot load, and writes its ranges again", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Gone Font", style: "Regular" });
    drifted.setBoundVariable("fontFamily", null);
    drifted.fontName = { family: "Gone Font", style: "Regular" };
    file.reopen({ unavailableFonts: [{ family: "Gone Font" }] });
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await runs(file)).toEqual([
      ["let", "sh-keyword"],
      [" ", "foreground"],
      ["a", "sh-identifier"],
      [";", "foreground"],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("shows the Code set's runs on every instance the applied kit places", async () => {
    const file = await appliedFile();
    const page = await kitPage(file, "page/code");
    const runsOf = (text: TextNode): readonly string[] =>
      text.getStyledTextSegments(["fills"]).map((segment) => {
        const [paint] = segment.fills;
        return `${segment.characters}|${paint?.type === "SOLID" ? (paint.boundVariables?.color?.id ?? "") : ""}`;
      });
    const shown: { readonly owner: string; readonly runs: readonly string[] }[] = [];
    const walk = (node: BaseNode, owner: string): void => {
      if (node.type === "TEXT" && node.name === "text") {
        shown.push({ owner, runs: runsOf(node) });
      }
      if ("children" in node) {
        for (const child of node.children) {
          walk(child, child.type === "INSTANCE" || child.type === "COMPONENT" ? child.type : owner);
        }
      }
    };
    walk(page, "page");
    const main = shown.find((each) => each.owner === "COMPONENT");
    const instances = shown.filter((each) => each.owner === "INSTANCE");
    expect([
      main?.runs.length,
      instances.length > 0,
      instances.every((each) => each.runs.join() === main?.runs.join()),
    ]).toEqual([14, true, true]);
  });
});

/** `Pay now` underlined at Figma's automatic offset, thickness and color, after `Open. `. */
const LINKED: TextLayerSpec = {
  ...LABEL,
  characters: "Open. Pay now",
  fontStyle: "Regular",
  color: bound("foreground"),
  ranges: [
    {
      start: 6,
      end: 13,
      color: bound("foreground"),
      underline: { offset: undefined, thickness: undefined, color: undefined },
    },
  ],
};

/** Each run of a label's characters with one line, as `characters|line|offset|thickness|color`. */
async function lines(file: ReturnType<typeof codeFile>): Promise<readonly string[]> {
  const label = childNamed(await buttonVariant(file), "TEXT", "Label");
  return label
    .getStyledTextSegments([
      "textDecoration",
      "textDecorationOffset",
      "textDecorationThickness",
      "textDecorationColor",
    ])
    .map((segment) =>
      [
        segment.characters,
        segment.textDecoration,
        segment.textDecorationOffset?.unit ?? "none",
        segment.textDecorationThickness?.unit ?? "none",
        segment.textDecorationColor === null
          ? "none"
          : segment.textDecorationColor.value === "AUTO"
            ? "AUTO"
            : "paint",
      ].join("|")
    );
}

describe("a label whose range draws an underline of its own", () => {
  const linkKit: KitSpec = nestedKit([LINKED]);

  it("underlines the range alone, and the next Plan lists nothing", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, linkKit, true);
    file.reopen();
    expect(await lines(file)).toEqual(["Open. |NONE|none|none|none", "Pay now|UNDERLINE|AUTO|AUTO|AUTO"]);
    expect((await reconcileKit(file.figma, linkKit, false)).changes).toEqual([]);
  });

  it("underlines the range again where a designer cleared the line of the whole text", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, linkKit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    drifted.textDecoration = "NONE";
    file.reopen();
    await reconcileKit(file.figma, linkKit, true);
    file.reopen();
    expect(await lines(file)).toEqual(["Open. |NONE|none|none|none", "Pay now|UNDERLINE|AUTO|AUTO|AUTO"]);
    expect((await reconcileKit(file.figma, linkKit, false)).changes).toEqual([]);
  });

  it("puts back a line and a color a designer gave the text outside the range", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, linkKit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    drifted.setRangeTextDecoration(0, 4, "UNDERLINE");
    drifted.setRangeTextDecorationColor(0, 4, { value: { type: "SOLID", color: { r: 1, g: 0, b: 0 } } });
    file.reopen();
    const drift = (await reconcileKit(file.figma, linkKit, false)).changes.length > 0;
    await reconcileKit(file.figma, linkKit, true);
    file.reopen();
    expect([drift, await lines(file)]).toEqual([
      true,
      ["Open. |NONE|none|none|none", "Pay now|UNDERLINE|AUTO|AUTO|AUTO"],
    ]);
    expect((await reconcileKit(file.figma, linkKit, false)).changes).toEqual([]);
  });

  // A span inside a link that sets another fill keeps the link's underline color (CSS Text
  // Decoration 3 §2.3), so its range carries the link's color explicitly.
  it("binds the underline color of a range whose fill differs from its link's, and the next Plan lists nothing", async () => {
    const tinted: TextLayerSpec = {
      ...LINKED,
      ranges: [
        {
          start: 6,
          end: 10,
          color: bound("foreground"),
          underline: { offset: undefined, thickness: undefined, color: undefined },
        },
        {
          start: 10,
          end: 13,
          color: bound("sh-keyword"),
          underline: { offset: undefined, thickness: undefined, color: bound("foreground") },
        },
      ],
    };
    const tintedKit = nestedKit([tinted]);
    const file = codeFile();
    await reconcileKit(file.figma, tintedKit, true);
    file.reopen();
    const variables = await file.figma.variables.getLocalVariablesAsync();
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    const underlineVariables = label.getStyledTextSegments(["textDecorationColor"]).map((segment) => {
      const held = segment.textDecorationColor;
      const id = held !== null && held.value !== "AUTO" ? held.value.boundVariables?.color?.id : undefined;
      return `${segment.characters}|${variables.find((variable) => variable.id === id)?.name ?? "none"}`;
    });
    expect([await lines(file), underlineVariables]).toEqual([
      ["Open. |NONE|none|none|none", "Pay |UNDERLINE|AUTO|AUTO|AUTO", "now|UNDERLINE|AUTO|AUTO|paint"],
      ["Open. |none", "Pay |none", "now|foreground"],
    ]);
    expect((await reconcileKit(file.figma, tintedKit, false)).changes).toEqual([]);
  });

  it("shows both links of the Timeline list links set on its variant and on every preview of it", async () => {
    const file = await appliedFile();
    const page = await kitPage(file, "page/timeline-list");
    const nodes = (node: PageNode | SceneNode): readonly SceneNode[] =>
      "children" in node ? node.children.flatMap((child) => [child, ...nodes(child)]) : [];
    const set = nodes(page).find(
      (node) => node.type === "COMPONENT_SET" && node.name === "Timeline list links"
    );
    if (set?.type !== "COMPONENT_SET") {
      throw new Error("the Timeline list page holds no Timeline list links set");
    }
    const variants = set.children.filter((node): node is ComponentNode => node.type === "COMPONENT");
    const previews: InstanceNode[] = [];
    for (const node of nodes(page)) {
      const main = node.type === "INSTANCE" ? await node.getMainComponentAsync() : null;
      if (node.type === "INSTANCE" && main?.parent?.id === set.id) {
        previews.push(node);
      }
    }
    // Each owner's underlined runs, from its two description texts in event order.
    const underlined = (owner: ComponentNode | InstanceNode): readonly string[] =>
      nodes(owner).flatMap((text) =>
        text.type === "TEXT"
          ? text
              .getStyledTextSegments(["textDecoration"])
              .filter((segment) => segment.textDecoration === "UNDERLINE")
              .map((segment) => segment.characters)
          : []
      );
    expect([variants.length, previews.length > 0]).toEqual([1, true]);
    expect([...variants, ...previews].map(underlined)).toEqual(
      [...variants, ...previews].map(() => ["View invoice 4821", "Pay now"])
    );
  });
});

/** `Pay now` linked to an absolute URL and underlined, after `Open. `. */
const HREF = "https://example.com/pay?id=4821";
const LINKED_URL: TextLayerSpec = {
  ...LINKED,
  ranges: [
    {
      start: 6,
      end: 13,
      color: bound("foreground"),
      underline: { offset: undefined, thickness: undefined, color: undefined },
      hyperlink: HREF,
    },
  ],
};

/** Each run of a label's characters with one link, as `characters|url`, or `characters|none`. */
async function linkRuns(file: ReturnType<typeof codeFile>): Promise<readonly string[]> {
  const label = childNamed(await buttonVariant(file), "TEXT", "Label");
  return label
    .getStyledTextSegments(["hyperlink"])
    .map((segment) => `${segment.characters}|${segment.hyperlink?.value ?? "none"}`);
}

// Oracle: the live probe of 2026-11-21 (RH1 to RH6): `setRangeHyperlink` stored an absolute URL on
// its range alone, whole fills and decoration writes kept it, and a whole `hyperlink = null` cleared
// every range's link.
describe("a label whose range links to a URL", () => {
  const urlKit: KitSpec = nestedKit([LINKED_URL]);

  it("links the range to its URL, and the next Plan lists nothing", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, urlKit, true);
    file.reopen();
    expect(await linkRuns(file)).toEqual(["Open. |none", `Pay now|${HREF}`]);
    expect((await reconcileKit(file.figma, urlKit, false)).changes).toEqual([]);
  });

  it("reports a URL a designer gave the range, or the rest of the text, and links them back", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, urlKit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    drifted.setRangeHyperlink(6, 13, { type: "URL", value: "https://example.com/elsewhere" });
    drifted.setRangeHyperlink(0, 4, { type: "URL", value: "https://example.com/open" });
    file.reopen();
    const drift = (await reconcileKit(file.figma, urlKit, false)).changes.some((line) => line.includes(HREF));
    await reconcileKit(file.figma, urlKit, true);
    file.reopen();
    expect([drift, await linkRuns(file)]).toEqual([true, ["Open. |none", `Pay now|${HREF}`]]);
    expect((await reconcileKit(file.figma, urlKit, false)).changes).toEqual([]);
  });
});

// The plugin owns the links of a label whose spec links a range, and of one it linked before, which
// it marks in the label's shared plugin data. A label it never linked keeps the links a designer
// gives it. Oracle: the live probe of 2026-11-21, where a whole `hyperlink = null` cleared every
// range's link (RH6) and whole fills writes kept a range's link (RH4).
describe("which labels' links the plugin owns", () => {
  const plainKit: KitSpec = nestedKit([
    { ...LABEL, characters: "Open. Pay now", fontStyle: "Regular", color: bound("foreground") },
  ]);

  it("unlinks a label whose spec no longer links a range, and the next Plan lists nothing", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, nestedKit([LINKED_URL]), true);
    file.reopen();
    const planned = (await reconcileKit(file.figma, plainKit, false)).changes.length > 0;
    await reconcileKit(file.figma, plainKit, true);
    file.reopen();
    expect([planned, await linkRuns(file)]).toEqual([true, ["Open. Pay now|none"]]);
    expect((await reconcileKit(file.figma, plainKit, false)).changes).toEqual([]);
  });

  it("unlinks a label whose only range was a link once its spec drops it, which Plan reports", async () => {
    const file = codeFile();
    const linkOnly: TextLayerSpec = {
      ...LINKED,
      ranges: [{ start: 6, end: 13, color: bound("foreground"), hyperlink: HREF }],
    };
    await reconcileKit(file.figma, nestedKit([linkOnly]), true);
    file.reopen();
    const planned = (await reconcileKit(file.figma, plainKit, false)).changes.length > 0;
    await reconcileKit(file.figma, plainKit, true);
    file.reopen();
    expect([planned, await linkRuns(file)]).toEqual([true, ["Open. Pay now|none"]]);
  });

  it("keeps a link a designer gave a label whose ranges only color it, while it writes the ranges again", async () => {
    const file = codeFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    drifted.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
    drifted.setRangeHyperlink(0, 3, { type: "URL", value: "https://example.com/let" });
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect([await runs(file), await linkRuns(file)]).toEqual([
      [
        ["let", "sh-keyword"],
        [" ", "foreground"],
        ["a", "sh-identifier"],
        [";", "foreground"],
      ],
      ["let|https://example.com/let", " a;|none"],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});
