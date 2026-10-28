/**
 * Build the component kit the Fuse plugin applies: a page for each component, holding the
 * component sets of `kit-registry.ts` and four preview frames, and an `Icons` page holding an
 * icon component for every Fuse icon. It also builds the coverage table of every recipe class.
 */
import { Effect, Result } from "effect";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { fuseVariableSet } from "../fuse-variable-set";
import type { CollectionSpec, VariableSpec } from "../variable-set";
import { KitSourceInvalid, KitUnmappable } from "./build-errors";
import { buildSetsInOrder } from "./component-builder";
import { definitionClasses, variantKey } from "./component-spec";
import type { BuiltComponent, OuterDeclaration } from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { makeVariableIndex, pinnedIndex, readColor } from "./css-values";
import type { ModeView, VariableIndex } from "./css-values";
import { fuseIcons, ICON_SIZE } from "./icon-library";
import { checkKitSpec } from "./kit-check";
import { KIT } from "./kit-registry";
import type { KitEntry, KitPage } from "./kit-registry";
import { walkLayers } from "./kit-spec";
import type {
  ComponentSetSpec,
  GlyphFontSpec,
  IconLibrarySpec,
  KitSpec,
  ModeRef,
  PageSpec,
  PreviewSpec,
} from "./kit-spec";
import { baseBorderColor, compileUtilities } from "./utility-css";

/**
 * A theme the previews pin: Fjordkraft private in one variant and color scheme. Density `Auto`
 * follows the variant, so an internal theme renders dense and an external one comfortable, as a
 * Fuse host renders them.
 */
function previewTheme(variant: "Internal" | "External", scheme: "Light" | "Dark") {
  return {
    key: `${variant.toLowerCase()}-fkas-private-${scheme.toLowerCase()}`,
    name: `Fjordkraft ${variant.toLowerCase()} private, ${scheme.toLowerCase()}`,
    modes: {
      "Fuse tokens": scheme,
      "Fuse variant": variant,
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
      "Fuse density": "Auto",
    },
  };
}

/**
 * The four themes each component page previews. A designer switches a preview's modes to see
 * the others.
 */
const PREVIEW_THEMES = [
  previewTheme("Internal", "Light"),
  previewTheme("Internal", "Dark"),
  previewTheme("External", "Light"),
  previewTheme("External", "Dark"),
];

/** The page that holds the icon library alone. */
const ICONS_PAGE: PageSpec = { key: "page/icons", name: "Icons" };

function pageSpec(page: KitPage): PageSpec {
  return { key: `page/${page.slug}`, name: page.name };
}

/**
 * The page a Fuse host renders into. The docs layout sets `font-sans text-foreground` on
 * `<body>` (`apps/docs/src/app/(docs)/layout.tsx`), so a part whose recipe sets no text color
 * or family inherits these.
 */
const PAGE: readonly OuterDeclaration[] = [
  { className: "body text-foreground", property: "color", value: "var(--foreground)" },
  { className: "body font-sans", property: "font-family", value: "var(--font-sans)" },
];

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
  const minimumOf = extremes(collections, Math.min);
  const maximumOf = extremes(collections, Math.max);
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
 * Map the registry's sets, in order. The mapping throws `KitUnmappable` from deep in the cascade and
 * the part mappers, where a definition asks for what Figma cannot draw, and this is the one place
 * that catches it, as `checkKitSpec` catches `KitContradiction`.
 *
 * @param registry - The sets to build.
 * @param context - What the mapping reads.
 * @returns Each entry and its built set, or the `KitUnmappable` the mapping threw.
 * @throws Any other error, a defect of the mapping.
 */
function mapSets(
  registry: readonly KitEntry[],
  context: Parameters<typeof buildSetsInOrder>[1]
): Result.Result<ReturnType<typeof buildSetsInOrder<KitEntry>>, KitUnmappable> {
  try {
    return Result.succeed(buildSetsInOrder(registry, context));
  } catch (thrown) {
    if (thrown instanceof KitUnmappable) {
      return Result.fail(thrown);
    }
    throw thrown;
  }
}

const buildSets = Effect.fnUntraced(function* (
  { variables, modes }: KitVariables,
  registry: readonly KitEntry[]
) {
  const classes = new Set(registry.flatMap(({ definition }) => definitionClasses(definition)));
  const compiled = yield* compileUtilities([...classes]);
  // The base layer's border color sets the color on each element, so a part does not inherit it
  // the way it inherits `PAGE`, and any utility that colors the border wins over it. The outline
  // Badge sets no border color, so its stroke binds `border`.
  const borderColor = yield* Effect.fromResult(baseBorderColor(compiled));
  const base: readonly OuterDeclaration[] = [{ className: "fuse.css base layer", ...borderColor }];
  const mapped = yield* Effect.fromResult(
    mapSets(registry, { compiled, variables, page: PAGE, base, modes })
  );
  const sets: readonly KitComponentSet[] = mapped.map(([{ page }, set]) => ({
    ...set,
    componentSet: { ...set.componentSet, page: pageSpec(page).key },
  }));
  return sets;
});

/**
 * Build the kit's component sets alone, without the icon library or the previews.
 *
 * @returns Each set of `KIT`, in its order and on its page, with the coverage of the recipe
 *   classes it read and the font styles its text uses. The Effect fails with `KitUnmappable`,
 *   `KitSourceInvalid` or `KitToolFailed`, as {@link buildKit} does.
 */
export const buildComponentSets = Effect.fn("buildComponentSets")(function* () {
  return yield* buildSets(yield* Effect.fromResult(kitVariables()), KIT);
});

/** The kit spec the plugin bundles, and the coverage of every recipe declaration. */
export type BuiltKit = {
  readonly spec: KitSpec;
  /** One coverage row per distinct outcome of each recipe declaration. */
  readonly coverage: readonly CoverageRow[];
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
  const built = yield* buildSets(kitVariableSet, registry);
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
    icons: yield* fuseIcons,
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
          .map(({ definition, previewCells }) => ({
            key: `${key}/${definition.key}`,
            name: definition.name,
            componentSet: definition.key,
            variants: previewCells.map((cell) => variantKey(definition, cell)),
          })),
      };
    })
  );

  const fontStyles = [...new Set(built.flatMap((set) => set.fontStyles))];
  const family = fontStyles.length === 0 ? "" : yield* Effect.fromResult(defaultFontFamily());
  const spec: KitSpec = {
    pages: [...componentPages.map(pageSpec), ICONS_PAGE],
    fonts: fontStyles.map((style) => ({ family, style })),
    glyphFont: GLYPH_FONT,
    icons,
    componentSets: built.map((set) => set.componentSet),
    previews,
  };
  yield* Effect.fromResult(checkKitSpec(spec, (text) => Buffer.from(text, "base64")));
  const kit: BuiltKit = { spec, coverage: built.flatMap((set) => set.coverage) };
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

/**
 * The smallest or the largest number each FLOAT variable holds in any mode, as `pick` chooses among
 * its values. An alias can land in any mode of its target, so it counts every value the target holds.
 */
function extremes(
  collections: readonly CollectionSpec[],
  pick: (...values: number[]) => number
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
      switch (value._tag) {
        case "Float":
          return value.value;
        case "Alias":
          return extremeOf(value.target.collection, value.target.variable);
        default:
          return undefined;
      }
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
 * The glyphs the kit's text holds that Roboto, the family `font-sans` resolves to, lacks: ⇧ (U+21E7)
 * and ⌘ (U+2318), in the Dropdown menu shortcuts. Inter draws both, and Figma ships it (G1).
 */
const GLYPH_FONT: GlyphFontSpec = { family: "Inter", glyphs: ["\u21E7", "\u2318"] };

/** The family `font-sans` resolves to, which every theme shares. The plugin loads it. */
function defaultFontFamily(): Result.Result<string, KitSourceInvalid> {
  const families = new Set(
    resolveThemeCatalog().themes.flatMap((theme) =>
      Object.values(theme.schemes).map((scheme) => scheme.tokens["font-sans"].value)
    )
  );
  const [family, ...others] = families;
  if (family === undefined || others.length > 0) {
    return Result.fail(
      new KitSourceInvalid({ message: `the themes disagree on font-sans: ${[...families].join(", ")}` })
    );
  }
  return Result.succeed(family);
}

const OUTCOME_ORDER: readonly CoverageOutcome[] = ["unmapped", "dropped", "bound", "literal"];

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
