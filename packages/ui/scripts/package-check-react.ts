import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

type ReactPair = { react: string; reactDom: string };

function installedVersion(name: string): string {
  // SAFETY: Node resolves the installed dependency's package manifest.
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

const consumerProbe = String.raw`
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";
import { Button } from "@elmeragroup/ui/button";
import * as root from "@elmeragroup/ui";
const require = createRequire(import.meta.url);
const packedRequire = createRequire(import.meta.resolve("@elmeragroup/ui"));
assert.equal(require.resolve("react"), packedRequire.resolve("react"));
assert.equal(require.resolve("react-dom"), packedRequire.resolve("react-dom"));
assert.equal(React.version, process.argv[2]);
assert.equal(require("react-dom/package.json").version, process.argv[3]);
assert.equal(root.PhoneNumberField, PhoneNumberField);
assert.equal(root.Button, Button);
const phone = renderToStaticMarkup(React.createElement(root.ElmeraGroupUiProvider, { locale: "en-US" }, React.createElement(PhoneNumberField, {
  "aria-label": "Phone", defaultCountryCode: "NO", name: "phone", value: "+4741234567"
})));
assert.match(phone, /inputMode="tel"/);
const visibleInput = phone.match(/<input[^>]*inputMode="tel"[^>]*>/)?.[0];
assert.ok(visibleInput);
assert.equal(visibleInput.match(/value="([^"]*)"/)?.[1].replace(/\D/g, ""), "41234567");
const hiddenInput = phone.match(/<input[^>]*type="hidden"[^>]*name="phone"[^>]*>/)?.[0];
assert.ok(hiddenInput);
assert.match(hiddenInput, /value="\+4741234567"/);
const button = renderToStaticMarkup(React.createElement(Button, null, "Control"));
assert.match(button, /<button/);
assert.match(button, />Control<\/button>/);
console.log(JSON.stringify({ react: React.version, reactDom: process.argv[3], root: "imported", phone: "rendered", button: "rendered" }));
`;

/** Install the tarball with real peer pairs, without workspace symlinks or aliases. */
export function checkPackedReactCompatibility(tarball: string): void {
  const pairs: ReactPair[] = [
    { react: "19.0.0", reactDom: "19.0.0" },
    { react: "19.1.1", reactDom: "19.1.1" },
    { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
  ];
  for (const pair of pairs) {
    const consumer = mkdtempSync(join(tmpdir(), "elmera-packed-react-"));
    try {
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          dependencies: {
            "@elmeragroup/ui": `file:${tarball}`,
            react: pair.react,
            "react-dom": pair.reactDom,
          },
        })
      );
      const install = spawnSync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"],
        { cwd: consumer, encoding: "utf8", timeout: 180_000 }
      );
      if (install.status !== 0) {
        throw new Error(`Packed React ${pair.react} install failed:\n${install.stderr || install.stdout}`);
      }
      writeFileSync(join(consumer, "probe.mjs"), consumerProbe);
      const probe = spawnSync(process.execPath, ["probe.mjs", pair.react, pair.reactDom], {
        cwd: consumer,
        encoding: "utf8",
        timeout: 30_000,
      });
      if (probe.status !== 0) {
        throw new Error(`Packed React ${pair.react} rendering failed:\n${probe.stderr || probe.stdout}`);
      }
      console.log(probe.stdout.trim());
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }
}
