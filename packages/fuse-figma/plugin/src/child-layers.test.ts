/**
 * `planChildren` on a variant's label, on the in-memory file in `fake-figma.ts`. Each test
 * builds the label by hand as the spec describes it, then changes what a designer or another
 * machine could leave behind: a binding some characters dropped, a style or weight binding, a
 * size only some characters hold, a font the machine lacks, a new sizing or truncation. The fake
 * models the Figma rules these depend on, per-character fonts, sizes and bindings (rule 10), the
 * fonts a write needs (rule 7), and a text's sizing and truncation as a real file showed them
 * (rules 19 and 20). The oracles are the change lines the spec asks for, the writes the file took
 * and the label it holds afterwards.
 */
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { HUGGING_TEXT, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type { TextLayerSpec } from "../../src/components/kit-spec.ts";
import { planChildren } from "./child-layers.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { color, fixtureFile, float, onFixture, string } from "./fake-fixtures.ts";
import { setKey } from "./identity.ts";
import { changeLines, newPlan, Plan, runPlan } from "./plan.ts";

const ROBOTO_MEDIUM: FontName = { family: "Roboto", style: "Medium" };
const ROBOTO_BOLD: FontName = { family: "Roboto", style: "Bold" };
const COMIC_SANS_BOLD: FontName = { family: "Comic Sans", style: "Bold" };

/** The Button label as the spec builder writes it, with a literal family. */
const LABEL: TextLayerSpec = {
  kind: "text",
  key: "button/label",
  name: "Label",
  characters: "Button",
  textProperty: undefined,
  fontFamily: { kind: "literal", value: "Roboto" },
  fontStyle: "Medium",
  fontSize: { kind: "variable", variable: { collection: "Fuse density", name: "control-text" } },
  lineHeight: { kind: "variable", variable: { collection: "Fuse density", name: "control-leading" } },
  color: { kind: "variable", variable: { collection: "Fuse tokens", name: "foreground" } },
  underline: undefined,
  sizing: HUGGING_TEXT,
  align: TOP_LEFT,
  truncation: undefined,
};

/** The variables the label binds, and the ones a designer could bind to its font. */
const VARIABLES = [
  color("Fuse tokens", "foreground", { r: 0.1, g: 0.1, b: 0.1, a: 1 }),
  string("Fuse tokens", "font-sans", "Roboto"),
  string("Fuse tokens", "label-style", "Medium"),
  float("Fuse density", "control-text", 14),
  float("Fuse density", "control-leading", 20),
  float("Fuse density", "selection-title-weight", 500),
  float("Fuse density", "strong-weight", 700),
  float("Fuse density", "display-text", 18),
];

/**
 * A synced file with a Button variant, a row as the kit's roots are, whose label matches `LABEL`,
 * and what a test changes.
 */
type ButtonFile = {
  readonly file: FakeFigma;
  readonly component: ComponentNode;
  readonly label: TextNode;
};

async function buttonFile(): Promise<ButtonFile> {
  const file = fixtureFile(VARIABLES);
  const { figma } = file;
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync(ROBOTO_MEDIUM);
  await figma.loadFontAsync(COMIC_SANS_BOLD);
  const component = figma.createComponent();
  component.layoutMode = "HORIZONTAL";
  const label = figma.createText();
  component.appendChild(label);
  setKey(label, LABEL.key);
  label.fontName = ROBOTO_MEDIUM;
  label.characters = "Button";
  label.name = "Label";
  label.setBoundVariable("fontSize", file.variable("Fuse density", "control-text"));
  label.setBoundVariable("lineHeight", file.variable("Fuse density", "control-leading"));
  label.fills = [
    figma.variables.setBoundVariableForPaint(
      { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
      "color",
      file.variable("Fuse tokens", "foreground")
    ),
  ];
  return { file, component, label };
}

/** A layer of the kit that the spec no longer lists. */
function staleLayer({ file, component }: ButtonFile): FrameNode {
  const stale = file.figma.createFrame();
  component.insertChild(0, stale);
  setKey(stale, "button/badge");
  stale.name = "Old badge";
  return stale;
}

function planButton({ file, component }: ButtonFile, spec: TextLayerSpec = LABEL) {
  return planChildren(
    component,
    "Button",
    { direction: "HORIZONTAL", children: [spec] },
    { properties: new Map(), icons: new Map(), sets: new Map() },
    "read"
  ).pipe(onFixture(file));
}

function changesFor(button: ButtonFile, spec: TextLayerSpec = LABEL) {
  return Effect.gen(function* () {
    const plan = newPlan();
    yield* Effect.provideService(planButton(button, spec), Plan, plan);
    return changeLines(plan);
  });
}

/**
 * Apply the Button's child layers in a new plugin run, and return the lines Apply made and the
 * writes the file took.
 */
function applyTo(button: ButtonFile, spec: TextLayerSpec = LABEL) {
  return Effect.gen(function* () {
    button.file.reopen();
    const before = button.file.writes.length;
    const { plan } = yield* runPlan(true, planButton(button, spec));
    return { lines: changeLines(plan), writes: button.file.writes.slice(before) };
  });
}

describe("planChildren on a label", () => {
  let button: ButtonFile;
  let label: TextNode;

  beforeEach(async () => {
    button = await buttonFile();
    ({ label } = button);
  });

  it.effect("plans nothing for a label that matches the spec", () =>
    Effect.gen(function* () {
      expect(yield* changesFor(button)).toEqual([]);
    })
  );

  it.effect("underlines a link label, then sets the offset an underline holds, in one operation", () =>
    Effect.gen(function* () {
      const link: TextLayerSpec = { ...LABEL, underline: { offset: 4 } };
      expect(yield* changesFor(button, link)).toEqual([
        "Button / Label: textDecoration → UNDERLINE, offset 4",
      ]);

      const { lines, writes } = yield* applyTo(button, link);
      expect(lines).toEqual(["Button / Label: textDecoration → UNDERLINE, offset 4"]);
      expect(writes).toEqual([`${label.id} textDecoration`, `${label.id} textDecorationOffset`]);
      expect(label.textDecorationOffset).toEqual({ unit: "PIXELS", value: 4 });
      expect(yield* changesFor(button, link)).toEqual([]);
    })
  );

  // The order is the one `research/plugin-api.md` §3 trap 6 sets: the auto resize, then the sizing
  // a new auto resize moves, then the truncation and its maximum. ENDING alone reads one line (P4),
  // and the plan writes the maximum anyway, so the line says what the label keeps.
  it.effect(
    "turns a hugging label into one that fills its row and ends in an ellipsis, in one operation (P3, P4)",
    () =>
      Effect.gen(function* () {
        const truncated: TextLayerSpec = {
          ...LABEL,
          sizing: { horizontal: { kind: "fill" }, vertical: { kind: "hug" } },
          truncation: { maxLines: 1 },
        };
        const line =
          "Button / Label: textAutoResize → HEIGHT, layoutSizingHorizontal → FILL, layoutSizingVertical → HUG, textTruncation → ENDING, maxLines → 1";
        expect(yield* changesFor(button, truncated)).toEqual([line]);

        const { lines, writes } = yield* applyTo(button, truncated);
        expect(lines).toEqual([line]);
        expect(writes).toEqual(
          [
            "textAutoResize",
            "layoutSizingHorizontal",
            "layoutSizingVertical",
            "textTruncation",
            "maxLines",
          ].map((field) => `${label.id} ${field}`)
        );
        expect([
          label.layoutSizingHorizontal,
          label.layoutSizingVertical,
          label.textTruncation,
          label.maxLines,
        ]).toEqual(["FILL", "HUG", "ENDING", 1]);
        expect(yield* changesFor(button, truncated)).toEqual([]);
      })
  );

  it.effect("fixes a label's width after its sizing, then centers its lines, and converges", () =>
    Effect.gen(function* () {
      const fixed: TextLayerSpec = {
        ...LABEL,
        sizing: {
          horizontal: { kind: "fixed", length: { kind: "literal", value: 120 } },
          vertical: { kind: "hug" },
        },
        align: { horizontal: "CENTER", vertical: "TOP" },
      };
      const { lines, writes } = yield* applyTo(button, fixed);
      expect(lines).toEqual([
        "Button / Label: textAutoResize → HEIGHT, layoutSizingHorizontal → FIXED, layoutSizingVertical → HUG, width → 120",
        "Button / Label: textAlignHorizontal → CENTER",
      ]);
      expect(writes).toEqual(
        [
          "textAutoResize",
          "layoutSizingHorizontal",
          "layoutSizingVertical",
          "unbind width",
          "resize",
          "textAlignHorizontal",
        ].map((field) => `${label.id} ${field}`)
      );
      expect([label.width, label.layoutSizingHorizontal, label.layoutSizingVertical]).toEqual([
        120,
        "FIXED",
        "HUG",
      ]);
      expect(yield* changesFor(button, fixed)).toEqual([]);
    })
  );

  // A hugging label's width follows its characters and its font, which an earlier write of the same
  // run can change, so a width that matches before the label turns fixed proves nothing.
  it.effect("writes a fixed width that a hugging label already measures, once its auto resize changes", () =>
    Effect.gen(function* () {
      label.resize(120, 20);
      expect([label.textAutoResize, label.width]).toEqual(["WIDTH_AND_HEIGHT", 120]);
      const fixed: TextLayerSpec = {
        ...LABEL,
        sizing: {
          horizontal: { kind: "fixed", length: { kind: "literal", value: 120 } },
          vertical: { kind: "hug" },
        },
      };
      expect(yield* changesFor(button, fixed)).toEqual([
        "Button / Label: textAutoResize → HEIGHT, layoutSizingHorizontal → FIXED, layoutSizingVertical → HUG, width → 120",
      ]);
    })
  );

  it.effect("writes a literal font size over a label whose first character alone holds it", () =>
    Effect.gen(function* () {
      const literal: TextLayerSpec = { ...LABEL, fontSize: { kind: "literal", value: 18 } };
      label.setBoundVariable("fontSize", null);
      label.setRangeBoundVariable(0, 1, "fontSize", button.file.variable("Fuse density", "display-text"));
      label.setRangeBoundVariable(0, 1, "fontSize", null);
      expect(label.fontSize).toBe(button.file.figma.mixed);
      expect(yield* changesFor(button, literal)).toEqual(["Button / Label: fontSize → 18"]);

      yield* applyTo(button, literal);
      expect(label.fontSize).toBe(18);
      expect(yield* changesFor(button, literal)).toEqual([]);
    })
  );

  it.effect("rebinds a font size that one character no longer follows", () =>
    Effect.gen(function* () {
      label.setRangeBoundVariable(0, 1, "fontSize", null);
      expect(yield* changesFor(button)).toEqual(["Button / Label: fontSize → control-text"]);
    })
  );

  it.effect("unbinds a literal line height that one character still binds", () =>
    Effect.gen(function* () {
      const literal: TextLayerSpec = { ...LABEL, lineHeight: { kind: "literal", value: 20 } };
      label.setRangeBoundVariable(1, 6, "lineHeight", null);
      expect(yield* changesFor(button, literal)).toEqual(["Button / Label: lineHeight → 20"]);
    })
  );

  it.effect("unbinds a literal font family that some characters still bind, in the font write", () =>
    Effect.gen(function* () {
      label.setRangeBoundVariable(1, 6, "fontFamily", button.file.variable("Fuse tokens", "font-sans"));
      const { lines, writes } = yield* applyTo(button);
      expect(lines).toEqual(["Button / Label: font → Roboto Medium"]);
      expect(writes).toEqual([`${label.id} unbind fontFamily`, `${label.id} fontName`]);
      expect(yield* changesFor(button)).toEqual([]);
    })
  );

  it.effect("clears a weight binding in the font write, and keeps the font", () =>
    Effect.gen(function* () {
      label.setRangeBoundVariable(
        0,
        6,
        "fontWeight",
        button.file.variable("Fuse density", "selection-title-weight")
      );
      const { lines, writes } = yield* applyTo(button);
      expect(lines).toEqual(["Button / Label: font → Roboto Medium"]);
      expect(writes).toEqual([`${label.id} unbind fontWeight`, `${label.id} fontName`]);
      expect(label.fontName).toEqual(ROBOTO_MEDIUM);
      expect(yield* changesFor(button)).toEqual([]);
    })
  );

  it.effect("clears a weight binding that turned the label bold, and writes the font back", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => button.file.figma.loadFontAsync(ROBOTO_BOLD));
      label.setRangeBoundVariable(0, 6, "fontWeight", button.file.variable("Fuse density", "strong-weight"));
      expect(label.fontName).toEqual(ROBOTO_BOLD);

      const { lines, writes } = yield* applyTo(button);
      expect(lines).toEqual(["Button / Label: font → Roboto Medium"]);
      expect(writes).toEqual([`${label.id} unbind fontWeight`, `${label.id} fontName`]);
      expect(label.fontName).toEqual(ROBOTO_MEDIUM);
      expect(yield* changesFor(button)).toEqual([]);
    })
  );

  it.effect("clears a style binding that some characters keep, in the font write", () =>
    Effect.gen(function* () {
      label.setRangeBoundVariable(0, 1, "fontStyle", button.file.variable("Fuse tokens", "label-style"));
      const { lines, writes } = yield* applyTo(button);
      expect(lines).toEqual(["Button / Label: font → Roboto Medium"]);
      expect(writes).toEqual([`${label.id} unbind fontStyle`, `${label.id} fontName`]);
      expect(label.fontName).toEqual(ROBOTO_MEDIUM);
      expect(yield* changesFor(button)).toEqual([]);
    })
  );

  it.effect("rebinds a font family that one character no longer follows", () =>
    Effect.gen(function* () {
      const bound: TextLayerSpec = {
        ...LABEL,
        fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
      };
      label.setBoundVariable("fontFamily", button.file.variable("Fuse tokens", "font-sans"));
      label.setRangeBoundVariable(0, 1, "fontFamily", null);
      expect(yield* changesFor(button, bound)).toEqual(["Button / Label: fontFamily → font-sans"]);
    })
  );
});

describe("planChildren with a font the machine cannot load", () => {
  it.effect("repairs a label that holds the font, because the font write needs only the new font", () =>
    Effect.gen(function* () {
      const button = yield* Effect.promise(() => buttonFile());
      const stale = staleLayer(button);
      // The first word is in a font the file holds and this machine lacks.
      button.label.setRangeFontName(0, 3, COMIC_SANS_BOLD);
      button.file.reopen({ unavailableFonts: [COMIC_SANS_BOLD] });

      const { lines, writes } = yield* applyTo(button);
      expect(lines).toEqual(["Button: delete the layer Old badge", "Button / Label: font → Roboto Medium"]);
      expect(writes).toEqual([`${stale.id} remove`, `${button.label.id} fontName`]);
      expect(button.label.fontName).toEqual(ROBOTO_MEDIUM);
    })
  );

  it("stops Apply before any write, and fails Plan the same way, for a label that keeps the font", async () => {
    const button = await buttonFile();
    staleLayer(button);
    button.label.setRangeBoundVariable(0, 1, "fontSize", null);
    button.file.reopen({ unavailableFonts: [ROBOTO_MEDIUM] });
    const before = button.file.writes.length;

    const message = "Button / Label needs the font Roboto Medium, which Figma cannot load.";
    await expect(Effect.runPromise(runPlan(true, planButton(button)))).rejects.toThrow(message);
    await expect(Effect.runPromise(runPlan(false, planButton(button)))).rejects.toThrow(message);
    expect(button.file.writes.slice(before)).toEqual([]);
  });
});
