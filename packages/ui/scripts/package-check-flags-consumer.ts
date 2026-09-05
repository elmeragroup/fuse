import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { build, preview } from "vite";

import { FLAG_SVG_COUNT } from "./flag-payload";
import { packageRootFromScript } from "./paths";
import { extractPackedPackage, findTarball } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), "elmera-packed-vite-flags-"));
const browser = await chromium.launch({ headless: true });
try {
  const extracted = extractPackedPackage(findTarball(packageRoot), scratch, packageRoot);
  const modules = join(scratch, "node_modules");
  mkdirSync(join(modules, "@elmeragroup"), { recursive: true });
  symlinkSync(extracted, join(modules, "@elmeragroup/ui"));
  for (const dependency of ["react", "react-dom"]) {
    symlinkSync(join(packageRoot, "node_modules", dependency), join(modules, dependency));
  }
  writeFileSync(join(scratch, "package.json"), JSON.stringify({ private: true, type: "module" }));
  for (const entry of ["flags", "phone"]) {
    const root = join(scratch, entry);
    mkdirSync(root);
    writeFileSync(join(root, "main.ts"), readFileSync(join(packageRoot, `test/packed-consumer/${entry}.ts`)));
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html data-density="dense"><body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>'
    );
    // A non-root base exercises emitted URL rewriting without changing Vite's asset defaults.
    const config = { configFile: false as const, root, base: "/account/", logLevel: "error" as const };
    await build(config);
    const assets = join(root, "dist/assets");
    const files = readdirSync(assets);
    const javascript = files
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(assets, file)));
    const javascriptBytes = javascript.reduce((sum, bytes) => sum + bytes.byteLength, 0);
    const javascriptGzipBytes = javascript.reduce((sum, bytes) => sum + gzipSync(bytes).byteLength, 0);
    const svgFiles = files.filter((file) => file.endsWith(".svg"));
    for (const bytes of javascript)
      assert.equal(
        /data:image\/svg\+xml/.test(bytes.toString()),
        false,
        `${entry}: flags must remain external`
      );
    assert.equal(svgFiles.length, FLAG_SVG_COUNT, `${entry}: every flag is emitted externally`);
    if (entry === "flags")
      assert.ok(javascriptBytes <= 40 * 1024, "Transformed flags consumer exceeds 40 KiB JavaScript");
    const server = await preview({ ...config, preview: { host: "127.0.0.1", port: 0, strictPort: true } });
    try {
      const resolvedUrl = server.resolvedUrls?.local[0];
      assert.ok(resolvedUrl);
      const origin = new URL(resolvedUrl).origin;
      const page = await browser.newPage();
      const svgRequests: string[] = [];
      const failures: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes(".svg")) svgRequests.push(request.url());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
      });
      page.on("pageerror", (error) => failures.push(error.message));
      await page.goto(`${origin}/account/`);
      const image = page.locator(entry === "flags" ? "#flag" : "img").first();
      await image.waitFor();
      await page.waitForFunction(() =>
        Array.from(document.images).some((image) => image.complete && image.naturalWidth > 0)
      );
      const initialSrc = await image.getAttribute("src");
      await page.locator("#country-choice").selectOption("SE");
      await page.waitForFunction(
        (initial) =>
          Array.from(document.images).some(
            (image) => image.getAttribute("src") !== initial && image.complete && image.naturalWidth > 0
          ),
        initialSrc
      );
      const changedSrc = await image.getAttribute("src");
      assert.notEqual(initialSrc, changedSrc, "Dynamic country change selects another emitted asset");
      assert.ok(
        svgRequests.length >= 2 && svgRequests.length < 10,
        "Only selected flags are requested, not the roster"
      );
      for (const url of svgRequests)
        assert.ok(url.startsWith(`${origin}/account/assets/`), `Incorrect asset base: ${url}`);
      assert.deepEqual(failures, []);
      if (entry === "flags") assert.equal(await page.locator("option").count(), FLAG_SVG_COUNT);
      console.log(
        JSON.stringify({
          entry,
          base: "/account/",
          javascriptBytes,
          javascriptGzipBytes,
          svgFiles: svgFiles.length,
          svgBytes: svgFiles.reduce((sum, file) => sum + readFileSync(join(assets, file)).byteLength, 0),
          svgRequests,
        })
      );
      await page.close();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
