/**
 * The text, icon and frame layers inside a variant's root, and the layers each frame holds.
 */

import { walkLayers } from "../../src/components/kit-spec.ts";
import type {
  AbsoluteSpec,
  BoxSpec,
  ChildLayerSpec,
  ComponentSetSpec,
  DirectionSpec,
  FrameLayerSpec,
  IconLayerSpec,
  NumberSpec,
  RotationSpec,
  TextLayerSpec,
  TextSizingSpec,
} from "../../src/components/kit-spec.ts";
import {
  describeNumber,
  LAYOUT_SIZING,
  near,
  planNumber,
  planPaints,
  planScalar,
  requireFont,
  SIZING_MEMBERS,
  solidPaint,
} from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { glyphOf } from "./icons.ts";
import type { PlannedIcon } from "./icons.ts";
import { findOwned, placeOwned, planOwnedChildren } from "./identity.ts";
import type { Siblings } from "./identity.ts";
import { change, changeTogether, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planBox, planLength } from "./root-layer.ts";
import type { LayerParent } from "./root-layer.ts";

/**
 * The TEXT, BOOLEAN and INSTANCE_SWAP properties of a component set, from the name in the spec to
 * the full property id. An operation that adds a property puts its id here when it runs, before
 * any layer links to it.
 */
export type PropertyIds = ReadonlyMap<string, string>;

/** What a variant's layers link to: the set's properties and the kit's icons. */
export type LayerLinks = {
  readonly properties: PropertyIds;
  readonly icons: ReadonlyMap<string, PlannedIcon>;
};

/**
 * The box a layer sits in, as the layer's planners need it: the node, the direction the spec lays
 * it out along, which a fill follows, and `held`, which is `unknown` when the box turns in this run.
 * A turn moves a layer's fill to the other axis and can change its size, so the layer's planners
 * write its lengths and sizing whatever it reads now.
 */
type Holder = {
  readonly node: LayerParent;
  readonly direction: DirectionSpec;
  readonly held: Held;
  /**
   * `unknown` when the run writes a field that can resize the box or a box above it, which moves an
   * absolute layer inside it by its constraints once the write runs, so the layer's place and size
   * are written whatever they read now.
   */
  readonly size: Held;
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
    for (const layer of walkLayers(variant.root)) {
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
 * @param parent - `unknown` when the box that holds the layer turns in this run.
 */
function planText(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  held: readonly FontName[],
  parent: Held
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
  planTypography(run, text, label, spec, propertyIds, parent);
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

/**
 * The auto resize a text's sizing takes: both sides hug its characters, its width is set and its
 * height follows its lines, or both sides are fixed.
 */
function autoResizeOf(sizing: TextSizingSpec): "WIDTH_AND_HEIGHT" | "HEIGHT" | "NONE" {
  if (sizing.vertical.kind === "fixed") {
    return "NONE";
  }
  return sizing.horizontal.kind === "hug" ? "WIDTH_AND_HEIGHT" : "HEIGHT";
}

/**
 * Plan how a text sizes and truncates as one operation, in the order its writes depend on each
 * other. The auto resize comes first, since it moves the text's hug: on a real file on 2026-10-22
 * a fill across a hugging text turned it to a fixed width with an auto height (P3). The sizing on
 * each axis follows, then a fixed width or height, which the auto resize must already keep, then
 * the truncation, and last the maximum lines, which a text keeps only while it truncates (P4).
 *
 * @param held - `unknown` when the text's box turns in this run, which moves its fill to the other
 *   axis, so the operation writes its sizing and lengths whatever it reads now, as it does after a
 *   new auto resize.
 */
function planTextLayout(run: Run, text: TextNode, label: string, spec: TextLayerSpec, held: Held): void {
  const autoResize = autoResizeOf(spec.sizing);
  const sizing = {
    horizontal: LAYOUT_SIZING[spec.sizing.horizontal.kind],
    vertical: LAYOUT_SIZING[spec.sizing.vertical.kind],
  };
  const truncation = spec.truncation === undefined ? "DISABLED" : "ENDING";
  changeTogether(
    run.plan,
    label,
    (plan) => {
      const group = { ...run, plan };
      // A new auto resize moves the text's hug, and a hugging text's size follows its characters and
      // its font, which the run can change first, so the sizing and the lengths after a new auto
      // resize are written whatever the text reads now.
      const lengths: Held = held === "read" && text.textAutoResize === autoResize ? "read" : "unknown";
      const reads = lengths === "read" ? text : undefined;
      planScalar(group, label, "textAutoResize", text.textAutoResize, autoResize, () => {
        text.textAutoResize = autoResize;
      });
      for (const [axis, member] of SIZING_MEMBERS) {
        if (reads?.[member] !== sizing[axis]) {
          change(plan, label, `${member} → ${sizing[axis]}`, () => {
            text[member] = sizing[axis];
          });
        }
      }
      planLength(group, text, label, "width", spec.sizing.horizontal, lengths, (value) =>
        text.resize(value, text.height)
      );
      planLength(group, text, label, "height", spec.sizing.vertical, lengths, (value) =>
        text.resize(text.width, value)
      );
      planScalar(group, label, "textTruncation", text.textTruncation, truncation, () => {
        text.textTruncation = truncation;
      });
      const maxLines = spec.truncation?.maxLines;
      if (maxLines !== undefined && (text.textTruncation !== truncation || text.maxLines !== maxLines)) {
        change(plan, label, `maxLines → ${maxLines}`, () => {
          text.maxLines = maxLines;
        });
      }
    },
    () => undefined
  );
}

function planTypography(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: PropertyIds,
  parent: Held
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
  planTextLayout(run, text, label, spec, parent);
  const { horizontal, vertical } = spec.align;
  planScalar(run, label, "textAlignHorizontal", text.textAlignHorizontal, horizontal, () => {
    text.textAlignHorizontal = horizontal;
  });
  planScalar(run, label, "textAlignVertical", text.textAlignVertical, vertical, () => {
    text.textAlignVertical = vertical;
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
 * Plan a layer's turn. Figma reads a rotation from -180 to 180, so two that differ by whole turns
 * match. Auto layout keeps a turned layer's box in its slot and moves its `x` and `y` with the turn,
 * as a real file did on 2026-10-22 (PR), so the plan compares the rotation alone.
 *
 * @param rotation - The turn the spec asks for, or undefined for none.
 */
function planRotation(
  run: Run,
  node: FrameNode | InstanceNode,
  label: string,
  rotation: RotationSpec | undefined
): void {
  const desired = rotation ?? 0;
  const off = (((node.rotation - desired) % 360) + 360) % 360;
  if (near(off, 0) || near(off, 360)) {
    return;
  }
  change(run.plan, label, `rotation → ${desired}`, () => {
    node.rotation = desired;
  });
}

/**
 * Plan the BOOLEAN property a frame's `visible` follows, which a designer toggles from the
 * properties panel to show or hide the part (PB). A frame the spec shows wherever its variant holds
 * it follows none.
 *
 * @param property - The property's name in the spec, or undefined for none.
 * @param ids - The set's properties.
 */
function planVisibleLink(
  run: Run,
  frame: FrameNode,
  label: string,
  property: string | undefined,
  ids: PropertyIds
): void {
  const linked = frame.componentPropertyReferences?.visible;
  if (property !== undefined && (linked === undefined || linked !== ids.get(property))) {
    change(run.plan, label, `visible → the ${property} property`, () => {
      const id = ids.get(property);
      if (id === undefined) {
        throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
      }
      frame.componentPropertyReferences = { ...frame.componentPropertyReferences, visible: id };
    });
  } else if (property === undefined && linked !== undefined) {
    change(run.plan, label, "visible → no property", () => {
      const { visible: _unlinked, ...rest } = frame.componentPropertyReferences ?? {};
      frame.componentPropertyReferences = rest;
    });
  }
}

/**
 * Plan an icon layer: an instance of the icon component the spec names, linked to the set's
 * swap property when it has one, sized and turned by the cell and with its glyph in the label's
 * color.
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
  planRotation(run, instance, label, spec.rotation);
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
const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";

/**
 * Plan where a frame layer sits as one operation: in its parent's auto layout, or absolute at the
 * spec's place, following the parent's resize as its constraints say. Turning a layer absolute or
 * back moves it, as the typings say of `layoutPositioning`, and a resize of the parent moves an
 * absolute layer by its constraints (P8), so a turn or a parent's resize in this run writes its
 * constraints and place whatever they read now. The positioning comes before the layer's size, since
 * Figma refuses FILL on an absolute layer (P8).
 *
 * @param size - `unknown` when the run writes a field that can resize the parent or a box above it.
 */
function planPositioning(
  run: Run,
  frame: FrameNode,
  label: string,
  absolute: AbsoluteSpec | undefined,
  size: Held
): void {
  const positioning = absolute === undefined ? "AUTO" : "ABSOLUTE";
  changeTogether(
    run.plan,
    label,
    (plan) => {
      const rewrite = frame.layoutPositioning !== positioning || size === "unknown";
      planScalar({ ...run, plan }, label, "layoutPositioning", frame.layoutPositioning, positioning, () => {
        frame.layoutPositioning = positioning;
      });
      if (absolute === undefined) {
        return;
      }
      const { horizontal, vertical } = absolute.constraints;
      if (rewrite || frame.constraints.horizontal !== horizontal || frame.constraints.vertical !== vertical) {
        change(plan, label, `constraints → ${horizontal} ${vertical}`, () => {
          frame.constraints = { horizontal, vertical };
        });
      }
      if (rewrite || !near(frame.x, absolute.x)) {
        change(plan, label, `x → ${absolute.x}`, () => {
          frame.x = absolute.x;
        });
      }
      if (rewrite || !near(frame.y, absolute.y)) {
        change(plan, label, `y → ${absolute.y}`, () => {
          frame.y = absolute.y;
        });
      }
    },
    () => undefined
  );
}

/**
 * Plan a frame layer: its name, where it sits, its box, the property that shows or hides it and its
 * turn, then the layers it holds.
 */
async function planFrame(
  run: Run,
  frame: FrameNode,
  label: string,
  spec: FrameLayerSpec,
  links: LayerLinks,
  holder: Holder
): Promise<void> {
  planScalar(run, label, "name", frame.name, spec.name, () => {
    frame.name = spec.name;
  });
  planPositioning(run, frame, label, spec.absolute, holder.size);
  // A resize of the parent moves an absolute layer's size by its constraints after the plan read it,
  // as a turn of the parent moves a fill, so the layer's lengths are written whatever they read.
  const moved = spec.absolute !== undefined && holder.size === "unknown" ? "unknown" : holder.held;
  const size = planBox(run, frame, label, spec, { kind: "frame", parent: moved });
  planVisibleLink(run, frame, label, spec.visibleProperty, links.properties);
  planRotation(run, frame, label, spec.rotation);
  await planChildren(run, frame, label, spec, links, holder.size === "unknown" ? "unknown" : size);
}

async function planChild(
  run: Run,
  holder: Holder,
  siblings: Siblings,
  label: string,
  spec: ChildLayerSpec,
  links: LayerLinks
): Promise<Target<SceneNode>> {
  const parent = holder.node;
  const layerLabel = `${label} / ${spec.name}`;
  const description = `create the ${spec.kind} layer ${spec.name}`;
  if (spec.kind === "frame") {
    const found = findOwned(run.plan, siblings, label, spec.key, spec.name, isFrame);
    if (found !== undefined) {
      await planFrame(run, found, layerLabel, spec, links, holder);
      return existing(found);
    }
    requireNewTextFonts(run, parent, label, walkLayers(spec));
    return create(
      run.plan,
      label,
      description,
      () => placeOwned(parent, run.figma.createFrame(), spec.key, spec.name),
      (made, plan) => planFrame({ ...run, plan }, made, layerLabel, spec, links, holder)
    );
  }
  if (spec.kind === "text") {
    const found = findOwned(run.plan, siblings, label, spec.key, spec.name, isText);
    if (found !== undefined) {
      planText(run, found, layerLabel, spec, links.properties, heldFonts(run, found), holder.held);
      return existing(found);
    }
    requireNewTextFonts(run, parent, label, [spec]);
    return create(
      run.plan,
      label,
      description,
      () => placeOwned(parent, run.figma.createText(), spec.key, spec.name),
      (made, plan) => planText({ ...run, plan }, made, layerLabel, spec, links.properties, [], holder.held)
    );
  }
  const found = findOwned(run.plan, siblings, label, spec.key, spec.name, isInstance);
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
    () => placeOwned(parent, icon.node.get().createInstance(), spec.key, spec.name),
    (made, plan) => planIcon({ ...run, plan }, made, layerLabel, spec, links)
  );
}

/**
 * Plan the layers of a variant or of a frame layer against the spec: create the missing ones,
 * update the rest, delete the kit's layers the spec dropped and restore the spec's order. A
 * frame layer plans its own layers the same way, so a key is unique among its siblings alone.
 *
 * @param run - The run.
 * @param parent - The variant component, or a frame layer below it.
 * @param label - The parent's label, for change lines.
 * @param box - The parent's spec: its layers, in order, and the direction it lays them out along.
 *   A parent whose direction differs from it turns in this run, so its layers' sizing is planned
 *   to be written again after the turn.
 * @param links - The set's properties and the kit's icons.
 * @param size - `unknown` when the run writes a field that can resize the parent or a box above it,
 *   as {@link planBox} returns for the parent, so the parent's absolute layers are planned to be
 *   written again after the resize.
 */
export async function planChildren(
  run: Run,
  parent: LayerParent,
  label: string,
  box: Pick<BoxSpec, "direction" | "children">,
  links: LayerLinks,
  size: Held
): Promise<void> {
  const holder: Holder = {
    node: parent,
    direction: box.direction,
    held: parent.layoutMode === box.direction ? "read" : "unknown",
    size,
  };
  await planOwnedChildren(run.plan, parent, label, "layer", box.children, (spec, siblings) =>
    planChild(run, holder, siblings, label, spec, links)
  );
}
