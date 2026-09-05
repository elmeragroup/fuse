import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

import { packageRootFromScript } from "./paths";
import { extractPackedPackage, findTarball } from "./tarball";

const packageRoot = packageRootFromScript(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), "elmera-packed-standalone-"));
const browser = await chromium.launch({ headless: true });
try {
  const extracted = extractPackedPackage(findTarball(packageRoot), scratch, packageRoot);
  const modules = join(scratch, "node_modules");
  mkdirSync(join(modules, "@elmeragroup"), { recursive: true });
  symlinkSync(extracted, join(modules, "@elmeragroup/ui"));
  for (const dependency of [
    "react",
    "react-dom",
    "tailwindcss",
    "tw-animate-css",
    "tailwindcss-react-aria-components",
  ]) {
    symlinkSync(join(packageRoot, "node_modules", dependency), join(modules, dependency));
  }
  writeFileSync(
    join(scratch, "render.ts"),
    readFileSync(join(packageRoot, "test/packed-consumer/standalone-render.ts"))
  );
  const rendered = spawnSync(process.execPath, ["render.ts"], { cwd: scratch, encoding: "utf8" });
  assert.equal(rendered.status, 0, rendered.stderr);
  writeFileSync(
    join(scratch, "source.css"),
    '@import "tailwindcss" source(none);\n@import "@elmeragroup/ui/css";\n@import "@elmeragroup/ui/themes.css";\n@source "./package";\n'
  );
  const compiled = spawnSync(
    "pnpm",
    [
      "exec",
      "tailwindcss",
      "-i",
      join(scratch, "source.css"),
      "-o",
      join(scratch, "compiled.css"),
      "--minify",
    ],
    { cwd: packageRoot, encoding: "utf8" }
  );
  assert.equal(compiled.status, 0, compiled.stderr);
  const styles = {
    standalone:
      readFileSync(join(extracted, "styles.css"), "utf8") +
      readFileSync(join(extracted, "themes.css"), "utf8"),
    source: readFileSync(join(scratch, "compiled.css"), "utf8"),
  };
  const page = await browser.newPage();
  for (const [mode, css] of Object.entries(styles)) {
    for (const density of ["dense", "comfortable"]) {
      await page.setContent(
        `<!doctype html><html data-density="${density}"><body><p id="host-paragraph">Host text</p><input id="host-input" style="box-sizing:content-box;width:80px;height:20px;padding:7px;border:3px solid"/>${rendered.stdout}</body></html>`
      );
      const hostBefore = await page.locator("#host-paragraph").evaluate((element) => ({
        margin: getComputedStyle(element).margin,
        boxSizing: getComputedStyle(element).boxSizing,
      }));
      await page.addStyleTag({ content: css });
      const geometry = await page.evaluate(() => {
        const measure = (selector: string) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            width: rect.width,
            height: rect.height,
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            boxSizing: style.boxSizing,
          };
        };
        return {
          input: measure("#input"),
          button: measure("#button"),
          link: measure("#link-button"),
          group: measure("#group"),
          groupInput: measure("#group input"),
          number: measure("#number [role=group]"),
          numberInput: measure("#number input:not([aria-hidden])"),
          phone: measure("#phone [data-slot=input-group]"),
          textarea: measure("#textarea"),
          hostInput: measure("#host-input"),
        };
      });
      console.log(JSON.stringify({ mode, density, geometry }));
      const expectedHeight = density === "dense" ? 36 : 44;
      for (const control of [
        geometry.input,
        geometry.button,
        geometry.link,
        geometry.group,
        geometry.number,
        geometry.phone,
      ]) {
        assert.equal(control.height, expectedHeight, `${mode}/${density}: control height`);
      }
      for (const control of [
        geometry.input,
        geometry.group,
        geometry.number,
        geometry.phone,
        geometry.textarea,
      ]) {
        assert.equal(control.width, 200, `${mode}/${density}: full-width control`);
      }
      assert.ok(geometry.groupInput.height <= expectedHeight - 2, "Grouped input fits its border");
      assert.ok(geometry.numberInput.height <= expectedHeight - 2, "Number input fits its border");
      assert.equal(geometry.textarea.paddingTop, "8px");
      assert.equal(geometry.textarea.paddingBottom, "8px");
      assert.ok(geometry.textarea.height > expectedHeight, "Textarea grows with its content");
      assert.equal(geometry.hostInput.width, 100);
      assert.equal(geometry.hostInput.height, 40);
      if (mode === "standalone") {
        assert.deepEqual(
          await page.locator("#host-paragraph").evaluate((element) => ({
            margin: getComputedStyle(element).margin,
            boxSizing: getComputedStyle(element).boxSizing,
          })),
          hostBefore
        );
      }
    }
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
