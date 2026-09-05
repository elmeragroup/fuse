import React from "react";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";

import * as root from "@elmeragroup/ui";
import { Button } from "@elmeragroup/ui/button";
import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";

/** Runs inside an npm-installed consumer: `node probe.ts <react version> <react-dom version>`. */
const require = createRequire(import.meta.url);
const packedRequire = createRequire(import.meta.resolve("@elmeragroup/ui"));
const [expectedReact, expectedReactDom] = process.argv.slice(2);

assert.equal(require.resolve("react"), packedRequire.resolve("react"));
assert.equal(require.resolve("react-dom"), packedRequire.resolve("react-dom"));
assert.equal(React.version, expectedReact);
// SAFETY: the resolved file is react-dom's own package manifest.
const reactDomManifest = JSON.parse(readFileSync(require.resolve("react-dom/package.json"), "utf8")) as {
  version: string;
};
assert.equal(reactDomManifest.version, expectedReactDom);
assert.equal(root.PhoneNumberField, PhoneNumberField);
assert.equal(root.Button, Button);

const phone = renderToStaticMarkup(
  React.createElement(root.ElmeraGroupUiProvider, {
    locale: "en-US",
    children: React.createElement(PhoneNumberField, {
      "aria-label": "Phone",
      defaultCountryCode: "NO",
      name: "phone",
      value: "+4741234567",
    }),
  })
);
assert.match(phone, /inputMode="tel"/);
const visibleInput = /<input[^>]*inputMode="tel"[^>]*>/.exec(phone)?.[0];
assert.ok(visibleInput);
assert.equal(/value="([^"]*)"/.exec(visibleInput)?.[1]?.replace(/\D/g, ""), "41234567");
const hiddenInput = /<input[^>]*type="hidden"[^>]*name="phone"[^>]*>/.exec(phone)?.[0];
assert.ok(hiddenInput);
assert.match(hiddenInput, /value="\+4741234567"/);

const button = renderToStaticMarkup(React.createElement(Button, null, "Control"));
assert.match(button, /<button/);
assert.match(button, />Control<\/button>/);

console.log(
  JSON.stringify({
    react: React.version,
    reactDom: expectedReactDom,
    root: "imported",
    phone: "rendered",
    button: "rendered",
  })
);
