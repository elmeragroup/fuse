/**
 * `pnpm gen component <name>` — the v1 component scaffold (tooling.md §6).
 *
 * Emits the five artifacts a component ticket owns, and nothing else:
 *
 *   1. `packages/ui/src/components/<name>/<name>.tsx` + `<name>-variants.ts`
 *   2. `<name>.test.ts` (unit) and `<name>.browser.test.tsx` (browser)
 *   3. `packages/ui/src/components/<name>/demos/<name>-basic.tsx`
 *   4. `apps/docs/src/content/components/<name>.mdx`
 *   5. `packages/ui/src/<name>.ts` — the source entry facade
 *
 * It never touches `package.json#exports` or `src/index.ts`: the exports/barrel
 * generators (`pnpm --filter @elmeragroup/ui build`) discover the facade on their own.
 * The one injection is the size-limit budget row, which `size-limit` would otherwise
 * skip silently for a brand-new packed entry.
 *
 * This file sits outside any tsconfig project, so `node:child_process` and plop's own
 * (untyped) API resolve as `any`; `.oxlintrc.json` carves the `no-unsafe-*` rules out for
 * it, the same way it does for the oxlint plugins. Templates under `plop-templates/` are
 * not standalone TypeScript and are excluded from oxfmt and oxlint.
 *
 * Every stub is a skeleton that fails until the spec is implemented — the component
 * throws, the suites carry an explicit unimplemented marker, the browser stub's role
 * placeholder throws until it is set, and the injected budget row has a 0 ceiling.
 * Nothing here guesses at props or variants.
 */
import { execFileSync } from "node:child_process";

import { BARE_COMPONENT_ENTRIES, RAC_ENTRIES } from "./packages/ui/scripts/entries.ts";

const UI = "packages/ui";
const DOCS_CONTENT = "apps/docs/src/content/components";
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
      add("demo.tsx.hbs", `${UI}/src/components/{{name}}/demos/{{name}}-basic.tsx`),
      add("page.mdx.hbs", `${DOCS_CONTENT}/{{name}}.mdx`),
      add("facade.ts.hbs", `${UI}/src/{{name}}.ts`),
      {
        type: "append",
        path: BUDGETS,
        pattern: BUDGET_MARKER,
        // A brand-new packed entry has no measurement yet; 0 fails size-limit until the
        // implementer records measured × 1.5 (performance.md §2, how-to §6).
        template: `  { name: "{{name}}", entryFile: "{{name}}.js", ceilingGzip: 0 }, // TODO({{name}}): measured × 1.5`,
      },
      // Template line breaks cannot know how long a component name is, so the emitted
      // TypeScript is normalised here — `oxfmt --check` is part of the merge gate.
      (answers, _config, plop) => {
        execFileSync(
          "pnpm",
          ["exec", "oxfmt", `${UI}/src/${answers.name}.ts`, `${UI}/src/components/${answers.name}`, BUDGETS],
          { cwd: plop.getPlopfilePath(), stdio: "ignore" }
        );
        return "formatted with oxfmt";
      },
      (answers) =>
        [
          "next steps",
          `  1. Implement docs/spec/components/${answers.name}.md — every stub above fails until you do.`,
          "  2. pnpm --filter @elmeragroup/ui build   # exports + barrel generators pick the facade up",
          "  3. pnpm turbo run ci:checks --filter=@elmeragroup/ui --force",
        ].join("\n"),
    ],
  });
}
