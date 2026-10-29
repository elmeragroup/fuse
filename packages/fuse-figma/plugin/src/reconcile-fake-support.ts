/**
 * The change lines and node readers the `reconcile.*.fake` suites share: what Plan lists after a
 * change to the Button set, the sets a run creates, and small readers of a fake file's layers.
 */
import { setsInBuildOrder } from "../../test/kit-inventory.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { kitFixture } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

export const DEFAULT_BUTTON = "variant=default, size=default, state=rest, icon=none";
export const LAY_OUT_BUTTONS = "Button: lay out 420 variants in 5 columns and 84 rows";
export const PLACE =
  "Button: place Button, Icon button and Confirm button in a row and stack 4 previews below them";

/** The change line of an instance that waits for Button's changes, at its label. */
export const waitsForButton = (label: string) => `${label} / button: plan again once Button's changes land`;

/**
 * What any change to the Button set makes Plan list for the sets that hold Button instances, in kit
 * order: the open Popover's trigger, the open Dropdown menu's trigger, Empty's two actions in each of its
 * 3 variants, Alert's action in each of its 10, the File upload dropzone's trigger in each of its 5,
 * Toolbar's three buttons in each of its 2, the Alert dialog popup's Cancel and action in each of its
 * 3 and the Dialog popup's two footer actions in each of its 2, whose open examples plan again after
 * their popups. Each
 * instance plans again once Button's changes land, and each set's grid, which reads the instances'
 * sizes, lays out again after them.
 */
export const AFTER_BUTTON = [
  // The open Popover sits on a page before Empty's.
  "Popover (open) / placement=below / button: plan again once Button's changes land",
  "Popover (open): lay out 1 variants in 1 columns and 1 rows",
  // The open Dropdown menu sits on a page after Popover's and before Empty's.
  "Dropdown menu (open) / placement=below / button: plan again once Button's changes land",
  "Dropdown menu (open): lay out 1 variants in 1 columns and 1 rows",
  ...["default", "outline", "outline-dashed"].flatMap((frame) => [
    waitsForButton(`Empty / variant=${frame} / empty-content`),
    waitsForButton(`Empty / variant=${frame} / empty-content`),
  ]),
  "Empty: lay out 3 variants in 3 columns and 1 rows",
  ...["default", "destructive", "warning", "success", "info"].flatMap((tone) =>
    ["off", "on"].map((described) =>
      waitsForButton(`Alert / variant=${tone}, described=${described} / item-actions`)
    )
  ),
  "Alert: lay out 10 variants in 2 columns and 5 rows",
  ...["rest", "hover", "focus", "drop-target", "disabled"].map((state) =>
    waitsForButton(`File upload dropzone / state=${state}`)
  ),
  "File upload dropzone: lay out 5 variants in 5 columns and 1 rows",
  ...["horizontal", "vertical"].flatMap((orientation) => [
    waitsForButton(`Toolbar / orientation=${orientation} / toolbar-group`),
    waitsForButton(`Toolbar / orientation=${orientation} / toolbar-group`),
    waitsForButton(`Toolbar / orientation=${orientation}`),
  ]),
  "Toolbar: lay out 2 variants in 2 columns and 1 rows",
  ...["destructive", "neutral", "pending"].flatMap((variant) => [
    waitsForButton(`Alert dialog content / variant=${variant} / dialog-footer`),
    waitsForButton(`Alert dialog content / variant=${variant} / dialog-footer`),
  ]),
  "Alert dialog content: lay out 3 variants in 3 columns and 1 rows",
  // The open example holds the popup, whose own Buttons wait, so it plans again after the popup.
  "Alert dialog (open) / placement=centered / dialog-content: plan again once Alert dialog content's changes land",
  "Alert dialog (open): lay out 1 variants in 1 columns and 1 rows",
  ...["basic", "footer-close"].flatMap((content) => [
    waitsForButton(`Dialog content / content=${content} / dialog-footer`),
    waitsForButton(`Dialog content / content=${content} / dialog-footer`),
  ]),
  "Dialog content: lay out 2 variants in 2 columns and 1 rows",
  "Dialog (open) / placement=centered / dialog-content: plan again once Dialog content's changes land",
  "Dialog (open): lay out 1 variants in 1 columns and 1 rows",
];

/** The pages of the sets that hold Button instances, which place their sets and previews again after them. */
export const PLACE_AFTER_BUTTON = [
  "Popover: place Popover content and Popover (open) in a row and stack 4 previews below them",
  "Dropdown menu: place Dropdown menu item, Dropdown menu checkbox item, Dropdown menu radio item, Dropdown menu sub trigger, Dropdown menu popup, Dropdown menu sub content and Dropdown menu (open) in a row and stack 4 previews below them",
  "Empty: place Empty in a row and stack 4 previews below them",
  "Alert: place Alert in a row and stack 4 previews below them",
  "File upload: place File upload dropzone in a row and stack 4 previews below them",
  "Toolbar: place Toolbar in a row and stack 4 previews below them",
  "Alert dialog: place Alert dialog content and Alert dialog (open) in a row and stack 4 previews below them",
  "Dialog: place Dialog content and Dialog (open) in a row and stack 4 previews below them",
];

/** The component sets a run creates, in the order the kit builds them. */
export const CREATE_SETS = setsInBuildOrder().map(
  ({ page, set }) => `${page.name}: create the component set ${set.name} with ${set.variants} variants`
);

/** The gray `ring` holds in Fjordkraft's internal private light theme, the file's default modes. */
export const RING_GRAY = 0.502;

export async function changes(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, (await kitFixture()).kit, false)).changes;
}

/**
 * Apply the kit and return its change lines. Plan and Apply run one planning pass, and Apply
 * reports the plan it performed (`reconcile.ts`), so the lines are what a Plan would list. The
 * Avatar suite and the duplicate-variant case keep a Plan of their own, for the writes it must
 * not make.
 */
export async function applies(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, (await kitFixture()).kit, true)).changes;
}

/** The modes a frame pins, as collection and mode names. */
export async function pinnedModes(
  file: FakeFigma,
  frame: FrameNode
): Promise<Record<string, string | undefined>> {
  const collectionsById = new Map(
    (await file.figma.variables.getLocalVariableCollectionsAsync()).map((collection) => [
      collection.id,
      collection,
    ])
  );
  return Object.fromEntries(
    Object.entries(frame.explicitVariableModes).map(([id, modeId]) => {
      const collection = collectionsById.get(id);
      return [
        collection?.name ?? id,
        collection?.modes.find((mode) => mode.modeId === modeId)?.name,
      ] as const;
    })
  );
}

export function variantNamed(set: ComponentSetNode, name: string): ComponentNode {
  const variant = set.children.find(
    (node): node is ComponentNode => node.type === "COMPONENT" && node.name === name
  );
  if (variant === undefined) {
    throw new Error(`${set.name} has no variant ${name}`);
  }
  return variant;
}

export function onlyShadow(node: ComponentNode, index = 0): DropShadowEffect {
  const effect = node.effects[index];
  if (effect?.type !== "DROP_SHADOW") {
    throw new Error(`${node.name} casts no drop shadow at ${index}`);
  }
  return effect;
}

export function onlySolid(paints: ReadonlyArray<Paint> | PluginAPI["mixed"], figma: PluginAPI): SolidPaint {
  if (paints === figma.mixed || paints.length !== 1) {
    throw new Error("the layer holds no single paint");
  }
  const [paint] = paints;
  if (paint?.type !== "SOLID") {
    throw new Error("the layer's paint is not solid");
  }
  return paint;
}

/** The text layers below a node, at any depth, in layer order. */
/** The texts of a node's own layers, down to its instances, whose texts are their main's, as the spec walks them. */
export function textsIn(node: BaseNode): TextNode[] {
  if (node.type === "TEXT") {
    return [node];
  }
  return "children" in node && node.type !== "INSTANCE" ? node.children.flatMap(textsIn) : [];
}

export function property(set: ComponentSetNode, name: string): ComponentPropertyDefinitions[string] {
  const found = Object.entries(set.componentPropertyDefinitions).find(
    ([id]) => id === name || id.startsWith(`${name}#`)
  );
  if (found === undefined) {
    throw new Error(`${set.name} has no property ${name}`);
  }
  return found[1];
}

/** The arrow's centre, and its parent's centre across and bottom edge, as the transform places them. */
export function arrowPlace(root: ComponentNode | InstanceNode) {
  const arrow = childNamed(root, "FRAME", "arrow");
  const radians = (arrow.rotation * Math.PI) / 180;
  const half = arrow.width / 2;
  const centre = {
    x: arrow.x + Math.cos(radians) * half + Math.sin(radians) * half,
    y: arrow.y - Math.sin(radians) * half + Math.cos(radians) * half,
  };
  return {
    rotation: arrow.rotation,
    constraints: arrow.constraints,
    positioning: arrow.layoutPositioning,
    fromCentre: Math.round((centre.x - root.width / 2) * 1000) / 1000,
    aboveBottom: Math.round((root.height - centre.y) * 1000) / 1000,
  };
}
