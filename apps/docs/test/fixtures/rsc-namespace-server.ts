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

function Fixture(): ReactElement {
  return createElement("div", null, ...namespaceElements(), alertTree());
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
if (payload.includes("button.tsx")) {
  throw new Error("The no-action Alert rendered a client Button");
}

process.stdout.write("RSC_OK\n");
