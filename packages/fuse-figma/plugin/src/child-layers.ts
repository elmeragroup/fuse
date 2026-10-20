/**
 * The text and icon layers inside a variant's root.
 */

import type {
  ChildLayerSpec,
  ComponentSetSpec,
  IconLayerSpec,
  NumberSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import {
  describeNumber,
  near,
  planNumber,
  planPaints,
  planScalar,
  requireFont,
  solidPaint,
} from "./fields.ts";
import type { Run } from "./fields.ts";
import { glyphOf } from "./icons.ts";
import type { PlannedIcon } from "./icons.ts";
import { findOwned, placeOwned, planOwnedChildren } from "./identity.ts";
import { change, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";

/**
 * The TEXT and INSTANCE_SWAP properties of a component set, from the name in the spec to the
 * full property id. An operation that adds a property puts its id here when it runs, before
 * any layer links to it.
 */
export type PropertyIds = ReadonlyMap<string, string>;

/** What a variant's layers link to: the set's properties and the kit's icons. */
export type LayerLinks = {
  readonly properties: PropertyIds;
  readonly icons: ReadonlyMap<string, PlannedIcon>;
};

/** The text fields that pick a font's style, which the spec sets as a literal. */
const STYLE_FIELDS: readonly VariableBindableTextField[] = ["fontStyle", "fontWeight"];

/**
 * The variable a text field binds across the whole layer. `boundVariables` lists the aliases
 * the characters bind and says nothing of characters that bind none, so the range read is
 * what shows a layer that one character left.
 *
 * @returns The alias when every character binds it, null when no character binds a variable,
 *   or `figma.mixed` when the characters differ.
 */
function textBinding(
  run: Run,
  text: TextNode,
  field: VariableBindableTextField
): VariableAlias | null | PluginAPI["mixed"] {
  if (text.characters.length > 0) {
    return text.getRangeBoundVariable(0, text.characters.length, field);
  }
  // An empty layer has no range to read, so its node-level bindings speak for it.
  const [first, ...rest] = text.boundVariables?.[field] ?? [];
  if (first === undefined) {
    return null;
  }
  return rest.every((alias) => alias.id === first.id) ? first : run.figma.mixed;
}

function planTextNumber(
  run: Run,
  text: TextNode,
  label: string,
  name: "fontSize" | "lineHeight",
  spec: NumberSpec,
  matches: (value: number) => boolean,
  write: (value: number) => void
): void {
  const binding = textBinding(run, text, name);
  if (spec.kind === "variable") {
    const variable = run.variables.variable(spec.variable);
    if (binding !== run.figma.mixed && binding?.id === variable.id) {
      return;
    }
    change(run.plan, label, `${name} → ${spec.variable.name}`, () => text.setBoundVariable(name, variable));
    return;
  }
  if (binding === null && matches(spec.value)) {
    return;
  }
  change(run.plan, label, `${name} → ${describeNumber(spec)}`, () => {
    text.setBoundVariable(name, null);
    write(spec.value);
  });
}

/**
 * The font a text layer should render in. A bound family resolves through the modes of
 * `consumer`, which is the layer itself, or the existing node a new layer lands in and takes
 * its modes from. The kit check has already confirmed that the variable holds a string.
 */
function fontFor(run: Run, consumer: SceneNode, spec: TextLayerSpec): FontName {
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
 */
export async function requireNewSetFonts(
  run: Run,
  pageModes: PageNode["explicitVariableModes"],
  set: ComponentSetSpec
): Promise<void> {
  const families = new Map<string, string>();
  for (const variant of set.variants) {
    for (const child of variant.root.children) {
      if (child.kind !== "text") {
        continue;
      }
      let family = child.fontFamily.kind === "literal" ? child.fontFamily.value : undefined;
      if (child.fontFamily.kind === "variable") {
        const variable = run.variables.variable(child.fontFamily.variable);
        family = families.get(variable.id);
        if (family === undefined) {
          // SAFETY: the kit check confirmed the font family variable is a STRING variable,
          // and an alias keeps its variable's type, so the value is a string.
          family = (await resolveOnPage(run, variable, pageModes)) as string;
          families.set(variable.id, family);
        }
      }
      if (family !== undefined) {
        requireFont(run, `${set.name} / ${child.name}`, { family, style: child.fontStyle });
      }
    }
  }
}

/** Every font a layer's characters use. An empty layer holds the one font it would type in. */
function heldFonts(run: Run, text: TextNode): FontName[] {
  if (text.characters.length > 0) {
    return text.getRangeAllFontNames(0, text.characters.length);
  }
  return text.fontName === run.figma.mixed ? [] : [text.fontName];
}

/**
 * Require the fonts of the text layers a new node gets, resolved through the existing node it
 * lands in.
 *
 * @param run - The run.
 * @param consumer - The existing node whose modes the new layers take.
 * @param label - The new node's label, for errors.
 * @param specs - The new node's child layers.
 */
export function requireNewTextFonts(
  run: Run,
  consumer: SceneNode,
  label: string,
  specs: readonly ChildLayerSpec[]
): void {
  for (const spec of specs) {
    if (spec.kind === "text") {
      requireFont(run, `${label} / ${spec.name}`, fontFor(run, consumer, spec));
    }
  }
}

/**
 * Plan the font, and require the fonts the label's later writes need. A font write comes first
 * among the label's writes, because Figma needs only the new font to set it. Every later write
 * then needs only that font, so a label whose font the machine lacks can still be repaired.
 * A label that keeps its font needs every font it holds for a write such as its size.
 *
 * @returns Whether the plan replaces the label's font.
 */
function planFont(run: Run, text: TextNode, label: string, spec: TextLayerSpec, fontName: FontName): boolean {
  const holds = text.fontName === run.figma.mixed ? undefined : text.fontName;
  const differs = holds?.family !== fontName.family || holds.style !== fontName.style;
  // The spec sets the style as a literal, and the family too unless it binds one. A variable
  // that any character binds to one of those fields would override the literal in another
  // theme, so the font write clears it in the same operation.
  const literalFields: readonly VariableBindableTextField[] =
    spec.fontFamily.kind === "literal" ? ["fontFamily", ...STYLE_FIELDS] : STYLE_FIELDS;
  const unbind = literalFields.filter((field) => textBinding(run, text, field) !== null);
  if (!differs && unbind.length === 0) {
    return false;
  }
  change(run.plan, label, `font → ${fontName.family} ${fontName.style}`, () => {
    for (const field of unbind) {
      text.setBoundVariable(field, null);
    }
    text.fontName = fontName;
  });
  requireFont(run, label, fontName);
  return true;
}

/**
 * Plan a text layer. The font comes first, then the writes that need no font, then the
 * typography. The layer's operations only write, because the run loads every font before its
 * first write.
 *
 * @param held - The fonts the layer holds now. A layer the run creates passes none, because
 *   its first font is unknown until it exists, and the font write that a new layer gets
 *   needs only the new font.
 */
function planText(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  held: readonly FontName[]
): void {
  const fontName = fontFor(run, text, spec);
  const replaced = planFont(run, text, label, spec, fontName);
  planScalar(run, label, "name", text.name, spec.name, () => {
    text.name = spec.name;
  });
  planPaints(run, label, "text color", text.fills, spec.color, (paints) => {
    text.fills = paints;
  });

  const start = run.plan.operations.length;
  planTypography(run, text, label, spec, propertyIds);
  if (!replaced && run.plan.operations.length > start) {
    for (const font of [...held, fontName]) {
      requireFont(run, label, font);
    }
  }
}

/** Whether a layer's underline offset is the one the spec asks for. */
function offsetMatches(current: TextDecorationOffset | null, desired: TextDecorationOffset): boolean {
  if (current === null || current.unit !== desired.unit) {
    return false;
  }
  return current.unit !== "AUTO" && desired.unit !== "AUTO" ? near(current.value, desired.value) : true;
}

/**
 * Plan the underline as one operation, because Figma holds an underline offset only while the
 * layer is underlined.
 */
function planUnderline(run: Run, text: TextNode, label: string, spec: TextLayerSpec): void {
  const underline = spec.underline;
  if (underline === undefined) {
    if (text.textDecoration !== "NONE") {
      change(run.plan, label, "textDecoration → NONE", () => {
        text.textDecoration = "NONE";
      });
    }
    return;
  }
  const offset: TextDecorationOffset =
    underline.offset === undefined ? { unit: "AUTO" } : { unit: "PIXELS", value: underline.offset };
  const held = text.textDecorationOffset === run.figma.mixed ? null : text.textDecorationOffset;
  if (text.textDecoration === "UNDERLINE" && offsetMatches(held, offset)) {
    return;
  }
  const description = underline.offset === undefined ? "UNDERLINE" : `UNDERLINE, offset ${underline.offset}`;
  change(run.plan, label, `textDecoration → ${description}`, () => {
    text.textDecoration = "UNDERLINE";
    text.textDecorationOffset = offset;
  });
}

function planTypography(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds
): void {
  if (spec.fontFamily.kind === "variable") {
    const variable = run.variables.variable(spec.fontFamily.variable);
    const binding = textBinding(run, text, "fontFamily");
    if (binding === run.figma.mixed || binding?.id !== variable.id) {
      change(run.plan, label, `fontFamily → ${spec.fontFamily.variable.name}`, () =>
        text.setBoundVariable("fontFamily", variable)
      );
    }
  }
  planTextNumber(
    run,
    text,
    label,
    "fontSize",
    spec.fontSize,
    (value) => text.fontSize !== run.figma.mixed && near(text.fontSize, value),
    (value) => {
      text.fontSize = value;
    }
  );
  planTextNumber(
    run,
    text,
    label,
    "lineHeight",
    spec.lineHeight,
    (value) =>
      text.lineHeight !== run.figma.mixed &&
      text.lineHeight.unit === "PIXELS" &&
      near(text.lineHeight.value, value),
    (value) => {
      text.lineHeight = { unit: "PIXELS", value };
    }
  );
  planUnderline(run, text, label, spec);
  planScalar(run, label, "textAutoResize", text.textAutoResize, "WIDTH_AND_HEIGHT", () => {
    text.textAutoResize = "WIDTH_AND_HEIGHT";
  });

  const property = spec.textProperty;
  if (property === undefined) {
    planScalar(run, label, "characters", text.characters, spec.characters, () => {
      text.characters = spec.characters;
    });
    return;
  }
  const linked = propertyIds.get(property);
  if (linked !== undefined && text.componentPropertyReferences?.characters === linked) {
    return;
  }
  change(run.plan, label, `characters → the ${property} property`, () => {
    const propertyId = propertyIds.get(property);
    if (propertyId === undefined) {
      throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
    }
    text.characters = spec.characters;
    text.componentPropertyReferences = { characters: propertyId };
  });
}

/**
 * Plan an icon layer: an instance of the icon component the spec names, linked to the set's
 * swap property when it has one, sized by the cell and with its glyph in the label's color.
 */
async function planIcon(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: IconLayerSpec,
  links: LayerLinks
): Promise<void> {
  planScalar(run, label, "name", instance.name, spec.name, () => {
    instance.name = spec.name;
  });
  const icon = links.icons.get(spec.icon);
  if (icon === undefined) {
    throw new Error(`${label} shows ${spec.icon}, which the kit's icon library lacks.`);
  }
  const main = await instance.getMainComponentAsync();
  const swapped = icon.node.existing === undefined || main?.id !== icon.node.existing.id;
  if (swapped) {
    change(run.plan, label, `show ${icon.spec.name}`, () => instance.swapComponent(icon.node.get()));
  }
  const property = spec.swapProperty;
  const linked = instance.componentPropertyReferences?.mainComponent;
  if (property !== undefined && (linked === undefined || linked !== links.properties.get(property))) {
    change(run.plan, label, `icon → the ${property} property`, () => {
      const id = links.properties.get(property);
      if (id === undefined) {
        throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
      }
      instance.componentPropertyReferences = { ...instance.componentPropertyReferences, mainComponent: id };
    });
  } else if (property === undefined && linked !== undefined) {
    change(run.plan, label, "icon → no property", () => {
      const { mainComponent: _unlinked, ...rest } = instance.componentPropertyReferences ?? {};
      instance.componentPropertyReferences = rest;
    });
  }
  planNumber(
    run,
    instance,
    label,
    {
      name: "size",
      bindings: ["width", "height"],
      matches: (value) => near(instance.width, value) && near(instance.height, value),
      write: (value) => instance.resize(value, value),
    },
    spec.size
  );
  // A swap or a redraw replaces the glyph, so the color goes on the glyph the instance holds
  // once those ran.
  const glyph = swapped || icon.redrawn ? undefined : glyphOf(instance);
  if (glyph === undefined) {
    const paint = solidPaint(run, spec.color);
    change(
      run.plan,
      label,
      `glyph fill → ${spec.color.kind === "variable" ? spec.color.variable.name : "a literal"}`,
      () => {
        const drawn = glyphOf(instance);
        if (drawn === undefined) {
          throw new Error(`${label}: ${icon.spec.name} has no glyph to color.`);
        }
        drawn.fills = [paint];
      }
    );
    return;
  }
  planPaints(run, `${label} / glyph`, "fill", glyph.fills, spec.color, (paints) => {
    glyph.fills = paints;
  });
}

const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";

async function planChild(
  run: Run,
  component: ComponentNode,
  label: string,
  spec: ChildLayerSpec,
  links: LayerLinks
): Promise<Target<SceneNode>> {
  const layerLabel = `${label} / ${spec.name}`;
  const description = `create the ${spec.kind} layer ${spec.name}`;
  if (spec.kind === "text") {
    const found = findOwned(run.plan, component.children, label, spec.key, spec.name, isText);
    if (found !== undefined) {
      planText(run, found, layerLabel, spec, links.properties, heldFonts(run, found));
      return existing(found);
    }
    requireNewTextFonts(run, component, label, [spec]);
    return create(
      run.plan,
      label,
      description,
      () => placeOwned(component, run.figma.createText(), spec.key, spec.name),
      (made, plan) => planText({ ...run, plan }, made, layerLabel, spec, links.properties, [])
    );
  }
  const found = findOwned(run.plan, component.children, label, spec.key, spec.name, isInstance);
  if (found !== undefined) {
    await planIcon(run, found, layerLabel, spec, links);
    return existing(found);
  }
  const icon = links.icons.get(spec.icon);
  if (icon === undefined) {
    throw new Error(`${layerLabel} shows ${spec.icon}, which the kit's icon library lacks.`);
  }
  return create(
    run.plan,
    label,
    description,
    () => placeOwned(component, icon.node.get().createInstance(), spec.key, spec.name),
    (made, plan) => planIcon({ ...run, plan }, made, layerLabel, spec, links)
  );
}

/**
 * Plan a variant's child layers against the spec: create the missing ones, update the rest,
 * delete the kit's layers the spec dropped and restore the spec's order.
 *
 * @param run - The run.
 * @param component - The variant component.
 * @param label - The variant's label, for change lines.
 * @param specs - The child layers, in order.
 * @param links - The set's properties and the kit's icons.
 */
export async function planChildren(
  run: Run,
  component: ComponentNode,
  label: string,
  specs: readonly ChildLayerSpec[],
  links: LayerLinks
): Promise<void> {
  await planOwnedChildren(run.plan, component, label, "layer", specs, (spec) =>
    planChild(run, component, label, spec, links)
  );
}
