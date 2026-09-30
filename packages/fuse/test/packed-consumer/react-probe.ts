import React from "react";

import { tableFeatures, useTable } from "@tanstack/react-table";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";

import * as root from "@elmeragroup/fuse";
import { Button } from "@elmeragroup/fuse/button";
import { DataTable } from "@elmeragroup/fuse/data-table";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

/** Runs inside an npm-installed consumer: `node probe.ts <react version> <react-dom version>`. */
const require = createRequire(import.meta.url);
const packedRequire = createRequire(import.meta.resolve("@elmeragroup/fuse"));
const [expectedReact, expectedReactDom] = process.argv.slice(2);

assert.equal(require.resolve("react"), packedRequire.resolve("react"));
assert.equal(require.resolve("react-dom"), packedRequire.resolve("react-dom"));
// One shared copy: TanStack's contexts and feature objects must be the consumer's instances.
assert.equal(require.resolve("@tanstack/react-table"), packedRequire.resolve("@tanstack/react-table"));
assert.equal(React.version, expectedReact);
// SAFETY: the resolved file is react-dom's own package manifest.
const reactDomManifest = JSON.parse(readFileSync(require.resolve("react-dom/package.json"), "utf8")) as {
  version: string;
};
assert.equal(reactDomManifest.version, expectedReactDom);
assert.equal(root.PhoneNumberField, PhoneNumberField);
assert.equal(root.Button, Button);

const phone = renderToStaticMarkup(
  React.createElement(root.LocaleProvider, {
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

function Orders(): React.ReactElement {
  const table = useTable({
    features: tableFeatures({}),
    columns: [{ accessorKey: "customer", header: "Customer" }],
    data: [{ customer: "Ada" }],
  });
  // The probe is plain TypeScript, so the binding instantiates Content's generics that JSX would infer.
  const Content: (props: { readonly table: typeof table }) => React.ReactElement = DataTable.Content;
  return React.createElement(Content, { table });
}

const dataTable = renderToStaticMarkup(
  React.createElement(root.LocaleProvider, { locale: "en-US", children: React.createElement(Orders) })
);
assert.match(dataTable, /<th[^>]*>Customer<\/th>/);
assert.match(dataTable, /<td[^>]*>Ada<\/td>/);

console.log(
  JSON.stringify({
    react: React.version,
    reactDom: expectedReactDom,
    root: "imported",
    phone: "rendered",
    button: "rendered",
    dataTable: "rendered",
  })
);
