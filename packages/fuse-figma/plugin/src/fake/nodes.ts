/**
 * The node classes the fake exposes, from the document down to vectors, and the maker of their
 * public nodes, which `fake-figma.ts` gives the file for the modules below.
 */

import { guard } from "./guard.ts";
import {
  addProperty,
  defaultVariant,
  definitions,
  editProperty,
  exposedBelow,
  exposedOf,
  instanceOwner,
  linkProperties,
  nearestComponent,
  OVERRIDE_FIELDS,
  renameVariantValues,
  requirePropertyHolder,
  setProperties,
  shownComponent,
  shownProperties,
  swapTo,
  variantValues,
} from "./instances.ts";
import {
  absoluteBox,
  anchoredPlace,
  bindNodeField,
  bindTextField,
  constraintsOf,
  fills,
  lengthOn,
  mapPoint,
  measuredWidth,
  place,
  placesItself,
  readBackRotation,
  relativeTransform,
  rescale,
  resize,
  resizeWithConstraints,
  setLayoutMode,
  setLimit,
  setSizing,
  setStrokesIncludedInLayout,
  settled,
  sizingOn,
  turnOf,
} from "./layout.ts";
import { hiddenByProperty, markOverride, noteOverride, shown } from "./overrides.ts";
import { heldColorBindings, storeEffect, storePaint, writeFills, writeStrokeSide } from "./paints.ts";
import {
  componentKey,
  componentOf,
  f32,
  isAutoLayout,
  isTextField,
  live,
  MIXED,
  pageOf,
  sceneOf,
  shared,
  SHARED_DATA_SEPARATOR,
  sourceOf,
  stateOf,
  write,
} from "./state.ts";
import type { BindableField, CharacterStyle, Made, NodeState, NodeType, Sizing } from "./state.ts";
import {
  alignmentOf,
  bindTextRange,
  charactersOf,
  distinctFonts,
  heldFonts,
  requireFont,
  requireHeldFonts,
  requireRange,
  restyle,
  restyleWhole,
  segmentBindings,
  segmentKey,
  shownStyles,
  withFont,
  writeFont,
} from "./text.ts";
import {
  childrenOf,
  copyNode,
  detach,
  duplicate,
  insert,
  markRemoved,
  placeOnCurrentPage,
  sharedDataOf,
} from "./tree.ts";
import { alias, boundCollections, modeFor, nodeBindings } from "./variables.ts";

/** The members every node has. */
class FakeBaseNode {
  get id(): string {
    return stateOf(this).id;
  }

  get removed(): boolean {
    return stateOf(this).removed;
  }

  get name(): string {
    return live(this).name;
  }

  set name(value: string) {
    const state = live(this);
    write(state, "name");
    const set = state.parent?.type === "COMPONENT_SET" ? state.parent : undefined;
    const before = set === undefined ? undefined : variantValues(state.name);
    state.name = value;
    state.autoRename = false;
    markOverride(state, "name");
    if (set !== undefined && before !== undefined) {
      renameVariantValues(set, state, before, variantValues(value));
    }
  }

  /** Rules 36 and 48: a sublayer reads its main layer's entry, or a swapped one its new main's. */
  getSharedPluginData(namespace: string, key: string): string {
    return sharedDataOf(live(this), `${namespace}${SHARED_DATA_SEPARATOR}${key}`);
  }

  setSharedPluginData(namespace: string, key: string, value: string): void {
    const state = live(this);
    write(state, `shared plugin data ${namespace}/${key}`);
    const entry = `${namespace}${SHARED_DATA_SEPARATOR}${key}`;
    if (value === "") {
      state.sharedData.delete(entry);
    } else {
      state.sharedData.set(entry, value);
    }
  }
}

class FakeDocument extends FakeBaseNode {
  get type(): "DOCUMENT" {
    return "DOCUMENT";
  }

  get children(): ReadonlyArray<PageNode> {
    return live(this).children.map(pageOf);
  }
}

class FakePage extends FakeBaseNode {
  get type(): "PAGE" {
    return "PAGE";
  }

  get children(): ReadonlyArray<SceneNode> {
    return childrenOf(live(this)).map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }

  loadAsync(): Promise<void> {
    live(this).loaded = true;
    return Promise.resolve();
  }

  remove(): void {
    const state = live(this);
    if (state.file.current === state) {
      throw new Error(`Cannot remove ${state.id}, the current page.`);
    }
    if (state.parent?.children.length === 1) {
      throw new Error(`Cannot remove ${state.id}, the file's last page.`);
    }
    write(state, "remove");
    detach(state);
    markRemoved(state);
  }
}

/**
 * Pin a collection's mode on a node. The typings deprecate passing a collection id, which
 * throws under `"documentAccess": "dynamic-page"`, so the fake takes only a collection.
 */
function pinMode(state: NodeState, collection: VariableCollection, modeId: string): void {
  const found = state.file.collections.find((candidate) => candidate.id === collection.id);
  if (found === undefined || !found.modes.some((mode) => mode.modeId === modeId)) {
    throw new Error(`The file has no collection ${String(collection.id)} with a mode ${modeId}.`);
  }
  write(state, `pin ${found.name} to ${modeId}`);
  state.explicitModes.set(found.id, modeId);
}

/** The members every layer has. */
class FakeSceneNode extends FakeBaseNode {
  /**
   * The page or layer that holds the layer, as the typings name it, or null where none does. The
   * plugin reads it to find a hidden child's fill (rule 42).
   */
  get parent(): (BaseNode & ChildrenMixin) | null {
    const parent = live(this).parent?.exposed;
    return parent === undefined || parent.type === "DOCUMENT" || !("children" in parent) ? null : parent;
  }

  remove(): void {
    const state = live(this);
    if (state.mirrorOf !== undefined) {
      throw new Error(`Cannot remove ${state.id}, a layer inside an instance.`);
    }
    write(state, "remove");
    detach(state);
    markRemoved(state);
  }

  get x(): number {
    const state = live(this);
    return anchoredPlace(state, "HORIZONTAL") ?? state.x;
  }

  set x(value: number) {
    const state = live(this);
    // The typings: an auto layout frame places its children, and a write to their x is a no-op,
    // apart from an absolute child's (rule 24).
    if (placesItself(state)) {
      write(state, "x");
      markOverride(state, "x");
      place(state, "HORIZONTAL", f32(value));
    }
  }

  get y(): number {
    const state = live(this);
    return anchoredPlace(state, "VERTICAL") ?? state.y;
  }

  set y(value: number) {
    const state = live(this);
    if (placesItself(state)) {
      write(state, "y");
      markOverride(state, "y");
      place(state, "VERTICAL", f32(value));
    }
  }

  get rotation(): number {
    return live(this).rotation;
  }

  /**
   * Rule 26. A layer in an auto layout flow keeps its box in its slot, so its origin moves with the
   * turn and the box keeps its center. Any other layer turns about its top left, as the typings say.
   */
  set rotation(value: number) {
    const state = live(this);
    const rotation = readBackRotation(f32(value));
    if (!placesItself(state)) {
      const halfWidth = state.width / 2;
      const halfHeight = state.height / 2;
      const center = mapPoint(relativeTransform(state), halfWidth, halfHeight);
      const { cos, sin } = turnOf(rotation);
      state.x = f32(center.x - (cos * halfWidth + sin * halfHeight));
      state.y = f32(center.y - (cos * halfHeight - sin * halfWidth));
    }
    write(state, "rotation");
    state.rotation = rotation;
  }

  /**
   * Rule 25: false for a layer a BOOLEAN property hides, and true for every other layer, since no
   * probe wrote `visible`.
   */
  get visible(): boolean {
    return !hiddenByProperty(live(this));
  }

  get layoutPositioning(): FrameNode["layoutPositioning"] {
    return live(this).layoutPositioning;
  }

  /**
   * Rule 24. The typings take ABSOLUTE only on a child of an auto layout frame, and no probe turned
   * a filling layer absolute, so the fake throws for both.
   */
  set layoutPositioning(value: FrameNode["layoutPositioning"]) {
    const state = live(this);
    if (
      value === "ABSOLUTE" &&
      (!isAutoLayout(state.parent) || fills(state, "HORIZONTAL") || fills(state, "VERTICAL"))
    ) {
      throw new Error(
        `The fake Figma file does not model layoutPositioning ABSOLUTE on ${state.id}, which is no auto layout child or fills its parent.`
      );
    }
    write(state, "layoutPositioning");
    state.layoutPositioning = value;
    // An instance turned absolute lists `layoutPositioning` among its overrides (N11).
    if (value === "ABSOLUTE") {
      markOverride(state, "layoutPositioning");
    } else {
      state.overridden.delete("layoutPositioning");
    }
  }

  get width(): number {
    return lengthOn(settled(live(this)), "HORIZONTAL");
  }

  get height(): number {
    return lengthOn(settled(live(this)), "VERTICAL");
  }

  get absoluteBoundingBox(): Rect | null {
    return absoluteBox(live(this));
  }

  /** The fake draws no effects or strokes, so a layer's render bounds are its box. */
  get absoluteRenderBounds(): Rect | null {
    return absoluteBox(live(this));
  }

  /** A PNG export: bytes that name the layer and the scale, since the fake draws no pixels. */
  exportAsync(settings: ExportSettingsImage): Promise<Uint8Array> {
    const state = live(this);
    if (settings.format !== "PNG") {
      throw new Error(`The fake Figma file exports only PNG, not ${settings.format}.`);
    }
    const scale = settings.constraint?.type === "SCALE" ? settings.constraint.value : 1;
    return Promise.resolve(
      Uint8Array.from(Array.from(`${state.id}@${scale}x`), (char) => char.charCodeAt(0))
    );
  }

  resize(width: number, height: number): void {
    const state = live(this);
    resizeWithConstraints(state, width, height);
    write(state, "resize");
  }

  resizeWithoutConstraints(width: number, height: number): void {
    const state = live(this);
    resize(state, width, height);
    write(state, "resizeWithoutConstraints");
  }

  rescale(scale: number): void {
    const state = live(this);
    if (scale < 0.01) {
      throw new Error(`Cannot rescale ${state.id} by ${scale}: the scale must be at least 0.01.`);
    }
    write(state, "rescale");
    rescale(state, scale);
  }

  get opacity(): number {
    return live(this).opacity;
  }

  set opacity(value: number) {
    const state = live(this);
    write(state, "opacity");
    state.opacity = f32(value);
  }

  get constraints(): Constraints {
    return constraintsOf(live(this));
  }

  set constraints(value: Constraints) {
    const state = live(this);
    write(state, "constraints");
    markOverride(state, "constraints");
    const held = {
      HORIZONTAL: anchoredPlace(state, "HORIZONTAL") ?? state.x,
      VERTICAL: anchoredPlace(state, "VERTICAL") ?? state.y,
    };
    state.constraints = { ...value };
    place(state, "HORIZONTAL", held.HORIZONTAL);
    place(state, "VERTICAL", held.VERTICAL);
  }

  /** Rule 12: the fill along an auto layout parent's direction, which only the shorthand writes. */
  get layoutGrow(): number {
    return live(this).layoutGrow;
  }

  /** Rule 12: the stretch across an auto layout parent, which only the shorthand writes. */
  get layoutAlign(): "INHERIT" | "STRETCH" {
    return live(this).layoutAlign;
  }

  get layoutSizingHorizontal(): Sizing {
    return sizingOn(live(this), "HORIZONTAL");
  }

  set layoutSizingHorizontal(value: Sizing) {
    setSizing(live(this), "HORIZONTAL", value);
  }

  get layoutSizingVertical(): Sizing {
    return sizingOn(live(this), "VERTICAL");
  }

  set layoutSizingVertical(value: Sizing) {
    setSizing(live(this), "VERTICAL", value);
  }

  get minWidth(): number | null {
    return live(this).limits.minWidth;
  }

  set minWidth(value: number | null) {
    setLimit(live(this), "minWidth", value);
  }

  get maxWidth(): number | null {
    return live(this).limits.maxWidth;
  }

  set maxWidth(value: number | null) {
    setLimit(live(this), "maxWidth", value);
  }

  get minHeight(): number | null {
    return live(this).limits.minHeight;
  }

  set minHeight(value: number | null) {
    setLimit(live(this), "minHeight", value);
  }

  get maxHeight(): number | null {
    return live(this).limits.maxHeight;
  }

  set maxHeight(value: number | null) {
    setLimit(live(this), "maxHeight", value);
  }

  get boundVariables(): FrameNode["boundVariables"] {
    return nodeBindings(live(this));
  }

  setBoundVariable(field: BindableField, variable: Variable | null): void {
    const state = live(this);
    if (isTextField(field)) {
      throw new Error(`${state.id} is a ${state.type}, which has no ${field}.`);
    }
    if (field === "characters") {
      throw new Error(`${state.id} is a ${state.type}, which has no characters.`);
    }
    bindNodeField(state, field, variable);
  }

  get componentPropertyReferences(): FrameNode["componentPropertyReferences"] {
    const references = live(this).propertyReferences;
    return references === null ? null : { ...references };
  }

  set componentPropertyReferences(references: FrameNode["componentPropertyReferences"]) {
    linkProperties(live(this), references);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }

  /**
   * The mode the layer reads each collection in, pinned or inherited or the default (rule 8),
   * for the collections its subtree's bindings read (rule 11).
   */
  get resolvedVariableModes(): { [collectionId: string]: string } {
    const state = live(this);
    const bound = boundCollections(state);
    return Object.fromEntries(
      state.file.collections
        .filter((collection) => bound.has(collection.id))
        .map((collection) => [collection.id, modeFor(state, collection)])
    );
  }
}

/** The members of frames, components, component sets and instances. */
class FakeFrameLikeNode extends FakeSceneNode {
  /**
   * An instance lists every sublayer, and leaves out one a BOOLEAN property hides only while
   * `figma.skipInvisibleInstanceChildren` is set (rule 25).
   */
  get children(): ReadonlyArray<SceneNode> {
    const state = live(this);
    const skipped = (child: NodeState): boolean =>
      state.file.skipInvisibleInstanceChildren && child.mirrorOf !== undefined && hiddenByProperty(child);
    return childrenOf(state)
      .filter((child) => !skipped(child))
      .map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  get strokes(): ReadonlyArray<Paint> {
    return shown(live(this), "strokes");
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map((paint) => storePaint(state.file, paint));
    noteOverride(state, "strokes");
  }

  get strokeWeight(): number | PluginAPI["mixed"] {
    const { top, right, bottom, left } = live(this).strokeWeights;
    return top === right && right === bottom && bottom === left ? top : MIXED;
  }

  set strokeWeight(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a stroke weight.");
    }
    write(state, "strokeWeight");
    const weight = f32(value);
    state.strokeWeights = { top: weight, right: weight, bottom: weight, left: weight };
    state.strokeWeightWritten = true;
  }

  get strokeTopWeight(): number {
    return live(this).strokeWeights.top;
  }

  set strokeTopWeight(value: number) {
    const state = live(this);
    write(state, "strokeTopWeight");
    writeStrokeSide(state, "top", value);
  }

  get strokeRightWeight(): number {
    return live(this).strokeWeights.right;
  }

  set strokeRightWeight(value: number) {
    const state = live(this);
    write(state, "strokeRightWeight");
    writeStrokeSide(state, "right", value);
  }

  get strokeBottomWeight(): number {
    return live(this).strokeWeights.bottom;
  }

  set strokeBottomWeight(value: number) {
    const state = live(this);
    write(state, "strokeBottomWeight");
    writeStrokeSide(state, "bottom", value);
  }

  get strokeLeftWeight(): number {
    return live(this).strokeWeights.left;
  }

  set strokeLeftWeight(value: number) {
    const state = live(this);
    write(state, "strokeLeftWeight");
    writeStrokeSide(state, "left", value);
  }

  get strokeAlign(): FrameNode["strokeAlign"] {
    return live(this).strokeAlign;
  }

  set strokeAlign(value: FrameNode["strokeAlign"]) {
    const state = live(this);
    write(state, "strokeAlign");
    state.strokeAlign = value;
  }

  get strokesIncludedInLayout(): boolean {
    return live(this).strokesIncludedInLayout;
  }

  set strokesIncludedInLayout(value: boolean) {
    setStrokesIncludedInLayout(live(this), value);
  }

  get dashPattern(): ReadonlyArray<number> {
    return live(this).dashPattern;
  }

  set dashPattern(lengths: ReadonlyArray<number>) {
    const state = live(this);
    write(state, "dashPattern");
    state.dashPattern = lengths.map((length) => f32(length));
  }

  get effects(): ReadonlyArray<Effect> {
    return shown(live(this), "effects");
  }

  /** Rule 2: a new color binding stores the variable's value, a held one keeps the color written. */
  set effects(effects: ReadonlyArray<Effect>) {
    const state = live(this);
    write(state, "effects");
    const held = heldColorBindings(shown(state, "effects"));
    state.effects = effects.map((effect) => storeEffect(state, effect, held));
    noteOverride(state, "effects");
  }

  get cornerRadius(): number | PluginAPI["mixed"] {
    const { topLeft, topRight, bottomRight, bottomLeft } = shown(live(this), "radii");
    return topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft ? topLeft : MIXED;
  }

  set cornerRadius(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a corner radius.");
    }
    write(state, "cornerRadius");
    const radius = f32(value);
    state.radii = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
    noteOverride(state, "radii");
  }

  get topLeftRadius(): number {
    return shown(live(this), "radii").topLeft;
  }

  get topRightRadius(): number {
    return shown(live(this), "radii").topRight;
  }

  get bottomRightRadius(): number {
    return shown(live(this), "radii").bottomRight;
  }

  get bottomLeftRadius(): number {
    return shown(live(this), "radii").bottomLeft;
  }

  get clipsContent(): boolean {
    return live(this).clipsContent;
  }

  set clipsContent(value: boolean) {
    const state = live(this);
    write(state, "clipsContent");
    state.clipsContent = value;
  }

  get itemReverseZIndex(): boolean {
    return live(this).itemReverseZIndex;
  }

  set itemReverseZIndex(value: boolean) {
    const state = live(this);
    if (value && state.layoutMode !== "VERTICAL") {
      throw new Error(
        `The fake Figma file models itemReverseZIndex only on a vertical auto layout (PZ2), and ${state.id} is ${state.layoutMode === "NONE" ? "no auto layout" : "a horizontal one"}.`
      );
    }
    write(state, "itemReverseZIndex");
    state.itemReverseZIndex = value;
  }

  get layoutMode(): FrameNode["layoutMode"] {
    return live(this).layoutMode;
  }

  set layoutMode(value: FrameNode["layoutMode"]) {
    setLayoutMode(live(this), value);
  }

  get layoutWrap(): FrameNode["layoutWrap"] {
    return live(this).layoutWrap;
  }

  set layoutWrap(value: FrameNode["layoutWrap"]) {
    const state = live(this);
    if (state.layoutMode !== "HORIZONTAL" && state.layoutMode !== "VERTICAL") {
      throw new Error(
        `layoutWrap needs a horizontal or vertical auto layout, and ${state.id} has ${state.layoutMode}.`
      );
    }
    write(state, "layoutWrap");
    state.layoutWrap = value;
  }

  get primaryAxisSizingMode(): FrameNode["primaryAxisSizingMode"] {
    return live(this).primaryAxisSizingMode;
  }

  set primaryAxisSizingMode(value: FrameNode["primaryAxisSizingMode"]) {
    const state = live(this);
    write(state, "primaryAxisSizingMode");
    state.primaryAxisSizingMode = value;
  }

  get counterAxisSizingMode(): FrameNode["counterAxisSizingMode"] {
    return live(this).counterAxisSizingMode;
  }

  set counterAxisSizingMode(value: FrameNode["counterAxisSizingMode"]) {
    const state = live(this);
    write(state, "counterAxisSizingMode");
    state.counterAxisSizingMode = value;
  }

  get primaryAxisAlignItems(): FrameNode["primaryAxisAlignItems"] {
    return live(this).primaryAxisAlignItems;
  }

  set primaryAxisAlignItems(value: FrameNode["primaryAxisAlignItems"]) {
    const state = live(this);
    write(state, "primaryAxisAlignItems");
    state.primaryAxisAlignItems = value;
  }

  get counterAxisAlignItems(): FrameNode["counterAxisAlignItems"] {
    return live(this).counterAxisAlignItems;
  }

  /** Rule 17: no STRETCH, and BASELINE only in a row. */
  set counterAxisAlignItems(value: FrameNode["counterAxisAlignItems"]) {
    const state = live(this);
    // The typings leave STRETCH out of the type, so only a cast reaches this check.
    if (!["MIN", "CENTER", "MAX", "BASELINE"].includes(value)) {
      throw new Error(
        `counterAxisAlignItems takes no ${value}. Stretch a child with layoutSizing* FILL instead.`
      );
    }
    if (value === "BASELINE" && state.layoutMode !== "HORIZONTAL") {
      throw new Error(
        `BASELINE can only be set on horizontal auto-layout frames, and ${state.id} has ${state.layoutMode}.`
      );
    }
    write(state, "counterAxisAlignItems");
    state.counterAxisAlignItems = value;
  }

  get paddingTop(): number {
    return live(this).padding.top;
  }

  set paddingTop(value: number) {
    const state = live(this);
    write(state, "paddingTop");
    state.padding.top = f32(value);
  }

  get paddingRight(): number {
    return live(this).padding.right;
  }

  set paddingRight(value: number) {
    const state = live(this);
    write(state, "paddingRight");
    state.padding.right = f32(value);
  }

  get paddingBottom(): number {
    return live(this).padding.bottom;
  }

  set paddingBottom(value: number) {
    const state = live(this);
    write(state, "paddingBottom");
    state.padding.bottom = f32(value);
  }

  get paddingLeft(): number {
    return live(this).padding.left;
  }

  set paddingLeft(value: number) {
    const state = live(this);
    write(state, "paddingLeft");
    state.padding.left = f32(value);
  }

  get itemSpacing(): number {
    return live(this).itemSpacing;
  }

  set itemSpacing(value: number) {
    const state = live(this);
    write(state, "itemSpacing");
    state.itemSpacing = f32(value);
  }

  get counterAxisSpacing(): number | null {
    return live(this).counterAxisSpacing;
  }

  set counterAxisSpacing(value: number | null) {
    const state = live(this);
    write(state, "counterAxisSpacing");
    state.counterAxisSpacing = value === null ? null : f32(value);
  }
}

class FakeFrame extends FakeFrameLikeNode {
  get type(): "FRAME" {
    return "FRAME";
  }
}

class FakeComponent extends FakeFrameLikeNode {
  get type(): "COMPONENT" {
    return "COMPONENT";
  }

  get key(): string {
    return componentKey(live(this));
  }

  createInstance(): InstanceNode {
    const main = live(this);
    const instance = copyNode(main.file, main, "INSTANCE");
    instance.main = main;
    instance.bindings.clear();
    instance.propertyReferences = null;
    placeOnCurrentPage(main.file, instance);
    write(instance, `create an instance of ${main.id}`);
    const node = instance.exposed;
    if (node.type !== "INSTANCE") {
      throw new Error(`${instance.id} is a ${node.type}, not an instance.`);
    }
    return node;
  }

  clone(): ComponentNode {
    const state = live(this);
    const copy = duplicate(state.file, state);
    placeOnCurrentPage(state.file, copy);
    write(copy, `duplicate ${state.id}`);
    return componentOf(copy);
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    const state = live(this);
    requirePropertyHolder(state);
    return definitions(state);
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeComponentSet extends FakeFrameLikeNode {
  get type(): "COMPONENT_SET" {
    return "COMPONENT_SET";
  }

  get defaultVariant(): ComponentNode {
    return componentOf(defaultVariant(live(this)));
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    return definitions(live(this));
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentSetNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeInstance extends FakeFrameLikeNode {
  get type(): "INSTANCE" {
    return "INSTANCE";
  }

  get mainComponent(): ComponentNode | null {
    throw new Error(
      'An instance\'s mainComponent is write-only under "documentAccess": "dynamic-page". Use getMainComponentAsync.'
    );
  }

  /** Rule 48: a sublayer shows its main layer's component until it swaps apart. */
  getMainComponentAsync(): Promise<ComponentNode | null> {
    const main = shownComponent(live(this));
    return Promise.resolve(main === undefined ? null : componentOf(main));
  }

  /** Rule 35: the instance keeps its node and its property values. */
  swapComponent(componentNode: ComponentNode): void {
    const state = live(this);
    const main = live(componentNode);
    if (main.type !== "COMPONENT") {
      throw new Error(`An instance swaps only to a component, and ${main.id} is a ${main.type}.`);
    }
    write(state, `swap to ${main.id}`);
    swapTo(state, main);
  }

  /**
   * Rules 25 and 34: the variant values the main component's name holds, then each property of its
   * set or component at the value the instance sets, or else at its default.
   */
  get componentProperties(): ComponentProperties {
    const state = live(this);
    const { main, owner } = instanceOwner(state);
    const properties: ComponentProperties = {};
    if (owner !== main) {
      for (const [name, value] of variantValues(main.name) ?? []) {
        properties[name] = { type: "VARIANT", value };
      }
    }
    for (const [id, { type, value }] of shownProperties(state)) {
      properties[id] = { type, value };
    }
    return properties;
  }

  /** Rules 25 and 34. */
  setProperties(properties: { [propertyName: string]: string | boolean | VariableAlias }): void {
    setProperties(live(this), properties);
  }

  /** Rule 39: an instance reads its own mark, or the one its main layer carries. */
  get isExposedInstance(): boolean {
    return exposedOf(live(this));
  }

  set isExposedInstance(value: boolean) {
    const state = live(this);
    const component = nearestComponent(state);
    if (state.mirrorOf !== undefined || component?.parent?.type !== "COMPONENT_SET") {
      throw new Error(
        `The fake Figma file writes isExposedInstance only on an instance inside a component in a set (N5), and ${state.id} is none.`
      );
    }
    write(state, "isExposedInstance");
    state.exposedInstance = value;
  }

  /** Rule 39: the instances below this one that their main layers expose. */
  get exposedInstances(): InstanceNode[] {
    return exposedBelow(live(this)).map((state) => {
      const node = state.exposed;
      if (node.type !== "INSTANCE") {
        throw new Error(`${state.id} is a ${node.type}, not an instance.`);
      }
      return node;
    });
  }

  /** Rule 37: each layer with an override, from the instance down, and its overridden fields. */
  get overrides(): { id: string; overriddenFields: NodeChangeProperty[] }[] {
    const entries: { id: string; overriddenFields: NodeChangeProperty[] }[] = [];
    const visit = (state: NodeState): void => {
      const fields = [...state.overridden].flatMap((field) => OVERRIDE_FIELDS.get(field) ?? []);
      if (fields.length > 0) {
        entries.push({ id: state.id, overriddenFields: fields });
      }
      for (const child of childrenOf(state)) {
        visit(child);
      }
    };
    visit(live(this));
    return entries;
  }

  /**
   * Rule 37: the typings' "removes all direct overrides", which keeps the property values. An instance
   * its modes hold keeps its lengths, listed, as `resetOverrides()` kept one in G13 (rule 56).
   */
  removeOverrides(): void {
    const state = live(this);
    write(state, "remove overrides");
    const clear = (layer: NodeState): void => {
      const source = sourceOf(layer);
      if (layer.overridden.has("name") && source !== undefined) {
        layer.name = source.name;
      }
      if (layer.overridden.has("boundVariables")) {
        layer.unboundLengths.clear();
      }
      const kept: ReadonlySet<string> = layer.heldByModes ? new Set(["width", "height"]) : new Set();
      for (const field of OVERRIDE_FIELDS.keys()) {
        if (!kept.has(field)) {
          layer.overridden.delete(field);
        }
      }
      for (const child of childrenOf(layer)) {
        clear(child);
      }
    };
    clear(state);
  }
}

class FakeText extends FakeSceneNode {
  get type(): "TEXT" {
    return "TEXT";
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  /** Rule 34: a sublayer shows the TEXT property value its instance sets. */
  get characters(): string {
    return charactersOf(live(this));
  }

  /** New characters take the style of the first character (rule 10). */
  set characters(value: string) {
    const state = live(this);
    requireHeldFonts(state, "characters");
    write(state, "characters");
    markOverride(state, "characters");
    const [first] = state.styles;
    if (first === undefined) {
      throw new Error(`${state.id} holds no character style.`);
    }
    state.characters = value;
    state.styles = Array.from({ length: Math.max(1, value.length) }, () => first);
    if (state.autoRename) {
      state.name = value;
    }
    // A text that hugs its characters takes their width, and an empty one is 0 wide (rule 31).
    if (state.textAutoResize === "WIDTH_AND_HEIGHT") {
      state.width = measuredWidth(value, first.fontSize);
    }
  }

  get fontName(): FontName | PluginAPI["mixed"] {
    const [font, ...others] = heldFonts(live(this));
    return font === undefined || others.length > 0 ? MIXED : font;
  }

  set fontName(font: FontName | PluginAPI["mixed"]) {
    const state = live(this);
    if (font === MIXED) {
      throw new Error("Cannot write figma.mixed as a font.");
    }
    writeFont(state, 0, state.styles.length, font, "fontName");
    state.baseStyle = withFont(state.baseStyle, font);
  }

  get fontSize(): number | PluginAPI["mixed"] {
    return shared(live(this), (style) => style.fontSize);
  }

  set fontSize(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a font size.");
    }
    requireHeldFonts(state, "fontSize");
    write(state, "fontSize");
    const fontSize = f32(value);
    restyleWhole(state, (style) => ({ ...style, fontSize }));
  }

  get lineHeight(): LineHeight | PluginAPI["mixed"] {
    return shared(live(this), (style) => style.lineHeight);
  }

  set lineHeight(value: LineHeight | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a line height.");
    }
    requireHeldFonts(state, "lineHeight");
    write(state, "lineHeight");
    const lineHeight: LineHeight =
      value.unit === "AUTO" ? { unit: "AUTO" } : { unit: value.unit, value: f32(value.value) };
    restyleWhole(state, (style) => ({ ...style, lineHeight }));
  }

  get letterSpacing(): LetterSpacing | PluginAPI["mixed"] {
    return live(this).letterSpacing;
  }

  set letterSpacing(value: LetterSpacing | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a letter spacing.");
    }
    requireHeldFonts(state, "letterSpacing");
    write(state, "letterSpacing");
    state.letterSpacing = { unit: value.unit, value: f32(value.value) };
  }

  get textDecoration(): TextDecoration | PluginAPI["mixed"] {
    return live(this).textDecoration;
  }

  set textDecoration(value: TextDecoration | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a text decoration.");
    }
    requireHeldFonts(state, "textDecoration");
    write(state, "textDecoration");
    state.textDecoration = value;
    state.textDecorationOffset =
      value === "UNDERLINE" ? (state.textDecorationOffset ?? { unit: "AUTO" }) : null;
  }

  /** Figma holds an underline offset only while the layer is underlined. */
  get textDecorationOffset(): TextDecorationOffset | PluginAPI["mixed"] | null {
    return live(this).textDecorationOffset;
  }

  set textDecorationOffset(value: TextDecorationOffset | PluginAPI["mixed"] | null) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as an underline offset.");
    }
    requireHeldFonts(state, "textDecorationOffset");
    write(state, "textDecorationOffset");
    if (state.textDecoration === "UNDERLINE") {
      state.textDecorationOffset = value;
    }
  }

  get textAutoResize(): TextNode["textAutoResize"] {
    return live(this).textAutoResize;
  }

  /** A filling text keeps a fixed width and an auto height when asked to hug its characters (rule 19). */
  set textAutoResize(value: TextNode["textAutoResize"]) {
    const state = live(this);
    requireHeldFonts(state, "textAutoResize");
    write(state, "textAutoResize");
    if (value !== "WIDTH_AND_HEIGHT" || !fills(state, "HORIZONTAL")) {
      state.textAutoResize = value;
    }
  }

  /** A sublayer of an instance shows its main layer's alignment until it overrides it (rule 41). */
  get textAlignHorizontal(): TextNode["textAlignHorizontal"] {
    return alignmentOf(live(this));
  }

  /** On an instance's sublayer the write is an override, even one equal to the main's (rule 41). */
  set textAlignHorizontal(value: TextNode["textAlignHorizontal"]) {
    const state = live(this);
    requireHeldFonts(state, "textAlignHorizontal");
    write(state, "textAlignHorizontal");
    markOverride(state, "textAlignHorizontal");
    state.textAlignHorizontal = value;
  }

  get textAlignVertical(): TextNode["textAlignVertical"] {
    return live(this).textAlignVertical;
  }

  set textAlignVertical(value: TextNode["textAlignVertical"]) {
    const state = live(this);
    requireHeldFonts(state, "textAlignVertical");
    write(state, "textAlignVertical");
    state.textAlignVertical = value;
  }

  get textTruncation(): TextNode["textTruncation"] {
    return live(this).textTruncation;
  }

  /** Truncating starts at one line where no maximum is set, and stopping drops the maximum (rule 20). */
  set textTruncation(value: TextNode["textTruncation"]) {
    const state = live(this);
    requireHeldFonts(state, "textTruncation");
    write(state, "textTruncation");
    state.textTruncation = value;
    state.maxLines = value === "DISABLED" ? null : (state.maxLines ?? 1);
  }

  get maxLines(): number | null {
    return live(this).maxLines;
  }

  /** A maximum written while the text does not truncate changes nothing (rule 20). */
  set maxLines(value: number | null) {
    const state = live(this);
    requireHeldFonts(state, "maxLines");
    if (value !== null && !(value >= 1)) {
      throw new Error(`maxLines must be at least 1, and ${value} is not.`);
    }
    write(state, "maxLines");
    if (state.textTruncation === "ENDING") {
      state.maxLines = value;
    }
  }

  getRangeAllFontNames(start: number, end: number): FontName[] {
    const state = live(this);
    requireRange(state, start, end);
    return distinctFonts(shownStyles(state).slice(start, end));
  }

  /**
   * The new font needs loading, as for `fontName` (rule 7), and the range keeps its family binding
   * only where its family stays (rule 50). On a sublayer it marks no override (rule 53), and it
   * leaves the base style (rule 51).
   */
  setRangeFontName(start: number, end: number, font: FontName): void {
    const state = live(this);
    requireRange(state, start, end);
    writeFont(state, start, end, font, `fontName ${start}-${end}`);
  }

  /**
   * The range's fonts need loading, as for `fontSize` (rule 7). The write leaves the base style
   * (rules 51 and 55).
   */
  setRangeFontSize(start: number, end: number, value: number): void {
    const state = live(this);
    requireRange(state, start, end);
    for (const font of distinctFonts(state.styles.slice(start, end))) {
      requireFont(state, font, `fontSize ${start}-${end}`);
    }
    write(state, `fontSize ${start}-${end}`);
    const fontSize = f32(value);
    restyle(state, start, end, (style) => ({ ...style, fontSize }));
  }

  /** The runs of characters whose `fontName`, `fontSize` and `boundVariables` agree (rule 50). */
  getStyledTextSegments(
    fields: readonly (keyof Omit<StyledTextSegment, "characters" | "start" | "end">)[],
    start?: number,
    end?: number
  ): Pick<StyledTextSegment, "characters" | "start" | "end" | "fontName" | "fontSize" | "boundVariables">[] {
    const state = live(this);
    const unmodelled = fields.filter(
      (field) => field !== "fontName" && field !== "fontSize" && field !== "boundVariables"
    );
    if (unmodelled.length > 0) {
      throw new Error(`The fake Figma file does not model the segment fields ${unmodelled.join(", ")}.`);
    }
    const characters = charactersOf(state);
    const from = start ?? 0;
    const to = end ?? characters.length;
    if (from === to) {
      return [];
    }
    requireRange(state, from, to);
    const styles = shownStyles(state);
    const segments: { readonly start: number; end: number; readonly style: CharacterStyle }[] = [];
    for (let index = from; index < to; index += 1) {
      const style = styles[index];
      if (style === undefined) {
        throw new Error(`${state.id} holds no style for its character ${index}.`);
      }
      const last = segments.at(-1);
      if (last !== undefined && segmentKey(last.style, fields) === segmentKey(style, fields)) {
        last.end = index + 1;
      } else {
        segments.push({ start: index, end: index + 1, style });
      }
    }
    // Each segment holds the three modelled fields, the ones asked for among them.
    return segments.map((segment) => ({
      characters: characters.slice(segment.start, segment.end),
      start: segment.start,
      end: segment.end,
      fontName: { ...segment.style.font },
      fontSize: segment.style.fontSize,
      boundVariables: segmentBindings(segment.style),
    }));
  }

  getRangeBoundVariable(
    start: number,
    end: number,
    field: VariableBindableTextField
  ): VariableAlias | null | PluginAPI["mixed"] {
    const state = live(this);
    requireRange(state, start, end);
    const ids = new Set(state.styles.slice(start, end).map((style) => style.bindings.get(field)));
    const [id, ...others] = ids;
    if (others.length > 0) {
      return MIXED;
    }
    return id === undefined ? null : alias(id);
  }

  setRangeBoundVariable(
    start: number,
    end: number,
    field: VariableBindableTextField,
    variable: Variable | null
  ): void {
    const state = live(this);
    requireRange(state, start, end);
    bindTextRange(state, start, end, field, variable);
  }

  override setBoundVariable(field: BindableField, variable: Variable | null): void {
    bindTextField(live(this), field, variable);
  }
}

class FakeVector extends FakeSceneNode {
  get type(): "VECTOR" {
    return "VECTOR";
  }

  /** A sublayer of an instance shows its main layer's fills until they are overridden (rule 38). */
  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  get strokes(): ReadonlyArray<Paint> {
    return shown(live(this), "strokes");
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map((paint) => storePaint(state.file, paint));
    noteOverride(state, "strokes");
  }
}

/** The public node for a node type, behind the guard. */
export function makeNode(type: NodeType): Made {
  switch (type) {
    case "DOCUMENT": {
      const target = new FakeDocument();
      // SAFETY: FakeDocument models DocumentNode's members with their types, and the guard
      // throws for every other member.
      return { target, exposed: guard(target, "DocumentNode") as DocumentNode };
    }
    case "PAGE": {
      const target = new FakePage();
      // SAFETY: as above, for PageNode.
      return { target, exposed: guard(target, "PageNode") as PageNode };
    }
    case "FRAME": {
      const target = new FakeFrame();
      // SAFETY: as above, for FrameNode.
      return { target, exposed: guard(target, "FrameNode") as FrameNode };
    }
    case "COMPONENT": {
      const target = new FakeComponent();
      // SAFETY: as above, for ComponentNode.
      return { target, exposed: guard(target, "ComponentNode") as ComponentNode };
    }
    case "COMPONENT_SET": {
      const target = new FakeComponentSet();
      // SAFETY: as above, for ComponentSetNode.
      return { target, exposed: guard(target, "ComponentSetNode") as ComponentSetNode };
    }
    case "INSTANCE": {
      const target = new FakeInstance();
      // SAFETY: as above, for InstanceNode.
      return { target, exposed: guard(target, "InstanceNode") as InstanceNode };
    }
    case "TEXT": {
      const target = new FakeText();
      // SAFETY: as above, for TextNode.
      return { target, exposed: guard(target, "TextNode") as TextNode };
    }
    case "VECTOR": {
      const target = new FakeVector();
      // SAFETY: as above, for VectorNode.
      return { target, exposed: guard(target, "VectorNode") as VectorNode };
    }
  }
}
