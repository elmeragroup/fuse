/**
 * `pnpm gen component <name>` — the v1 component scaffold (tooling.md §6).
 *
 * Emits the five artifacts a component ticket owns, and nothing else:
 *
 *   1. `packages/ui/src/components/<name>/<name>.tsx` + `<name>-variants.ts`
 *   2. `<name>.test.ts` (unit) and `<name>.browser.test.tsx` (browser)
 *   3. `apps/docs/src/app/(docs)/components/<name>/demos/<name>-basic.tsx`
 *   4. `apps/docs/src/app/(docs)/components/<name>/page.mdx`
 *   5. `packages/ui/src/<name>.ts` — the source entry facade
 *
 * It never touches `package.json#exports` or `src/index.ts`: `pnpm --filter
 * @elmeragroup/ui generate:exports` rewrites those tracked files once the facade
 * exists. The package build still produces `dist` from the discovered entries but
 * never mutates the source exports map.
 * The one injection is the size-limit budget row, which `size-limit` would otherwise
 * skip silently for a brand-new packed entry.
 *
 * This file sits outside any tsconfig project, so `node:child_process` and plop's own
 * (untyped) API resolve as `any`; `.oxlintrc.json` carves the `no-unsafe-*` rules out for
 * it, the same way it does for the oxlint plugins. Templates under `plop-templates/` are
 * not standalone TypeScript and are excluded from oxfmt and oxlint.
 *
 * Every stub is a skeleton that fails until the component is implemented — the component
 * throws, the suites carry an explicit unimplemented marker, the browser stub's role
 * placeholder throws until it is set, and the injected budget row has a 0 ceiling.
 * Nothing here guesses at props or variants.
 *
 * The two docs artifacts fail the same way rather than rendering an empty page: the docs
 * generation pass reads the authored `page.mdx` and hard-fails on an undocumented public
 * prop or an unresolvable type (docs-site.md §8), so `pnpm --filter docs generate` is red
 * with the offending prop named until the component is documented, and the page's
 * `<ApiReference>` throws during prerendering while its committed `api.json` is absent.
 */
import { execFileSync } from "node:child_process";

import { BARE_COMPONENT_ENTRIES, RAC_ENTRIES } from "./packages/ui/scripts/entries.ts";

const UI = "packages/ui";
/** One route directory per component page — the page, its demos and its `api.json` (§6). */
const DOCS_ROUTE = "apps/docs/src/app/(docs)/components/{{name}}";
const TEMPLATES = "plop-templates/component";
const BUDGETS = `${UI}/scripts/size-budgets.ts`;
const BUDGET_MARKER = "// plop:js-entry-budget";

/** Kebab names sharing a three-character prefix with the typed name, so a typo gets a pointed hint. */
function nearestEntries(name) {
  return BARE_COMPONENT_ENTRIES.filter(
    (entry) => entry.startsWith(name.slice(0, 3)) || name.startsWith(entry.slice(0, 3))
  );
}

function rejectUnknownName(name) {
  const trimmed = String(name ?? "").trim();
  if (trimmed === "") {
    return "A component name is required.";
  }
  if (BARE_COMPONENT_ENTRIES.includes(trimmed)) {
    return true;
  }
  const rac = RAC_ENTRIES.includes(trimmed);
  const near = nearestEntries(trimmed);
  return [
    `"${trimmed}" is not an Appendix A component entry.`,
    rac
      ? `It is a quarantined react-aria interim entry (RAC_ENTRIES); those live in ${UI}/src/react-aria/ and are not scaffolded by this generator.`
      : "",
    near.length === 0 ? "" : `Did you mean: ${near.join(", ")}?`,
    `The canonical list is BARE_COMPONENT_ENTRIES in ${UI}/scripts/entries.ts (Appendix A, ${BARE_COMPONENT_ENTRIES.length} entries):`,
    BARE_COMPONENT_ENTRIES.join(", "),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function add(templateFile, path) {
  return { type: "add", path, templateFile: `${TEMPLATES}/${templateFile}` };
}

export default function plopfile(plop) {
  plop.setGenerator("component", {
    description: "Scaffold an Appendix A component: skeleton, recipe, tests, demo, docs page, facade",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Component entry name (kebab-case, from the Appendix A manifest)",
        validate: rejectUnknownName,
      },
    ],
    actions: [
      add("variants.ts.hbs", `${UI}/src/components/{{name}}/{{name}}-variants.ts`),
      add("component.tsx.hbs", `${UI}/src/components/{{name}}/{{name}}.tsx`),
      add("unit-test.ts.hbs", `${UI}/src/components/{{name}}/{{name}}.test.ts`),
      add("browser-test.tsx.hbs", `${UI}/src/components/{{name}}/{{name}}.browser.test.tsx`),
      add("demo.tsx.hbs", `${DOCS_ROUTE}/demos/{{name}}-basic.tsx`),
      add("page.mdx.hbs", `${DOCS_ROUTE}/page.mdx`),
      add("facade.ts.hbs", `${UI}/src/{{name}}.ts`),
      {
        type: "append",
        path: BUDGETS,
        pattern: BUDGET_MARKER,
        // A brand-new packed entry has no measurement yet; 0 fails size-limit until the
        // implementer records measuredGzip (performance.md §2, how-to §6).
        template: `  { name: "{{name}}", entryFile: "{{name}}.js", measuredGzip: 0 }, // TODO({{name}}): record measuredGzip`,
      },
      // Template line breaks cannot know how long a component name is, so the emitted
      // TypeScript is normalised here — `oxfmt --check` is part of the merge gate.
      (answers, _config, plop) => {
        execFileSync(
          "pnpm",
          [
            "exec",
            "oxfmt",
            `${UI}/src/${answers.name}.ts`,
            `${UI}/src/components/${answers.name}`,
            // Only the demos directory: `page.mdx` is not oxfmt's to format.
            `${DOCS_ROUTE.replace("{{name}}", answers.name)}/demos`,
            BUDGETS,
          ],
          { cwd: plop.getPlopfilePath(), stdio: "ignore" }
        );
        return "formatted with oxfmt";
      },
      (answers) =>
        [
          "next steps",
          `  1. Implement ${answers.name} using docs/component-authoring.md; replace every failing placeholder.`,
          "  2. pnpm --filter @elmeragroup/ui generate:exports  # rewrites tracked package.json#exports and src/index.ts",
          "  3. pnpm --filter @elmeragroup/ui build             # dist + publish manifest; does not rewrite source exports",
          `  4. Author the page and demos; record required scenarios in apps/docs/test/fixtures/component-demo-requirements.json.`,
          "  5. pnpm --filter docs generate                    # writes the committed api.json next to the page",
          "  6. pnpm turbo run ci:checks --force",
        ].join("\n"),
    ],
  });
}
