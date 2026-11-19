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
    ]).toEqual([15, true, true]);
  });
});
