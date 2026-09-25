/**
 * Server module. Renders every public namespace part of the compound components whose
 * implementation is `"use client"`, plus Alert.
 *
 * The part lists are the public namespace shape. They are not read from the
 * implementation: a missing or renamed part fails here even if the source still parses.
 *
 * Oracle: React Flight (`createClientModuleProxy` in the sibling loader). Dotting into
 * a client module throws "Cannot access X.Y on the server". A directive-free
 * `export * as` namespace is a real object, so each part is a client reference the
 * server may pass through. Alert's composed tree must render on the server, which
 * means its markup is in this payload and no Item or Button client module is.
 */
import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Alert } from "@elmeragroup/fuse/alert";
import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Avatar } from "@elmeragroup/fuse/avatar";
import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Item } from "@elmeragroup/fuse/item";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Popover } from "@elmeragroup/fuse/popover";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Select } from "@elmeragroup/fuse/select";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toast } from "@elmeragroup/fuse/toast";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

const NAMESPACES: ReadonlyArray<readonly [string, object, readonly string[]]> = [
  ["Accordion", Accordion, ["Root", "Item", "Header", "Trigger", "Content"]],
  ["AlertDialog", AlertDialog, ["Root", "Trigger", "Content"]],
  ["Avatar", Avatar, ["Root", "Group", "Image", "Fallback"]],
  ["Breadcrumb", Breadcrumb, ["Root", "List", "Item", "Link", "Page", "Separator", "Ellipsis"]],
  ["ButtonGroup", ButtonGroup, ["Root", "Separator", "Text"]],
  ["Collapsible", Collapsible, ["Root", "Trigger", "Content"]],
  [
    "Combobox",
    Combobox,
    [
      "Root",
      "Input",
      "Trigger",
      "Clear",
      "Content",
      "List",
      "Item",
      "Group",
      "Label",
      "Collection",
      "Empty",
      "Separator",
      "Chips",
      "Chip",
      "ChipsInput",
      "Value",
    ],
  ],
  ["Dialog", Dialog, ["Root", "Trigger", "Portal", "Close", "Overlay", "Content", "Header", "Footer", "Title", "Description"]],
  [
    "DropdownMenu",
    DropdownMenu,
    [
      "Root",
      "Trigger",
      "Portal",
      "Content",
      "Group",
      "Label",
      "Item",
      "LinkItem",
      "CheckboxItem",
      "RadioGroup",
      "RadioItem",
      "Separator",
      "Shortcut",
      "Sub",
      "SubTrigger",
      "SubContent",
    ],
  ],
  [
    "Field",
    Field,
    ["Root", "Label", "Description", "Error", "Control", "Item", "Content", "Group", "Set", "Legend", "Separator", "Title"],
  ],
  ["InputGroup", InputGroup, ["Root", "Addon", "Button", "Text", "Input", "Textarea"]],
  ["Item", Item, ["Root", "Media", "Content", "Actions", "Group", "Separator", "Title", "Description", "Header", "Footer"]],
  ["Pagination", Pagination, ["Root", "Content", "Item", "Link", "Previous", "Next", "Ellipsis"]],
  ["Popover", Popover, ["Root", "Trigger", "Content", "Header", "Title", "Description"]],
  ["ScrollArea", ScrollArea, ["Root", "Bar"]],
  [
    "Select",
    Select,
    ["Root", "Trigger", "Value", "Content", "Item", "Group", "Label", "Separator", "ScrollUpButton", "ScrollDownButton"],
  ],
  ["SelectionItem", SelectionItem, ["Shell", "Title", "Description", "Content", "Actions", "SubSection"]],
  ["Sheet", Sheet, ["Root", "Trigger", "Close", "Portal", "Overlay", "Content", "Header", "Body", "Footer", "Title", "Description"]],
  [
    "Sidebar",
    Sidebar,
    [
      "Provider",
      "Root",
      "Trigger",
      "Rail",
      "Inset",
      "Input",
      "Header",
      "Footer",
      "Separator",
      "Content",
      "Group",
      "GroupLabel",
      "GroupAction",
      "GroupContent",
      "Menu",
      "MenuItem",
      "MenuButton",
      "MenuAction",
      "MenuBadge",
      "MenuSkeleton",
      "MenuSub",
      "MenuSubItem",
      "MenuSubButton",
      "Icon",
    ],
  ],
  ["Tabs", Tabs, ["Root", "List", "Trigger", "Content"]],
  [
    "Toast",
    Toast,
    ["Provider", "Viewport", "Root", "Content", "Title", "Description", "Action", "Close", "useToastManager", "createToastManager"],
  ],
  ["ToggleGroup", ToggleGroup, ["Root", "Item"]],
  ["Tooltip", Tooltip, ["Provider", "Root", "Trigger", "Content"]],
];

const ALERT_PARTS = ["Root", "Icon", "Title", "Description"] as const;

function part(namespace: object, name: string, key: string): ReactElement {
  const value = Reflect.get(namespace, key);
  if (typeof value !== "function") {
    throw new Error(`${name}.${key} is ${typeof value}, expected a component`);
  }
  return createElement(value);
}

function namespaceElements(): ReactElement[] {
  const elements: ReactElement[] = [];
  for (const [name, namespace, parts] of NAMESPACES) {
    // Read each part before comparing keys. On today's client-module object this throws
    // "Cannot access X.Y on the server" instead of reporting an empty key list.
    for (const key of parts) {
      elements.push(part(namespace, name, key));
    }
    const actual = Object.keys(namespace).toSorted();
    const expected = [...parts].toSorted();
    if (actual.join("\n") !== expected.join("\n")) {
      throw new Error(`${name} parts\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
    }
  }
  return elements;
}

function alertTree(): ReactElement {
  const actual = Object.keys(Alert).toSorted();
  const expected = [...ALERT_PARTS].toSorted();
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`Alert parts\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
  }
  return createElement(
    "section",
    { "data-fixture": "alert" },
    createElement(Alert.Icon, { variant: "warning" }),
    createElement(
      Alert.Root,
      { variant: "warning" },
      createElement(Alert.Title, null, "Sync delayed"),
      createElement(Alert.Description, null, "Facility data is more than an hour old.")
    )
  );
}

function Fixture(): ReactElement {
  return createElement("div", null, ...namespaceElements(), alertTree());
}

const require = createRequire(import.meta.url);
const { renderToPipeableStream } = require("next/dist/compiled/react-server-dom-webpack/server.node.js") as {
  renderToPipeableStream: (
    node: ReactNode,
    manifest: object,
    options?: { onError?: (error: unknown) => void }
  ) => { pipe: (destination: NodeJS.WritableStream) => void };
};

const manifest = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== "string" || property === "then") {
        return undefined;
      }
      return { id: property, chunks: [], name: "*", async: false };
    },
  }
);

const chunks: Buffer[] = [];
let renderError: unknown;
const destination = new PassThrough();
const finished = new Promise<void>((resolve, reject) => {
  destination.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.from(chunk));
  });
  destination.on("end", () => {
    resolve();
  });
  destination.on("error", reject);
});
const stream = renderToPipeableStream(createElement(Fixture), manifest, {
  onError(error) {
    renderError = error;
  },
});
stream.pipe(destination);
await finished;
if (renderError !== undefined) {
  throw renderError;
}

const payload = Buffer.concat(chunks).toString("utf8");
const alertStart = payload.indexOf("data-fixture");
const alertPayload = alertStart === -1 ? payload : payload.slice(alertStart);
if (!payload.includes("Sync delayed") || !payload.includes("Facility data is more than an hour old.")) {
  throw new Error(`Alert text missing from the server payload:\n${payload.slice(0, 1500)}`);
}
if (!alertPayload.includes("data-slot") || !alertPayload.includes("item")) {
  throw new Error(`Alert chrome was not rendered on the server:\n${alertPayload.slice(0, 1500)}`);
}
if (alertPayload.includes("item.tsx") || alertPayload.includes("button.tsx")) {
  throw new Error(`Alert render crossed a client boundary:\n${alertPayload.slice(0, 1500)}`);
}

process.stdout.write("RSC_OK\n");
