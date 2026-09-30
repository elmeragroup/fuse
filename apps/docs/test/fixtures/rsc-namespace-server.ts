/**
 * Server module. Renders every public namespace part of the compound components whose
 * implementation is `"use client"`, plus Alert.
 *
 * The part lists are the public namespace shape. They are not read from the
 * implementation: a missing or renamed part fails here even if the source still parses.
 *
 * Oracle: React Flight (`createClientModuleProxy`, which the sibling loader installs for
 * `"use client"` modules). Dotting into a client module throws "Cannot access X.Y on the
 * server". A directive-free namespace object is a real object, so each client part is a
 * client reference the server may pass through; the lists name the few directive-free
 * markup parts, which must stay server components. Alert's composed tree must render on
 * the server: the warning root is a div row (`data-slot` item, `role` alert), not a
 * client reference.
 */
import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { PassThrough } from "node:stream";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Alert } from "@elmeragroup/fuse/alert";
import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Avatar } from "@elmeragroup/fuse/avatar";
import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { CheckboxItem } from "@elmeragroup/fuse/checkbox";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { DataTable } from "@elmeragroup/fuse/data-table";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Item } from "@elmeragroup/fuse/item";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Popover } from "@elmeragroup/fuse/popover";
import { RadioItem } from "@elmeragroup/fuse/radio-group";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Select } from "@elmeragroup/fuse/select";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toast } from "@elmeragroup/fuse/toast";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { renderToPipeableStream } from "./rsc-flight-server.ts";
import type { FlightManifest, FlightModuleRecord } from "./rsc-flight-server.ts";

const ALERT_PARTS = ["Root", "Icon", "Title", "Description"] as const;

function byName(left: string, right: string): number {
  return left.localeCompare(right);
}

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

/** A client function that is not a component, such as Toast's manager hook and factory. */
type ClientHelper = () => object;

/** A namespace member as its public type declares it. */
type NamespacePart = ComponentType<never> | ClientHelper;

/**
 * A Flight client reference: the server serializes it instead of running it.
 * Reading `$$typeof` and `$$id` on a client-module proxy is allowed.
 */
function isClientReference(part: NamespacePart): boolean {
  return "$$typeof" in part && part.$$typeof === CLIENT_REFERENCE && "$$id" in part;
}

/** Handwritten parts that are not client components. */
type OtherParts<Server extends string, Helper extends string> = {
  /** Directive-free markup components. The server runs them, so they must not be client references. */
  readonly server?: readonly Server[];
  /** Client functions that are not components (Toast's manager hook and factory). Checked, not rendered. */
  readonly helpers?: readonly Helper[];
};

function unexpectedParts(name: string, problem: string, parts: readonly string[]): void {
  if (parts.length > 0) {
    throw new Error(`${name} parts ${problem}: ${parts.join(", ")}`);
  }
}

/**
 * Check a namespace against its handwritten part lists and render its components.
 * Client components and helpers must be Flight client references; server components must not be.
 */
function renderNamespace<Client extends string, Server extends string = never, Helper extends string = never>(
  name: string,
  namespace: Readonly<Record<NoInfer<Client | Server>, ComponentType<never>>> &
    Readonly<Record<NoInfer<Helper>, ClientHelper>>,
  client: readonly Client[],
  { server = [], helpers = [] }: OtherParts<Server, Helper> = {}
): ReactElement[] {
  // Read each part before comparing keys. On a client-module object this throws
  // "Cannot access X.Y on the server" instead of reporting an empty key list.
  const references: readonly (Client | Helper)[] = [...client, ...helpers];
  unexpectedParts(
    name,
    "are not client references",
    references.filter((part) => !isClientReference(namespace[part]))
  );
  unexpectedParts(
    name,
    "are client references but should render on the server",
    server.filter((part) => isClientReference(namespace[part]))
  );
  const actual = Object.keys(namespace).toSorted(byName);
  const expected = [...references, ...server].toSorted(byName);
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`${name} parts\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
  }
  const components: readonly (Client | Server)[] = [...client, ...server];
  return components.map((part) => createElement(namespace[part]));
}

function namespaceElements(): ReactElement[] {
  return [
    ...renderNamespace("Accordion", Accordion, ["Root", "Item", "Header", "Trigger", "Content"]),
    ...renderNamespace("AlertDialog", AlertDialog, ["Root", "Trigger", "Content"]),
    ...renderNamespace("Avatar", Avatar, ["Root", "Group", "Image", "Fallback"]),
    ...renderNamespace("Breadcrumb", Breadcrumb, [
      "Root",
      "List",
      "Item",
      "Link",
      "Page",
      "Separator",
      "Ellipsis",
    ]),
    ...renderNamespace("ButtonGroup", ButtonGroup, ["Root", "Separator", "Text"]),
    ...renderNamespace("Collapsible", Collapsible, ["Root", "Trigger", "Content"]),
    ...renderNamespace("Combobox", Combobox, [
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
    ]),
    ...renderNamespace("DataTable", DataTable, [
      "Content",
      "Header",
      "Body",
      "Row",
      "Pagination",
      "SortButton",
      "ColumnToggle",
      "SelectAll",
      "SelectRow",
      "Text",
      "Number",
      "Date",
      "DateTime",
      "Currency",
    ]),
    ...renderNamespace("Dialog", Dialog, [
      "Root",
      "Trigger",
      "Portal",
      "Close",
      "Overlay",
      "Content",
      "Header",
      "Footer",
      "Title",
      "Description",
    ]),
    ...renderNamespace("DropdownMenu", DropdownMenu, [
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
    ]),
    ...renderNamespace("Field", Field, [
      "Root",
      "Label",
      "Description",
      "Error",
      "Control",
      "Item",
      "Content",
      "Group",
      "Set",
      "Legend",
      "Separator",
      "Title",
    ]),
    ...renderNamespace("InputGroup", InputGroup, ["Root", "Addon", "Button", "Text", "Input", "Textarea"]),
    ...renderNamespace("Item", Item, ["Root", "Group", "Separator"], {
      server: ["Media", "Content", "Actions", "Title", "Description", "Header", "Footer"],
    }),
    ...renderNamespace("Pagination", Pagination, [
      "Root",
      "Content",
      "Item",
      "Link",
      "Previous",
      "Next",
      "Ellipsis",
    ]),
    ...renderNamespace("Popover", Popover, ["Root", "Trigger", "Content", "Header", "Title", "Description"]),
    ...renderNamespace("ScrollArea", ScrollArea, ["Root", "Bar"]),
    ...renderNamespace("Select", Select, [
      "Root",
      "Trigger",
      "Value",
      "Content",
      "Item",
      "Group",
      "Label",
      "Separator",
      "ScrollUpButton",
      "ScrollDownButton",
    ]),
    ...renderNamespace("SelectionItem", SelectionItem, ["Shell", "Title", "Actions", "SubSection"], {
      server: ["Description", "Content"],
    }),
    ...renderNamespace("Sheet", Sheet, [
      "Root",
      "Trigger",
      "Close",
      "Portal",
      "Overlay",
      "Content",
      "Header",
      "Body",
      "Footer",
      "Title",
      "Description",
    ]),
    ...renderNamespace("Sidebar", Sidebar, [
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
    ]),
    ...renderNamespace("Tabs", Tabs, ["Root", "List", "Trigger", "Content"]),
    ...renderNamespace(
      "Toast",
      Toast,
      ["Provider", "Viewport", "Root", "Content", "Title", "Description", "Action", "Close"],
      { helpers: ["useToastManager", "createToastManager"] }
    ),
    ...renderNamespace("ToggleGroup", ToggleGroup, ["Root", "Item"]),
    ...renderNamespace("Tooltip", Tooltip, ["Provider", "Root", "Trigger", "Content"]),
  ];
}

function alertTree(): ReactElement {
  const actual = Object.keys(Alert).toSorted(byName);
  const expected = [...ALERT_PARTS].toSorted(byName);
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

const CHECKBOX_BAND = "Includes a price-freeze guarantee.";
const RADIO_BAND = "Price follows the hourly market.";

/** CheckboxItem and RadioItem are hook-free rows; the server runs them and reads their parts. */
function selectionItemTrees(): ReactElement {
  const rows: readonly (readonly [string, NamespacePart])[] = [
    ["CheckboxItem", CheckboxItem],
    ["RadioItem", RadioItem],
  ];
  for (const [name, row] of rows) {
    if (isClientReference(row)) {
      throw new Error(`${name} is a client reference; the server must run it to read its parts`);
    }
  }
  return createElement(
    "section",
    { "data-fixture": "selection-items" },
    createElement(
      CheckboxItem,
      { value: "fixed" },
      createElement(
        CheckboxItem.Content,
        null,
        createElement(CheckboxItem.Title, null, "Fixed price"),
        createElement(CheckboxItem.Description, null, "Locked for 12 months.")
      ),
      createElement(CheckboxItem.Actions, null, "Recommended"),
      createElement(CheckboxItem.SubSection, null, CHECKBOX_BAND)
    ),
    createElement(
      RadioItem,
      { value: "spot" },
      createElement(RadioItem.Content, null, createElement(RadioItem.Title, null, "Spot price")),
      createElement(RadioItem.SubSection, null, RADIO_BAND)
    )
  );
}

/** A value in a Flight model row, which is JSON. */
type FlightJson = string | number | boolean | null | readonly FlightJson[] | FlightObject;

type FlightObject = { readonly [key: string]: FlightJson };

/** The JSON model rows of a Flight payload (`<hex id>:[…]` or `<hex id>:{…}`). */
function flightModelRows(payload: string): FlightJson[] {
  return payload.split("\n").flatMap((line) => {
    const body = /^[0-9a-f]+:(.*)$/u.exec(line)?.[1];
    // SAFETY: Flight model rows are the I/O boundary. The body starts with `[` or `{`, and
    // JSON.parse yields only JSON values, so the result is a FlightJson array or object.
    return body !== undefined && (body.startsWith("[") || body.startsWith("{"))
      ? [JSON.parse(body) as FlightJson]
      : [];
  });
}

/** Every key path from `value` to a string equal to `text`. Array indices appear as strings. */
function pathsTo(value: FlightJson, text: string, path: readonly string[] = []): string[][] {
  if (value === text) {
    return [[...path]];
  }
  // `instanceof Object` keeps arrays and objects and drops `null` and the other primitives.
  if (!(value instanceof Object)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, item]) => pathsTo(item, text, [...path, key]));
}

function Fixture(): ReactElement {
  return createElement("div", null, ...namespaceElements(), alertTree(), selectionItemTrees());
}

function flightManifest() {
  const records: FlightManifest = {};
  return new Proxy(records, {
    get(_target, property): FlightModuleRecord | undefined {
      const id = String(property);
      // `then` would make the manifest a thenable. Symbol keys are not module ids.
      if (id === "then" || id.startsWith("Symbol(")) {
        return undefined;
      }
      return { id, chunks: [], name: "*", async: false };
    },
  });
}

const manifest = flightManifest();

const chunks: Buffer[] = [];
let renderError: Error | undefined;
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
    renderError = error instanceof Error ? error : new Error(String(error));
  },
});
stream.pipe(destination);
await finished;
if (renderError !== undefined) {
  throw renderError;
}

const payload = Buffer.concat(chunks).toString("utf8");
if (!payload.includes("Sync delayed") || !payload.includes("Facility data is more than an hour old.")) {
  throw new Error(`Alert text missing from the server payload:\n${payload.slice(0, 1500)}`);
}
// Client parts are module references (`I["…/item.tsx#…"]`). A server-rendered
// Alert root is a div row. Check that row: `selection-item.tsx` contains the
// substring `item.tsx`, so a whole-payload search would not mean Item ran.
const alertRoot = payload
  .split("\n")
  .find((line) => line.includes('data-slot":"item"') && line.includes('"role":"alert"'));
if (
  alertRoot === undefined ||
  !alertRoot.includes('["$","div"') ||
  !alertRoot.includes("bg-warning-soft") ||
  alertRoot.includes("item.tsx") ||
  alertRoot.includes("button.tsx")
) {
  throw new Error(`Alert chrome was not rendered on the server:\n${alertRoot ?? payload.slice(0, 1500)}`);
}
// Button's own module path: other client parts, such as `data-table-sort-button.tsx`, end in
// `button.tsx` too.
if (payload.includes("/components/button/button.tsx")) {
  throw new Error("The no-action Alert rendered a client Button");
}

// The shell partitions on the client by `child.type`, which a server-authored element cannot
// satisfy: Flight revives each client reference as a new lazy wrapper. The rows must hand
// SubSections over through the shell's `subSections` prop, so each band's only path runs
// through that prop, never through the shell's `children`.
const models = flightModelRows(payload);
for (const band of [CHECKBOX_BAND, RADIO_BAND]) {
  const paths = models.flatMap((model) => pathsTo(model, band));
  if (paths.length !== 1 || paths[0]?.includes("subSections") !== true) {
    throw new Error(`${band} is not passed through the shell's subSections prop: ${JSON.stringify(paths)}`);
  }
}
for (const text of ["Fixed price", "Locked for 12 months.", "Spot price"]) {
  if (models.flatMap((model) => pathsTo(model, text)).some((path) => path.includes("subSections"))) {
    throw new Error(`${text} left the row label`);
  }
}

process.stdout.write("RSC_OK\n");
