// The packed `@elmeragroup/fuse/temporal-polyfill` entry through a consumer's production build.
// The entry exports nothing, so a bundler keeps a bare import of it only because the published
// `package.json#sideEffects` lists it. Vite builds the consumer in production mode, which
// tree-shakes, and Node runs the bundle without its own Temporal: the bundle must report the
// installed Temporal and the marker.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

import { packageRootFromScript } from "./paths";
import { linkConsumerModules, withExtractedTarballAsync } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);
await withExtractedTarballAsync(packageRoot, "elmera-packed-temporal-", async ({ extracted, scratch }) => {
  linkConsumerModules(scratch, extracted, packageRoot, []);
  writeFileSync(join(scratch, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const root = join(scratch, "temporal-polyfill");
  cpSync(join(packageRoot, "test/packed-consumer/temporal-polyfill"), root, { recursive: true });
  await build({
    configFile: false,
    root,
    logLevel: "error",
    mode: "production",
    build: { rollupOptions: { input: join(root, "main.ts") } },
  });
  const assets = join(root, "dist/assets");
  const bundles = readdirSync(assets).filter((file) => file.endsWith(".js"));
  assert.equal(bundles.length, 1, `one bundle, found ${bundles.join(", ")}`);
  const [bundle = ""] = bundles;
  const run = spawnSync(
    process.execPath,
    ["--import", join(root, "remove-native-temporal.mjs"), join(assets, bundle)],
    { encoding: "utf8" }
  );
  assert.equal(run.status, 0, run.stderr);
  const report: unknown = JSON.parse(run.stdout);
  assert.deepEqual(report, { sum: "2026-03-01", marker: true });
  console.log(JSON.stringify({ entry: "temporal-polyfill", bundle, report }));
});
