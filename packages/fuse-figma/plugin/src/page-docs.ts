/**
 * The nodes that document a component page, and the page's layout. A page reads as the Obra kit's
 * pages do: a title, the component's description and a link to its docs page, a rule under them,
 * then sections down the page, each with its label in a column at the left and
 * its content growing to the right. A section per component set holds the set's name, a header above
 * each column naming its value on the column axis and a header beside each row naming its values on
 * the other axes. The `Themes` section holds the theme previews side by side, and the `Examples`
 * section the usage example.
 *
 * The docs sit beside the sets, never inside them, so no variant, property or layer of a set
 * changes. Each is a keyed top-level node of its page, which the page plan keeps, and none carries
 * the `preview/` key the snapshot export reads.
 */

import { Effect } from "effect";

import { columnAxisOf, gridCell } from "../../src/components/kit-check.ts";
import { axisValues } from "../../src/components/kit-spec.ts";
import type {
  ColorSpec,
  ComponentSetSpec,
  DocLinkSpec,
  DocRuleSpec,
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
import { heldFonts, requireFont, unloadableFont } from "./fonts.ts";
import { keyOf, placeOwned, planOwnedChildren } from "./identity.ts";
import type { OwnedChild } from "./identity.ts";
import type { PlannedPage } from "./pages.ts";
import { change, changeWith, create, existing, warn } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planGroupFields } from "./previews.ts";
import { currentRun } from "./services.ts";
import { settleInstances } from "./settle.ts";
import { planDecoration } from "./text-layer.ts";
import type { PlannedTextStyle } from "./text-styles.ts";

/** The space between sections, and between previews side by side. */
const SECTION_SPACING = 64;
const PREVIEW_SPACING = 32;

/** The space between the title, the description and the docs link. */
const HEAD_GAP = 8;

/** The space above and below the rule under a page's head. */
const RULE_GAP = 32;

/** The rule's thickness. */
const RULE_HEIGHT = 1;

/**
 * The label column's least width, and the space between its widest label and the content. A set
 * name longer than the column allows widens it.
 */
const LABEL_COLUMN = 240;
const LABEL_COLUMN_GAP = 32;

/** The space between the column headers and the grid, and on each side of the row headers. */
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
 *
 * @returns Whether the plan writes the text's style link or characters.
 */
function planDocText(
  run: Run,
  text: TextNode,
  origin: "found" | "new",
  label: string,
  spec: DocText,
  style: PlannedTextStyle
): "rewritten" | "kept" {
  const linked =
    origin === "found" && style.style.existing !== undefined && text.textStyleId === style.style.existing.id;
  // A new text is never linked, so `linked` covers it.
  const rewrites = !linked || text.characters !== spec.characters;
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
  return rewrites ? "rewritten" : "kept";
}

/**
 * A frame that only holds what sits in it, each layer where the page layout puts it: no auto
 * layout, which would place the layers itself, no clip, and the fill given, a labels frame none.
 */
function planBareFrame(
  run: Run,
  frame: FrameNode,
  label: string,
  name: string,
  fill: ColorSpec | undefined
): void {
  planScalar(run, label, "name", frame.name, name, () => {
    frame.name = name;
  });
  planScalar(run, label, "layoutMode", frame.layoutMode, "NONE", () => {
    frame.layoutMode = "NONE";
  });
  planScalar(run, label, "clipsContent", frame.clipsContent, false, () => {
    frame.clipsContent = false;
  });
  planPaints(run, label, "fill", frame.fills, fill, (paints) => {
    frame.fills = paints;
  });
}

/**
 * Plan a page-level text, such as the title, the description or the `Examples` header, and the URL
 * the docs link opens.
 *
 * @param shown - How the change lines name the text: by its characters, or, for the description,
 *   which is a whole sentence, as `description`.
 */
const planTopText = Effect.fnUntraced(function* (
  page: PlannedPage,
  spec: DocTextSpec | DocLinkSpec,
  styles: ReadonlyMap<string, PlannedTextStyle>,
  shown: "characters" | "description"
) {
  const run = yield* currentRun;
  const named = shown === "characters" ? spec.text : "description";
  const label = `${page.spec.name} / ${named}`;
  const style = styleOf(styles, spec.style);
  const text: DocText = { key: spec.key, name: spec.name, characters: spec.text, style: spec.style };
  const plan = (now: Run, node: TextNode, origin: "found" | "new"): void => {
    const rewritten = planDocText(now, node, origin, label, text, style);
    if (spec.kind === "link") {
      planLinkLook(now, node, label, spec, rewritten);
    }
  };
  const found = yield* page.find(spec.key, spec.name, isText);
  requireTextFonts(run, label, style, found);
  if (found !== undefined) {
    plan(run, found, "found");
    return existing(found);
  }
  return yield* create(
    page.spec.name,
    shown === "characters" ? `create the text ${spec.text}` : "create the description",
    () => placeOwned(page.node.get(), run.figma.createText(), spec.key, spec.name),
    (made) =>
      Effect.gen(function* () {
        plan(yield* currentRun, made, "new");
      })
  );
});

/**
 * Plan how a docs link reads as a link: its fill and underline as Fuse's `Link` draws its text, and
 * the URL the whole text opens. Figma draws a text linked through the API in its own fill with no
 * underline (live probe 2026-11-19, HL1–HL4), so the look is the plugin's to write. The fill and
 * underline follow the style link and characters. A style link may reset a decoration, as no probe
 * has settled, so the underline is written again after either. The link survives both writes,
 * so it is written only where the text holds another.
 */
function planLinkLook(
  run: Run,
  text: TextNode,
  label: string,
  spec: DocLinkSpec,
  rewritten: "rewritten" | "kept"
): void {
  planPaints(run, label, "fill", text.fills, spec.color, (paints) => {
    text.fills = paints;
  });
  planDecoration(run, text, label, spec, rewritten === "rewritten" ? "unknown" : "read");
  const held = text.hyperlink;
  if (held !== null && held !== run.figma.mixed && held.type === "URL" && held.value === spec.url) {
    return;
  }
  change(run.plan, label, `link → ${spec.url}`, () => {
    text.hyperlink = { type: "URL", value: spec.url };
  });
}

/** Plan the rule under a page's head: a frame 1px high, filled with its color. */
const planRule = Effect.fnUntraced(function* (page: PlannedPage, spec: DocRuleSpec) {
  const run = yield* currentRun;
  const label = `${page.spec.name} / ${spec.name}`;
  const contents = (frame: FrameNode) =>
    Effect.gen(function* () {
      planBareFrame(yield* currentRun, frame, label, spec.name, spec.color);
    });
  const found = yield* page.find(spec.key, spec.name, isFrame);
  if (found !== undefined) {
    yield* contents(found);
    return existing(found);
  }
  return yield* create(
    page.spec.name,
    "create the rule",
    () => placeOwned(page.node.get(), run.figma.createFrame(), spec.key, spec.name),
    contents
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
      planBareFrame(inner, frame, label, spec.name, undefined);
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
  readonly description: Target<TextNode> | undefined;
  readonly docsLink: Target<TextNode> | undefined;
  readonly rule: Target<FrameNode> | undefined;
  /** Each set's labels frame, by the set's key. */
  readonly labels: ReadonlyMap<string, Target<FrameNode>>;
  readonly themesHeader: Target<TextNode> | undefined;
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

/** A page with no docs: no title, description, docs link, rule, labels, headers or example. */
const UNDOCUMENTED: PlannedDocs = {
  title: undefined,
  description: undefined,
  docsLink: undefined,
  rule: undefined,
  labels: new Map(),
  themesHeader: undefined,
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
  const title = yield* planTopText(page, docs.title, styles, "characters");
  const description = yield* planTopText(page, docs.description, styles, "description");
  const docsLink = yield* planTopText(page, docs.docsLink, styles, "characters");
  const rule = yield* planRule(page, docs.rule);
  const labels = new Map<string, Target<FrameNode>>();
  for (const spec of docs.labels) {
    labels.set(
      spec.componentSet,
      yield* planLabels(page, spec, setOf(sets, spec.componentSet, spec.name), styles)
    );
  }
  const themesHeader = yield* planTopText(page, docs.themesHeader, styles, "characters");
  const examplesHeader = yield* planTopText(page, docs.examplesHeader, styles, "characters");
  const example = yield* planExample(
    page,
    docs.example,
    setOf(sets, docs.example.componentSet, docs.example.name)
  );
  const planned: PlannedDocs = {
    title,
    description,
    docsLink,
    rule,
    labels,
    themesHeader,
    examplesHeader,
    example,
  };
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
    docs.description.style,
    docs.docsLink.style,
    docs.themesHeader.style,
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

/** A section's place on the page, how tall it is, and where its right edge falls on the page. */
type Section = PageLayout & {
  readonly height: number;
  readonly right: number;
};

/**
 * Lay out a set's section at a place: its labels frame at the page's left edge, and the set inside
 * the frame's bounds. The set's name sits at the frame's top left, in the page's label column. Right
 * of the column, each row header sits centred on its row, the set right of the row headers, and each
 * column header above the set at its column's left edge. The set's grid gives each column the width
 * of its widest variant or of its header, whichever is wider, as the header measures when the
 * operation runs, so a header never runs into the next column's. A set without labels lays out its
 * grid alone, at the label column's right edge.
 *
 * @param column - The label column's width.
 */
function placeSet(
  set: PlannedSet,
  node: ComponentSetNode,
  frame: FrameNode | undefined,
  x: number,
  y: number,
  column: number
): Section {
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
  const columns = axisValues(set.spec, columnAxis.name).flatMap((value, index) => {
    const text = texts.get(columnKey(value));
    return text === undefined ? [] : [{ text, column: index }];
  });
  const headerWidths = axisValues(set.spec, columnAxis.name).map(
    (value) => texts.get(columnKey(value))?.width ?? 0
  );
  const grid = gridLayout(set.spec, nodeOf, headerWidths);
  const cells: Placed[] = grid.cells.map((cell) => ({ node: cell.node, x: cell.x, y: cell.y }));
  const setSize: Sized = { node, width: grid.width, height: grid.height };
  if (frame === undefined) {
    return {
      placed: [...cells, { node, x: x + column, y }],
      sized: [setSize],
      below: [],
      height: Math.ceil(grid.height),
      right: x + column + grid.width,
    };
  }
  const name = texts.get(NAME_KEY);
  const rows = [...texts].flatMap(([key, text]) => {
    const row = key.startsWith("row/") ? Number(key.slice("row/".length)) : Number.NaN;
    return Number.isNaN(row) ? [] : [{ text, row }];
  });
  const rowWidth = Math.max(0, ...rows.map(({ text }) => Math.ceil(text.width)));
  const setLeft = column + (rows.length === 0 ? 0 : rowWidth + LABEL_GAP * 2);
  const columnHeight = Math.max(0, ...columns.map(({ text }) => Math.ceil(text.height)));
  const setTop = columns.length === 0 ? 0 : columnHeight + LABEL_GAP;
  const height = Math.max(setTop + Math.ceil(grid.height), Math.ceil(name?.height ?? 0));
  const placed: Placed[] = [
    ...cells,
    { node: frame, x, y },
    { node, x: x + setLeft, y: y + setTop },
    ...(name === undefined ? [] : [{ node: name, x: 0, y: 0 }]),
    ...columns.map(({ text, column: index }) => ({
      node: text,
      x: setLeft + (grid.columnX[index] ?? 0),
      y: 0,
    })),
    ...rows.map(({ text, row }) => ({
      node: text,
      x: column,
      y: setTop + grid.rowY(row) + Math.round((grid.rowHeight - text.height) / 2),
    })),
  ];
  return {
    placed,
    sized: [setSize, { node: frame, width: setLeft + grid.width, height }],
    below: [{ node: frame, over: node }],
    height,
    right: x + setLeft + grid.width,
  };
}

/**
 * The label column's width: the least width, or the widest section label and a gap, whichever is
 * wider, as the labels measure when the operation runs. Every section's label sits in it, so every
 * section's content starts at one left edge.
 */
function labelColumn(sets: readonly PageSet[], docs: PlannedDocs): number {
  const names = sets.flatMap((entry) => {
    const frame = entry.set === undefined ? undefined : docs.labels.get(entry.set.spec.key)?.get();
    const name = frame === undefined ? undefined : textsOf(frame).get(NAME_KEY);
    return name === undefined ? [] : [name];
  });
  const headers = [docs.themesHeader?.get(), docs.examplesHeader?.get()].filter(
    (header) => header !== undefined
  );
  const widest = Math.max(0, ...[...names, ...headers].map((label) => Math.ceil(label.width)));
  return Math.max(LABEL_COLUMN, widest + LABEL_COLUMN_GAP);
}

/**
 * The page layout: the title, the description and the docs link, a rule under them, then a section
 * per set, then the `Themes` section, the previews side by side, then the `Examples` section, each
 * section below the last, with its label in the label column and its content growing to the right.
 * The rule runs from the page's left edge to the right edge of whatever reaches furthest right, a
 * head text or a section's content, as the layout places them. The layout starts where the title
 * sits, or, on a page the run first documents, where the first set sits. Each preview's and the
 * example's instances settle before their sizes are read (`settle.ts`).
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
  const column = labelColumn(sets, docs);
  const content = anchor.x + column;
  let y = anchor.y;
  let right = anchor.x;
  const head = [docs.title?.get(), docs.description?.get(), docs.docsLink?.get()].filter(
    (text) => text !== undefined
  );
  for (const [index, text] of head.entries()) {
    y += index === 0 ? 0 : HEAD_GAP;
    placed.push({ node: text, x: anchor.x, y });
    y += Math.ceil(text.height);
    right = Math.max(right, anchor.x + text.width);
  }
  y += head.length === 0 ? 0 : RULE_GAP;
  const rule = docs.rule?.get();
  if (rule !== undefined) {
    placed.push({ node: rule, x: anchor.x, y });
    y += RULE_HEIGHT + RULE_GAP;
  }
  for (const entry of sets) {
    const node = entry.node.get();
    if (entry.set === undefined || node.type !== "COMPONENT_SET") {
      placed.push({ node, x: content, y });
      y += Math.ceil(node.height) + SECTION_SPACING;
      right = Math.max(right, content + node.width);
      continue;
    }
    const section = placeSet(
      entry.set,
      node,
      docs.labels.get(entry.set.spec.key)?.get(),
      anchor.x,
      y,
      column
    );
    placed.push(...section.placed);
    sized.push(...section.sized);
    below.push(...section.below);
    y += section.height + SECTION_SPACING;
    right = Math.max(right, section.right);
  }
  const themes = docs.themesHeader?.get();
  if (themes !== undefined || frames.length > 0) {
    let height = 0;
    if (themes !== undefined) {
      placed.push({ node: themes, x: anchor.x, y });
      height = Math.ceil(themes.height);
    }
    let x = content;
    for (const target of frames) {
      const frame = target.get();
      settleInstances(frame);
      placed.push({ node: frame, x, y });
      right = Math.max(right, x + frame.width);
      x += Math.ceil(frame.width) + PREVIEW_SPACING;
      height = Math.max(height, Math.ceil(frame.height));
    }
    y += height + SECTION_SPACING;
  }
  const header = docs.examplesHeader?.get();
  if (header !== undefined) {
    placed.push({ node: header, x: anchor.x, y });
  }
  const example = docs.example?.get();
  if (example !== undefined) {
    settleInstances(example);
    placed.push({ node: example, x: content, y });
    right = Math.max(right, content + example.width);
  }
  if (rule !== undefined) {
    sized.push({ node: rule, width: Math.ceil(right - anchor.x), height: RULE_HEIGHT });
  }
  return { placed, sized, below };
}

/** A node's place among its parent's children, or -1 for a node with no parent. */
function indexOf(node: SceneNode): number {
  const parent = node.parent;
  return parent === null || !("children" in parent) ? -1 : parent.children.indexOf(node);
}

/**
 * Whether the nodes stand where the layout puts them, at the sizes it gives them, with each labels
 * frame below its set, but for a frame and a set that both hold a font Figma cannot load.
 */
function holds(layout: PageLayout, pinned: ReadonlySet<SceneNode>): boolean {
  return (
    layout.placed.every((placed) => near(placed.node.x, placed.x) && near(placed.node.y, placed.y)) &&
    layout.sized.every(
      (sized) => near(sized.node.width, sized.width) && near(sized.node.height, sized.height)
    ) &&
    layout.below.every(
      ({ node, over }) => indexOf(node) < indexOf(over) || (pinned.has(node) && pinned.has(over))
    )
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
export const placePageContents = Effect.fnUntraced(function* (
  run: Run,
  page: PlannedPage,
  sets: readonly PageSet[],
  docs: PlannedDocs,
  frames: readonly Target<FrameNode>[],
  changed: boolean
) {
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
    [
      docs.title,
      docs.description,
      docs.docsLink,
      docs.rule,
      ...docs.labels.values(),
      docs.themesHeader,
      docs.examplesHeader,
      docs.example,
      ...frames,
    ].every((target) => target === undefined || target.existing !== undefined);
  const pinned = yield* pinnedSections(run, page.spec.name, sets, docs);
  if (settled && holds(pageLayout(sets, docs, frames, anchorOf()), pinned)) {
    return;
  }
  const side = frames.length === 0 ? "" : `, and ${String(frames.length)} previews side by side`;
  const named = documented ? ", with their labels and the page's title and example," : "";
  change(
    run.plan,
    page.spec.name,
    `place ${listed(sets.map((entry) => entry.name))}${named} in sections${side}`,
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
        if (parent === null || !("insertChild" in parent) || indexOf(node) < indexOf(over)) {
          continue;
        }
        // Figma moves no layer that holds a font it cannot load, so the set moves above a labels
        // frame that holds one. Figma counts the index among the children before the move (probe
        // MV3), so the set lands right above the frame.
        if (!pinned.has(node)) {
          parent.insertChild(indexOf(over), node);
        } else if (!pinned.has(over)) {
          parent.insertChild(indexOf(node) + 1, over);
        }
      }
    }
  );
});

/**
 * The labels frames and sets on a page that hold a font Figma cannot load, which no move may carry
 * (`unloadableFont`). It warns for a labels frame and its set that both hold one, since the plan
 * cannot put the set above the frame then.
 *
 * @param run - The run.
 * @param label - The page's label, for warnings.
 * @param sets - The page's sets.
 * @param docs - The page's doc nodes.
 * @returns The layers that stay where they stand.
 */
const pinnedSections = Effect.fnUntraced(function* (
  run: Run,
  label: string,
  sets: readonly PageSet[],
  docs: PlannedDocs
) {
  const pinned = new Set<SceneNode>();
  for (const entry of sets) {
    const set = entry.node.existing;
    const frame = entry.set === undefined ? undefined : docs.labels.get(entry.set.spec.key)?.existing;
    if (set === undefined || frame === undefined) {
      continue;
    }
    const frameFont = yield* unloadableFont(run, frame);
    const setFont = yield* unloadableFont(run, set);
    if (frameFont !== undefined) {
      pinned.add(frame);
    }
    if (setFont !== undefined) {
      pinned.add(set);
    }
    if (frameFont !== undefined && setFont !== undefined && indexOf(frame) > indexOf(set)) {
      warn(
        run.plan,
        label,
        `keeps ${frame.name} above ${set.name}, since Figma cannot load the fonts of either, ${frameFont.family} ${frameFont.style} and ${setFont.family} ${setFont.style}, and moves no layer that holds one`
      );
    }
  }
  return pinned;
});
