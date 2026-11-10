/**
 * The TypeScript requirement Fuse's Temporal declarations put on a consumer, against the packed
 * `.d.ts` with `skipLibCheck` off. The declarations name the global `Temporal` types, which come
 * only from the compiler's own `esnext.temporal` lib (first shipped in TypeScript 6.0), so:
 *
 * - under the catalog's TypeScript and under TypeScript 6.0, with `lib: ["dom", "esnext"]`, a
 *   consumer of the root entry and of the calendar entry compiles;
 * - with a `lib` below `esnext`, or under TypeScript 5.9, which has no Temporal lib, a consumer
 *   that never names a date type still fails on Fuse's declarations with "Cannot find namespace
 *   'Temporal'".
 *
 * The changeset, the quick-start "Temporal for dates" section and the Temporal Calendar page state
 * this requirement; a change that makes the declarations carry their own Temporal types, or need
 * a newer compiler, fails here.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { releaseAgeCutoff, withPackedConsumer } from "./packed-consumer";
import { packageRootFromScript } from "./paths";
import { catalogVersion, readWorkspaceCatalog } from "./published-dependencies";
import { runCommandAsync } from "./run-command";
import { fail, findTarball } from "./tarball";

/** The first stable TypeScript whose lib ships `esnext.temporal`, the minimum the docs state. */
const MINIMUM_TYPESCRIPT = "6.0.2";
/** The last TypeScript before it, which has no Temporal lib. */
const BELOW_MINIMUM_TYPESCRIPT = "5.9.3";

/** A consumer that uses the calendar and its Temporal values. */
const CALENDAR_CASE = `import { Calendar } from "@elmeragroup/fuse";
import type { CalendarRootProps } from "@elmeragroup/fuse/calendar";

const props: CalendarRootProps = {
  "aria-label": "Delivery",
  defaultValue: Temporal.PlainDate.from("2026-10-14"),
  onValueChange: (value) => value.add({ days: 1 }),
};

export const calendar = <Calendar.Root {...props} />;
`;

/** A consumer of the root entry that never names a date type. */
const ROOT_CASE = `import { Button } from "@elmeragroup/fuse";

export const button = <Button>Save</Button>;
`;

function tsconfig(lib: readonly string[], include: string): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "es2022",
        lib,
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      include: [include],
    },
    null,
    2
  )}\n`;
}

const packageRoot = packageRootFromScript(import.meta.url);
const catalog = readWorkspaceCatalog();
const catalogTypescript = catalogVersion(catalog, "typescript");

try {
  const results = await withPackedConsumer(
    {
      tarball: findTarball(packageRoot),
      prefix: "elmera-packed-temporal-types-",
      label: "Temporal types",
      dependencies: {
        typescript: catalogTypescript,
        "typescript-minimum": `npm:typescript@${MINIMUM_TYPESCRIPT}`,
        "typescript-below-minimum": `npm:typescript@${BELOW_MINIMUM_TYPESCRIPT}`,
        react: catalogVersion(catalog, "react"),
        "react-dom": catalogVersion(catalog, "react-dom"),
        "@types/react": catalogVersion(catalog, "@types/react"),
      },
      cutoff: releaseAgeCutoff(new Date()),
    },
    async (consumer) => {
      mkdirSync(join(consumer, "cases"));
      writeFileSync(join(consumer, "cases/calendar.tsx"), CALENDAR_CASE);
      writeFileSync(join(consumer, "cases/root.tsx"), ROOT_CASE);
      writeFileSync(
        join(consumer, "tsconfig.esnext.json"),
        tsconfig(["dom", "dom.iterable", "esnext"], "cases")
      );
      writeFileSync(
        join(consumer, "tsconfig.es2024.json"),
        tsconfig(["dom", "dom.iterable", "es2024"], "cases/root.tsx")
      );
      writeFileSync(
        join(consumer, "tsconfig.root-esnext.json"),
        tsconfig(["dom", "dom.iterable", "esnext"], "cases/root.tsx")
      );

      const tsc = (compiler: string, project: string) =>
        runCommandAsync(
          process.execPath,
          [join(consumer, "node_modules", compiler, "bin/tsc"), "-p", project],
          {
            cwd: consumer,
            timeoutMs: 180_000,
          }
        );
      /** Runs a compile that must fail, returning its diagnostics. */
      const failing = async (compiler: string, project: string): Promise<string> => {
        try {
          await tsc(compiler, project);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
        throw new Error(`${compiler} -p ${project} compiled, but Fuse's declarations need the Temporal lib`);
      };

      const passed: string[] = [];
      for (const [compiler, version] of [
        ["typescript", catalogTypescript],
        ["typescript-minimum", MINIMUM_TYPESCRIPT],
      ] as const) {
        await tsc(compiler, "tsconfig.esnext.json");
        passed.push(`TypeScript ${version} with lib esnext`);
      }
      for (const [compiler, project, label] of [
        ["typescript", "tsconfig.es2024.json", `TypeScript ${catalogTypescript} with lib es2024`],
        [
          "typescript-below-minimum",
          "tsconfig.root-esnext.json",
          `TypeScript ${BELOW_MINIMUM_TYPESCRIPT} with lib esnext`,
        ],
      ] as const) {
        const diagnostics = await failing(compiler, project);
        assert.match(
          diagnostics,
          /node_modules\/@elmeragroup\/fuse\/.*Cannot find namespace 'Temporal'/u,
          label
        );
        assert.doesNotMatch(diagnostics, /cases\/root\.tsx/u, `${label}: only Fuse's declarations fail`);
        passed.push(`${label} fails on Fuse's declarations`);
      }
      return passed;
    }
  );
  console.log(`Packed Temporal types: ${results.join("; ")}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
