/**
 * Checks an installed app: it type-checks and builds it, reads its files, the built page and the
 * installed package, resolves its Fuse imports with Node, and hands the text to the pure checks.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import {
  checkDocument,
  checkFuseImports,
  checkSource,
  checkStylesheetMode,
  dataSlotNames,
  fuseImports,
  linkedStylesheets,
} from "./checks.ts";
import type { CheckResult, Resolution, SourceDirective, SourceFile } from "./checks.ts";
import { outputTail, runCommand, succeeded } from "./command.ts";
import type { Environment } from "./isolation.ts";
import type { Task } from "./task.ts";

const CHECK_TIMEOUT = Duration.minutes(5);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".css", ".html"]);
/** Folders that hold no app source: installed packages and build output. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist"]);

/** Every source file of the app outside `node_modules` and `dist`, by its path from the app root. */
const readSources = Effect.fn("checkApp.readSources")(function* (appDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: SourceFile[] = [];
  const walk = (relative: readonly string[]): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = yield* fs
        .readDirectoryEntries(path.join(appDirectory, ...relative))
        .pipe(Effect.orElseSucceed(() => []));
      for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
        if (SKIPPED_FOLDERS.has(entry.name) || entry.name.startsWith(".")) continue;
        const segments = [...relative, entry.name];
        if (entry.type === "Directory") {
          yield* walk(segments);
        } else if (entry.type === "File" && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          const text = yield* fs.readFileString(path.join(appDirectory, ...segments)).pipe(Effect.option);
          if (Option.isSome(text)) files.push({ path: segments.join("/"), text: text.value });
        }
      }
    });
  yield* walk([]);
  return files;
});

const Resolutions = Schema.fromJsonString(
  Schema.Record(
    Schema.String,
    Schema.Union([
      Schema.TaggedStruct("resolved", { file: Schema.String }),
      Schema.TaggedStruct("unresolved", { reason: Schema.String }),
    ])
  )
);
const decodeResolutions = Schema.decodeUnknownOption(Resolutions);

/**
 * Resolves each specifier with Node's ESM resolver, in a child process whose code runs from the
 * app's folder, so the package's `exports` decide it. The resolver returns a URL for a pattern
 * export whose file is missing, so each target must also exist.
 */
const RESOLVER = `
const { existsSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const out = {};
for (const specifier of process.argv.slice(1)) {
  try {
    const file = fileURLToPath(import.meta.resolve(specifier));
    out[specifier] = existsSync(file) ? { _tag: "resolved", file } : { _tag: "unresolved", reason: "no file at " + file };
  } catch (cause) {
    out[specifier] = { _tag: "unresolved", reason: cause.code ?? String(cause) };
  }
}
console.log(JSON.stringify(out));
`;

const resolveImports = Effect.fn("checkApp.resolveImports")(function* (
  appDirectory: string,
  specifiers: readonly string[],
  env: Environment
) {
  const unresolved = (reason: string) =>
    new Map<string, Resolution>(specifiers.map((specifier) => [specifier, { _tag: "unresolved", reason }]));
  if (specifiers.length === 0) return new Map<string, Resolution>();
  const run = yield* runCommand({
    executable: process.execPath,
    args: ["--input-type=module", "-e", RESOLVER, "--", ...specifiers],
    cwd: appDirectory,
    env,
    timeout: Duration.seconds(30),
  }).pipe(Effect.option);
  if (Option.isNone(run) || !succeeded(run.value)) return unresolved("the resolver did not run");
  const decoded = decodeResolutions(run.value.stdout.trim());
  return Option.isNone(decoded)
    ? unresolved("the resolver printed no result")
    : new Map<string, Resolution>(Object.entries(decoded.value));
});

/**
 * Type-checks and builds the app, then decides each check from its files.
 *
 * @param appDirectory - The installed app.
 * @param task - The task whose checks to run.
 * @param env - The environment the commands start with.
 * @returns The installed Fuse version and the checks, in report order.
 */
export const checkApp = Effect.fn("checkApp")(function* (appDirectory: string, task: Task, env: Environment) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const command = (name: string, args: readonly string[]) =>
    runCommand({ executable: "pnpm", args, cwd: appDirectory, env, timeout: CHECK_TIMEOUT }).pipe(
      Effect.map((run): CheckResult => ({
        name,
        passed: succeeded(run),
        detail: succeeded(run) ? "exit 0" : outputTail(run, 8),
      })),
      Effect.catchTag("CommandUnstartable", (cause) =>
        Effect.succeed({ name, passed: false, detail: cause.message })
      )
    );
  const typeCheck = yield* command("Type-check passes", ["exec", "tsc", "-b"]);
  // A build the agent left behind must not count.
  yield* fs.remove(path.join(appDirectory, "dist"), { recursive: true, force: true }).pipe(Effect.ignore);
  const build = yield* command("Build passes", ["run", "build"]);
  const distDirectory = path.join(appDirectory, "dist");
  const html = Option.getOrUndefined(
    yield* fs.readFileString(path.join(distDirectory, "index.html")).pipe(Effect.option)
  );
  const shipped =
    html === undefined
      ? undefined
      : yield* Effect.forEach(
          linkedStylesheets(html),
          (href) =>
            fs.readFileString(path.join(distDirectory, ...href.replace(/^\.?\//u, "").split("/"))).pipe(
              Effect.map((text) => ({ href, text })),
              Effect.orElseSucceed(() => ({ href, text: "" }))
            ),
          { concurrency: 1 }
        );

  const packageDirectory = path.join(appDirectory, "node_modules/@elmeragroup/fuse");
  const version = yield* fs.readFileString(path.join(packageDirectory, "package.json")).pipe(
    Effect.map(decodeVersion),
    Effect.orElseSucceed(() => Option.none<string>())
  );
  const fuseSlots = yield* fs.readFileString(path.join(packageDirectory, "styles.css")).pipe(
    Effect.map(dataSlotNames),
    Effect.orElseSucceed(() => new Set<string>())
  );
  const packageRealPath = Option.getOrUndefined(yield* fs.realPath(packageDirectory).pipe(Effect.option));

  const sources = yield* readSources(appDirectory);
  const reachingDirectives = new Set<string>();
  for (const file of sources) {
    // Every @source in every stylesheet is resolved here; the check keeps the ones a reached sheet holds.
    for (const match of file.text.matchAll(/@source\s+(?:not\s+)?["'](?<path>[^"']+)["']/gu)) {
      const source = match.groups?.path;
      if (source === undefined || packageRealPath === undefined) continue;
      const target = yield* fs
        .realPath(path.resolve(appDirectory, path.dirname(file.path), source))
        .pipe(Effect.option);
      if (
        Option.isSome(target) &&
        (target.value === packageRealPath || target.value.startsWith(`${packageRealPath}${path.sep}`))
      ) {
        reachingDirectives.add(directiveKey({ file: file.path, path: source }));
      }
    }
  }
  const resolutions = yield* resolveImports(appDirectory, fuseImports(sources), env);
  const srcFiles = sources.filter((file) => file.path.startsWith("src/"));
  const checks: CheckResult[] = [
    typeCheck,
    build,
    checkDocument(html, task.document),
    checkStylesheetMode(
      {
        sources,
        shipped,
        fuseSlots,
        reachesPackage: (directive) => reachingDirectives.has(directiveKey(directive)),
      },
      task.stylesheet
    ),
    checkFuseImports(sources, resolutions),
    ...task.sourceChecks.map((check) => checkSource(srcFiles, check)),
  ];
  return { fuseVersion: Option.getOrUndefined(version), checks };
});

function directiveKey(directive: SourceDirective): string {
  return `${directive.file}\n${directive.path}`;
}

const decodeVersion = (text: string): Option.Option<string> =>
  Option.map(
    Schema.decodeOption(Schema.fromJsonString(Schema.Struct({ version: Schema.String })))(text),
    (parsed) => parsed.version
  );
