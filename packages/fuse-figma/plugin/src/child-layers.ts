/**
 * The text and icon layers inside a variant's root.
 */

import type {
  ChildLayerSpec,
  IconLayerSpec,
  NumberSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { describeNumber, near, planNumber, planPaints, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, setKey, staleOwned, unowned } from "./identity.ts";
import { change, create, existing, keepsOrder, precede, warn } from "./plan.ts";
import type { Target } from "./plan.ts";

/**
 * The text properties of a component set, from the name in the spec to the full property id.
 * An operation that adds a property puts its id here when it runs, before any text layer
 * links to it.
 */
export type TextPropertyIds = ReadonlyMap<string, string>;

/** A placeholder icon draws a ring this thick, close to a 16px Phosphor glyph's stroke. */
const ICON_STROKE_WEIGHT = 1.5;

function planTextNumber(
  run: Run,
  text: TextNode,
  label: string,
  name: "fontSize" | "lineHeight",
  spec: NumberSpec,
  matches: (value: number) => boolean,
  write: (value: number) => void
): void {
  const bound = text.boundVariables?.[name] ?? [];
  if (spec.kind === "variable") {
    const variable = run.variables.variable(spec.variable);
    if (bound.length > 0 && bound.every((alias) => alias.id === variable.id)) {
      return;
    }
    change(run.plan, label, `${name} → ${spec.variable.name}`, () => text.setBoundVariable(name, variable));
    return;
  }
  if (bound.length === 0 && matches(spec.value)) {
    return;
  }
  change(run.plan, label, `${name} → ${describeNumber(spec)}`, () => {
    text.setBoundVariable(name, null);
    write(spec.value);
  });
}

/**
 * The font family a text layer should render in. A bound family resolves through the
 * layer's modes, so the plugin can load it before it writes the layer. The kit check has
 * already confirmed that the variable holds a string.
 */
function fontFamilyFor(run: Run, text: TextNode, spec: TextLayerSpec): string {
  if (spec.fontFamily.kind === "literal") {
    return spec.fontFamily.value;
  }
  const resolved = run.variables.variable(spec.fontFamily.variable).resolveForConsumer(text);
  // SAFETY: the kit check confirmed the font family variable is a STRING variable, which
  // resolves to a string.
  return resolved.value as string;
}

function planTextFields(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  fontName: FontName,
  propertyIds: TextPropertyIds
): void {
  planScalar(run, label, "name", text.name, spec.name, () => {
    text.name = spec.name;
  });
  const holds = text.fontName === run.figma.mixed ? undefined : text.fontName;
  if (holds?.family !== fontName.family || holds.style !== fontName.style) {
    change(run.plan, label, `font → ${fontName.family} ${fontName.style}`, () => {
      text.fontName = fontName;
    });
  }
  if (spec.fontFamily.kind === "variable") {
    const variable = run.variables.variable(spec.fontFamily.variable);
    const bound = text.boundVariables?.fontFamily ?? [];
    if (bound.length === 0 || bound.some((alias) => alias.id !== variable.id)) {
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
  planPaints(run, label, "text color", text.fills, spec.color, (paints) => {
    text.fills = paints;
  });
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
 * Plan a text layer. Each of its operations loads the layer's fonts first, because Figma
 * refuses a text write unless the font the layer holds at that moment is loaded.
 */
function planText(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: TextPropertyIds
): void {
  const fontName: FontName = { family: fontFamilyFor(run, text, spec), style: spec.fontStyle };
  const loadFonts = async (): Promise<void> => {
    if (text.fontName !== run.figma.mixed) {
      await run.figma.loadFontAsync(text.fontName);
    }
    await run.figma.loadFontAsync(fontName);
  };
  precede(run.plan, loadFonts, (plan) =>
    planTextFields({ ...run, plan }, text, label, spec, fontName, propertyIds)
  );
}

function planIcon(run: Run, icon: EllipseNode, label: string, spec: IconLayerSpec): void {
  planScalar(run, label, "name", icon.name, spec.name, () => {
    icon.name = spec.name;
  });
  planNumber(
    run,
    icon,
    label,
    {
      name: "size",
      bindings: ["width", "height"],
      matches: (value) => near(icon.width, value) && near(icon.height, value),
      write: (value) => icon.resize(value, value),
    },
    spec.size
  );
  planPaints(run, label, "fill", icon.fills, undefined, (paints) => {
    icon.fills = paints;
  });
  planPaints(run, label, "stroke", icon.strokes, spec.color, (paints) => {
    icon.strokes = paints;
  });
  planNumber(
    run,
    icon,
    label,
    {
      name: "strokeWeight",
      bindings: ["strokeWeight"],
      matches: (value) => icon.strokeWeight !== run.figma.mixed && near(icon.strokeWeight, value),
      write: (value) => {
        icon.strokeWeight = value;
      },
    },
    { kind: "literal", value: ICON_STROKE_WEIGHT }
  );
  planScalar(run, label, "strokeAlign", icon.strokeAlign, "INSIDE", () => {
    icon.strokeAlign = "INSIDE";
  });
}

const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";
const isEllipse = (node: BaseNode): node is EllipseNode => node.type === "ELLIPSE";

function planChild(
  run: Run,
  component: ComponentNode,
  label: string,
  spec: ChildLayerSpec,
  propertyIds: TextPropertyIds
): Target<SceneNode> {
  const layerLabel = `${label} / ${spec.name}`;
  const description = `create the ${spec.kind} layer ${spec.name}`;
  if (spec.kind === "text") {
    const found = findOwned(run.plan, component.children, label, spec.key, spec.name, isText);
    if (found !== undefined) {
      planText(run, found, layerLabel, spec, propertyIds);
      return existing(found);
    }
    return create(
      run.plan,
      label,
      description,
      () => {
        const made = run.figma.createText();
        component.appendChild(made);
        setKey(made, spec.key);
        made.name = spec.name;
        return made;
      },
      (made, plan) => planText({ ...run, plan }, made, layerLabel, spec, propertyIds)
    );
  }
  const found = findOwned(run.plan, component.children, label, spec.key, spec.name, isEllipse);
  if (found !== undefined) {
    planIcon(run, found, layerLabel, spec);
    return existing(found);
  }
  return create(
    run.plan,
    label,
    description,
    () => {
      const made = run.figma.createEllipse();
      component.appendChild(made);
      setKey(made, spec.key);
      made.name = spec.name;
      return made;
    },
    (made, plan) => planIcon({ ...run, plan }, made, layerLabel, spec)
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
 * @param propertyIds - The set's text properties.
 */
export function planChildren(
  run: Run,
  component: ComponentNode,
  label: string,
  specs: readonly ChildLayerSpec[],
  propertyIds: TextPropertyIds
): void {
  const keep = new Set(specs.map((spec) => spec.key));
  for (const stale of staleOwned(component.children, keep)) {
    change(run.plan, label, `delete the layer ${stale.name}`, () => stale.remove());
  }

  const owned = specs.map((spec) => planChild(run, component, label, spec, propertyIds));

  for (const node of unowned(component.children, owned)) {
    warn(run.plan, label, `keeps the layer ${node.name}, which the kit does not own`);
  }

  if (!keepsOrder(component.children, owned)) {
    change(run.plan, label, "reorder the layers", () => {
      owned.forEach((target, index) => component.insertChild(index, target.get()));
    });
  }
}
