import { ruleTester } from "../rule-tester.ts";
import { sideOverlayState } from "./side-overlay-state.ts";

const hook = 'import { useSideOverlay } from "../window-side";\n';
const sheet = `${hook}import { Sheet } from "@elmeragroup/fuse/sheet";\n`;
const dataTable = `${hook}import { DataTable } from "@elmeragroup/fuse/data-table";\n`;
const listDetail = `${hook}import { ListDetail } from "@elmeragroup/fuse/list-detail";\n`;

ruleTester.run("side-overlay-state", sideOverlayState, {
  valid: [
    `${sheet}function Panel() { const [open, setOpen] = useSideOverlay(false); return <Sheet.Root open={open} onOpenChange={setOpen} />; }`,
    // The hook under an alias, a nav panel's value closed by `null`, and the root barrel.
    `import { useSideOverlay as useClosing } from "../../window-side";
import { NavigationMenu } from "@elmeragroup/fuse";
function Nav() { const [value, setValue] = useClosing(null); return <NavigationMenu.Root value={value} onValueChange={setValue} />; }`,
    // State first, then a boolean: `false` whenever the state is, a boolean otherwise.
    `${sheet}function Panel({ order }) { const [open] = useSideOverlay(false); return <Sheet.Root open={open && order !== undefined} />; }`,
    `${sheet}function Shell({ split }) { const [open] = useSideOverlay(false); return <Main sheetOpen={open && !split} />; }`,
    // A type position names no part to render.
    `import type { ComponentProps } from "react";
${sheet}type RootProps = ComponentProps<typeof Sheet.Root>;
function Panel() { const [open] = useSideOverlay(false); return <Sheet.Root open={open} />; }`,
    // Forwarded through a component prop whose default is closed, under its own name or a `…Open` name.
    `${sheet}function Panel({ open = false }) { return <Sheet.Root open={open} />; }`,
    `${sheet}const Panel = ({ sheetOpen: shown = false }) => <Sheet.Root open={shown} />;`,
    `${sheet}function Shell() { const [open, setOpen] = useSideOverlay(false); return <Panel sheetOpen={open} onSheetOpenChange={setOpen} />; }`,
    // A ListDetail's Sheet, held by the hook or forwarded with a closed default.
    `${listDetail}function Orders() { const [open, setOpen] = useSideOverlay(false); return <ListDetail.Root open={open} onOpenChange={setOpen} />; }`,
    `${listDetail}function Main({ detailOpen = false, onDetailOpenChange }) { return <ListDetail.Root open={detailOpen} onOpenChange={onDetailOpenChange} />; }`,
    // Fuse's picker fields take `isOpen`.
    `${hook}import { DatePickerField } from "@elmeragroup/fuse/date-picker";
function Start() { const [open, setOpen] = useSideOverlay(false); return <DatePickerField label="Start" isOpen={open} onOpenChange={setOpen} />; }`,
    // A namespace import of a subpath, and a lowercase namespace of the root.
    `${hook}import * as Menus from "@elmeragroup/fuse/dropdown-menu";
function Menu() { const [open] = useSideOverlay(false); return <Menus.DropdownMenu.Root open={open} />; }`,
    `${hook}import * as fuse from "@elmeragroup/fuse";
function Panel() { const [open] = useSideOverlay(false); return <fuse.Sheet.Root open={open} />; }`,
    // A spread before the state attribute cannot override it. Only a spread onto a local component may
    // follow its attributes, and only as a stateless object.
    `${sheet}function Panel(props) { const [open] = useSideOverlay(false); return <Sheet.Root {...props} open={open} />; }`,
    // A local component given a constant object the module only spreads.
    `function Section() { const band = { tone: "plain", title: "Hi" }; return <><Band {...band} /><Band {...band} lede="x" /></>; }`,
    // An inline list is controlled like any root.
    `${hook}import { Combobox } from "@elmeragroup/fuse/combobox";
function Picker() { const [open, setOpen] = useSideOverlay(false); return <Combobox.Root inline open={open} onOpenChange={setOpen} items={[]} />; }`,
    // A Sidebar's phone Sheet reads its Provider's `openMobile`, so the Root needs no state of its own.
    `${hook}import { Sidebar } from "@elmeragroup/fuse/sidebar";
function App() { const [open, setOpen] = useSideOverlay(false); return <Sidebar.Provider bounds="container" openMobile={open} onOpenMobileChange={setOpen}><Sidebar.Root collapsible="icon" /></Sidebar.Provider>; }`,
    // Parts that are no overlay, an overlay's other parts, and a seed for a local component.
    `import { Tooltip } from "@elmeragroup/fuse/tooltip";
import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Sheet } from "@elmeragroup/fuse/sheet";
function Parts({ shown }) { return <><Tooltip.Root /><Collapsible.Root open={shown} /><Sheet.Content /><Details defaultOpen /></>; }`,
    // The DataTable's menus: the namespace parts and a table's registered forms.
    `${dataTable}function Columns({ table }) { const [open, setOpen] = useSideOverlay(false); return <DataTable.ColumnToggle table={table} open={open} onOpenChange={setOpen} />; }`,
    `${dataTable}function Pages({ table }) { const [open] = useSideOverlay(false); return <DataTable.Pagination table={table} pageSizeOpen={open} />; }`,
    `${hook}function Search() { const table = useAppTable({}); const [open, setOpen] = useSideOverlay(false); return <table.AppTable><table.ColumnToggle open={open} onOpenChange={setOpen} /><table.Pagination pageSizeOpen={open} /></table.AppTable>; }`,
    // A part without a popup, read outside a tag.
    `${dataTable}const columns = [{ cell: DataTable.Text }];`,
    // A local module's dynamic import is linted where it is defined; another value's own members pass.
    `import dynamic from "next/dynamic";
const OrderSearch = dynamic(async () => (await import("./order-search")).OrderSearch);`,
    `function Search({ table }) { return table.getPageCount() + table.options.pagination; }`,
    // A template specifier without substitutions is read like a string literal.
    "const load = () => import(`./order-search`);",
    // A forwarding component declared and exported, rendered as a tag; a non-forwarding one used as a value.
    `${sheet}export function Panel({ open = false }) { return <Sheet.Root open={open} />; }
function Shell() { const [open] = useSideOverlay(false); return <Panel open={open} />; }`,
    `import { createElement } from "react";
function Label({ text }) { return text; }
const element = createElement(Label, { text: "Hi" });`,
    // A Fuse re-export elsewhere than Fuse, and a declaration export.
    `export { useSideOverlay } from "../window-side";`,
    // A local that shadows an import is not the import.
    `import { Sheet } from "@elmeragroup/fuse/sheet";
function Panel({ Sheet }) { return <Sheet.Root />; }`,
    `import { Dialog } from "@elmeragroup/fuse/dialog";
function wrap(Dialog) { return Dialog; }`,
    // A setter or handler passed to a local component is no forwarded state.
    `function App({ setState, handle }) { return <Shell setOpen={setState} onOpen={handle} />; }`,
  ],
  invalid: [
    // Uncontrolled, under any import shape.
    {
      code: `${sheet}function Panel() { return <Sheet.Root />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import { Combobox as Picker } from "@elmeragroup/fuse";
function Seller() { return <Picker.Root items={[]} />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import * as Fuse from "@elmeragroup/fuse";
function Confirm() { return <Fuse.AlertDialog.Root defaultOpen />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // A lowercase namespace is a binding, not an intrinsic tag.
    {
      code: `import * as fuse from "@elmeragroup/fuse";
function Panel() { return <fuse.Sheet.Root defaultOpen />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // Fuse's picker fields take `isOpen`, so Base UI's `open` does not control them.
    {
      code: `${hook}import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
function Range() { const [open] = useSideOverlay(false); return <DateRangePickerField label="Period" open={open} />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // NavigationMenu shows by `value`; its open state is not `open`.
    {
      code: `${hook}import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
function Nav() { const [open] = useSideOverlay(false); return <NavigationMenu.Root open={open} />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // Controlled, by state that does not close with the side.
    {
      code: `import { useState } from "react";
import { Dialog } from "@elmeragroup/fuse/dialog";
function Change() { const [open, setOpen] = useState(false); return <Dialog.Root open={open} onOpenChange={setOpen} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A hook of the same name from another module.
    {
      code: `import { useSideOverlay } from "./elsewhere";
import { Dialog } from "@elmeragroup/fuse/dialog";
function Change() { const [open] = useSideOverlay(false); return <Dialog.Root open={open} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // The hook returns its argument while the side hides, so it must be the closed value.
    {
      code: `${sheet}function Panel() { const [open] = useSideOverlay(true); return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "closedValue" }],
    },
    {
      code: `${hook}import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
function Nav() { const [value] = useSideOverlay(false); return <NavigationMenu.Root value={value} />; }`,
      errors: [{ messageId: "closedValue" }],
    },
    {
      code: `${sheet}const CLOSED = false;
function Panel() { const [open] = useSideOverlay(CLOSED); return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "closedValue" }],
    },
    {
      code: `${sheet}function Shell() { const [open] = useSideOverlay(true); return <Panel sheetOpen={open} />; }`,
      errors: [{ messageId: "closedValue" }],
    },
    // The setter, not the state.
    {
      code: `${sheet}function Panel() { const [, setOpen] = useSideOverlay(false); return <Sheet.Root open={setOpen} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A disjunction can be open while the side is hidden.
    {
      code: `${sheet}function Panel({ pinned }) { const [open] = useSideOverlay(false); return <Sheet.Root open={open || pinned} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A literal, and a prop whose name no caller is checked under.
    {
      code: `${sheet}function Panel() { return <Sheet.Root open />; }`,
      errors: [{ messageId: "untraced" }],
    },
    {
      code: `${sheet}function Panel({ visible = false }) { return <Sheet.Root open={visible} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A forwarded prop without a closed default lets a caller that omits it leave the overlay open.
    {
      code: `${sheet}function Panel({ open }) { return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "openDefault" }],
    },
    {
      code: `${sheet}function Panel({ open = true }) { return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "openDefault" }],
    },
    {
      code: `${listDetail}function Main({ detailOpen, onDetailOpenChange }) { return <ListDetail.Root open={detailOpen} onOpenChange={onDetailOpenChange} />; }`,
      errors: [{ messageId: "openDefault" }],
    },
    // A callback's parameter is data, not a component's forwarded prop.
    {
      code: `${sheet}function Panels({ items }) { return items.map(({ open = false }) => <Sheet.Root open={open} />); }`,
      errors: [{ messageId: "untraced" }],
    },
    // A shadowing binding is resolved by scope, not by name.
    {
      code: `import { useState } from "react";
${sheet}function Outer() { const [open] = useSideOverlay(false); function Inner() { const [open] = useState(true); return <Sheet.Root open={open} />; } return <Inner />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // `&&` counts only with the side state on the left and a boolean on the right.
    {
      code: `${sheet}function Panel({ enabled }) { const [open] = useSideOverlay(false); return <Sheet.Root open={open && enabled} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A nav value closes with `null`, so it takes the hook's state directly, never a boolean prop.
    {
      code: `import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
function Nav({ navOpen = null }) { return <NavigationMenu.Root value={navOpen} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A binding written after its declaration may no longer be the side's state.
    {
      code: `${sheet}function Panel({ open = false, forced }) { open ||= forced; return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "reassigned" }],
    },
    {
      code: `${sheet}function Panel() { let [open] = useSideOverlay(false); open = true; return <Sheet.Root open={open} />; }`,
      errors: [{ messageId: "reassigned" }],
    },
    // An overlay part is rendered only as a tag; an alias would hide it.
    {
      code: `${sheet}const Modal = Sheet.Root;
function Panel() { return <Modal defaultOpen />; }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `${sheet}const { Root: Modal } = Sheet;
function Panel() { return <Modal defaultOpen />; }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `import * as fuse from "@elmeragroup/fuse";
const { Sheet } = fuse;
function Panel() { return <Sheet.Root defaultOpen />; }`,
      errors: [{ messageId: "alias" }],
    },
    // An import below its use still counts.
    {
      code: `export function Panel() { return <Sheet.Root defaultOpen />; }
import { Sheet } from "@elmeragroup/fuse/sheet";`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // A spread after the state attribute, or instead of it, may override it.
    {
      code: `${sheet}function Panel(props) { const [open] = useSideOverlay(false); return <Sheet.Root open={open} {...props} />; }`,
      errors: [{ messageId: "spread" }],
    },
    {
      code: `${sheet}function Panel(props) { return <Sheet.Root {...props} />; }`,
      errors: [{ messageId: "spread" }],
    },
    {
      code: `${sheet}function Panel() { const [open] = useSideOverlay(false); return <Sheet.Root open={open} {...{ modal: true }} />; }`,
      errors: [{ messageId: "spread" }],
    },
    // `inline` does not exempt a Root: a Content inside it still renders a popup.
    {
      code: `import { Combobox } from "@elmeragroup/fuse/combobox";
function Picker() { return <Combobox.Root inline modal defaultOpen items={[]}><Combobox.Input /><Combobox.Content><Combobox.List /></Combobox.Content></Combobox.Root>; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
function Picker() { return <Autocomplete.Root inline={true} open items={[]} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // A forwarded prop is checked where it is passed, through spreads too.
    {
      code: `import { useState } from "react";
function Shell() { const [open] = useState(false); return <NewOrderSheet open={open} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    {
      code: `function Shell({ ready }) { return <Main sheetOpen={ready} settingsOpen={ready} isOpen />; }`,
      errors: [{ messageId: "untraced" }, { messageId: "untraced" }, { messageId: "untraced" }],
    },
    {
      code: `import { useState } from "react";
function Shell() { const [open] = useState(true); return <Panel {...{ open }} />; }`,
      errors: [{ messageId: "spread" }],
    },
    {
      code: `function Shell(props) { return <Panel {...props} />; }`,
      errors: [{ messageId: "spread" }],
    },
    // A constant object the module also writes elsewhere could gain a forwarded key.
    {
      code: `function Section() { const band = {}; band.open = true; return <Band {...band} />; }`,
      errors: [{ messageId: "spread" }],
    },
    // The DataTable's menus, uncontrolled: Order search's column menu without its hook state.
    {
      code: `function Search() { const table = useAppTable({}); return <table.AppTable><table.ColumnToggle className="columns" getLabel={(column) => column.id} /></table.AppTable>; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import { useState } from "react";
function Search() { const table = useAppTable({}); const [open, setOpen] = useState(false); return <table.ColumnToggle open={open} onOpenChange={setOpen} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    {
      code: `function Search() { const table = useAppTable({}); return <table.Pagination />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `${dataTable}function Pages({ table }) { const [open] = useSideOverlay(false); return <DataTable.Pagination table={table} open={open} />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import { actionsColumn } from "@elmeragroup/fuse/data-table";
const columns = [actionsColumn(helper, { items: () => null })];`,
      errors: [{ messageId: "factory" }],
    },
    // A registered part aliased or destructured off a table escapes the tag check.
    {
      code: `function Search() { const table = useAppTable({}); const Columns = table.ColumnToggle; return <Columns />; }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `function Search() { const table = useAppTable({}); const { ColumnToggle } = table; return <ColumnToggle />; }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `function Search() { const Columns = getTable()["ColumnToggle"]; return <Columns />; }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `${dataTable}const tableComponents = { Columns: DataTable.ColumnToggle };`,
      errors: [{ messageId: "alias" }],
    },
    // A dynamic import of Fuse loads a part the rule cannot name, as the landing's `dynamic` does.
    {
      code: `import dynamic from "next/dynamic";
const DatePicker = dynamic(async () => (await import("@elmeragroup/fuse/date-picker")).DatePickerField, { ssr: false });
function Start() { return <DatePicker label="Start" />; }`,
      errors: [{ messageId: "dynamicImport" }],
    },
    {
      code: `const load = (entry) => import(entry);`,
      errors: [{ messageId: "dynamicImport" }],
    },
    {
      code: "const load = (entry) => import(`@elmeragroup/fuse/${entry}`);",
      errors: [{ messageId: "dynamicImport" }],
    },
    // A re-export of Fuse, in each form, hands its parts to modules that see a local component.
    {
      code: `export { Sheet } from "@elmeragroup/fuse/sheet";`,
      errors: [{ messageId: "reexport" }],
    },
    {
      code: `export * from "@elmeragroup/fuse/sheet";`,
      errors: [{ messageId: "reexport" }],
    },
    // An imported overlay part exported again by name is an alias.
    {
      code: `import { Sheet } from "@elmeragroup/fuse/sheet";
export { Sheet };`,
      errors: [{ messageId: "alias" }],
    },
    // A component that forwards open state is checked only at JSX callers; any other use bypasses them.
    {
      code: `import { createElement, useState } from "react";
${sheet}function Panel({ open = false, onOpenChange }) { return <Sheet.Root open={open} onOpenChange={onOpenChange} />; }
function Shell() { const [open, setOpen] = useState(true); return createElement(Panel, { open, onOpenChange: setOpen }); }`,
      errors: [{ messageId: "alias" }],
    },
    {
      code: `import { cloneElement, memo } from "react";
${sheet}const Panel = ({ sheetOpen = false }) => <Sheet.Root open={sheetOpen} />;
export const Remembered = memo(Panel);
function Shell({ element }) { return cloneElement(element, { Panel }); }`,
      errors: [{ messageId: "alias" }, { messageId: "alias" }],
    },
    // Shadowing applies inward only: the import still counts outside the shadowing scope.
    {
      code: `import { Sheet } from "@elmeragroup/fuse/sheet";
function Inner({ Sheet: Local }) { return <Local.Root />; }
function Panel() { return <Sheet.Root />; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    // A Sidebar Provider holds its phone Sheet's state inside unless it takes `openMobile` from the hook.
    {
      code: `import { Sidebar } from "@elmeragroup/fuse/sidebar";
function App() { return <Sidebar.Provider bounds="container"><Sidebar.Root collapsible="icon" /></Sidebar.Provider>; }`,
      errors: [{ messageId: "uncontrolled" }],
    },
    {
      code: `import { useState } from "react";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
function App() { const [open, setOpen] = useState(false); return <Sidebar.Provider openMobile={open} onOpenMobileChange={setOpen} />; }`,
      errors: [{ messageId: "untraced" }],
    },
    // Parts that keep their open state inside.
    {
      code: `import { SelectField } from "@elmeragroup/fuse/select-field";
function Size() { return <SelectField label="Size" items={[]} />; }`,
      errors: [{ messageId: "internal" }],
    },
  ],
});
