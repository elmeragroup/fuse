/**
 * The `api.json` drift check.
 *
 * `api.json` is generated *and* committed, so it can go stale: someone edits a JSDoc
 * comment or a prop's type in `packages/fuse` and the artifact next to the page still
 * describes the old API. This is the check that refuses to let that land, and it looks
 * at staleness from both sides:
 *
 *   • a `check`-mode regeneration must find every artifact in the working tree byte-equal
 *     to what it would write — it fails naming each stale file — which catches a
 *     hand-edit and a stale file in any run that has not just generated;
 *   • the last generation pass must have rewritten nothing, which catches the case where
 *     generation ran *first* (the `test` task depends on `build`) and quietly repaired the
 *     stale file before this test could see it.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { generateDocsApiArtifacts, STALE_HINT } from "../scripts/lib/api-artifact.ts";
import { componentSlugs, resolveComponentPaths } from "../scripts/lib/components.ts";
import { docsApiInventory } from "../scripts/lib/docs-inspection.ts";
import { functionReferences } from "../scripts/lib/function-reference.ts";
import { repoRelative } from "../scripts/lib/paths.ts";
import { API_ARTIFACTS_REWRITTEN } from "../src/generated/api-drift";
import { API_REGEN_COMMAND } from "../src/lib/docs-model.ts";

describe("committed api.json", () => {
  // The long timeout is the regeneration itself: the package opens a full TypeScript
  // program over packages/fuse and re-derives every component's API through the checker.
  it("matches a fresh regeneration from the library's types and JSDoc", { timeout: 180_000 }, async () => {
    const slugs = componentSlugs();
    expect(slugs.length).toBeGreaterThan(0);

    // Rejects with a `DocsGenerationError` naming each stale file and the regen command,
    // or any extraction problem — the same ones that fail the docs build, which a drift
    // run must not be the place they first go unnoticed.
    const regenerated = await generateDocsApiArtifacts("check");

    for (const slug of slugs) {
      const artifact = regenerated.artifacts.get(slug);
      expect(artifact, `${slug} was not regenerated`).toBeDefined();
      expect(artifact?.changed, `${slug}/api.json is stale. ${STALE_HINT}`).toBe(false);
      expect(readFileSync(resolveComponentPaths(slug).apiFile, "utf8"), slug).toBe(artifact?.text);
    }
    // The package accepts `unsupported-type-fallback` for documented shapes and reports
    // it; anything else it would have failed on. The docs also accept the omitted
    // `--chart-color-${string}` index signature, in the one module that declares it. Keep the
    // accepted set visible here.
    for (const entry of regenerated.diagnostics) {
      const where = repoRelative(entry.warning.filePath);
      expect(
        entry.warning.code === "unsupported-type-fallback" ||
          (entry.warning.code === "omitted-index-signature" &&
            where === "packages/fuse/src/components/chart/chart-types.ts"),
        `${entry.component}: ${entry.warning.message}`
      ).toBe(true);
    }
  });

  it("was already up to date when the last generation pass ran", () => {
    expect(
      API_ARTIFACTS_REWRITTEN,
      `The committed api.json of ${API_ARTIFACTS_REWRITTEN.join(", ")} did not match packages/fuse. ${STALE_HINT}`
    ).toEqual([]);
  });

  it("tells a reader in the file that it is generated, and how to regenerate it", () => {
    for (const slug of componentSlugs()) {
      const text = readFileSync(resolveComponentPaths(slug).apiFile, "utf8");
      expect(text, slug).toContain('"$generated"');
      expect(text, slug).toContain(API_REGEN_COMMAND);
      expect(text, slug).toContain("never hand-edit");
    }
  });
});

/**
 * Unit under test: the function reference beside the committed `api.json`.
 * Oracle: the signatures and `@param` and `@returns` text written in
 * `packages/fuse/src/components/chart/chart-format.ts` and `use-chart-point.ts`, copied here by hand.
 */
describe("function references", () => {
  const references = functionReferences(
    docsApiInventory(
      ["chart", "sparkline", "combobox", "toast", "focusable"].map((slug) => ({
        slug,
        paths: resolveComponentPaths(slug),
      }))
    )
  );
  const chart = references.pages.get("chart");

  it("describes the chart page's three functions by signature, parameters and return value", () => {
    expect([...(chart?.keys() ?? [])]).toEqual(["useChartPoint", "formatChartValue", "formatChartSlot"]);
    const { description: pointDescription, ...point } = chart?.get("useChartPoint") ?? {};
    expect(pointDescription).toContain(
      "The active point of the enclosing chart, or null when nothing is active."
    );
    expect(point).toEqual({
      signature: "useChartPoint(): ChartPoint | null",
      parameters: [],
      returns: { type: "ChartPoint | null", description: "The active point, or null." },
    });
    const { description: valueDescription, ...value } = chart?.get("formatChartValue") ?? {};
    expect(valueDescription).toContain("A value as the chart prints it");
    expect(value).toEqual({
      signature:
        "formatChartValue(value: number, format: ValueFormat | undefined, options: { readonly locale: SupportedLocale; }): FormattedText",
      parameters: [
        { name: "value", type: "number", optional: false, description: "The value to print." },
        {
          name: "format",
          type: "ValueFormat | undefined",
          optional: false,
          description: "Intl number options or a Fuse preset. Without one, the locale's plain number.",
        },
        {
          name: "options",
          type: "{ readonly locale: SupportedLocale; }",
          optional: false,
          description: "The locale to print in.",
        },
      ],
      returns: {
        type: "FormattedText",
        description:
          "The visual and spoken text, with canonical spaces, so server and client agree byte for byte.",
      },
    });
    const slot = chart?.get("formatChartSlot");
    expect(slot?.description).toBe(
      "The label of the slot that contains `at`, such as the text `17\u201318` with the spoken form " +
        "`kl. 17 til 18` for an hour. A day, week, month or year starts at the first instant of its first " +
        "local date in `timeZone`, and a shorter slot steps its fixed length from the first instant of its " +
        "day. So any instant inside the slot gives the same label, and a week's `date` label names its " +
        "Monday. `format` picks a preset or Intl date options. The default is the interval's label " +
        "preset, such as `hour-range` for an hour and `date` for a day. When Intl options hold both date " +
        "and time fields, Fuse joins the two halves itself with the CLDR 48 pattern for English, " +
        "Norwegian Bokmål, Swedish or Finnish, so every engine prints the same label. The `time-seconds` " +
        "preset of a `second` interval has no recipe yet and throws a `RangeError`."
    );
    expect(slot?.signature).toBe(
      "formatChartSlot(at: ChartInstant, interval: Interval, options: { readonly locale: SupportedLocale; readonly timeZone: string; readonly format?: XFormat | undefined; }): FormattedText"
    );
    expect(slot?.parameters.map(({ name, description }) => [name, description])).toEqual([
      ["at", "Any instant inside the slot."],
      ["interval", "The slot length."],
      ["options", "The locale, the IANA zone of the data's market and an optional format."],
    ]);
    expect(slot?.returns).toEqual({
      type: "FormattedText",
      description: "The visual and spoken label, with canonical spaces.",
    });
  });

  // Oracle: the declarations in packages/fuse/src/components/toast/toast.tsx and React Aria's
  // useFocusable, copied by hand with their type parameters, constraints and defaults.
  it("prints a generic function's type parameters with their constraints and defaults", () => {
    expect(references.pages.get("toast")?.get("Toast.useToastManager")?.signature).toBe(
      "Toast.useToastManager<Data extends object = object>(): UseToastManagerReturnValue<Data>"
    );
    const focusable = references.pages.get("focusable")?.get("useFocusable");
    expect(focusable?.signature).toBe(
      "useFocusable<T extends FocusableElement = FocusableElement>(props: FocusableOptions<T>, domRef: RefObject<FocusableElement | null>): FocusableAria"
    );
    expect(focusable?.parameters.map(({ name, description }) => [name, description])).toEqual([
      [
        "props",
        "The focus options, such as `autoFocus`, `excludeFromTabOrder` and the focus and keyboard handlers.",
      ],
      ["domRef", "The ref of the element to make focusable."],
    ]);
  });

  it("leaves components to the props tables and keeps an existing hook a function", () => {
    expect(chart?.has("Chart.Root")).toBe(false);
    expect(references.pages.has("sparkline")).toBe(false);
    expect([...(references.pages.get("combobox")?.keys() ?? [])]).toEqual(["useComboboxAnchor"]);
  });
});
