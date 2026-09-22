/**
 * `pnpm gen component <name>` creates an unimplemented component, tests, demo,
 * docs page and facade, and registers its public entry and initial size budget.
 * Run generate:exports after implementation to update tracked package exports.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BARE_COMPONENT_ENTRIES,
  DEFERRED_ENTRIES,
  RAC_ENTRIES,
  NON_COMPONENT_JS_ENTRIES,
  TOOLING_ONLY_JS_ENTRIES,
  CSS_ENTRY_NAMES,
} from "./packages/fuse/scripts/entries.ts";

const FUSE = "packages/fuse";
/** One route directory per component page — the page, its demos and its `api.json`. */
const DOCS_ROUTE = "apps/docs/src/app/(docs)/components/{{name}}";
const TEMPLATES = "plop-templates/component";
const BUDGETS = `${FUSE}/scripts/size-budgets.ts`;
const BUDGET_MARKER = "// plop:js-entry-budget";

const ENTRIES = `${FUSE}/scripts/entries.ts`;
const ENTRY_MARKER = "// plop:component-entry";
const RESERVED_NAMES = new Set([
  ...NON_COMPONENT_JS_ENTRIES,
  ...TOOLING_ONLY_JS_ENTRIES.map((entry) => entry.subpath),
  ...CSS_ENTRY_NAMES,
  "index",
  "components",
  "hooks",
  "styles",
  "react-aria",
  "intl",
  "test",
]);

function validateName(name, root) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(String(name ?? ""))) {
    return "Use a lowercase kebab-case component name, starting with a letter.";
  }
  if (DEFERRED_ENTRIES.includes(name)) {
    return `"${name}" is deferred. Implement it through an explicit release change, including its DEFERRED_ENTRIES policy.`;
  }
  if (RAC_ENTRIES.includes(name)) {
    return `"${name}" is a quarantined react-aria entry; use the react-aria authoring workflow.`;
  }
  if (BARE_COMPONENT_ENTRIES.includes(name) || RESERVED_NAMES.has(name)) {
    return `"${name}" is already registered or reserved.`;
  }
  const targets = [
    `${FUSE}/src/${name}`,
    ...["ts", "tsx", "js", "jsx"].map((extension) => `${FUSE}/src/${name}.${extension}`),
    `${FUSE}/src/components/${name}`,
    DOCS_ROUTE.replace("{{name}}", name),
  ];
  if (targets.some((target) => existsSync(join(root, target)))) {
    return `"${name}" already has source or documentation files. No files were generated.`;
  }
  return true;
}

function preflight(answers, _config, plop) {
  const root = plop.getDestBasePath();
  const result = validateName(answers.name, root);
  if (result !== true) {
    throw new Error(result);
  }
  for (const [file, marker] of [
    [ENTRIES, ENTRY_MARKER],
    [BUDGETS, BUDGET_MARKER],
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    if (source.split(marker).length !== 2) {
      throw new Error(`Expected one ${marker} marker in ${file}. No files were generated.`);
    }
    if (source.includes(`"${answers.name}"`)) {
      throw new Error(`"${answers.name}" already appears in ${file}. No files were generated.`);
    }
  }
  return "name and registration targets checked";
}

function add(templateFile, path) {
  return { type: "add", path, templateFile: `${TEMPLATES}/${templateFile}` };
}

export default function plopfile(plop) {
  plop.setGenerator("component", {
    description: "Scaffold and register a new component: skeleton, recipe, tests, demo, docs page, facade",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "New component entry name (kebab-case)",
        validate: (name) => validateName(name, plop.getDestBasePath()),
      },
    ],
    actions: [
      preflight,
      add("variants.ts.hbs", `${FUSE}/src/components/{{name}}/{{name}}-variants.ts`),
      add("component.tsx.hbs", `${FUSE}/src/components/{{name}}/{{name}}.tsx`),
      add("unit-test.ts.hbs", `${FUSE}/src/components/{{name}}/{{name}}.test.ts`),
      add("browser-test.tsx.hbs", `${FUSE}/src/components/{{name}}/{{name}}.browser.test.tsx`),
      add("demo.tsx.hbs", `${DOCS_ROUTE}/demos/{{name}}-basic.tsx`),
      add("page.mdx.hbs", `${DOCS_ROUTE}/page.mdx`),
      add("facade.ts.hbs", `${FUSE}/src/{{name}}.ts`),
      {
        type: "append",
        path: ENTRIES,
        pattern: ENTRY_MARKER,
        template: '  "{{name}}",',
      },
      {
        type: "append",
        path: BUDGETS,
        pattern: BUDGET_MARKER,
        // A brand-new packed entry has no measurement yet; 0 fails size-limit until the
        // implementer records measuredGzip.
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
            `${FUSE}/src/${answers.name}.ts`,
            `${FUSE}/src/components/${answers.name}`,
            // Only the demos directory: `page.mdx` is not oxfmt's to format.
            `${DOCS_ROUTE.replace("{{name}}", answers.name)}/demos`,
            BUDGETS,
            ENTRIES,
          ],
          { cwd: plop.getDestBasePath(), stdio: "pipe" }
        );
        return "formatted with oxfmt";
      },
      (answers) =>
        [
          "next steps",
          `  1. Implement ${answers.name} using AGENTS.md; replace every failing placeholder.`,
          "  2. pnpm --filter @elmeragroup/fuse generate:exports  # rewrites tracked package.json#exports and src/index.ts",
          "  3. pnpm --filter @elmeragroup/fuse build             # dist + publish manifest; does not rewrite source exports",
          `  4. Author the page and demos; record required scenarios in apps/docs/test/fixtures/component-demo-requirements.json.`,
          "  5. pnpm --filter docs generate                    # writes the committed api.json next to the page",
          "  6. Record measuredGzip in packages/fuse/scripts/size-budgets.ts.",
          "  7. Add the component to apps/docs/test/fixtures/component-rsc-statuses.json, source-contracts.test.ts and public type/API checks.",
          "  8. pnpm ci:checks",
        ].join("\n"),
    ],
  });
}
