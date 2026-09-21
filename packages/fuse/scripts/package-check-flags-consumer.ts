import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { build, preview } from "vite";

import { FLAG_SVG_COUNT } from "./flag-payload";
import { packageRootFromScript } from "./paths";
import { linkConsumerModules, withExtractedTarballAsync } from "./tarball";

type ConsumerScenario = {
  /** Consumer entry under `test/packed-consumer/`. */
  entry: string;
  /** Locator for the flag image whose `src` must change with the country. */
  image: string;
  /** JavaScript budget for a consumer that imports only the flag roster. */
  maxJavaScriptBytes?: number;
  /** Rendered `<option>` count when the consumer lists the whole roster. */
  optionCount?: number;
};

const scenarios: ConsumerScenario[] = [
  { entry: "flags", image: "#flag", maxJavaScriptBytes: 40 * 1024, optionCount: FLAG_SVG_COUNT },
  { entry: "phone", image: "img" },
];

const packageRoot = packageRootFromScript(import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  await withExtractedTarballAsync(
    packageRoot,
    "elmera-packed-vite-flags-",
    async ({ extracted, scratch }) => {
      linkConsumerModules(scratch, extracted, packageRoot, ["react", "react-dom"]);
      writeFileSync(join(scratch, "package.json"), JSON.stringify({ private: true, type: "module" }));
      for (const { entry, image: imageSelector, maxJavaScriptBytes, optionCount } of scenarios) {
        const root = join(scratch, entry);
        mkdirSync(root);
        writeFileSync(
          join(root, "main.ts"),
          readFileSync(join(packageRoot, `test/packed-consumer/${entry}.ts`))
        );
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
        if (maxJavaScriptBytes !== undefined)
          assert.ok(
            javascriptBytes <= maxJavaScriptBytes,
            `${entry}: consumer exceeds its JavaScript budget`
          );
        const server = await preview({
          ...config,
          preview: { host: "127.0.0.1", port: 0, strictPort: true },
        });
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
          const image = page.locator(imageSelector).first();
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
          if (optionCount !== undefined) assert.equal(await page.locator("option").count(), optionCount);
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
    }
  );
} finally {
  await browser.close();
}
