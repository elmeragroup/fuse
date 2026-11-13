import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

import { ruleTester } from "../rule-tester.ts";
import { sideOverlayState } from "./side-overlay-state.ts";

/*
 * Unit under test: `fuse/side-overlay-state`'s inventory of Fuse parts that render a popup.
 * Oracle: the committed `api.json` files the docs generate from Fuse's types, which the rule never
 * reads. A part there renders a popup when it takes a portal `container` or holds an open state
 * (`onOpenChange`, `onPageSizeOpenChange`, `onOpenMobileChange`). Each such part, rendered bare,
 * must be reported, or carry a reviewed exemption below, so a new Drawer or ContextMenu cannot
 * reach the hero window unchecked.
 *
 * A part that holds open state is controlled where it is rendered, so it is checked itself. A part
 * that only portals a popup reviewed as reading its namespace's Root (`PORTALS`) is checked through
 * that Root. Any other part with a `container` is checked itself, so a new part that opens on its
 * own cannot pass on an existing Root's row.
 *
 * Parts no docs page documents have no `api.json` and escape this check, as do popups that keep
 * their state inside with no prop to show it (`SelectField`, `DataTableFilter.Root`); the rule's
 * inventory lists those by hand.
 */

/** The docs' component pages, one directory each with its committed `api.json` files. */
const COMPONENT_PAGES = new URL("../../../../apps/docs/src/app/(docs)/components/", import.meta.url);

/** A prop that holds a part's open state: `onOpenChange`, `onPageSizeOpenChange`. */
const OPEN_STATE = /^on[A-Za-z]*Open[A-Za-z]*Change$/u;

/** Where React Aria parts live, which the rule looks up under the `react-aria/*` entries. */
const REACT_ARIA_SOURCE = /^packages\/fuse\/src\/react-aria\/([^/]+)\//u;

/**
 * Fuse parts that render a popup and need no side state, each with why. They are checked the other
 * way: the rule must not report them, so an entry goes stale once the inventory lists its part.
 */
const EXEMPT = new Map([
  ["Accordion.Item", "Its panel expands in the page flow; no popup."],
  ["Collapsible.Root", "Its panel expands in the page flow; no popup."],
  ["DropdownMenu.Sub", "A submenu opens only inside an open DropdownMenu.Root, which the rule checks."],
  [
    "Tooltip.Root",
    "A tooltip shows only while pointed at: the press that flips the window moves hover and focus off its trigger.",
  ],
  ["Toast.Viewport", "Its toasts sit in the Dashboard's own viewport and dismiss themselves."],
]);

/**
 * Parts that only portal a popup whose open state their namespace's Root holds, each reviewed. A
 * new `container` part joins this list only once its popup is known to read the Root.
 */
const PORTALS = new Set([
  "AlertDialog.Content",
  "Autocomplete.Content",
  "Combobox.Content",
  "Command.Content",
  "DatePicker.Popup",
  "DateRangePicker.Popup",
  "Dialog.Content",
  "Dialog.Portal",
  "DropdownMenu.Content",
  "DropdownMenu.Portal",
  "DropdownMenu.SubContent",
  "Popover.Content",
  "Select.Content",
  "Sheet.Content",
  "Sheet.Portal",
  "Tooltip.Content",
]);

/** A documented part: its export path, the import that names it, and the popup props it takes. */
type DocumentedPart = {
  readonly name: string;
  readonly source: string;
  readonly container: boolean;
  readonly opens: boolean;
};

/** The fields this check reads from a committed `api.json`, as the docs generator writes them. */
type ApiArtifact = {
  readonly parts: ReadonlyArray<{
    readonly name: string;
    readonly sourcePath: string;
    readonly props: ReadonlyArray<{ readonly name: string }>;
  }>;
};

/** The parts one committed `api.json` documents, under the entry the rule resolves each through. */
function readApi(path: string): DocumentedPart[] {
  // SAFETY: the docs generator writes every `api.json` through one serialiser, and its drift check
  // regenerates and compares each committed file, as `apps/docs/src/lib/api-source.ts` relies on.
  const artifact = JSON.parse(readFileSync(new URL(path, COMPONENT_PAGES), "utf8")) as ApiArtifact;
  return artifact.parts.map(({ name, sourcePath, props }) => {
    const reactAria = REACT_ARIA_SOURCE.exec(sourcePath)?.[1];
    return {
      name,
      source: reactAria === undefined ? "@elmeragroup/fuse" : `@elmeragroup/fuse/react-aria/${reactAria}`,
      container: props.some((prop) => prop.name === "container"),
      opens: props.some((prop) => OPEN_STATE.test(prop.name)),
    };
  });
}

const documented = readdirSync(COMPONENT_PAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap(({ name: page }) =>
    readdirSync(new URL(`${page}/`, COMPONENT_PAGES))
      .filter((file) => file.endsWith("api.json"))
      .flatMap((file) => readApi(`${page}/${file}`))
  );

/** The part whose state controls a popup part's: itself, or the Root a reviewed portal part reads. */
function controller(part: DocumentedPart): DocumentedPart {
  if (part.opens || !PORTALS.has(part.name)) return part;
  const rootName = `${part.name.split(".")[0]}.Root`;
  const root = documented.find((other) => other.source === part.source && other.name === rootName);
  if (root === undefined)
    throw new Error(`${part.name} is listed in PORTALS, but no ${rootName} is documented`);
  return root;
}

/** Every controlling part, with the popup parts it controls. */
const controllers = Map.groupBy(
  documented.filter((part) => part.container || part.opens),
  controller
);

/** Whether a controlling part carries a reviewed exemption. */
function isExempt(part: DocumentedPart): boolean {
  return part.source === "@elmeragroup/fuse" && EXEMPT.has(part.name);
}

/** A file that renders a part bare: no state attribute, which the rule reports for an overlay. */
function bare({ name, source }: DocumentedPart): string {
  return `import { ${name.split(".")[0]} } from "${source}";\nexport const Bare = () => <${name} />;`;
}

const exempt = [...controllers.keys()].filter(isExempt);

ruleTester.run(
  "side-overlay-state inventory: list each popup part in FUSE_OVERLAYS or REACT_ARIA_OVERLAYS, add a portal that reads its Root to PORTALS, or exempt it here with why",
  sideOverlayState,
  {
    valid: exempt.map((part) => ({
      name: `${part.name} is exempt (${EXEMPT.get(part.name)}), so the rule must not list it`,
      code: bare(part),
    })),
    invalid: [...controllers]
      .filter(([part]) => !isExempt(part))
      .map(([part, popups]) => ({
        name: `${part.name} from ${part.source} controls a popup (${popups.map((popup) => popup.name).join(", ")})`,
        code: bare(part),
        errors: 1,
      })),
  }
);

it("names only documented parts in EXEMPT and PORTALS, so a rename cannot hide behind a stale entry", () => {
  const exempted = exempt.map((part) => part.name);
  const named = documented.map((part) => part.name);
  expect({
    EXEMPT: [...EXEMPT.keys()].filter((name) => !exempted.includes(name)),
    PORTALS: [...PORTALS].filter((name) => !named.includes(name)),
  }).toEqual({ EXEMPT: [], PORTALS: [] });
});
