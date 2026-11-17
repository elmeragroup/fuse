/**
 * The nodes that document a component page, and the page's layout. A page reads as the Obra kit's
 * pages do: a title, each component set with its name above it, a header above each column naming its
 * value on the column axis and a header beside each row naming its values on the other axes, then the
 * section header `Examples` over a usage example, and the theme previews below.
 *
 * The docs sit beside the sets, never inside them, so no variant, property or layer of a set
 * changes. Each is a keyed top-level node of its page, which the page plan keeps, and none carries
 * the `preview/` key the snapshot export reads.
 */

import { Effect } from "effect";

import { columnAxisOf, gridCell } from "../../src/components/kit-check.ts";
import { axisValues } from "../../src/components/kit-spec.ts";
import type {
  ComponentSetSpec,
  DocTextSpec,
  PageDocsSpec,
  PageExampleSpec,
  SetLabelsSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { gridLayout } from "./component-set.ts";
import type { PlannedSet } from "./component-set.ts";
import { near, planPaints, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { heldFonts, requireFont } from "./fonts.ts";
import { keyOf, placeOwned, planOwnedChildren } from "./identity.ts";
import type { OwnedChild } from "./identity.ts";
import type { PlannedPage } from "./pages.ts";
import { change, changeWith, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planGroupFields } from "./previews.ts";
import { currentRun } from "./services.ts";
import { settleInstances } from "./settle.ts";
import type { PlannedTextStyle } from "./text-styles.ts";

/** The space between component sets, between the sets and the example, and above the previews. */
const SET_SPACING = 64;
const SECTION_SPACING = 64;
const PREVIEW_SPACING = 32;

/** The space below a page's title and below a section header. */
const TITLE_GAP = 32;
const HEADER_GAP = 16;

/** The space between a set's name and its column headers, and between the headers and the grid. */
const LABEL_GAP = 8;

/** The font `createText` gives a new text, which linking a style needs loaded. */
const NEW_TEXT_FONT: FontName = { family: "Inter", style: "Regular" };

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";

/** A text a doc node shows: its key, its layer name, its characters and the style it links. */
type DocText = {
  readonly key: string;
  readonly name: string;
  readonly characters: string;
  readonly style: string;
};

/** The key of a set's name among its labels. */
const NAME_KEY = "name";

/** The key of a column header among a set's labels. */
const columnKey = (value: string): string => `column/${value}`;

/** The key of a row header among a set's labels. */
const rowKey = (row: number): string => `row/${String(row)}`;

/**
 * The texts of a set's labels: its name, a header for each value of its column axis, and a header for
 * each row that holds a variant, which names the row's values on the other axes. A set whose only
 * axis is its column axis has no row headers.
 */
function labelTexts(set: ComponentSetSpec, spec: SetLabelsSpec): readonly DocText[] {
  const columnAxis = columnAxisOf(set);
  const others = set.axes.filter((axis) => axis !== columnAxis);
  const rows = new Map<number, string>();
  for (const variant of set.variants) {
    const { row } = gridCell(set, variant);
    if (!rows.has(row)) {
      rows.set(row, others.map((axis) => variant.properties[axis.name] ?? "").join(" · "));
    }
  }
  return [
    { key: NAME_KEY, name: "Header", characters: set.name, style: spec.nameStyle },
    ...axisValues(set, columnAxis.name).map((value): DocText => ({
      key: columnKey(value),
      name: value,
      characters: value,
      style: spec.axisStyle,
    })),
    ...(others.length === 0
      ? []
      : [...rows].map(([row, characters]): DocText => ({
          key: rowKey(row),
          name: characters,
          characters,
          style: spec.axisStyle,
        }))),
  ];
}

/** The planned style a doc text links. */
function styleOf(styles: ReadonlyMap<string, PlannedTextStyle>, key: string): PlannedTextStyle {
  const style = styles.get(key);
  if (style === undefined) {
    throw new Error(`A doc text links the text style ${key}, which the kit does not plan.`);
  }
  return style;
}

/**
 * Require the fonts a doc text's writes need: every font the layer holds, a new layer's
 * `createText` font, and the style's, which linking it gives every character. A text write needs every font the
 * layer holds and a style link the style's (`fake/styles.ts` rule 60).
 */
function requireTextFonts(
  run: Run,
  label: string,
  style: PlannedTextStyle,
  text: TextNode | undefined
): void {
  requireFont(run, label, style.font);
  for (const font of text === undefined ? [NEW_TEXT_FONT] : heldFonts(run, text)) {
    requireFont(run, label, font);
  }
}

/**
 * Plan a doc text: link its style, then write its characters, which take the style's font. A text
 * found linked to its style, and holding its characters, plans nothing.
 */
function planDocText(
  run: Run,
  text: TextNode,
  origin: "found" | "new",
  label: string,
  spec: DocText,
  style: PlannedTextStyle
): void {
  const linked =
    origin === "found" && style.style.existing !== undefined && text.textStyleId === style.style.existing.id;
  if (!linked) {
    changeWith(
      run.plan,
      label,
      `text style → ${spec.style}`,
      Effect.promise(() => text.setTextStyleIdAsync(style.style.get().id))
    );
  }
  if (origin === "new" || text.characters !== spec.characters) {
    change(run.plan, label, `characters → ${JSON.stringify(spec.characters)}`, () => {
      text.characters = spec.characters;
    });
  }
}

/**
 * A frame that only holds what sits in it, each layer where the page layout puts it: no auto
 * layout, which would place the layers itself, no fill and no clip.
 */
function planBareFrame(run: Run, frame: FrameNode, label: string, name: string): void {
  planScalar(run, label, "name", frame.name, name, () => {
    frame.name = name;
  });
  planScalar(run, label, "layoutMode", frame.layoutMode, "NONE", () => {
    frame.layoutMode = "NONE";
  });
  planScalar(run, label, "clipsContent", frame.clipsContent, false, () => {
    frame.clipsContent = false;
  });
  planPaints(run, label, "fill", frame.fills, undefined, (paints) => {
    frame.fills = paints;
  });
}

/** Plan a page-level text, such as the title or the `Examples` header. */
const planTopText = Effect.fnUntraced(function* (
  page: PlannedPage,
  spec: DocTextSpec,
  styles: ReadonlyMap<string, PlannedTextStyle>
) {
  const run = yield* currentRun;
  const label = `${page.spec.name} / ${spec.text}`;
  const style = styleOf(styles, spec.style);
  const text: DocText = { key: spec.key, name: spec.name, characters: spec.text, style: spec.style };
  const found = yield* page.find(spec.key, spec.name, isText);
  requireTextFonts(run, label, style, found);
  if (found !== undefined) {
    planDocText(run, found, "found", label, text, style);
    return existing(found);
  }
  return yield* create(
    page.spec.name,
    `create the text ${spec.text}`,
    () => placeOwned(page.node.get(), run.figma.createText(), spec.key, spec.name),
    (made) =>
      Effect.gen(function* () {
        planDocText(yield* currentRun, made, "new", label, text, style);
      })
  );
});

/** Plan a set's labels frame and its texts. */
const planLabels = Effect.fnUntraced(function* (
  page: PlannedPage,
  spec: SetLabelsSpec,
  set: PlannedSet,
  styles: ReadonlyMap<string, PlannedTextStyle>
) {
  const run = yield* currentRun;
  const label = `${page.spec.name} / ${spec.name}`;
  const texts = labelTexts(set.spec, spec);
  const contents = (frame: FrameNode) =>
    Effect.gen(function* () {
      const inner = yield* currentRun;
      planBareFrame(inner, frame, label, spec.name);
      yield* planOwnedChildren(frame, label, "header", texts, (text): OwnedChild<TextNode, void> => ({
        name: text.name,
        accept: isText,
        description: `create the header ${text.characters}`,
        make: () => inner.figma.createText(),
        requireNew: () => {
          requireTextFonts(inner, label, styleOf(styles, text.style), undefined);
        },
        plan: (node, origin) =>
          Effect.gen(function* () {
            const now = yield* currentRun;
            const style = styleOf(styles, text.style);
            if (origin === "found") {
              requireTextFonts(now, label, style, node);
            }
            planDocText(now, node, origin, `${label} / ${text.characters}`, text, style);
          }),
      }));
    });
  const found = yield* page.find(spec.key, spec.name, isFrame);
  if (found !== undefined) {
    yield* contents(found);
    return existing(found);
  }
  // A new frame's texts are planned when it is made, so the fonts they need load before Apply.
  for (const text of texts) {
    requireTextFonts(run, label, styleOf(styles, text.style), undefined);
  }
  return yield* create(
    page.spec.name,
    `create the labels ${spec.name}`,
    () => placeOwned(page.node.get(), run.figma.createFrame(), spec.key, spec.name),
    contents
  );
});

/** Plan a page's example: a group frame, as a preview's, holding the example set's variant. */
const planExample = Effect.fnUntraced(function* (page: PlannedPage, spec: PageExampleSpec, set: PlannedSet) {
  const run = yield* currentRun;
  const group = {
    key: spec.key,
    name: spec.name,
    componentSet: spec.componentSet,
    instances: [{ variant: spec.variant }],
  };
  const label = `${page.spec.name} / ${spec.name}`;
  const found = yield* page.find(spec.key, spec.name, isFrame);
  if (found !== undefined) {
    yield* planGroupFields(found, label, spec.key, group, set);
    return existing(found);
  }
  return yield* create(
    page.spec.name,
    `create the example ${spec.name}`,
    () => placeOwned(page.node.get(), run.figma.createFrame(), spec.key, spec.name),
    (made) => planGroupFields(made, label, spec.key, group, set)
  );
});

/** A page's doc nodes as the plan leaves them. */
export type PlannedDocs = {
  readonly title: Target<TextNode> | undefined;
  /** Each set's labels frame, by the set's key. */
  readonly labels: ReadonlyMap<string, Target<FrameNode>>;
  readonly examplesHeader: Target<TextNode> | undefined;
  readonly example: Target<FrameNode> | undefined;
};

/** The planned set a doc reads. */
function setOf(sets: ReadonlyMap<string, PlannedSet>, key: string, reader: string): PlannedSet {
  const set = sets.get(key);
  if (set === undefined) {
    throw new Error(`${reader} reads ${key}, which the plan has not planned.`);
  }
  return set;
}

/** A page with no docs: no title, labels, header or example. */
const UNDOCUMENTED: PlannedDocs = {
  title: undefined,
  labels: new Map(),
  examplesHeader: undefined,
  example: undefined,
};

/**
 * Plan a page's doc nodes against its docs record.
 *
 * @param page - The page.
 * @param docs - The page's docs, or undefined for a page the kit does not document.
 * @param sets - The component sets as the plan leaves them, by key.
 * @param styles - The text styles as the plan leaves them, by key.
 * @returns The doc nodes, as the page's layout finds them.
 */
export const planPageDocs = Effect.fnUntraced(function* (
  page: PlannedPage,
  docs: PageDocsSpec | undefined,
  sets: ReadonlyMap<string, PlannedSet>,
  styles: ReadonlyMap<string, PlannedTextStyle>
) {
  if (docs === undefined) {
    return UNDOCUMENTED;
  }
  const title = yield* planTopText(page, docs.title, styles);
  const labels = new Map<string, Target<FrameNode>>();
  for (const spec of docs.labels) {
    labels.set(
      spec.componentSet,
      yield* planLabels(page, spec, setOf(sets, spec.componentSet, spec.name), styles)
    );
  }
  const examplesHeader = yield* planTopText(page, docs.examplesHeader, styles);
  const example = yield* planExample(
    page,
    docs.example,
    setOf(sets, docs.example.componentSet, docs.example.name)
  );
  const planned: PlannedDocs = { title, labels, examplesHeader, example };
  return planned;
});

/**
 * Whether the plan retypes a text style a page's docs link, which resizes the linked texts, so the
 * page lays out again.
 *
 * @param docs - The page's docs, or undefined for a page the kit does not document.
 * @param styles - The text styles as the plan leaves them, by key.
 * @returns True where the plan creates or rewrites one of the styles.
 */
export function retypesDocs(
  docs: PageDocsSpec | undefined,
  styles: ReadonlyMap<string, PlannedTextStyle>
): boolean {
  if (docs === undefined) {
    return false;
  }
  const linked = [
    docs.title.style,
    docs.examplesHeader.style,
    ...docs.labels.flatMap((labels) => [labels.nameStyle, labels.axisStyle]),
  ];
  return linked.some((key) => styles.get(key)?.retypes === true);
}

/** A component set on a page and its node, as the layout places it. */
export type PageSet = {
  readonly name: string;
  readonly node: Target<ComponentSetNode | FrameNode>;
  /** The set as the plan leaves it, or undefined for the icon library, which has no grid. */
  readonly set: PlannedSet | undefined;
};

/** Where the layout puts a node, relative to the page, or a text relative to its labels frame. */
type Placed = {
  readonly node: SceneNode;
  readonly x: number;
  readonly y: number;
};

/** A labels frame's size, which the layout writes. */
type Sized = {
  readonly node: FrameNode | ComponentSetNode;
  readonly width: number;
  readonly height: number;
};

/**
 * A labels frame and the set it surrounds, which must sit above it, so a click inside the set's
 * bounds lands on the set rather than on the frame around it.
 */
type Below = {
  readonly node: FrameNode;
  readonly over: SceneNode;
};

/** What the layout writes: every node's place, every labels frame's size, and each frame's order. */
type PageLayout = {
  readonly placed: readonly Placed[];
  readonly sized: readonly Sized[];
  readonly below: readonly Below[];
};

/** Where a page's layout starts: its top left. */
type Anchor = {
  readonly x: number;
  readonly y: number;
};

/** A labels frame's texts, by their keys. */
function textsOf(frame: FrameNode): ReadonlyMap<string, TextNode> {
  return new Map(frame.children.flatMap((child) => (isText(child) ? [[keyOf(child), child] as const] : [])));
}

/**
 * Lay out a set and its labels at a place. The set's grid gives each column the width of its widest
 * variant or of its header, whichever is wider, as the header measures when the operation runs, so a
 * header never runs into the next column's. The name sits above the grid, each column header at its
 * column's left edge between them, each row header in a column left of the grid, centred on its row,
 * and the set right of that column. A set without labels lays out its grid alone.
 */
function placeSet(
  set: PlannedSet,
  node: ComponentSetNode,
  frame: FrameNode | undefined,
  x: number,
  y: number
): PageLayout {
  const texts = frame === undefined ? new Map<string, TextNode>() : textsOf(frame);
  const nodeOf = (variant: VariantSpec): ComponentNode => {
    const target = set.variants.get(variant.key);
    if (target === undefined) {
      throw new Error(`${set.spec.name}: the plan has no variant ${variant.key} to lay out.`);
    }
    const component = target.get();
    settleInstances(component);
    return component;
  };
  const columnAxis = columnAxisOf(set.spec);
  const columns = axisValues(set.spec, columnAxis.name).flatMap((value, column) => {
    const text = texts.get(columnKey(value));
    return text === undefined ? [] : [{ text, column }];
  });
  const headerWidths = axisValues(set.spec, columnAxis.name).map(
    (value) => texts.get(columnKey(value))?.width ?? 0
  );
  const grid = gridLayout(set.spec, nodeOf, headerWidths);
  const cells: Placed[] = grid.cells.map((cell) => ({ node: cell.node, x: cell.x, y: cell.y }));
  const setSize: Sized = { node, width: grid.width, height: grid.height };
  if (frame === undefined) {
    return { placed: [...cells, { node, x, y }], sized: [setSize], below: [] };
  }
  const name = texts.get(NAME_KEY);
  const rows = [...texts].flatMap(([key, text]) => {
    const row = key.startsWith("row/") ? Number(key.slice("row/".length)) : Number.NaN;
    return Number.isNaN(row) ? [] : [{ text, row }];
  });
  const rowWidth = Math.max(0, ...rows.map(({ text }) => Math.ceil(text.width)));
  const setLeft = rows.length === 0 ? 0 : rowWidth + LABEL_GAP * 2;
  const columnTop = name === undefined ? 0 : Math.ceil(name.height) + LABEL_GAP;
  const columnHeight = Math.max(0, ...columns.map(({ text }) => Math.ceil(text.height)));
  const setTop = columnTop + columnHeight + LABEL_GAP;
  const placed: Placed[] = [
    ...cells,
    { node: frame, x, y },
    { node, x: x + setLeft, y: y + setTop },
    ...(name === undefined ? [] : [{ node: name, x: setLeft, y: 0 }]),
    ...columns.map(({ text, column }) => ({
      node: text,
      x: setLeft + (grid.columnX[column] ?? 0),
      y: columnTop,
    })),
    ...rows.map(({ text, row }) => ({
      node: text,
      x: 0,
      y: setTop + grid.rowY(row) + Math.round((grid.rowHeight - text.height) / 2),
    })),
  ];
  return {
    placed,
    sized: [setSize, { node: frame, width: setLeft + grid.width, height: setTop + grid.height }],
    below: [{ node: frame, over: node }],
  };
}

/**
 * The page layout: the title, then the sets in a row, each with its labels, then the `Examples`
 * header and the example, then the previews stacked below, all left-aligned with the title. The
 * layout starts where the title sits, or, on a page the run first documents, where the first set
 * sits. Each preview's and the example's instances settle before their heights are read
 * (`settle.ts`).
 */
function pageLayout(
  sets: readonly PageSet[],
  docs: PlannedDocs,
  frames: readonly Target<FrameNode>[],
  anchor: Anchor
): PageLayout {
  const placed: Placed[] = [];
  const sized: Sized[] = [];
  const below: Below[] = [];
  let y = anchor.y;
  const title = docs.title?.get();
  if (title !== undefined) {
    placed.push({ node: title, x: anchor.x, y });
    y += Math.ceil(title.height) + TITLE_GAP;
  }
  let x = anchor.x;
  let bottom = y;
  for (const entry of sets) {
    const node = entry.node.get();
    if (entry.set === undefined || node.type !== "COMPONENT_SET") {
      placed.push({ node, x, y });
      x += node.width + SET_SPACING;
      bottom = Math.max(bottom, y + node.height);
      continue;
    }
    const block = placeSet(entry.set, node, docs.labels.get(entry.set.spec.key)?.get(), x, y);
    placed.push(...block.placed);
    sized.push(...block.sized);
    below.push(...block.below);
    // The block is the labels frame where the set has one, and the set alone where it has none.
    const [size] = block.sized.slice(-1);
    x += (size?.width ?? node.width) + SET_SPACING;
    bottom = Math.max(bottom, y + (size?.height ?? node.height));
  }
  y = bottom + SECTION_SPACING;
  const header = docs.examplesHeader?.get();
  if (header !== undefined) {
    placed.push({ node: header, x: anchor.x, y });
    y += Math.ceil(header.height) + HEADER_GAP;
  }
  const example = docs.example?.get();
  if (example !== undefined) {
    settleInstances(example);
    placed.push({ node: example, x: anchor.x, y });
    y += example.height + SECTION_SPACING;
  }
  for (const target of frames) {
    const frame = target.get();
    settleInstances(frame);
    placed.push({ node: frame, x: anchor.x, y });
    y += frame.height + PREVIEW_SPACING;
  }
  return { placed, sized, below };
}

/** A node's place among its parent's children, or -1 for a node with no parent. */
function indexOf(node: SceneNode): number {
  const parent = node.parent;
  return parent === null || !("children" in parent) ? -1 : parent.children.indexOf(node);
}

/** Whether the nodes stand where the layout puts them, at the sizes it gives them. */
function holds(layout: PageLayout): boolean {
  return (
    layout.placed.every((placed) => near(placed.node.x, placed.x) && near(placed.node.y, placed.y)) &&
    layout.sized.every(
      (sized) => near(sized.node.width, sized.width) && near(sized.node.height, sized.height)
    ) &&
    layout.below.every(({ node, over }) => indexOf(node) < indexOf(over))
  );
}

/** `A`, `A and B`, or `A, B and C`. */
function listed(names: readonly string[]): string {
  const last = names.at(-1) ?? "";
  return names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * Plan a page's layout, as {@link pageLayout} puts it. The layout reads the sizes of what it places
 * when its operation runs, after the writes that change them.
 *
 * @param run - The run.
 * @param page - The page.
 * @param sets - The page's sets, or its icon library, in order.
 * @param docs - The page's doc nodes.
 * @param frames - The preview frames, in spec order.
 * @param changed - Whether the plan changes anything on the page, which may move or resize what the
 *   layout reads.
 */
export function placePageContents(
  run: Run,
  page: PlannedPage,
  sets: readonly PageSet[],
  docs: PlannedDocs,
  frames: readonly Target<FrameNode>[],
  changed: boolean
): void {
  const [first] = sets;
  if (first === undefined) {
    return;
  }
  // A lone node with no grid and nothing to document, as the Icons page's library, leads its page
  // where it stands.
  const documented = docs.title !== undefined || docs.example !== undefined || docs.labels.size > 0;
  if (!documented && sets.every((entry) => entry.set === undefined) && sets.length + frames.length === 1) {
    return;
  }
  // The title leads the page where it stands, and a page the run first documents starts where its
  // first set stands.
  const lead = docs.title?.existing ?? first.node.existing;
  const anchorOf = (): Anchor => {
    const node = lead ?? first.node.get();
    return { x: node.x, y: node.y };
  };
  const settled =
    !changed &&
    sets.every((entry) => entry.node.existing !== undefined) &&
    [docs.title, ...docs.labels.values(), docs.examplesHeader, docs.example, ...frames].every(
      (target) => target === undefined || target.existing !== undefined
    );
  if (settled && holds(pageLayout(sets, docs, frames, anchorOf()))) {
    return;
  }
  const stack = frames.length === 0 ? "" : ` and stack ${String(frames.length)} previews below them`;
  const named = documented ? ", with their labels and the page's title and example," : "";
  change(
    run.plan,
    page.spec.name,
    `place ${listed(sets.map((entry) => entry.name))}${named} in a row${stack}`,
    () => {
      const layout = pageLayout(sets, docs, frames, anchorOf());
      for (const sized of layout.sized) {
        sized.node.resizeWithoutConstraints(sized.width, sized.height);
      }
      for (const placed of layout.placed) {
        placed.node.x = placed.x;
        placed.node.y = placed.y;
      }
      for (const { node, over } of layout.below) {
        const parent = over.parent;
        if (parent !== null && "insertChild" in parent && indexOf(node) > indexOf(over)) {
          parent.insertChild(indexOf(over), node);
        }
      }
    }
  );
}
