import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, matchesGlob, relative } from "node:path";
import {
  isArrayLiteralExpression,
  isExpressionStatement,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
} from "tsrs/ast";
import { getLeadingCommentRanges, skipTrivia } from "tsrs/ast/scanner";
import { API } from "tsrs/sync";
import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

import lintConfig from "../oxlint.config.ts";
import { asRecord, asRecordArray, asString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

// The Effect rules are configured twice. tooling/typescript/effect.json, the language-service preset
// every tsconfig extends, decides each rule and holds the options the rules read. .oxlintrc.effect.json
// is the gate `pnpm lint:effect` runs through the Effect-patched oxlint, which runs only the rules the
// gate names. Stock oxlint cannot load a config that names the `effecttsgo` plugin, so the gate
// cannot live in oxlint.config.ts. These cases hold the two to one decision per rule, the gate to the
// main pass's scope and the catalog's compiler, and the `lint:effect` script to what it must catch.

const PRESET_PATH = "tooling/typescript/effect.json";

/** The language-service plugin's name in a tsconfig's `compilerOptions.plugins`. */
const LANGUAGE_SERVICE = "@effect/language-service";

/** The compiler's own config reader and project loader. */
const compiler = new API({ cwd: repoRoot });
afterAll(() => {
  compiler.close();
});

/** @param {string} path */
function read(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

/**
 * A committed JSONC file, read as the compiler reads a tsconfig.
 * @param {string} path
 */
function readJsonc(path) {
  const { config, error } = compiler.readConfigFile(join(repoRoot, path));
  if (error !== undefined) throw new Error(`${path} does not parse: ${JSON.stringify(error)}`);
  return asRecord(config, path);
}

/**
 * The value of a JSON object's property, in a config source file the compiler parsed.
 * @param {import("tsrs/ast").Node | undefined} object
 * @param {string} name
 * @returns {import("tsrs/ast").Expression | undefined}
 */
function propertyValue(object, name) {
  if (object === undefined || !isObjectLiteralExpression(object)) return undefined;
  for (const property of object.properties) {
    if (isPropertyAssignment(property) && isStringLiteral(property.name) && property.name.text === name) {
      return property.initializer;
    }
  }
  return undefined;
}

/**
 * A config source file's root JSON object.
 * @param {import("tsrs/ast").SourceFile | undefined} sourceFile
 */
function rootObject(sourceFile) {
  const [statement] = sourceFile?.statements ?? [];
  return statement !== undefined && isExpressionStatement(statement) ? statement.expression : undefined;
}

/** A blank line, `\n` or `\r\n`, whitespace aside. */
const BLANK_LINE = /\r?\n[ \t]*\r?\n/u;

/**
 * The preset's `off` rules no reason explains. A blank line ends a group of rules. Each run of `off`
 * rules within a group needs a reason: a comment on its own lines directly before the run's first
 * rule, with no blank line between them. A comment that trails a rule on its line is no reason.
 * @param {import("tsrs/ast").SourceFile} sourceFile - The preset, as the compiler parsed it.
 */
function unexplainedOffs(sourceFile) {
  const { text } = sourceFile;
  const plugins = propertyValue(propertyValue(rootObject(sourceFile), "compilerOptions"), "plugins");
  const entry =
    plugins !== undefined && isArrayLiteralExpression(plugins)
      ? plugins.elements.find((element) => {
          const name = propertyValue(element, "name");
          return name !== undefined && isStringLiteral(name) && name.text === LANGUAGE_SERVICE;
        })
      : undefined;
  const severity = propertyValue(entry, "diagnosticSeverity");
  if (severity === undefined || !isObjectLiteralExpression(severity)) {
    throw new Error("the preset has no diagnosticSeverity object");
  }
  /** @type {string[]} */
  const unexplained = [];
  let previousOff = false;
  for (const property of severity.properties) {
    if (
      !isPropertyAssignment(property) ||
      !isStringLiteral(property.name) ||
      !isStringLiteral(property.initializer)
    ) {
      throw new Error("diagnosticSeverity holds a non-string entry");
    }
    const comments = getLeadingCommentRanges(text, property.pos) ?? [];
    const start = skipTrivia(text, property.pos);
    const startsGroup = BLANK_LINE.test(text.slice(property.pos, start));
    const reason = comments.at(-1);
    const reasoned =
      reason !== undefined &&
      text.slice(reason.pos, reason.end).replaceAll(/[\s/*]/gu, "").length > 0 &&
      !BLANK_LINE.test(text.slice(reason.end, start));
    const off = property.initializer.text === "off";
    // A rule continues the run before it only within one group, and only after another `off` rule.
    const continuesRun = previousOff && !startsGroup && comments.length === 0;
    if (off && !reasoned && !continuesRun) unexplained.push(property.name.text);
    previousOff = off;
  }
  return unexplained;
}

const preset = readJsonc(PRESET_PATH);
const presetPlugins = asRecord(preset.compilerOptions, "compilerOptions").plugins;
const entries = asRecordArray(presetPlugins, "plugins").filter((entry) => entry.name === LANGUAGE_SERVICE);
const [plugin] = entries;
if (plugin === undefined || entries.length > 1) {
  throw new Error(`${PRESET_PATH} needs exactly one ${LANGUAGE_SERVICE} plugin entry`);
}
const severities = Object.entries(asRecord(plugin.diagnosticSeverity, "diagnosticSeverity"));
const gate = readJsonc(".oxlintrc.effect.json");
const gateRules = asRecord(gate.rules, "rules");
const ignorePatterns = Array.isArray(gate.ignorePatterns)
  ? gate.ignorePatterns.map((pattern) => asString(pattern, "ignore pattern"))
  : [];
const rootManifest = asRecord(JSON.parse(read("package.json")), "package.json");
const lintEffect = asString(asRecord(rootManifest.scripts, "scripts")["lint:effect"], "lint:effect");
const tsrs = asString(
  asRecord(asRecord(parse(read("pnpm-workspace.yaml")), "workspace").catalog, "catalog").tsrs,
  "tsrs"
);

/**
 * The oxlint name of a language-service rule, as each rule's docs list both.
 * @param {string} rule
 */
function oxlintName(rule) {
  return `effecttsgo/${rule.replace("UUID", "Uuid").replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** oxlint's exit status when it ran and reported a diagnostic. */
const OXLINT_LINT_FAILURE = 1;

/** The hang guard of one `lint:effect` run over two fixture files, which takes a few seconds. */
const LINT_EFFECT_TIMEOUT_MS = 60_000;

/** Where the `.ts` fixture sits in the scratch project: a workspace package's source, as lint reaches it. */
const PACKAGE_FIXTURE_DIR = join("tooling", "probe", "src");

/** The hang guard of loading every committed tsconfig's project, which takes a few seconds. */
const PROJECTS_TIMEOUT_MS = 60_000;

/** A module that takes an Effect export by name from the `effect` barrel, which the preset forbids. */
const NAMED_EFFECT_IMPORT = 'import { Effect } from "effect";\n\nexport const program = Effect.void;\n';

/**
 * Every committed tsconfig's project in one compiler snapshot, with the files it lints: its files
 * outside the gate's ignored paths. A project whose files all lie there lints nothing and is left out.
 */
function lintedProjects() {
  const listed = spawnSync("git", ["ls-files", "--cached", "*tsconfig*.json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (listed.status !== 0) throw new Error(`git ls-files exited ${String(listed.status)}: ${listed.stderr}`);
  const configs = listed.stdout
    .split("\n")
    .filter((path) => path.length > 0)
    .map((path) => join(repoRoot, path));
  const snapshot = compiler.createSnapshot({ openProjects: configs });
  return configs.flatMap((config) => {
    const project = snapshot.getConfiguredProject(config);
    if (project === undefined) throw new Error(`the compiler did not load ${config}`);
    const linted = project.parsedCommandLine.fileNames.some(
      (/** @type {string} */ file) =>
        !ignorePatterns.some((pattern) => matchesGlob(relative(repoRoot, file), pattern))
    );
    return linted ? [{ path: relative(repoRoot, config), program: project.program }] : [];
  });
}

describe("Effect lint config", () => {
  it("gates exactly the preset's errors, and only through its rule list", () => {
    // Unit under test: .oxlintrc.effect.json. Oracle: the preset's `error` decisions.
    const errors = severities.filter(([, level]) => level === "error").map(([rule]) => oxlintName(rule));
    expect(Object.keys(gateRules).sort()).toEqual(errors.sort());
    expect(new Set(Object.values(gateRules))).toEqual(new Set(["error"]));
    // `extends` or `overrides` could relax a rule for some paths, and without type-aware mode or the
    // effecttsgo plugin the gate runs other rules. A new key is a new decision.
    expect(Object.keys(gate).sort()).toEqual(
      ["$schema", "categories", "ignorePatterns", "options", "plugins", "rules"].sort()
    );
    expect(gate.plugins).toEqual(["effecttsgo"]);
    expect(gate.categories).toEqual({ correctness: "off" });
    expect(gate.options).toEqual({ typeAware: true });
  });

  it("decides every rule of the installed @effect/tsgo, each off with its reason", () => {
    // Unit under test: the preset. Oracle: the installed @effect/tsgo's schema. A bump that adds a rule
    // fails here until the preset decides it; the gate runs only the rules it names, so an undecided
    // rule would go unchecked. A deprecated rule stays unnamed, since naming it makes the patched
    // compiler warn.
    const schema = asRecord(JSON.parse(read("node_modules/@effect/tsgo/schema.json")), "schema");
    const rules = asRecord(
      asRecord(
        asRecord(schema.definitions, "definitions").effectLanguageServicePluginDiagnosticSeverityDefinition,
        "severity definition"
      ).properties,
      "severity properties"
    );
    const current = Object.entries(rules)
      .filter(
        ([, rule]) => !asString(asRecord(rule, "rule").description, "description").startsWith("Deprecated")
      )
      .map(([name]) => name);
    expect(severities.map(([rule]) => rule).sort()).toEqual(current.sort());
    expect(severities.filter(([, level]) => level !== "error" && level !== "off")).toEqual([]);
    const presetFile = join(repoRoot, PRESET_PATH);
    const owner = lintedProjects().find(({ program }) => program.getConfigFileNames().includes(presetFile));
    if (owner === undefined) throw new Error(`no linted project reads ${PRESET_PATH}`);
    expect(unexplainedOffs(owner.program.getConfigSourceFile(presetFile))).toEqual([]);
    // Each option of the entry changes what the editor and the gate report; `overrides` or
    // `diagnostics: false` would split them. A new option is a new decision.
    expect(Object.keys(plugin).sort()).toEqual(
      [
        "allowedUnstableApis",
        "diagnosticSeverity",
        "effectFn",
        "includeSuggestionsInTsc",
        "name",
        "namespaceImportPackages",
      ].sort()
    );
  });

  it("lints with the catalog's tsrs", () => {
    // Unit under test: the lint:effect script. Oracle: the catalog's tsrs. effect-tsgo falls back to
    // its newest packaged tsrs when the installed one is not supported, so the script names it.
    expect(lintEffect).toContain(`effect-tsgo --tsrs-lint=${tsrs} oxlint `);
  });

  it("ignores what the main pass ignores", () => {
    // Unit under test: the gate's ignorePatterns. Oracle: oxlint.config.ts, the main pass.
    expect(gate.ignorePatterns).toEqual(lintConfig.ignorePatterns);
  });

  it(
    "gives every linted project the preset's plugins, declared by the preset alone",
    () => {
      // Unit under test: the committed tsconfigs. Oracles: the preset's path, and the configs and files
      // the compiler loads for each project. The rules read their options from each linted file's
      // project, and any other config in a chain that declares `plugins` replaces or shadows the
      // preset's list, even with a copy of it.
      const presetFile = join(repoRoot, PRESET_PATH);
      const projects = lintedProjects();
      const findings = projects.flatMap(({ path, program }) => {
        /** @type {readonly string[]} */
        const chain = program.getConfigFileNames();
        // The compiler's reader, so a repeated key reads as the compiler reads it: the last one wins.
        const declaring = chain.filter((config) => {
          const options = readJsonc(relative(repoRoot, config)).compilerOptions;
          return options !== undefined && "plugins" in asRecord(options, `${config} compilerOptions`);
        });
        return [
          ...(chain.includes(presetFile) ? [] : [`${path}: its chain misses ${PRESET_PATH}`]),
          ...declaring
            .filter((config) => config !== presetFile)
            .map((config) => `${path}: ${relative(repoRoot, config)} declares plugins`),
        ];
      });
      expect(projects.length).toBeGreaterThan(0);
      expect(findings).toEqual([]);
    },
    PROJECTS_TIMEOUT_MS
  );

  it(
    "fails `lint:effect` on a named effect import in a .ts and a .mjs file",
    () => {
      // Unit under test: the lint:effect script with the gate, the preset and the root tsconfig.
      // Oracle: a module the preset's `namespaceImportPackages` forbids. The script runs as written,
      // from a scratch directory holding a copy of the root tsconfig, so the scratch files reach the
      // preset as the workspace's files do: a `.ts` file under a package's source and a root `.mjs`
      // file. A script target narrower than the whole tree misses one of them.
      const scratch = mkdtempSync(join(tmpdir(), "effect-lint-"));
      try {
        symlinkSync(join(repoRoot, "node_modules"), join(scratch, "node_modules"));
        symlinkSync(join(repoRoot, ".oxlintrc.effect.json"), join(scratch, ".oxlintrc.effect.json"));
        // A copy, not an `extends`: an inherited include or exclude resolves against the config
        // that declares it, which would be the checkout. The copy's own `extends` resolves through
        // the linked node_modules.
        copyFileSync(join(repoRoot, "tsconfig.json"), join(scratch, "tsconfig.json"));
        mkdirSync(join(scratch, PACKAGE_FIXTURE_DIR), { recursive: true });
        writeFileSync(join(scratch, PACKAGE_FIXTURE_DIR, "named.ts"), NAMED_EFFECT_IMPORT);
        writeFileSync(join(scratch, "named.mjs"), NAMED_EFFECT_IMPORT);
        // The script runs as the shell command `pnpm run` gives it, with the workspace's bin first
        // on PATH, as `pnpm run` puts it.
        const run = spawnSync("sh", ["-c", `${lintEffect} --format=json`], {
          cwd: scratch,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: [join(repoRoot, "node_modules", ".bin"), process.env.PATH].join(delimiter),
          },
          timeout: LINT_EFFECT_TIMEOUT_MS,
        });
        if (run.error !== undefined) throw run.error;
        expect(run.status, run.stderr).toBe(OXLINT_LINT_FAILURE);
        const diagnostics = asRecordArray(
          asRecord(JSON.parse(run.stdout), "lint:effect report").diagnostics,
          "diagnostics"
        );
        const flagged = diagnostics
          .filter((diagnostic) => diagnostic.code === "effecttsgo(prefer-namespace-import)")
          .map((diagnostic) => asString(diagnostic.filename, "filename"));
        expect(new Set(flagged)).toEqual(new Set([join(PACKAGE_FIXTURE_DIR, "named.ts"), "named.mjs"]));
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
    LINT_EFFECT_TIMEOUT_MS
  );
});
