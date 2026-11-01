/**
 * The chart type tests against the packed `.d.ts`. It copies `src/components/chart/*.test-d.tsx`
 * and the packed-only cases in `test/packed-consumer/chart-types/` into a fresh npm consumer of
 * the tarball and runs `tsc --noEmit` under the catalog's TypeScript and under the older copy
 * `@microsoft/api-extractor` pins, each with and without `exactOptionalPropertyTypes`. Every
 * import resolves through the tarball's `exports` types condition, so a broken export map fails
 * here, and an unused `@ts-expect-error` fails like any other error.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { releaseAgeCutoff, withPackedConsumer } from "./packed-consumer";
import { packageRootFromScript } from "./paths";
import { catalogVersion, readWorkspaceCatalog } from "./published-dependencies";
import { runCommandAsync } from "./run-command";
import { fail, findTarball } from "./tarball";

/**
 * The older consumer compiler, the TypeScript `@microsoft/api-extractor` pins in its own
 * dependencies, read from its manifest so a catalog bump moves both together.
 */
function olderTypescript(): string {
  const manifest = createRequire(import.meta.url).resolve("@microsoft/api-extractor/package.json");
  // SAFETY: the installed package's own manifest. Only `dependencies.typescript` is read, and the
  // check below rejects a missing or empty pin, so a reshaped manifest fails here by name.
  const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
    readonly dependencies?: { readonly typescript?: string };
  };
  const version = parsed.dependencies?.typescript;
  if (version === undefined || version.length === 0) {
    fail(`${manifest} names no typescript dependency`);
  }
  return version;
}

const OLDER_TYPESCRIPT = olderTypescript();

const packageRoot = packageRootFromScript(import.meta.url);

/** The type-test files to copy, as source path and consumer file name. */
function caseFiles(): Array<readonly [string, string]> {
  const sources = [
    ["src/components/chart", ""],
    ["test/packed-consumer/chart-types", "packed-"],
  ] as const;
  return sources.flatMap(([directory, prefix]) =>
    readdirSync(join(packageRoot, directory))
      .filter((name) => name.endsWith(".test-d.tsx"))
      .map((name) => [join(packageRoot, directory, name), `${prefix}${name}`] as const)
  );
}

function tsconfig(exact: boolean): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "es2022",
        lib: ["dom", "dom.iterable", "esnext"],
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: exact,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      include: ["cases/**/*.tsx"],
    },
    null,
    2
  )}\n`;
}

const catalog = readWorkspaceCatalog();
const files = caseFiles();
if (files.length === 0) {
  fail("No chart type tests to run against the tarball");
}
try {
  const runs = await withPackedConsumer(
    {
      tarball: findTarball(packageRoot),
      prefix: "elmera-packed-chart-types-",
      label: "chart types",
      dependencies: {
        typescript: catalogVersion(catalog, "typescript"),
        "typescript-older": `npm:typescript@${OLDER_TYPESCRIPT}`,
        react: catalogVersion(catalog, "react"),
        "react-dom": catalogVersion(catalog, "react-dom"),
        "@types/react": catalogVersion(catalog, "@types/react"),
        vitest: catalogVersion(catalog, "vitest"),
      },
      cutoff: releaseAgeCutoff(new Date()),
    },
    async (consumer) => {
      mkdirSync(join(consumer, "cases"));
      for (const [source, name] of files) {
        copyFileSync(source, join(consumer, "cases", name));
      }
      writeFileSync(join(consumer, "tsconfig.json"), tsconfig(false));
      writeFileSync(join(consumer, "tsconfig.exact.json"), tsconfig(true));
      const results: string[] = [];
      for (const [compiler, version] of [
        ["typescript", catalogVersion(catalog, "typescript")],
        ["typescript-older", OLDER_TYPESCRIPT],
      ] as const) {
        for (const project of ["tsconfig.json", "tsconfig.exact.json"]) {
          await runCommandAsync(
            process.execPath,
            [join(consumer, "node_modules", compiler, "bin/tsc"), "--noEmit", "-p", project],
            { cwd: consumer, timeoutMs: 180_000 }
          );
          results.push(`TypeScript ${version} ${project}`);
        }
      }
      return results;
    }
  );
  console.log(`Packed chart types pass ${String(files.length)} files under ${runs.join(", ")}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
