/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- replacement graph identities are intentionally opaque sentinels. */
/* oxlint-disable typescript/no-unsafe-assignment -- the fake backend deliberately uses opaque test handles. */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  declarationBoundaryViolations,
  packageSourceFiles,
  publicDeclarationGraph,
  scanCompilerImports,
  sourceBoundaryViolations,
} from "../scripts/boundary-scanner.ts";
import { cleanPackageDist } from "../scripts/build.ts";
import { assertFreshDeclarationOutput } from "../scripts/check-boundary.ts";
import type {
  BackendCompilerOperations,
  BackendNodeHandle,
  BackendSymbolHandle,
  BackendSignatureHandle,
  BackendTypeHandle,
} from "../src/backend/contracts.ts";
import { parseModule } from "../src/parser.ts";

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("compiler boundary", () => {
  it("catches every compiler import spelling, including side-effect and template forms", () => {
    const mutations = [
      'import value from "typescript/unstable/sync";',
      'import type { API } from "typescript/unstable/sync";',
      'import "typescript/unstable/sync";',
      'export * from "typescript/unstable/sync";',
      'const dynamic = import("typescript/unstable/sync");',
      'const templated = import(`typescript/unstable/${"sync"}`);',
      'const required = require("typescript/unstable/sync");',
    ];

    for (const mutation of mutations) {
      expect(scanCompilerImports(mutation), mutation).not.toEqual([]);
    }
    expect(scanCompilerImports('import "typescript";')).not.toEqual([]);
    expect(scanCompilerImports('import "typescriptx";')).toEqual([]);
  });

  it("scans compiler imports in every supported source extension", () => {
    for (const extension of [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]) {
      expect(
        sourceBoundaryViolations(
          `/virtual/source${extension}`,
          'import type { API } from "typescript/unstable/sync";'
        )
      ).toEqual([expect.objectContaining({ path: `/virtual/source${extension}` })]);
    }
  });

  it("scans package scripts, tests, and root config while excluding fixture data", () => {
    const directory = mkdtempSync(join(tmpdir(), "api-extractor-scan-"));
    try {
      for (const relativePath of [
        "src/adapter.ts",
        "scripts/check.ts",
        "test/check.test.ts",
        "vitest.config.ts",
      ]) {
        const path = join(directory, relativePath);
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, 'import type { API } from "typescript/unstable/sync";\n');
      }
      const fixturePath = join(directory, "test/fixtures/mutation.ts");
      mkdirSync(join(directory, "test/fixtures"), { recursive: true });
      writeFileSync(fixturePath, "const mutation = 'import \"typescript/unstable/sync\";';\n");

      const paths = packageSourceFiles(directory);
      expect(paths).toEqual(
        expect.arrayContaining([
          join(directory, "src/adapter.ts"),
          join(directory, "scripts/check.ts"),
          join(directory, "test/check.test.ts"),
          join(directory, "vitest.config.ts"),
        ])
      );
      expect(paths).not.toContain(fixturePath);
      const violations = paths.flatMap((path) => sourceBoundaryViolations(path, readFileSync(path, "utf8")));
      expect(violations).toHaveLength(4);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("walks transitive declaration imports used by exported declarations", () => {
    const directory = mkdtempSync(join(tmpdir(), "api-extractor-boundary-"));
    writeFileSync(
      join(directory, "index.d.ts"),
      'export interface Public extends import("./one.js").One {}\n'
    );
    writeFileSync(join(directory, "one.js"), "export const runtime = true;\n");
    writeFileSync(
      join(directory, "one.d.ts"),
      'import type { Two } from "./two.js"; export interface One extends Two {}\n'
    );
    writeFileSync(
      join(directory, "two.d.ts"),
      'import type { Leak } from "./backend/contracts.js"; export type Two = Leak;\n'
    );

    const graph = publicDeclarationGraph(join(directory, "index.d.ts"));
    expect(graph).toEqual([
      join(directory, "index.d.ts"),
      join(directory, "one.d.ts"),
      join(directory, "two.d.ts"),
    ]);
    expect(declarationBoundaryViolations(graph[2] ?? "", readFileSync(graph[2] ?? "", "utf8"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining("imports") })])
    );
  });

  it("rejects stale declarations after a source change", () => {
    const directory = mkdtempSync(join(tmpdir(), "api-extractor-clean-emit-"));
    try {
      const sourceDirectory = join(directory, "src");
      const declarationDirectory = join(directory, "dist");
      const sourcePath = join(sourceDirectory, "index.ts");
      const declarationPath = join(declarationDirectory, "index.d.ts");
      const tsconfigPath = join(directory, "tsconfig.json");
      mkdirSync(sourceDirectory, { recursive: true });
      mkdirSync(declarationDirectory, { recursive: true });
      writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            declaration: true,
            declarationMap: true,
            emitDeclarationOnly: true,
            module: "ESNext",
            moduleResolution: "Bundler",
            outDir: "dist",
            rootDir: "src",
            strict: true,
            target: "ES2022",
          },
          include: ["src"],
        })
      );
      writeFileSync(sourcePath, "export type Value = string;\n");
      writeFileSync(declarationPath, "export type Value = string;\n//# sourceMappingURL=index.d.ts.map");
      expect(() =>
        assertFreshDeclarationOutput({
          tsconfigPath,
          cwd: directory,
          declarationDirectory,
        })
      ).not.toThrow();

      writeFileSync(sourcePath, "export type Value = number;\n");
      expect(() =>
        assertFreshDeclarationOutput({
          tsconfigPath,
          cwd: directory,
          declarationDirectory,
        })
      ).toThrow(/stale/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("cleans stale declarations from only the package dist before building", () => {
    const directory = mkdtempSync(join(tmpdir(), "api-extractor-build-clean-"));
    try {
      const packageDist = join(directory, "package", "dist");
      const unrelated = join(directory, "keep.txt");
      mkdirSync(join(packageDist, "src/backend"), { recursive: true });
      writeFileSync(join(packageDist, "src/backend/tsgo.d.ts"), "stale");
      writeFileSync(unrelated, "keep");

      cleanPackageDist(packageDist);

      expect(existsSync(packageDist)).toBe(false);
      expect(existsSync(unrelated)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("catches compiler/backend leaks through a transitive declaration re-export", () => {
    const declaration = `export * as leaked from "./backend/contracts.ts";`;
    const importDeclaration = `export type Leaked = import("./backend/contracts.ts").BackendModuleDraft;`;
    const violations = declarationBoundaryViolations("/virtual/leak.d.ts", declaration);
    const importViolations = declarationBoundaryViolations("/virtual/import-leak.d.ts", importDeclaration);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: expect.stringContaining("public declaration") }),
      ])
    );
    expect(importViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: expect.stringContaining("imports") }),
        expect.objectContaining({ reason: expect.stringContaining("BackendModuleDraft") }),
      ])
    );
  });

  it("keeps TypeScript unstable imports inside the backend adapter", () => {
    const sourceDirectory = resolve(import.meta.dirname, "../src");
    const unstableImports = sourceFiles(sourceDirectory)
      .filter((path) => path.endsWith(".ts"))
      .filter((path) => !path.startsWith(resolve(sourceDirectory, "backend/ts7") + "/"))
      .filter((path) =>
        /\b(?:from|import\s*\(|require\s*\()\s*["'`]typescript\/unstable\//u.test(readFileSync(path, "utf8"))
      );

    expect(unstableImports).toEqual([]);
  });

  it("keeps the durable backend contract on normalized records and opaque handles", () => {
    const sourceDirectory = resolve(import.meta.dirname, "../src");
    const contracts = readFileSync(resolve(sourceDirectory, "backend/contracts.ts"), "utf8");
    expect(contracts).toContain("BackendHandle");
    expect(contracts).not.toContain("extractModule");
    expect(contracts).not.toMatch(/resolveModule\?/u);
  });

  it("runs parser policy against a replacement backend with no compiler dependency", () => {
    const valueSymbol = {} as BackendSymbolHandle;
    const runtimeSymbol = {} as BackendSymbolHandle;
    const compiler: BackendCompilerOperations = {
      typeOfSymbol: () => undefined,
      typeAtNode: () => undefined,
      typeFacts: () => ({ typeText: "unknown", flags: ["Unknown"], intrinsic: "unknown" }),
      symbolFacts: (symbol) => ({
        name: symbol === valueSymbol ? "Value" : "RuntimeValue",
        flags: [],
        declarationPaths: ["/virtual/source.d.ts"],
        declarations: [],
      }),
      nodeFacts: () => ({ kind: "unknown", text: "", filePath: "/virtual/source.d.ts", line: 1, column: 1 }),
      typeNameFacts: () => undefined,
      signaturesOfType: () => [] as readonly BackendSignatureHandle[],
      signatureFacts: () => ({ parameters: [], returnType: {} as BackendTypeHandle, typeParameters: [] }),
      declarationOwnership: () => ({ kind: "project" }),
      propertiesOfType: () => [],
      propertyType: () => undefined,
      indexSignaturesOfType: () => [],
      baseConstraintOfType: () => undefined,
      isArrayType: () => false,
      isReadonlyType: () => false,
      typeToString: () => "unknown",
    };
    const module = parseModule(
      {
        compiler,
        readModule: () => ({
          name: "virtual/input",
          imports: ["./source.js"],
          typeOnlyStarExports: ["./source.js"],
          exports: [
            {
              name: "Value",
              symbol: valueSymbol,
              declarationSourcePath: "/virtual/source.d.ts",
              pureType: true,
            },
            {
              name: "RuntimeValue",
              symbol: runtimeSymbol,
              declarationSourcePath: "/virtual/source.d.ts",
            },
          ],
        }),
        resolveModule: () => ({ filePath: "/virtual/source.d.ts" }),
        close: () => undefined,
      },
      "/virtual/input.d.ts"
    );

    expect(module.module.exports.map((entry) => entry.name)).toEqual(["Value"]);
    expect(module.module.imports).toEqual(["./source.js"]);
  });

  it("resolves an opaque replacement type graph through the real resolver", () => {
    const widgetSymbol = {} as BackendSymbolHandle;
    const propsSymbol = {} as BackendSymbolHandle;
    const valueSymbol = {} as BackendSymbolHandle;
    const reactSymbol = {} as BackendSymbolHandle;
    const widgetType = {} as BackendTypeHandle;
    const propsType = {} as BackendTypeHandle;
    const valueType = {} as BackendTypeHandle;
    const reactType = {} as BackendTypeHandle;
    const signature = {} as BackendSignatureHandle;
    const propsNode = {} as BackendNodeHandle;
    const valueNode = {} as BackendNodeHandle;
    const reactNode = {} as BackendNodeHandle;
    const compiler: BackendCompilerOperations = {
      typeOfSymbol: (symbol) =>
        symbol === widgetSymbol ? widgetType : symbol === propsSymbol ? propsType : undefined,
      typeAtNode: () => undefined,
      typeFacts: (type) => {
        if (type === valueType) return { typeText: "string", flags: ["String"], intrinsic: "string" };
        if (type === reactType)
          return { typeText: "ReactElement", flags: ["Object"], isObject: true, symbol: reactSymbol };
        if (type === propsType)
          return { typeText: "Props", flags: ["Object"], isObject: true, symbol: propsSymbol };
        return {
          typeText: "(props: Props) => ReactElement",
          flags: ["Object"],
          isObject: true,
          symbol: widgetSymbol,
        };
      },
      symbolFacts: (symbol) => {
        if (symbol === propsSymbol)
          return {
            name: "Props",
            flags: [],
            declarationPaths: ["/virtual/input.d.ts"],
            declarations: [propsNode],
          };
        if (symbol === valueSymbol)
          return {
            name: "value",
            flags: [],
            declarationPaths: ["/virtual/input.d.ts"],
            declarations: [valueNode],
          };
        if (symbol === reactSymbol)
          return {
            name: "ReactElement",
            flags: [],
            declarationPaths: ["/virtual/node_modules/react/index.d.ts"],
            declarations: [reactNode],
          };
        return { name: "Widget", flags: [], declarationPaths: ["/virtual/input.tsx"], declarations: [] };
      },
      nodeFacts: (node) => {
        if (node === propsNode)
          return {
            kind: "interface",
            text: "interface Props {}",
            filePath: "/virtual/input.d.ts",
            line: 1,
            column: 1,
          };
        if (node === valueNode)
          return {
            kind: "property",
            text: "value: string",
            filePath: "/virtual/input.d.ts",
            line: 1,
            column: 1,
          };
        return {
          kind: "interface",
          text: "interface ReactElement {}",
          filePath: "/virtual/node_modules/react/index.d.ts",
          line: 1,
          column: 1,
        };
      },
      typeNameFacts: (type) =>
        type === reactType
          ? { name: "ReactElement", namespaces: ["React"] }
          : type === propsType
            ? { name: "Props", namespaces: ["Widget"] }
            : undefined,
      signaturesOfType: (type) => (type === widgetType ? [signature] : []),
      signatureFacts: () => ({ parameters: [propsSymbol], returnType: reactType, typeParameters: [] }),
      declarationOwnership: () => ({ kind: "project" }),
      propertiesOfType: (type) => (type === propsType ? [valueSymbol] : []),
      propertyType: (property) => (property === valueSymbol ? valueType : undefined),
      indexSignaturesOfType: () => [],
      baseConstraintOfType: () => undefined,
      isArrayType: () => false,
      isReadonlyType: () => false,
      typeToString: (type) => (type === valueType ? "string" : "unknown"),
    };
    const module = parseModule(
      {
        compiler,
        readModule: () => ({ name: "virtual/input", exports: [{ name: "Widget", symbol: widgetSymbol }] }),
        resolveModule: () => undefined,
        close: () => undefined,
      },
      "/virtual/input.tsx"
    );

    expect(module.module.exports[0]?.type).toEqual({
      kind: "component",
      props: [{ name: "value", type: { kind: "intrinsic", intrinsic: "string" }, optional: false }],
    });
  });

  it("does not log from the package source", () => {
    const sourceDirectory = resolve(import.meta.dirname, "../src");
    const automaticLogging = sourceFiles(sourceDirectory)
      .filter((path) => path.endsWith(".ts"))
      .filter((path) => /\bconsole\.(debug|error|info|log|warn)\s*\(/u.test(readFileSync(path, "utf8")));

    expect(automaticLogging).toEqual([]);
  });
});
