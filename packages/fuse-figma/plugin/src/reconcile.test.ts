/**
 * `reconcileKit` with a one-variant kit on the in-memory file in `fake-figma.ts`, for a file
 * whose kit page holds a stale preview and no component set. The label's family follows
 * `font-sans`, which aliases a brand variable, so the run resolves it across collections before
 * it writes (rule 8) and needs the font it names (rule 7). The oracles are the change lines Plan
 * lists and the writes the file took.
 */
import { describe, expect, it } from "vitest";

import type { KitSpec, NumberSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
import { aliasOf, color, fixtureFile, string } from "./fake-fixtures.ts";
import { setKey } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const literal = (value: number): NumberSpec => ({ kind: "literal", value });

/** The label of the one Button variant, whose family follows `font-sans`. */
const LABEL: TextLayerSpec = {
  kind: "text",
  key: "button/label",
  name: "Label",
  characters: "Button",
  textProperty: undefined,
  fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
  fontStyle: "Medium",
  fontSize: literal(14),
  lineHeight: literal(20),
  color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
  underline: undefined,
};

/** A kit with one Button variant, no icons and no previews, which bundles Roboto Medium. */
const KIT: KitSpec = {
  page: { key: "page", name: "Fuse components" },
  fonts: [{ family: "Roboto", style: "Medium" }],
  icons: {
    key: "icons",
    name: "Icons",
    size: 16,
    color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
    icons: [],
  },
  componentSets: [
    {
      key: "button",
      name: "Button",
      axes: [{ name: "size", values: ["md"] }],
      columnAxis: "size",
      textProperties: [],
      swapProperties: [],
      variants: [
        {
          key: "button/size=md",
          properties: { size: "md" },
          root: {
            name: "button",
            width: undefined,
            height: literal(36),
            minWidth: undefined,
            paddingTop: literal(0),
            paddingRight: literal(16),
            paddingBottom: literal(0),
            paddingLeft: literal(16),
            itemSpacing: literal(8),
            cornerRadius: literal(6),
            fill: undefined,
            stroke: undefined,
            shadows: [],
            opacity: 1,
            children: [LABEL],
          },
        },
      ],
    },
  ],
  previews: [],
};

/**
 * A file whose `font-sans` aliases a brand variable that holds `family` in its default mode.
 * The machine cannot load Comic Sans.
 *
 * @param family - The family the brand variable holds.
 * @param withPage - Whether the file holds the kit page, with its stale preview.
 * @returns The file, opened for a new run, and the number of writes its setup made.
 */
function fixture(family: string, withPage = true) {
  const file = fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", {
      collection: "Fuse brand",
      variable: "light/external/private/font-sans",
    }),
    string("Fuse brand", "light/external/private/font-sans", family),
  ]);
  if (withPage) {
    const page = file.figma.createPage();
    page.name = "Fuse components";
    setKey(page, "page");
    const stale = file.figma.createFrame();
    page.appendChild(stale);
    stale.name = "Old preview";
    setKey(stale, "preview/old");
  }
  file.reopen({ unavailableFonts: [{ family: "Comic Sans" }] });
  return { file, setup: file.writes.length };
}

describe("reconcileKit on a file without the component set", () => {
  it("plans to delete the stale preview and create the set when the family loads", async () => {
    const { file, setup } = fixture("Roboto");
    const report = await reconcileKit(file.figma, KIT, false);
    expect(report.changes).toEqual([
      "Fuse components: delete Old preview",
      "Fuse components: create the Icons frame with 0 icons",
      "Fuse components: create the component set Button with 1 variants",
      "Fuse components: place 1 component sets and the icons in a row and stack 0 previews below them",
    ]);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, when the file's family cannot load", async () => {
    const { file, setup } = fixture("Comic Sans");
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });

  it("fails Plan, and stops Apply before any write, for a file without the kit page", async () => {
    const { file, setup } = fixture("Comic Sans", false);
    const message = "Button / Label needs the font Comic Sans Medium, which Figma cannot load.";
    await expect(reconcileKit(file.figma, KIT, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, KIT, true)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});
