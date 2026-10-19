/**
 * Build the component kit the Fuse plugin applies: the Button component set from its recipe,
 * preview frames that pin three themes at both densities, and the coverage table of every
 * recipe class.
 */
import { Result } from "effect";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { fuseVariableSet } from "../fuse-variable-set";
import { BUTTON } from "./button-kit";
import { splitClassName } from "./class-name";
import { buildComponentSet, matrixCells, variantKey } from "./component-spec";
import type { PageDeclaration } from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { KitSpec, ModeRef, PreviewSpec } from "./kit-spec";
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
  const variables = makeVariableIndex(
    collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        variable.webSyntax === undefined
          ? []
          : [{ ref: { collection: collection.name, name: variable.name }, webSyntax: variable.webSyntax }]
      )
    )
  );
  const utilities = new Set(
    matrixCells(BUTTON.axes).flatMap((cell) =>
      BUTTON.classesFor(cell)
        .split(/\s+/)
        .filter((className) => className !== "")
        .map((className) => splitClassName(className).utility)
    )
  );
  const compiled = await compileUtilities([...utilities]);
  const button = buildComponentSet(BUTTON, { compiled, variables, page: PAGE });

  const modeNames = new Map(collections.map((collection) => [collection.name, new Set(collection.modes)]));
  const previews = PREVIEW_THEMES.flatMap((theme) =>
    PREVIEW_DENSITIES.map((density): PreviewSpec => {
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
      return {
        key: `preview/${theme.key}/${density.toLowerCase()}`,
        name: `Button / ${theme.name} / ${density}`,
        modes,
        componentSet: BUTTON.key,
        variants: previewCells().map((cell) => variantKey(BUTTON, cell)),
      };
    })
  );

  return {
    spec: {
      page: { key: "page/components", name: "Fuse components" },
      fonts: button.fontStyles.map((style) => ({ family: defaultFontFamily(), style })),
      componentSets: [button.componentSet],
      previews,
    },
    coverage: button.coverage,
  };
}

/** Every state of each variant at the default size, then the start icon and the sm size at rest. */
function previewCells() {
  const variants = ["default", "outline", "destructive"];
  return [
    ...variants.flatMap((variant) =>
      ["rest", "hover", "focus", "disabled"].map((state) => ({
        variant,
        size: "default",
        state,
        icon: "none",
      }))
    ),
    ...variants.map((variant) => ({ variant, size: "default", state: "rest", icon: "start" })),
    ...variants.map((variant) => ({ variant, size: "sm", state: "rest", icon: "none" })),
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
