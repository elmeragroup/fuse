/**
 * Build the component kit the Fuse plugin applies: a page for each component, holding the
 * component sets of `kit-registry.ts` and four preview frames, and an `Icons` page holding an
 * icon component for every Fuse icon. It also builds the coverage table of every captured declaration.
 */
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { OpenPlacement } from "../capture/capture-cell-cascade";
import type { CaptureUnreadable, SetCapture } from "../capture/capture-format";
import { keptCapture } from "../capture/captures";
import { manifestDefinition } from "../capture/manifest";
import type { SetManifest } from "../capture/manifest";
import { nestedComposite } from "../capture/nested-placement.ts";
import { fuseVariableSet } from "../fuse-variable-set";
import type { CollectionSpec, LiteralValue, VariableSpec } from "../variable-set";
import { KitSourceInvalid, KitUnmappable } from "./build-errors";
import { buildSetsInOrder } from "./component-builder";
import type { SetSource } from "./component-builder";
import { variantKey } from "./component-spec";
import type {
  BuiltComponent,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { makeVariableIndex, pinnedIndex, readColor } from "./css-values";
import type { ModeView, VariableIndex } from "./css-values";
import { readDocsPage } from "./docs-pages";
import type { DocsPage } from "./docs-pages";
import type { DrawnPart } from "./drawn-parts";
import { fuseIcons, ICON_SIZE, weightedIcons } from "./icon-library";
import { checkKitSpec } from "./kit-check";
import { KIT } from "./kit-registry";
import type { KitEntry, KitPage } from "./kit-registry";
import { walkLayers } from "./kit-spec";
import type {
  NumberSpec,
  ColorSpec,
  ComponentSetSpec,
  DocLinkSpec,
  GlyphFontSpec,
  IconLibrarySpec,
  KitSpec,
  ModeRef,
  PageDocsSpec,
  PageSpec,
  PreviewInstanceSpec,
  PreviewSpec,
  SetLabelsSpec,
  TextStyleSpec,
} from "./kit-spec";
import { TEXT_STYLE_CAPTURE } from "./text-style-samples";
import { buildTextStyles } from "./text-styles";
import { compileUtilities } from "./utility-css";

/**
 * The instances a preview group places: each preview cell at its BOOLEAN defaults, then, for each
 * BOOLEAN property of the set, the first preview cell whose variant holds a layer the property links,
 * with the property at its non-default value. So a preview shows every optional part in both states,
 * and `checkKitSpec` refuses a property no preview places so.
 *
 * @param set - The built set, or undefined where the build made none.
 * @param variants - The variant keys of the set's preview cells, in order.
 * @returns The instances.
 */
export function previewInstances(
  set: Omit<ComponentSetSpec, "page"> | undefined,
  variants: readonly string[]
): readonly PreviewInstanceSpec[] {
  const links = (key: string, property: string): boolean => {
    const root = set?.variants.find((variant) => variant.key === key)?.root;
    return (
      root !== undefined &&
      walkLayers(root).some((layer) => layer.kind !== "text" && layer.visibleProperty === property)
    );
  };
  const toggled = (set?.booleanProperties ?? []).flatMap(({ name, defaultValue }): PreviewInstanceSpec[] => {
    const shown = variants.find((key) => links(key, name));
    return shown === undefined ? [] : [{ variant: shown, booleans: { [name]: !defaultValue } }];
  });
  return [...variants.map((variant): PreviewInstanceSpec => ({ variant })), ...toggled];
}

/** The text style a page's title links. */
const TITLE_STYLE = "text-style/heading/2";

/** The text style a set's name and a page's section header link. */
const CAPTION_STYLE = "text-style/text/sm/medium";

/** The text style each row and column header of a set's grid links. */
const AXIS_STYLE = "text-style/span/xs/regular";

/** The text style a page's description and its docs link link. */
const LEDE_STYLE = "text-style/text/sm/regular";

/**
 * Link's resting underline, from its recipe's `underline-offset-[0.2em]` and
 * `decoration-[max(1px,0.0625em)]`, in ems of the text's size.
 */
const LINK_UNDERLINE_OFFSET_EM = 0.2;
const LINK_UNDERLINE_THICKNESS_EM = 0.0625;

/** The colors and underline a page's docs nodes take from the theme and from Link. */
type DocsLook = {
  /** The rule's color, the `border` role. */
  readonly rule: ColorSpec;
  /** The docs link's text color and underline, as Fuse's `Link` draws its text at rest. */
  readonly link: Pick<DocLinkSpec, "color" | "underline">;
};

/**
 * The look of each page's docs nodes. Link's default color is `text-inherit`, which the kit's Link
 * set reads as `foreground`, the color a page's text takes. Its resting underline is that color at
 * 35%, the `foreground/35` tint the Link set binds, offset and thick in ems of the lede style's size.
 *
 * @returns The look, or `KitSourceInvalid` where the variable set lacks a color it binds or the lede
 *   style has no literal size.
 */
function docsLook(
  variables: VariableIndex,
  textStyles: readonly TextStyleSpec[]
): Result.Result<DocsLook, KitSourceInvalid> {
  const rule = readColor("var(--border)", variables);
  const text = readColor("var(--foreground)", variables);
  const underline = readColor("color-mix(in oklab, var(--foreground) 35%, transparent)", variables);
  const size = textStyles.find((style) => style.key === LEDE_STYLE)?.fontSize;
  if (rule === undefined || text === undefined || underline === undefined) {
    return Result.fail(
      new KitSourceInvalid({
        message: "the variable set lacks border, foreground or foreground/35 for the page heads",
      })
    );
  }
  if (size?.kind !== "literal") {
    return Result.fail(new KitSourceInvalid({ message: `the text style ${LEDE_STYLE} has no literal size` }));
  }
  return Result.succeed({
    rule,
    link: {
      color: text,
      underline: {
        // To the hundredth of a pixel, so the change line reads 2.8, not 0.2 × 14's float error.
        offset: Math.round(LINK_UNDERLINE_OFFSET_EM * size.value * 100) / 100,
        thickness: Math.max(1, LINK_UNDERLINE_THICKNESS_EM * size.value),
        color: underline,
      },
    },
  });
}

/**
 * The docs of a component page, as the Obra kit's pages read: the page's title, its docs page's lede
 * as its description, a `View documentation` link to its docs page and a rule under them, the labels
 * around each of its sets' grids, the section header `Themes` beside its previews, and the section header
 * `Examples` beside its usage example, its example set's default variant.
 *
 * @param page - The page.
 * @param registry - The kit's sets.
 * @param sets - The built sets, by key.
 * @param docsPage - The page's docs page.
 * @param look - The colors and underline of the page's docs nodes.
 * @returns The page's docs, or `KitSourceInvalid` where its example names a set the kit does not build.
 */
function pageDocs(
  page: KitPage,
  registry: readonly KitEntry[],
  sets: ReadonlyMap<string, Omit<ComponentSetSpec, "page">>,
  docsPage: DocsPage,
  look: DocsLook
): Result.Result<PageDocsSpec, KitSourceInvalid> {
  const pageKey = pageSpec(page).key;
  const prefix = `docs/${page.slug}`;
  const [variant] = sets.get(page.example)?.variants ?? [];
  if (variant === undefined) {
    return Result.fail(
      new KitSourceInvalid({
        message: `the ${page.name} page names ${page.example} as its example, which the kit does not build`,
      })
    );
  }
  return Result.succeed({
    page: pageKey,
    title: {
      kind: "text",
      key: `${prefix}/title`,
      name: "Header",
      page: pageKey,
      text: page.name,
      style: TITLE_STYLE,
    },
    description: {
      kind: "text",
      key: `${prefix}/description`,
      name: "Description",
      page: pageKey,
      text: docsPage.description,
      style: LEDE_STYLE,
    },
    docsLink: {
      kind: "link",
      key: `${prefix}/docs-link`,
      name: "View documentation",
      page: pageKey,
      text: "View documentation",
      style: LEDE_STYLE,
      url: docsPage.url,
      ...look.link,
    },
    rule: { kind: "rule", key: `${prefix}/rule`, name: "Rule", page: pageKey, color: look.rule },
    labels: registry
      .filter((entry) => entry.page.slug === page.slug)
      .map(({ manifest }): SetLabelsSpec => ({
        kind: "labels",
        key: `${prefix}/labels/${manifest.key}`,
        name: `${manifest.name} labels`,
        page: pageKey,
        componentSet: manifest.key,
        nameStyle: CAPTION_STYLE,
        axisStyle: AXIS_STYLE,
      })),
    themesHeader: {
      kind: "text",
      key: `${prefix}/themes-header`,
      name: "Header",
      page: pageKey,
      text: "Themes",
      style: CAPTION_STYLE,
    },
    examplesHeader: {
      kind: "text",
      key: `${prefix}/examples-header`,
      name: "Header",
      page: pageKey,
      text: "Examples",
      style: CAPTION_STYLE,
    },
    example: {
      kind: "example",
      key: `${prefix}/example`,
      name: "Example",
      page: pageKey,
      componentSet: page.example,
      variant: variant.key,
    },
  });
}

/** A theme the previews pin: Fjordkraft private in one identity, color scheme and density. */
function previewTheme(
  identity: "Neutral" | "Branded",
  scheme: "Light" | "Dark",
  density: "Dense" | "Comfortable"
) {
  return {
    key: `${identity.toLowerCase()}-fkas-private-${scheme.toLowerCase()}`,
    name: `Fjordkraft ${identity.toLowerCase()} private, ${scheme.toLowerCase()}`,
    modes: {
      "Fuse tokens": scheme,
      "Fuse identity": identity,
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
      "Fuse density": density,
    },
  };
}

/**
 * The four themes each component page previews. A designer switches a preview's modes to see
 * the others. No identity implies a density, so each preview pins one: neutral dense and branded
 * comfortable, the pairing the docs and the previews drew before density became explicit.
 */
const PREVIEW_THEMES = [
  previewTheme("Neutral", "Light", "Dense"),
  previewTheme("Neutral", "Dark", "Dense"),
  previewTheme("Branded", "Light", "Comfortable"),
  previewTheme("Branded", "Dark", "Comfortable"),
];

/** The page that holds the icon library alone. */
const ICONS_PAGE: PageSpec = { key: "page/icons", name: "Icons" };

function pageSpec(page: KitPage): PageSpec {
  return { key: `page/${page.slug}`, name: page.name };
}

/**
 * The variable set the kit binds, the index its CSS values resolve through, and each mode of a
 * collection with more than one, as the index resolves in it.
 */
type KitVariables = {
  readonly collections: readonly CollectionSpec[];
  readonly variables: VariableIndex;
  readonly modes: readonly ModeView[];
};

/** A built component set, placed on its page. */
export type KitComponentSet = Omit<BuiltComponent, "componentSet"> & {
  readonly componentSet: ComponentSetSpec;
};

function kitVariables(): Result.Result<KitVariables, KitSourceInvalid> {
  const variableSet = fuseVariableSet();
  if (Result.isFailure(variableSet)) {
    return Result.fail(
      new KitSourceInvalid({
        message: `the Fuse variable set does not build: ${String(variableSet.failure)}`,
      })
    );
  }
  const collections = variableSet.success.collections;
  const minimumOf = extremes(collections, Math.min, floatOf);
  const maximumOf = extremes(collections, Math.max, floatOf);
  const leastAlphaOf = extremes(collections, Math.min, alphaOf);
  const variables = makeVariableIndex(
    collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        variable.webSyntax === undefined
          ? []
          : [
              {
                ref: { collection: collection.name, name: variable.name },
                webSyntax: variable.webSyntax,
                minimum: minimumOf(collection.name, variable.name),
                maximum: maximumOf(collection.name, variable.name),
                opaque: leastAlphaOf(collection.name, variable.name) === 1,
              },
            ]
      )
    )
  );
  return Result.succeed({
    collections,
    variables,
    modes: modeViews(collections, variables, minimumOf, maximumOf),
  });
}

/**
 * The pixels a spec length draws in one mode of `Fuse density`, as the page that renders at that
 * density lays it out: a literal's value, or the value a variable holds in that mode where the mode
 * pins it to one, and undefined for any other length, whose pixels the mode does not decide.
 *
 * @param density - The density, as a theme names it: `dense` or `comfortable`.
 * @returns The reader, or `KitSourceInvalid` where the variable set does not build or has no such mode.
 */
export function densityLengths(
  density: string
): Result.Result<(length: NumberSpec) => number | undefined, KitSourceInvalid> {
  return Result.flatMap(kitVariables(), ({ modes }) => {
    const mode = modes.find(({ name }) => name.toLowerCase() === `fuse density / ${density}`);
    if (mode === undefined) {
      return Result.fail(new KitSourceInvalid({ message: `Fuse density has no ${density} mode` }));
    }
    return Result.succeed((length: NumberSpec): number | undefined => {
      if (length.kind === "literal") {
        return length.value;
      }
      const least = mode.variables.minimum(length.variable);
      return least !== undefined && least === mode.variables.maximum(length.variable) ? least : undefined;
    });
  });
}

/**
 * Each mode of a collection with more than one, named `Collection / Mode`: the collection's
 * variables hold that mode's value, or the bounds of the variable an alias there names, and every
 * other variable keeps its bounds across all modes.
 */
function modeViews(
  collections: readonly CollectionSpec[],
  variables: VariableIndex,
  minimumOf: (collection: string, name: string) => number | undefined,
  maximumOf: (collection: string, name: string) => number | undefined
): readonly ModeView[] {
  return collections
    .filter((collection) => collection.modes.length > 1)
    .flatMap((collection) => {
      const specs = new Map(collection.variables.map((variable) => [variable.name, variable]));
      return collection.modes.map((mode) => ({
        name: `${collection.name} / ${mode}`,
        collection: collection.name,
        variables: pinnedIndex(variables, (ref) => {
          const value =
            ref.collection === collection.name ? specs.get(ref.name)?.values.get(mode) : undefined;
          switch (value?._tag) {
            case "Float":
              return { minimum: value.value, maximum: value.value };
            case "Alias": {
              const minimum = minimumOf(value.target.collection, value.target.variable);
              const maximum = maximumOf(value.target.collection, value.target.variable);
              return minimum === undefined || maximum === undefined ? undefined : { minimum, maximum };
            }
            default:
              return undefined;
          }
        }),
      }));
    });
}

/**
 * Run a mapping that throws `KitUnmappable` from deep in the cascade and the part mappers, where a
 * definition or a capture asks for what Figma cannot draw. This is the one place that catches it,
 * for the component sets and the text styles alike, as `checkKitSpec` catches `KitContradiction`.
 *
 * @param map - The mapping.
 * @returns What the mapping returned, or the `KitUnmappable` it threw.
 * @throws Any other error, a defect of the mapping.
 */
function caughtUnmappable<Mapped>(map: () => Mapped): Result.Result<Mapped, KitUnmappable> {
  try {
    return Result.succeed(map());
  } catch (thrown) {
    if (Schema.is(KitUnmappable)(thrown)) {
      return Result.fail(thrown);
    }
    throw thrown;
  }
}

/**
 * The kept capture `captures/<key>.json`.
 *
 * @param key - The capture's key.
 * @param reader - What reads the capture, such as a set's name, which the message names where it is
 *   missing.
 * @returns The capture, `KitUnmappable` where the repository keeps none, or `CaptureUnreadable` for a
 *   file the schema rejects.
 */
function keptCaptureOf(
  key: string,
  reader: string
): Result.Result<SetCapture, CaptureUnreadable | KitUnmappable> {
  return (
    keptCapture(key) ??
    Result.fail(
      new KitUnmappable({
        message: `${reader} reads its capture, and captures/${key}.json does not exist; run figma:capture`,
      })
    )
  );
}

/** What builds an entry's set, or `CaptureUnreadable` for a kept capture the schema rejects. */
function setSource({ manifest }: KitEntry): Result.Result<SetSource, CaptureUnreadable | KitUnmappable> {
  return Result.flatMap(keptCaptureOf(manifest.key, manifest.name), (read) =>
    Result.flatMap(openPlacement(manifest), (open) => {
      const definition = positionedByBaseUi(withMeasuredHost(manifestDefinition(manifest), read), read);
      const placed =
        open?._tag === "nested" ? nestedComposite(definition, read, open) : Result.succeed(definition);
      return Result.map(placed, (drawn): SetSource => {
        const source: SetSource = { definition: drawn, capture: read };
        return open === undefined ? source : { ...source, open };
      });
    })
  );
}

/**
 * A capture-backed definition whose manifest names no host width, with the width the capture
 * measured around its root in each cell, where the root fills it and CSS, not the root's text, sets
 * it: a popup's `min-w-36` for a Select row, or the Input group a Combobox popup is as wide as.
 */
function withMeasuredHost(definition: ComponentDefinition, capture: SetCapture): ComponentDefinition {
  if (definition.previewWidth !== undefined || definition.previewWidthFor !== undefined) {
    return definition;
  }
  const widths = new Map(
    capture.cells.flatMap((cell) => {
      const width = cell.roots.length === 1 ? cell.roots[0].root.measured?.containerWidth : undefined;
      return width === undefined ? [] : [[cell.key, width] as const];
    })
  );
  return widths.size === 0
    ? definition
    : { ...definition, previewWidthFor: (cell) => widths.get(variantKey(definition, cell)) };
}

/**
 * A capture-backed definition whose root Base UI's positioner places, as every cell's one root
 * carrying its `data-side` says: the positioner is an absolute box with the popup's border box, so
 * it is the containing block of the popup's absolute parts, such as a Tooltip's arrow.
 */
function positionedByBaseUi(definition: ComponentDefinition, capture: SetCapture): ComponentDefinition {
  const placed = capture.cells.every(
    ({ roots }) => roots.length === 1 && roots[0].root.attributes["data-side"] !== undefined
  );
  const own = placed
    ? { ...definition, positionedBy: "Base UI's positioner, an absolute box with the popup's size" }
    : definition;
  return own.parts === undefined ? own : { ...own, parts: own.parts.map(withInnerPositioners) };
}

/** A part whose instance parts' inner definitions say what places their roots, as their captures show. */
function withInnerPositioners(
  part: PartDefinition | InstanceDefinition
): PartDefinition | InstanceDefinition {
  if (!("kind" in part)) {
    return part.parts === undefined ? part : { ...part, parts: part.parts.map(withInnerPositioners) };
  }
  const inner = keptCapture(part.of.key);
  return inner === undefined || Result.isFailure(inner)
    ? part
    : { ...part, of: positionedByBaseUi(part.of, inner.success) };
}

/**
 * How an open composite's manifest places its cells' roots: nested where it names the row its popup
 * opens beside, anchored where it names its popup's `sideOffset`, modal where it names the viewport
 * its Backdrop covers, or undefined for a set whose cells measure one root.
 */
function openPlacement(manifest: SetManifest): Result.Result<OpenPlacement | undefined, KitUnmappable> {
  if (manifest.union === undefined) {
    return Result.succeed(undefined);
  }
  if (manifest.anchor !== undefined) {
    return manifest.sideOffset === undefined
      ? Result.fail(
          new KitUnmappable({
            message: `${manifest.name} opens beside ${manifest.anchor.slot}, and its manifest names no sideOffset`,
          })
        )
      : Result.succeed({
          _tag: "nested",
          anchor: manifest.anchor.slot,
          sideOffset: manifest.sideOffset,
          alignOffset: manifest.anchor.alignOffset,
        });
  }
  if (manifest.sideOffset !== undefined) {
    return manifest.alignItemWithTrigger === true
      ? Result.fail(
          new KitUnmappable({
            message: `${manifest.name} opens its popup over its anchor, which the kit does not draw; its manifest must name alignItemWithTrigger false`,
          })
        )
      : Result.succeed({ _tag: "anchored", sideOffset: manifest.sideOffset });
  }
  return manifest.viewport === undefined
    ? Result.fail(
        new KitUnmappable({
          message: `${manifest.name} measures ${manifest.union.join(" and ")}, and its manifest names neither an anchored popup's sideOffset nor a modal popup's viewport`,
        })
      )
    : Result.succeed({ _tag: "modal", viewport: manifest.viewport });
}

/** Every class an element of the captures carries, around a root or below it. */
function capturedClasses(captures: readonly SetCapture[]): ReadonlySet<string> {
  const classes = new Set<string>();
  const visit = (element: SetCapture["page"][number]): void => {
    for (const className of element.classes) {
      classes.add(className);
    }
    for (const child of element.children) {
      visit(child);
    }
  };
  for (const capture of captures) {
    for (const { roots } of capture.cells) {
      for (const { around, root } of roots) {
        for (const element of [...around, root]) {
          visit(element);
        }
      }
    }
  }
  return classes;
}

/**
 * Build the registry's sets in one compile of every class their captures and `others` record, since
 * Tailwind emits a theme value and an `@property` registration only for a utility it compiles, which
 * says which custom properties inherit.
 *
 * @param others - Captures beside the sets' that the build reads with the same context, such as the
 *   text style samples'.
 * @returns The sets, in the registry's order and on their pages, and the context the mapping read.
 */
const buildSets = Effect.fnUntraced(function* (
  { variables, modes }: KitVariables,
  registry: readonly KitEntry[],
  others: readonly SetCapture[]
) {
  const sources = yield* Effect.forEach(registry, (entry) => Effect.fromResult(setSource(entry)), {
    concurrency: 1,
  });
  const captures = [...sources.map(({ capture }) => capture), ...others];
  const compiled = yield* compileUtilities([...capturedClasses(captures)]);
  const context = { compiled, variables, modes };
  const mapped = yield* Effect.fromResult(caughtUnmappable(() => buildSetsInOrder(sources, context)));
  // The builder returns one set per source, in the registry's order.
  const sets: readonly KitComponentSet[] = registry.flatMap(({ page }, index) => {
    const set = mapped[index];
    return set === undefined
      ? []
      : [{ ...set, componentSet: { ...set.componentSet, page: pageSpec(page).key } }];
  });
  return { sets, context };
});

/**
 * Build the kit's component sets alone, without the icon library or the previews.
 *
 * @returns Each set of `KIT`, in its order and on its page, with the coverage of the recipe
 *   classes it read and the font styles its text uses. The Effect fails with `KitUnmappable`,
 *   `KitSourceInvalid` or `KitToolFailed`, as {@link buildKit} does.
 */
export const buildComponentSets = Effect.fn("buildComponentSets")(function* () {
  return (yield* buildSets(yield* Effect.fromResult(kitVariables()), KIT, [])).sets;
});

/** The kit spec the plugin bundles, and the coverage of every recipe declaration. */
export type BuiltKit = {
  readonly spec: KitSpec;
  /** One coverage row per distinct outcome of each recipe declaration. */
  readonly coverage: readonly CoverageRow[];
  /** Each cell's drawn parts, by its variant's key, as `drawn-parts.ts` records them. */
  readonly drawn: ReadonlyMap<string, readonly DrawnPart[]>;
};

/**
 * Build the kit and its coverage, and check the kit against itself, so a spec the plugin would
 * refuse fails the build.
 *
 * @param registry - The sets to build, their pages and their preview cells. `figma:plugin` builds
 *   `KIT`.
 * @returns The kit and its coverage. The Effect fails with the `KitContradiction` the check found,
 *   with `KitUnmappable` where a recipe or a definition asks for what Figma cannot draw, with
 *   `KitSourceInvalid` where a Fuse source lacks what the kit needs, such as a mode a preview pins,
 *   and with `KitToolFailed` where Tailwind, rolldown or the temporary directory fails.
 */
export const buildKit = Effect.fn("buildKit")(function* (registry: readonly KitEntry[] = KIT) {
  const kitVariableSet = yield* Effect.fromResult(kitVariables());
  const { collections, variables } = kitVariableSet;
  const samples = yield* Effect.fromResult(keptCaptureOf(TEXT_STYLE_CAPTURE.key, "Text styles"));
  const { sets: built, context } = yield* buildSets(kitVariableSet, registry, [samples]);
  const glyphColor = readColor("var(--foreground)", variables);
  if (glyphColor === undefined) {
    return yield* new KitSourceInvalid({ message: "the variable set has no foreground for the icon glyphs" });
  }
  const icons: IconLibrarySpec = {
    key: "icons",
    name: "Icons",
    page: ICONS_PAGE.key,
    size: ICON_SIZE,
    color: glyphColor,
    icons: yield* fuseIcons(weightedIcons(registry.map(({ manifest }) => manifestDefinition(manifest)))),
  };
  for (const { componentSet } of built) {
    yield* Effect.fromResult(checkIconReferences(componentSet, icons));
  }

  const modeNames = new Map(collections.map((collection) => [collection.name, new Set(collection.modes)]));
  const themes: (Omit<(typeof PREVIEW_THEMES)[number], "modes"> & { readonly modes: ModeRef[] })[] = [];
  for (const theme of PREVIEW_THEMES) {
    const modes: ModeRef[] = Object.entries(theme.modes).map(([collection, mode]) => ({ collection, mode }));
    for (const { collection, mode } of modes) {
      if (modeNames.get(collection)?.has(mode) !== true) {
        return yield* new KitSourceInvalid({
          message: `the preview ${theme.key} pins ${collection} / ${mode}, which the variable set lacks`,
        });
      }
    }
    themes.push({ ...theme, modes });
  }
  const setsByKey = new Map(built.map(({ componentSet }) => [componentSet.key, componentSet]));
  const componentPages = [...new Map(registry.map(({ page }) => [page.slug, page])).values()];
  const previews = componentPages.flatMap((page) =>
    themes.map((theme): PreviewSpec => {
      const key = `preview/${page.slug}/${theme.key}`;
      return {
        key,
        name: `${page.name} / ${theme.name}`,
        page: pageSpec(page).key,
        modes: theme.modes,
        groups: registry
          .filter((entry) => entry.page.slug === page.slug)
          .map(({ manifest, previewCells }) => ({
            key: `${key}/${manifest.key}`,
            name: manifest.name,
            componentSet: manifest.key,
            instances: previewInstances(
              setsByKey.get(manifest.key),
              previewCells.map((cell) => variantKey(manifest, cell))
            ),
          })),
      };
    })
  );

  const textStyles = yield* Effect.fromResult(caughtUnmappable(() => buildTextStyles(samples, context)));
  const look = yield* Effect.fromResult(docsLook(variables, textStyles));
  const docs: PageDocsSpec[] = [];
  for (const page of componentPages) {
    const docsPage = yield* readDocsPage(page);
    docs.push(yield* Effect.fromResult(pageDocs(page, registry, setsByKey, docsPage, look)));
  }
  const fonts = new Map(
    built.flatMap((set) => set.fonts).map((font) => [`${font.family} ${font.style}`, font])
  );
  const spec: KitSpec = {
    pages: [...componentPages.map(pageSpec), ICONS_PAGE],
    fonts: [...fonts.values()],
    glyphFont: GLYPH_FONT,
    icons,
    componentSets: built.map((set) => set.componentSet),
    previews,
    textStyles,
    docs,
  };
  yield* Effect.fromResult(checkKitSpec(spec, (text) => Buffer.from(text, "base64")));
  const kit: BuiltKit = {
    spec,
    coverage: built.flatMap((set) => set.coverage),
    drawn: new Map(
      built.flatMap((set) => [...set.accounting].map(([cell, { parts }]) => [cell, parts] as const))
    ),
  };
  return kit;
});

/**
 * Check that every icon a set places, and every icon its swap properties start with, is one of
 * the library's, and that each icon layer's swap property is one the set defines.
 *
 * @param set - The built component set.
 * @param library - The icon library the kit ships.
 * @returns Nothing, or `KitSourceInvalid` when the set names an icon the library lacks, or links a
 *   property it does not define.
 */
export function checkIconReferences(
  set: Omit<ComponentSetSpec, "page">,
  library: IconLibrarySpec
): Result.Result<void, KitSourceInvalid> {
  const icons = new Set(library.icons.map((icon) => icon.key));
  const properties = new Set(set.swapProperties.map((property) => property.name));
  for (const property of set.swapProperties) {
    if (!icons.has(property.defaultIcon)) {
      return Result.fail(
        new KitSourceInvalid({
          message: `${set.name}: the ${property.name} property starts with ${property.defaultIcon}, which the library lacks`,
        })
      );
    }
  }
  for (const variant of set.variants) {
    for (const layer of walkLayers(variant.root)) {
      if (layer.kind !== "icon") {
        continue;
      }
      if (!icons.has(layer.icon)) {
        return Result.fail(
          new KitSourceInvalid({
            message: `${variant.key}: the ${layer.name} shows ${layer.icon}, which the library lacks`,
          })
        );
      }
      if (layer.swapProperty !== undefined && !properties.has(layer.swapProperty)) {
        return Result.fail(
          new KitSourceInvalid({
            message: `${variant.key}: the ${layer.name} links ${layer.swapProperty}, which ${set.name} does not define`,
          })
        );
      }
    }
  }
  return Result.succeed(undefined);
}

/** A FLOAT literal's number, or undefined for a literal of another type. */
function floatOf(value: LiteralValue): number | undefined {
  return value._tag === "Float" ? value.value : undefined;
}

/** A COLOR literal's alpha, or undefined for a literal of another type. */
function alphaOf(value: LiteralValue): number | undefined {
  return value._tag === "Color" ? value.color.a : undefined;
}

/**
 * The smallest or the largest number `read` takes from each variable's literal in any mode, as `pick`
 * chooses among its values: a FLOAT variable's number, or a COLOR variable's alpha. An alias can land
 * in any mode of its target, so it counts every value the target holds.
 */
function extremes(
  collections: readonly CollectionSpec[],
  pick: (...values: number[]) => number,
  read: (value: LiteralValue) => number | undefined
): (collection: string, name: string) => number | undefined {
  const specs = new Map<string, VariableSpec>(
    collections.flatMap((collection) =>
      collection.variables.map((variable) => [`${collection.name}/${variable.name}`, variable] as const)
    )
  );
  const memo = new Map<string, number | undefined>();
  const extremeOf = (collection: string, name: string): number | undefined => {
    const key = `${collection}/${name}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    // An alias cycle reads as unknown, and the sync refuses one anyway.
    memo.set(key, undefined);
    const values = [...(specs.get(key)?.values.values() ?? [])].map((value) => {
      return value._tag === "Alias" ? extremeOf(value.target.collection, value.target.variable) : read(value);
    });
    const extreme =
      values.length === 0 || values.includes(undefined)
        ? undefined
        : pick(...values.filter((value) => value !== undefined));
    memo.set(key, extreme);
    return extreme;
  };
  return extremeOf;
}

/**
 * The glyphs the kit's text holds that Roboto, the family the kit's `font-sans` holds, lacks: ⇧ (U+21E7)
 * and ⌘ (U+2318), in the Dropdown menu shortcuts. Inter draws both, and Figma ships it (G1).
 */
const GLYPH_FONT: GlyphFontSpec = { family: "Inter", glyphs: ["\u21E7", "\u2318"] };

const OUTCOME_ORDER: readonly CoverageOutcome[] = ["unmapped", "unshown", "dropped", "bound", "literal"];

/**
 * Render the coverage as a Markdown report: the count per outcome, then one table per outcome.
 *
 * @param coverage - The rows from {@link buildKit}.
 * @returns The report.
 */
export function renderCoverage(coverage: readonly CoverageRow[]): string {
  const cell = (text: string) => (text === "" ? " " : `\`${text.replaceAll("|", "\\|")}\``);
  const lines = ["# Component coverage", "", "| Outcome | Rows |", "| --- | --- |"];
  for (const outcome of OUTCOME_ORDER) {
    lines.push(`| ${outcome} | ${coverage.filter((row) => row.outcome === outcome).length} |`);
  }
  for (const outcome of OUTCOME_ORDER) {
    const rows = coverage
      .filter((row) => row.outcome === outcome)
      .toSorted(
        (left, right) =>
          left.className.localeCompare(right.className) || left.property.localeCompare(right.property)
      );
    if (rows.length === 0) {
      continue;
    }
    lines.push(
      "",
      `## ${outcome}`,
      "",
      "| Component | Part | Class | Property | Value | Detail |",
      "| --- | --- | --- | --- | --- | --- |"
    );
    for (const row of rows) {
      lines.push(
        `| ${row.component} | ${row.part} | ${cell(row.className)} | ${cell(row.property)} | ${cell(row.value)} | ${row.detail.replaceAll("|", "\\|")} |`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
