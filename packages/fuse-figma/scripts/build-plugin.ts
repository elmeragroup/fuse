/**
 * Build the Fuse components plugin. It builds the kit spec from the Fuse recipes, writes the
 * spec and its coverage table to `plugin/dist/` for review, and bundles the plugin's main
 * thread with the spec inlined. Import `plugin/manifest.json` into the Figma desktop app
 * under Plugins → Development to run it.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:plugin [--sets <set>,<set>…]
 *
 * `--sets` builds a probe instead: the named sets and every set they instance (`probe-kit.ts`), written to `plugin/dist/probe/` with a manifest of its own, "Fuse components (UX
 * probe)" under its own id, so Figma holds it beside the whole kit's plugin.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Runtime, Schema } from "effect";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { buildKit, renderCoverage } from "../src/components/build-kit.ts";
import type { BuiltKit } from "../src/components/build-kit.ts";
import type { KitSpec } from "../src/components/kit-spec.ts";
import { buildProbe } from "../src/components/probe-kit.ts";
import { bundlePlugin } from "./plugin-bundle.ts";

const pluginDir = fileURLToPath(new URL("../plugin/", import.meta.url));

const USAGE = "Usage: figma:plugin [--sets <set>,<set>…]";

/** The command line asks for something the script does not run, such as an unknown flag. */
class ArgumentsInvalid extends Data.TaggedError("ArgumentsInvalid")<{ readonly message: string }> {}

/**
 * The build stopped, and what it printed says why. The runtime exits 1 and prints nothing more, as
 * `compare.ts`'s does.
 */
class BuildStopped extends Data.TaggedError("BuildStopped") {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = 1;
}

/** The text of a thrown value, for a message. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- throw boundary: Node's parser throws values with no static type
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Where a build writes: the whole kit's plugin, or the probe's beside it. */
type Output = {
  readonly dir: string;
  /** The manifest Figma imports: the plugin's own, or the probe's, which the build writes. */
  readonly manifest: string;
};

const WHOLE: Output = { dir: `${pluginDir}dist/`, manifest: `${pluginDir}manifest.json` };
const PROBE: Output = { dir: `${pluginDir}dist/probe/`, manifest: `${pluginDir}dist/probe/manifest.json` };

/** The plugin's manifest, which the probe's copies, with every field Figma reads from it. */
const Manifest = Schema.Struct({
  name: Schema.String,
  id: Schema.String,
  api: Schema.String,
  editorType: Schema.Array(Schema.String),
  documentAccess: Schema.String,
  networkAccess: Schema.Struct({ allowedDomains: Schema.Array(Schema.String) }),
  main: Schema.String,
  ui: Schema.String,
});

const parseManifest = Schema.decodeUnknownResult(Schema.fromJsonString(Manifest));

/** The probe's manifest: the plugin's, under a name and id of its own, beside its own bundle and UI. */
const probeManifest = (manifest: typeof Manifest.Type): typeof Manifest.Type => ({
  ...manifest,
  name: "Fuse components (UX probe)",
  id: "fuse-components-ux-probe",
  main: "code.js",
  ui: "ui.html",
});

/** The lines `figma:plugin` prints: where each file went, and what the spec and coverage hold. */
function summary(output: Output, spec: KitSpec, coverage: BuiltKit["coverage"]): readonly string[] {
  const totals = new Map<string, number>();
  for (const row of coverage) {
    totals.set(row.outcome, (totals.get(row.outcome) ?? 0) + 1);
  }
  const outcomes = [...totals].map(([outcome, count]) => `${count} ${outcome}`).join(", ");
  const variants = spec.componentSets.reduce((sum, set) => sum + set.variants.length, 0);
  return [
    `Plugin: ${output.dir}code.js`,
    `Spec: ${output.dir}spec.json (${spec.componentSets.length} component sets, ${variants} variants)`,
    `Coverage: ${output.dir}coverage.md (${outcomes})`,
    `Manifest: ${output.manifest}`,
  ];
}

const program = Effect.gen(function* () {
  const { values } = yield* Effect.try({
    try: () => parseArgs({ args: process.argv.slice(2), options: { sets: { type: "string" } } }),
    catch: (error) => new ArgumentsInvalid({ message: `${describe(error)}\n${USAGE}` }),
  });
  const named = values.sets
    ?.split(",")
    .map((key) => key.trim())
    .filter((key) => key !== "");
  if (named?.length === 0) {
    return yield* new ArgumentsInvalid({ message: `--sets names no set.\n${USAGE}` });
  }
  const output = named === undefined ? WHOLE : PROBE;
  const fs = yield* FileSystem.FileSystem;
  const { spec, coverage } = yield* named === undefined ? buildKit() : buildProbe(new Set(named));
  yield* fs.makeDirectory(output.dir, { recursive: true });
  yield* fs.writeFileString(`${output.dir}spec.json`, `${JSON.stringify(spec, null, 2)}\n`);
  yield* fs.writeFileString(`${output.dir}coverage.md`, renderCoverage(coverage));
  yield* fs.writeFileString(`${output.dir}code.js`, yield* bundlePlugin(spec));
  if (output === PROBE) {
    const manifest = yield* Effect.fromResult(parseManifest(yield* fs.readFileString(WHOLE.manifest)));
    yield* fs.writeFileString(output.manifest, `${JSON.stringify(probeManifest(manifest), null, 2)}\n`);
    yield* fs.copyFile(`${pluginDir}ui.html`, `${output.dir}ui.html`);
  }
  for (const line of summary(output, spec, coverage)) {
    yield* Console.log(line);
  }
}).pipe(
  // Print why the build stopped, on stderr, once.
  Effect.catch((failure) =>
    Console.error(failure.message).pipe(Effect.andThen(Effect.fail(new BuildStopped())))
  )
);

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
