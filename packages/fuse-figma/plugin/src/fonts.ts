/**
 * This module requires the fonts a run loads before its first write. Figma refuses a text write unless every font it
 * touches is loaded, so the planning pass requires each font a write needs: the fonts a text layer
 * holds, and the fonts of the text layers a new node brings, resolved through the modes the new node
 * will read. `instance-layers.ts` adds the fonts an instance's held labels need, bound to its stages.
 */

import { Effect } from "effect";

import { FONT_WEIGHT_STYLES, glyphRanges, shownLabels, walkLayers } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentSetSpec,
  InnerVariantSpec,
  InstanceLayerSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { FileNotSynced, FontUnavailable } from "./errors.ts";
import type { Run } from "./fields.ts";
import { requirement } from "./plan.ts";
import { currentRun } from "./services.ts";

/** The inner variant an instance layer shows, and the TEXT properties of its set. */
export type InnerSpecs = (layer: InstanceLayerSpec) => InnerVariantSpec;

/**
 * Require a font before the run's first write. Figma refuses a text write unless the fonts it
 * touches are loaded, and a file can hold a font this machine cannot load. Loading every font
 * first makes such a font stop the run, Plan included, with nothing written.
 *
 * @param run - The run.
 * @param label - The layer that needs the font, for the error.
 * @param font - The font.
 */
export function requireFont(run: Run, label: string, font: FontName): void {
  const axes = font.variationSettings === undefined ? "" : ` ${JSON.stringify(font.variationSettings)}`;
  const key = `font ${font.family} ${font.style}${axes}`;
  requirement(
    run.plan,
    key,
    Effect.tryPromise({
      try: () => run.figma.loadFontAsync(font),
      catch: (cause) =>
        new FontUnavailable({
          message: `${label} needs the font ${font.family} ${font.style}, which Figma cannot load. Install it, then run the plugin again.`,
          font,
          cause,
        }),
    })
  );
}

/**
 * Every font a text layer's characters use, each range of mixed ones included. An empty layer holds
 * the one font it would type in.
 *
 * @param run - The run.
 * @param text - The text layer.
 * @returns The fonts.
 */
export function heldFonts(run: Run, text: TextNode): FontName[] {
  if (text.characters.length > 0) {
    return text.getRangeAllFontNames(0, text.characters.length);
  }
  return text.fontName === run.figma.mixed ? [] : [text.fontName];
}

/**
 * The font a text layer should render in. A bound family resolves through the modes of
 * `consumer`, which is the layer itself, or the existing node a new layer lands in and takes
 * its modes from. The kit check has already confirmed that the variable holds a string.
 */
export function fontFor(run: Run, consumer: SceneNode, spec: TextLayerSpec): FontName {
  const style = weightFace(run, consumer, spec);
  if (spec.fontFamily.kind === "literal") {
    return { family: spec.fontFamily.value, style };
  }
  const resolved = run.variables.variable(spec.fontFamily.variable).resolveForConsumer(consumer);
  // SAFETY: the kit check confirmed the font family variable is a STRING variable, which
  // resolves to a string.
  return { family: resolved.value as string, style };
}

/**
 * The face a text layer takes in `consumer`'s modes: the one its bound weight names there, where
 * the spec binds one, as Figma gives a text bound to a `fontWeight` variable (rule 10 of the fake),
 * and the spec's style otherwise.
 */
function weightFace(run: Run, consumer: SceneNode, spec: TextLayerSpec): string {
  if (spec.weight === undefined) {
    return spec.fontStyle;
  }
  const resolved = run.variables.variable(spec.weight.variable).resolveForConsumer(consumer);
  // SAFETY: the kit check confirmed the weight variable is a FLOAT variable, which resolves to a number.
  return FONT_WEIGHT_STYLES.get(resolved.value as number) ?? spec.fontStyle;
}

/**
 * Every font a text layer can show, so the run loads each before it writes the layer: each face its
 * bound weight names in some mode, or its one style, in its family and, where its characters hold the
 * glyph font's glyphs, in the glyph font's family too. A `fontWeight` binding gives each range the
 * face its own family names for the weight (rule 10 of the fake), and the glyph ranges take the
 * label's one style otherwise (`planGlyphRanges`).
 *
 * @param run - The run, which names the glyph font.
 * @param spec - The text layer.
 * @param family - The family the layer's own characters take.
 * @returns The fonts.
 */
export function fontsOf(run: Run, spec: TextLayerSpec, family: string): readonly FontName[] {
  const faces = spec.weight?.faces ?? [spec.fontStyle];
  const glyphs = glyphRanges(spec.characters, run.glyphFont).length > 0;
  const families = glyphs ? [family, run.glyphFont.family] : [family];
  return families.flatMap((each) => faces.map((style) => ({ family: each, style })));
}

function isAlias(value: VariableValue): value is VariableAlias {
  // SAFETY: a string, number or boolean has no `type` field, so the read yields undefined, and
  // only an alias carries VARIABLE_ALIAS.
  return (value as Partial<VariableAlias>).type === "VARIABLE_ALIAS";
}

/**
 * The value a variable takes in a node that sits on a page and pins no modes. Such a node
 * reads each collection in the mode the page pins for it, or in the collection's default
 * mode, and so does every alias the variable follows. It fails with `FileNotSynced` where the
 * file's variables do not resolve: a variable outside any collection, one without a value in the
 * mode, an alias to a variable the file lacks, or an alias cycle.
 *
 * @param figma - The plugin API.
 * @param variable - The variable.
 * @param pageModes - The modes the page pins, or none for each collection's default mode.
 * @returns The value the variable resolves to.
 */
export const resolveOnPage = Effect.fnUntraced(function* (
  figma: PluginAPI,
  variable: Variable,
  pageModes: PageNode["explicitVariableModes"]
) {
  const seen = new Set<string>();
  let current = variable;
  while (!seen.has(current.id)) {
    seen.add(current.id);
    const { variableCollectionId } = current;
    const collection = yield* Effect.promise(() =>
      figma.variables.getVariableCollectionByIdAsync(variableCollectionId)
    );
    if (collection === null) {
      return yield* new FileNotSynced({
        message: `${current.name} belongs to no collection the file holds.`,
        collection: variableCollectionId,
      });
    }
    const value = current.valuesByMode[pageModes[collection.id] ?? collection.defaultModeId];
    if (value === undefined) {
      return yield* new FileNotSynced({
        message: `${current.name} has no value in the mode a new layer reads.`,
        collection: collection.name,
      });
    }
    if (!isAlias(value)) {
      return value;
    }
    const target = yield* Effect.promise(() => figma.variables.getVariableByIdAsync(value.id));
    if (target === null) {
      return yield* new FileNotSynced({
        message: `${current.name} aliases a variable the file does not hold.`,
        collection: collection.name,
      });
    }
    current = target;
  }
  return yield* new FileNotSynced({
    message: `${variable.name} aliases itself.`,
    collection: variable.variableCollectionId,
  });
});

/**
 * Require the fonts of the text layers in a component set the run creates. A new set sits
 * on the page, which is no scene node, so no existing node can resolve its labels' family
 * through `resolveForConsumer`. The plan follows the family variable through the modes the
 * set will read instead, which is what Figma renders once the set exists.
 *
 * @param pageModes - The modes the page pins. A page the run creates pins none.
 * @param set - The component set.
 * @param innerOf - The inner variant each of the set's instance layers shows, whose labels the layer
 *   sets.
 */
export const requireNewSetFonts = Effect.fnUntraced(function* (
  pageModes: PageNode["explicitVariableModes"],
  set: ComponentSetSpec,
  innerOf: InnerSpecs
) {
  const run = yield* currentRun;
  const families = new Map<string, string>();
  for (const variant of set.variants) {
    for (const layer of fontLayers(walkLayers(variant.root), innerOf)) {
      if (layer.kind !== "text") {
        continue;
      }
      let family = layer.fontFamily.kind === "literal" ? layer.fontFamily.value : undefined;
      if (layer.fontFamily.kind === "variable") {
        const variable = run.variables.variable(layer.fontFamily.variable);
        family = families.get(variable.id);
        if (family === undefined) {
          // SAFETY: the kit check confirmed the font family variable is a STRING variable,
          // and an alias keeps its variable's type, so the value is a string.
          family = (yield* resolveOnPage(run.figma, variable, pageModes)) as string;
          families.set(variable.id, family);
        }
      }
      if (family !== undefined) {
        for (const font of fontsOf(run, layer, family)) {
          requireFont(run, `${set.name} / ${layer.name}`, font);
        }
      }
    }
  }
});

/**
 * Require the fonts of the text layers a new node gets, resolved through the existing node it
 * lands in.
 *
 * @param run - The run.
 * @param consumer - The existing node whose modes the new layers take.
 * @param label - The new node's label, for errors.
 * @param layers - Every layer the new node brings, such as `walkLayers` lists below a box.
 */
export function requireNewTextFonts(
  run: Run,
  consumer: SceneNode,
  label: string,
  layers: readonly ChildLayerSpec[]
): void {
  for (const layer of layers) {
    if (layer.kind === "text") {
      const { family } = fontFor(run, consumer, layer);
      for (const font of fontsOf(run, layer, family)) {
        requireFont(run, `${label} / ${layer.name}`, font);
      }
    }
  }
}

/**
 * The layers whose fonts a new node's writes need: its text layers, and the labels of each inner
 * variant whose TEXT property an instance layer among them sets.
 *
 * @param layers - The layers the new node brings, such as `walkLayers` lists below a box.
 * @param innerOf - The inner variant an instance layer shows, such as `innerSpecs` in
 *   `instance-layers.ts` finds among the sets the run planned before this one.
 * @returns The layers to require fonts for.
 */
export function fontLayers(
  layers: readonly ChildLayerSpec[],
  innerOf: InnerSpecs
): readonly ChildLayerSpec[] {
  return layers.flatMap((layer): readonly ChildLayerSpec[] =>
    layer.kind === "instance" ? shownLabels(layer, innerOf(layer)) : [layer]
  );
}

/**
 * The font an instance shows a label of its inner variant in, as one face over the whole label: the
 * inner label's family, resolved in the instance's modes, in the face of the label as the instance
 * shows it (`shownLabel` in `kit-spec.ts`), a face override's or the inner label's own. The overrides
 * stage writes it as the label's whole font, and the planning pass requires it, with the glyph font's
 * family in the same face ({@link fontsOf}), so neither reads the family or the face from what the
 * label holds.
 *
 * @param run - The run.
 * @param instance - The instance, whose modes resolve a bound family and a bound weight.
 * @param shown - The label as the instance shows it.
 * @returns The font.
 */
export function shownFace(run: Run, instance: InstanceNode, shown: TextLayerSpec): FontName {
  return fontFor(run, instance, shown);
}
