/**
 * Build the component kit the Fuse plugin applies: an icon component for every Fuse icon, the
 * Button and Icon button component sets from the Button recipe, preview frames that pin three
 * themes at both densities, and the coverage table of every recipe class.
 */
import { Result } from "effect";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { fuseVariableSet } from "../fuse-variable-set";
import type { CollectionSpec, VariableSpec } from "../variable-set";
import { BUTTON, ICON_BUTTON } from "./button-kit";
import { splitClassName } from "./class-name";
import { buildComponentSet, matrixCells, variantKey } from "./component-spec";
import type { Cell, ComponentDefinition, PageDeclaration } from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { makeVariableIndex, readColor } from "./css-values";
import { fuseIcons, ICON_SIZE } from "./icon-library";
import type { ComponentSetSpec, IconLibrarySpec, KitSpec, ModeRef, PreviewSpec } from "./kit-spec";
import { compileUtilities } from "./utility-css";

/** The three themes the preview frames pin, as the mode of each theme axis. */
const PREVIEW_THEMES = [
  {
    key: "internal-fkas-private-light",
    name: "Fjordkraft internal private, light",
    modes: {
      "Fuse tokens": "Light",
      "Fuse variant": "Internal",
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
    },
  },
  {
    key: "internal-elma-company-dark",
    name: "Elmera internal company, dark",
    modes: {
      "Fuse tokens": "Dark",
      "Fuse variant": "Internal",
      "Fuse segment": "Company",
      "Fuse brand": "Elmera",
    },
  },
  {
    key: "external-fkas-private-light",
    name: "Fjordkraft external private, light",
    modes: {
      "Fuse tokens": "Light",
      "Fuse variant": "External",
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
    },
  },
] as const;

const PREVIEW_DENSITIES = ["Dense", "Comfortable"] as const;

/** The component sets of the kit, each with the cells its preview frames place. */
const KIT = [
  {
    definition: BUTTON,
    previewCells: [
      ...previewCells(BUTTON, "default", { icon: "none" }),
      ...["start", "end"].flatMap((icon) =>
        axisValues(BUTTON, "variant").map((variant) => ({ variant, size: "default", state: "rest", icon }))
      ),
    ],
  },
  { definition: ICON_BUTTON, previewCells: previewCells(ICON_BUTTON, "icon", {}) },
];

/**
 * The page a Fuse host renders into. The docs layout sets `font-sans text-foreground` on
 * `<body>` (`apps/docs/src/app/(docs)/layout.tsx`), so a part whose recipe sets no text color
 * or family inherits these.
 */
const PAGE: readonly PageDeclaration[] = [
  { className: "body text-foreground", property: "color", value: "var(--foreground)" },
  { className: "body font-sans", property: "font-family", value: "var(--font-sans)" },
];

/**
 * Build the kit and its coverage.
 *
 * @returns The kit spec the plugin bundles, and one coverage row per distinct outcome of each
 *   recipe declaration.
 * @throws When the variable set does not build, or a preview names a mode it lacks.
 */
export async function buildKit(): Promise<{
  readonly spec: KitSpec;
  readonly coverage: readonly CoverageRow[];
}> {
  const variableSet = fuseVariableSet();
  if (Result.isFailure(variableSet)) {
    throw new Error(`the Fuse variable set does not build: ${String(variableSet.failure)}`);
  }
  const collections = variableSet.success.collections;
  const minimumOf = minimums(collections);
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
              },
            ]
      )
    )
  );
  const utilities = new Set(
    KIT.flatMap(({ definition }) =>
      matrixCells(definition.axes).flatMap((cell) =>
        definition
          .classesFor(cell)
          .split(/\s+/)
          .filter((className) => className !== "")
          .map((className) => splitClassName(className).utility)
      )
    )
  );
  const compiled = await compileUtilities([...utilities]);
  const built = KIT.map(({ definition }) =>
    buildComponentSet(definition, { compiled, variables, page: PAGE })
  );
  const glyphColor = readColor("var(--foreground)", variables);
  if (glyphColor === undefined) {
    throw new Error("the variable set has no foreground for the icon glyphs");
  }
  const icons: IconLibrarySpec = {
    key: "icons",
    name: "Icons",
    size: ICON_SIZE,
    color: glyphColor,
    icons: await fuseIcons(),
  };
  for (const { componentSet } of built) {
    checkIconReferences(componentSet, icons);
  }

  const modeNames = new Map(collections.map((collection) => [collection.name, new Set(collection.modes)]));
  const previews = PREVIEW_THEMES.flatMap((theme) =>
    PREVIEW_DENSITIES.flatMap((density) => {
      const modes: ModeRef[] = [
        ...Object.entries(theme.modes).map(([collection, mode]) => ({ collection, mode })),
        { collection: "Fuse density", mode: density },
      ];
      for (const { collection, mode } of modes) {
        if (modeNames.get(collection)?.has(mode) !== true) {
          throw new Error(
            `the preview ${theme.key} pins ${collection} / ${mode}, which the variable set lacks`
          );
        }
      }
      return KIT.map(({ definition, previewCells: cells }): PreviewSpec => ({
        key: `preview/${definition.key}/${theme.key}/${density.toLowerCase()}`,
        name: `${definition.name} / ${theme.name} / ${density}`,
        modes,
        componentSet: definition.key,
        variants: cells.map((cell) => variantKey(definition, cell)),
      }));
    })
  );

  return {
    spec: {
      page: { key: "page/components", name: "Fuse components" },
      fonts: [...new Set(built.flatMap((set) => set.fontStyles))].map((style) => ({
        family: defaultFontFamily(),
        style,
      })),
      icons,
      componentSets: built.map((set) => set.componentSet),
      previews,
    },
    coverage: built.flatMap((set) => set.coverage),
  };
}

/**
 * Check that every icon a set places, and every icon its swap properties start with, is one of
 * the library's, and that each icon layer's swap property is one the set defines.
 *
 * @param set - The built component set.
 * @param library - The icon library the kit ships.
 * @throws When the set names an icon the library lacks, or links a property it does not define.
 */
export function checkIconReferences(set: ComponentSetSpec, library: IconLibrarySpec): void {
  const icons = new Set(library.icons.map((icon) => icon.key));
  const properties = new Set(set.swapProperties.map((property) => property.name));
  for (const property of set.swapProperties) {
    if (!icons.has(property.defaultIcon)) {
      throw new Error(
        `${set.name}: the ${property.name} property starts with ${property.defaultIcon}, which the library lacks`
      );
    }
  }
  for (const variant of set.variants) {
    for (const child of variant.root.children) {
      if (child.kind !== "icon") {
        continue;
      }
      if (!icons.has(child.icon)) {
        throw new Error(`${variant.key}: the ${child.name} shows ${child.icon}, which the library lacks`);
      }
      if (child.swapProperty !== undefined && !properties.has(child.swapProperty)) {
        throw new Error(
          `${variant.key}: the ${child.name} links ${child.swapProperty}, which ${set.name} does not define`
        );
      }
    }
  }
}

/**
 * The smallest number each FLOAT variable holds in any mode. An alias can land in any mode of
 * its target, so it counts every value the target holds.
 */
function minimums(
  collections: readonly CollectionSpec[]
): (collection: string, name: string) => number | undefined {
  const specs = new Map<string, VariableSpec>(
    collections.flatMap((collection) =>
      collection.variables.map((variable) => [`${collection.name}/${variable.name}`, variable] as const)
    )
  );
  const memo = new Map<string, number | undefined>();
  const minimumOf = (collection: string, name: string): number | undefined => {
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
          return minimumOf(value.target.collection, value.target.variable);
        default:
          return undefined;
      }
    });
    const minimum =
      values.length === 0 || values.includes(undefined)
        ? undefined
        : Math.min(...values.filter((value) => value !== undefined));
    memo.set(key, minimum);
    return minimum;
  };
  return minimumOf;
}

function axisValues(definition: ComponentDefinition, name: string): readonly string[] {
  return definition.axes.find((axis) => axis.name === name)?.values ?? [];
}

/**
 * Every state of each variant at the base size, then each variant at rest at every other
 * size. `fixed` sets the cell's other axes.
 */
function previewCells(definition: ComponentDefinition, baseSize: string, fixed: Cell): Cell[] {
  const variants = axisValues(definition, "variant");
  return [
    ...variants.flatMap((variant) =>
      axisValues(definition, "state").map((state) => ({ ...fixed, variant, size: baseSize, state }))
    ),
    ...axisValues(definition, "size")
      .filter((size) => size !== baseSize)
      .flatMap((size) => variants.map((variant) => ({ ...fixed, variant, size, state: "rest" }))),
  ];
}

/** The family `font-sans` resolves to, which every theme shares. The plugin loads it. */
function defaultFontFamily(): string {
  const families = new Set(
    resolveThemeCatalog().themes.flatMap((theme) =>
      Object.values(theme.schemes).map((scheme) => scheme.tokens["font-sans"].value)
    )
  );
  const [family, ...others] = families;
  if (family === undefined || others.length > 0) {
    throw new Error(`the themes disagree on font-sans: ${[...families].join(", ")}`);
  }
  return family;
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
      "| Component | Class | Property | Value | Detail |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const row of rows) {
      lines.push(
        `| ${row.component} | ${cell(row.className)} | ${cell(row.property)} | ${cell(row.value)} | ${row.detail.replaceAll("|", "\\|")} |`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
