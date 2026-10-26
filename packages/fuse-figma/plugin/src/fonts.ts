/**
 * This module requires the fonts a run loads before its first write. Figma refuses a text write unless every font it
 * touches is loaded, so the planning pass requires each font a write needs: the fonts a text layer
 * holds, and the fonts of the text layers a new node brings, resolved through the modes the new node
 * will read. `instance-layers.ts` adds the fonts an instance's held labels need, bound to its stages.
 */

import { walkLayers } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  TextLayerSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { FontUnavailable } from "./errors.ts";
import type { Run } from "./fields.ts";
import { requirement } from "./plan.ts";

/** The inner variant an instance layer shows. */
export type InnerSpecs = (layer: InstanceLayerSpec) => VariantSpec;

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
  requirement(run.plan, key, async () => {
    try {
      await run.figma.loadFontAsync(font);
    } catch (cause) {
      throw new FontUnavailable({
        message: `${label} needs the font ${font.family} ${font.style}, which Figma cannot load. Install it, then run the plugin again.`,
        font,
        cause,
      });
    }
  });
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
  if (spec.fontFamily.kind === "literal") {
    return { family: spec.fontFamily.value, style: spec.fontStyle };
  }
  const resolved = run.variables.variable(spec.fontFamily.variable).resolveForConsumer(consumer);
  // SAFETY: the kit check confirmed the font family variable is a STRING variable, which
  // resolves to a string.
  return { family: resolved.value as string, style: spec.fontStyle };
}

function isAlias(value: VariableValue): value is VariableAlias {
  // SAFETY: a string, number or boolean has no `type` field, so the read yields undefined, and
  // only an alias carries VARIABLE_ALIAS.
  return (value as Partial<VariableAlias>).type === "VARIABLE_ALIAS";
}

/**
 * The value a variable takes in a node that sits on a page and pins no modes. Such a node
 * reads each collection in the mode the page pins for it, or in the collection's default
 * mode, and so does every alias the variable follows.
 */
async function resolveOnPage(
  run: Run,
  variable: Variable,
  pageModes: PageNode["explicitVariableModes"]
): Promise<VariableValue> {
  const seen = new Set<string>();
  let current = variable;
  while (!seen.has(current.id)) {
    seen.add(current.id);
    const collection = await run.figma.variables.getVariableCollectionByIdAsync(current.variableCollectionId);
    if (collection === null) {
      throw new Error(`${current.name} belongs to no collection the file holds.`);
    }
    const value = current.valuesByMode[pageModes[collection.id] ?? collection.defaultModeId];
    if (value === undefined) {
      throw new Error(`${current.name} has no value in the mode a new layer reads.`);
    }
    if (!isAlias(value)) {
      return value;
    }
    const target = await run.figma.variables.getVariableByIdAsync(value.id);
    if (target === null) {
      throw new Error(`${current.name} aliases a variable the file does not hold.`);
    }
    current = target;
  }
  throw new Error(`${variable.name} aliases itself.`);
}

/**
 * Require the fonts of the text layers in a component set the run creates. A new set sits
 * on the page, which is no scene node, so no existing node can resolve its labels' family
 * through `resolveForConsumer`. The plan follows the family variable through the modes the
 * set will read instead, which is what Figma renders once the set exists.
 *
 * @param run - The run.
 * @param pageModes - The modes the page pins. A page the run creates pins none.
 * @param set - The component set.
 * @param innerOf - The inner variant each of the set's instance layers shows, whose labels the layer
 *   sets.
 */
export async function requireNewSetFonts(
  run: Run,
  pageModes: PageNode["explicitVariableModes"],
  set: ComponentSetSpec,
  innerOf: InnerSpecs
): Promise<void> {
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
          family = (await resolveOnPage(run, variable, pageModes)) as string;
          families.set(variable.id, family);
        }
      }
      if (family !== undefined) {
        requireFont(run, `${set.name} / ${layer.name}`, { family, style: layer.fontStyle });
      }
    }
  }
}

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
      requireFont(run, `${label} / ${layer.name}`, fontFor(run, consumer, layer));
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
    layer.kind === "instance" ? linkedLabels(innerOf(layer)) : [layer]
  );
}

/**
 * The labels of a variant that a TEXT property sets, whose fonts a TEXT write on an instance needs.
 *
 * @param variant - The inner variant.
 * @returns The text layers that link a TEXT property.
 */
export function linkedLabels(variant: VariantSpec): readonly TextLayerSpec[] {
  return walkLayers(variant.root).filter(
    (layer): layer is TextLayerSpec => layer.kind === "text" && layer.textProperty !== undefined
  );
}
