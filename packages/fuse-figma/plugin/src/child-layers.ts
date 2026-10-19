/**
 * The text and icon layers inside a variant's root.
 */

import type {
  ChildLayerSpec,
  IconLayerSpec,
  NumberSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { describeNumber, near, syncNumber, syncPaints, syncScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, keyOf, setKey, staleOwned } from "./identity.ts";
import { change, create, muted, warn } from "./ledger.ts";

/** The text properties of a component set, from the name in the spec to the full property id. */
export type TextPropertyIds = ReadonlyMap<string, string>;

/** A placeholder icon draws a ring this thick, close to a 16px Phosphor glyph's stroke. */
const ICON_STROKE_WEIGHT = 1.5;

function syncTextNumber(
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
    change(run.ledger, label, `${name} → ${spec.variable.name}`, () => text.setBoundVariable(name, variable));
    return;
  }
  if (bound.length === 0 && matches(spec.value)) {
    return;
  }
  change(run.ledger, label, `${name} → ${describeNumber(spec)}`, () => {
    text.setBoundVariable(name, null);
    write(spec.value);
  });
}

/**
 * The font family a text layer should render in. A bound family resolves through the
 * layer's modes, so the plugin can load it before it writes the layer.
 */
function fontFamilyFor(run: Run, text: TextNode, spec: TextLayerSpec): string {
  if (spec.fontFamily.kind === "literal") {
    return spec.fontFamily.value;
  }
  const resolved = run.variables.variable(spec.fontFamily.variable).resolveForConsumer(text);
  if (resolved.resolvedType !== "STRING") {
    throw new Error(
      `${spec.fontFamily.variable.name} is a ${resolved.resolvedType} variable, not a font family.`
    );
  }
  // SAFETY: a variable whose resolved type is STRING resolves to a string.
  return resolved.value as string;
}

async function syncText(
  run: Run,
  text: TextNode,
  label: string,
  spec: TextLayerSpec,
  propertyIds: TextPropertyIds
): Promise<void> {
  const family = fontFamilyFor(run, text, spec);
  const fontName: FontName = { family, style: spec.fontStyle };
  if (run.ledger.apply) {
    // Figma refuses a text write unless the font the layer holds now is loaded.
    if (text.fontName !== run.figma.mixed) {
      await run.figma.loadFontAsync(text.fontName);
    }
    await run.figma.loadFontAsync(fontName);
  }

  syncScalar(run, label, "name", text.name, spec.name, () => {
    text.name = spec.name;
  });
  const holds = text.fontName === run.figma.mixed ? undefined : text.fontName;
  if (holds?.family !== family || holds.style !== spec.fontStyle) {
    change(run.ledger, label, `font → ${family} ${spec.fontStyle}`, () => {
      text.fontName = fontName;
    });
  }
  if (spec.fontFamily.kind === "variable") {
    const variable = run.variables.variable(spec.fontFamily.variable);
    const bound = text.boundVariables?.fontFamily ?? [];
    if (bound.length === 0 || bound.some((alias) => alias.id !== variable.id)) {
      change(run.ledger, label, `fontFamily → ${spec.fontFamily.variable.name}`, () =>
        text.setBoundVariable("fontFamily", variable)
      );
    }
  }
  syncTextNumber(
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
  syncTextNumber(
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
  syncPaints(run, label, "text color", text.fills, spec.color, (paints) => {
    text.fills = paints;
  });
  syncScalar(run, label, "textAutoResize", text.textAutoResize, "WIDTH_AND_HEIGHT", () => {
    text.textAutoResize = "WIDTH_AND_HEIGHT";
  });

  if (spec.textProperty === undefined) {
    syncScalar(run, label, "characters", text.characters, spec.characters, () => {
      text.characters = spec.characters;
    });
    return;
  }
  const propertyId = propertyIds.get(spec.textProperty);
  if (propertyId === undefined) {
    return;
  }
  if (text.componentPropertyReferences?.characters !== propertyId) {
    change(run.ledger, label, `characters → the ${spec.textProperty} property`, () => {
      text.characters = spec.characters;
      text.componentPropertyReferences = { characters: propertyId };
    });
  }
}

function syncIcon(run: Run, icon: EllipseNode, label: string, spec: IconLayerSpec): void {
  syncScalar(run, label, "name", icon.name, spec.name, () => {
    icon.name = spec.name;
  });
  syncNumber(
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
  syncPaints(run, label, "fill", icon.fills, undefined, (paints) => {
    icon.fills = paints;
  });
  syncPaints(run, label, "stroke", icon.strokes, spec.color, (paints) => {
    icon.strokes = paints;
  });
  syncNumber(
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
  syncScalar(run, label, "strokeAlign", icon.strokeAlign, "INSIDE", () => {
    icon.strokeAlign = "INSIDE";
  });
}

const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";
const isEllipse = (node: BaseNode): node is EllipseNode => node.type === "ELLIPSE";

async function syncChild(
  run: Run,
  component: ComponentNode,
  label: string,
  spec: ChildLayerSpec,
  propertyIds: TextPropertyIds
): Promise<SceneNode | undefined> {
  const layerLabel = `${label} / ${spec.name}`;
  const accept = (node: BaseNode): node is TextNode | EllipseNode =>
    spec.kind === "text" ? isText(node) : isEllipse(node);
  const existing = findOwned(run.ledger, component.children, label, spec.key, spec.name, accept);
  if (existing === undefined) {
    const created = create(run.ledger, label, `create the ${spec.kind} layer ${spec.name}`, () => {
      const node = spec.kind === "text" ? run.figma.createText() : run.figma.createEllipse();
      component.appendChild(node);
      setKey(node, spec.key);
      node.name = spec.name;
      return node;
    });
    if (created === undefined) {
      return undefined;
    }
    const quiet: Run = { ...run, ledger: muted(run.ledger) };
    if (spec.kind === "text" && isText(created)) {
      await syncText(quiet, created, layerLabel, spec, propertyIds);
    } else if (spec.kind === "icon" && isEllipse(created)) {
      syncIcon(quiet, created, layerLabel, spec);
    }
    return created;
  }
  if (spec.kind === "text" && isText(existing)) {
    await syncText(run, existing, layerLabel, spec, propertyIds);
  } else if (spec.kind === "icon" && isEllipse(existing)) {
    syncIcon(run, existing, layerLabel, spec);
  }
  return existing;
}

/**
 * Bring a variant's child layers in line with the spec: create the missing ones, update the
 * rest, delete the kit's layers the spec dropped and restore the spec's order.
 *
 * @param run - The run.
 * @param component - The variant component.
 * @param label - The variant's label, for change lines.
 * @param specs - The child layers, in order.
 * @param propertyIds - The set's text properties.
 */
export async function syncChildren(
  run: Run,
  component: ComponentNode,
  label: string,
  specs: readonly ChildLayerSpec[],
  propertyIds: TextPropertyIds
): Promise<void> {
  const keep = new Set(specs.map((spec) => spec.key));
  for (const stale of staleOwned(component.children, keep)) {
    change(run.ledger, label, `delete the layer ${stale.name}`, () => stale.remove());
  }

  const owned: SceneNode[] = [];
  for (const spec of specs) {
    const node = await syncChild(run, component, label, spec, propertyIds);
    if (node !== undefined) {
      owned.push(node);
    }
  }

  for (const node of component.children) {
    if (keyOf(node) === "") {
      warn(run.ledger, label, `keeps the layer ${node.name}, which the kit does not own`);
    }
  }

  const order = component.children.filter((node) => owned.includes(node));
  if (order.some((node, index) => node !== owned[index])) {
    change(run.ledger, label, "reorder the layers", () => {
      owned.forEach((node, index) => component.insertChild(index, node));
    });
  }
}
