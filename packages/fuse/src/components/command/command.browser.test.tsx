import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from "react";

import { Autocomplete } from "@base-ui/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import {
  metricPx,
  px,
  renderThemed,
  ROW,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Dialog } from "../dialog";
import { Kbd } from "../kbd/kbd";
import { Command } from "./index";

type Entry = { readonly value: string; readonly label: string; readonly page?: string };

const HOME: readonly Entry[] = [
  { value: "customers", label: "Customers", page: "customers" },
  { value: "invoices", label: "Open invoices" },
  { value: "reading", label: "Register meter reading" },
];

const CUSTOMERS: readonly Entry[] = [
  { value: "ada", label: "Ada Lovelace" },
  { value: "grace", label: "Grace Hopper" },
];

function renderPalette(node: ReactNode) {
  return renderThemed(withLocale("en-US", node));
}

function comboboxNamed(name: string): HTMLInputElement {
  const input = roleNamed("combobox", name);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> named ${name}`);
  }
  return input;
}

/** The text of the option that Base UI marks highlighted. */
function highlightedLabel(): string | null {
  const highlighted = page
    .getByRole("option")
    .elements()
    .find((option) => option.hasAttribute("data-highlighted"));
  return highlighted?.textContent ?? null;
}

function EntryRows({ onRun }: { onRun: (label: string) => void }): ReactElement {
  return (
    <Command.List>
      {(entry: Entry) =>
        entry.page === undefined ? (
          <Command.Item
            key={entry.value}
            value={entry}
            onClick={() => {
              onRun(entry.label);
            }}>
            {entry.label}
          </Command.Item>
        ) : (
          <Command.PageTrigger key={entry.value} value={entry} page={entry.page}>
            {entry.label}
          </Command.PageTrigger>
        )
      }
    </Command.List>
  );
}

/** The parts of one search: the input, the empty message, the rows and the footer hints. */
function EntrySearch({ onRun }: { onRun: (label: string) => void }): ReactElement {
  return (
    <>
      <Command.Input />
      <Command.Empty />
      <EntryRows onRun={onRun} />
      <Command.Footer>
        <Command.NavigateHint />
        <Command.BackHint />
      </Command.Footer>
    </>
  );
}

/**
 * A search whose items come from elsewhere, as a server's results do, so `filter={null}` turns
 * Base UI's filtering off. Its status line reports the query it last saw.
 */
function ServerSearch(): ReactElement {
  const [query, setQuery] = useState("");
  return (
    <Command.Root items={HOME} filter={null} value={query} onValueChange={setQuery}>
      <Command.Input aria-label="Search" />
      <Command.Status>{query === "" ? null : `${HOME.length} results for ${query}`}</Command.Status>
      <Command.List>
        {(entry: Entry) => (
          <Command.Item key={entry.value} value={entry}>
            {entry.label}
          </Command.Item>
        )}
      </Command.List>
    </Command.Root>
  );
}

/** A query held above `Command.Root`, which makes the home page's search controlled. */
type HeldQuery = { readonly value: string; readonly onValueChange: (value: string) => void };

type EntryPagesProps = {
  readonly onRun: (label: string) => void;
  readonly held?: HeldQuery;
};

/** The home page and the customers page, as children of a Root with a stack. */
function EntryPages({ onRun, held }: EntryPagesProps): ReactElement {
  return (
    <>
      <Command.Page id="home" label="Commands" items={HOME} {...held}>
        <EntrySearch onRun={onRun} />
      </Command.Page>
      <Command.Page id="customers" label="Customers" items={CUSTOMERS}>
        <EntrySearch onRun={onRun} />
      </Command.Page>
    </>
  );
}

function PagedPalette({ onRun = () => undefined }: { onRun?: (label: string) => void }): ReactElement {
  return (
    <Command.Root defaultPages={["home"]}>
      <EntryPages onRun={onRun} />
    </Command.Root>
  );
}

/** The palette holds the parent page's query above the Root, so the query outlasts the page. */
function KeptQueryPalette(): ReactElement {
  const [query, setQuery] = useState("");
  return (
    <Command.Root defaultPages={["home"]}>
      <EntryPages onRun={() => undefined} held={{ value: query, onValueChange: setQuery }} />
    </Command.Root>
  );
}

/** Waits until the page input with this name has mounted, and returns it. */
async function mountedInput(name: string): Promise<HTMLInputElement> {
  await expect.element(page.getByRole("combobox", { name, exact: true })).toBeInTheDocument();
  return comboboxNamed(name);
}

async function openCustomers(): Promise<HTMLInputElement> {
  const home = comboboxNamed("Commands");
  home.focus();
  await expect.poll(highlightedLabel).toBe("Customers");
  await userEvent.keyboard("{Enter}");
  return mountedInput("Customers");
}

/** A list that maps its `children` over the filtered items, as a custom renderer would. */
function MappedList({
  children,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  children?: (item: string, index: number) => ReactNode;
}): ReactElement {
  const items = Autocomplete.useFilteredItems<string>();
  return <div {...props}>{children === undefined ? null : items.map(children)}</div>;
}

describe("Command", () => {
  it("names its input and placeholder from the dictionary when no page names it", () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <Command.Root items={["Kunder"]}>
          <Command.Input />
        </Command.Root>
      )
    );
    expect(comboboxNamed("Søk etter kommandoer").placeholder).toBe("Skriv en kommando eller søk …");
  });

  it("labels the close hint with the locale's close word unless its children replace it", () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <Command.Root items={["Kunder"]}>
          <Command.Footer>
            <Command.CloseHint />
            <Command.CloseHint>Tilbake</Command.CloseHint>
          </Command.Footer>
        </Command.Root>
      )
    );
    expect(
      page
        .getByText("Esc", { exact: true })
        .elements()
        .map((cap) => cap.parentElement?.textContent)
    ).toEqual(["EscLukk", "EscTilbake"]);
  });

  it("leaves focus where it is when the palette first mounts", () => {
    renderPalette(<PagedPalette />);
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps a palette without pages apart from the page of an outer palette it sits on", async () => {
    renderPalette(
      <Command.Root defaultPages={["home", "inner"]}>
        <Command.Page id="inner" label="Outer page" items={["Outer row"]}>
          <Command.Root items={["Inner row"]}>
            <Command.Input />
            <Command.Footer>
              <Command.BackHint />
            </Command.Footer>
          </Command.Root>
        </Command.Page>
      </Command.Root>
    );
    // The inner input takes its name from the dictionary, not from the outer page's label. It
    // starts with the search icon, not with the outer stack's Back button.
    const inner = comboboxNamed("Search commands");
    expect(page.getByRole("button", { name: "Back", exact: true }).elements()).toEqual([]);
    expect(page.getByText("Back", { exact: true }).elements()).toEqual([]);
    inner.focus();
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => page.getByRole("combobox").elements()).toEqual([inner]);
  });

  it("hands the row function to a custom render element as its children", async () => {
    const onRun = vi.fn<(item: string) => void>();
    renderPalette(
      <Command.Root items={["Invoices", "Customers"]}>
        <Command.Input />
        <Command.List render={<MappedList />}>
          {(item: string) => (
            <Command.Item
              key={item}
              value={item}
              onClick={() => {
                onRun(item);
              }}>
              {item}
            </Command.Item>
          )}
        </Command.List>
      </Command.Root>
    );
    expect(
      page
        .getByRole("listbox")
        .getByRole("option")
        .elements()
        .map((option) => option.textContent)
    ).toEqual(["Invoices", "Customers"]);
    comboboxNamed("Search commands").focus();
    await expect.poll(highlightedLabel).toBe("Invoices");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onRun.mock.calls).toEqual([["Customers"]]);
  });

  it("pads a custom render element's rows on every side with the small surface gap", () => {
    renderPalette(
      <Command.Root items={["Invoices"]}>
        <Command.List render={<MappedList />}>
          {(item: string) => (
            <Command.Item key={item} value={item}>
              {item}
            </Command.Item>
          )}
        </Command.List>
      </Command.Root>
    );
    const list = getComputedStyle(page.getByRole("listbox").element());
    const inset = metricPx("surface-gap-sm", "dense");
    expect([list.paddingTop, list.paddingRight, list.paddingBottom, list.paddingLeft].map(px)).toEqual([
      inset,
      inset,
      inset,
      inset,
    ]);
  });

  it("moves the highlight with the arrow keys and runs the highlighted row on Enter", async () => {
    const onRun = vi.fn<(label: string) => void>();
    renderPalette(<PagedPalette onRun={onRun} />);
    comboboxNamed("Commands").focus();
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Open invoices"]]);
  });

  it("keeps focus in the input when a row is clicked", async () => {
    const onRun = vi.fn<(label: string) => void>();
    renderPalette(<PagedPalette onRun={onRun} />);
    const input = comboboxNamed("Commands");
    input.focus();
    await userEvent.click(roleNamed("option", "Register meter reading"));
    expect(onRun.mock.calls).toEqual([["Register meter reading"]]);
    expect(document.activeElement).toBe(input);
  });

  it("filters as the user types and shows the dictionary's empty message when nothing matches", async () => {
    renderPalette(<PagedPalette />);
    comboboxNamed("Commands").focus();
    await userEvent.keyboard("meter");
    await expect
      .poll(() =>
        page
          .getByRole("option")
          .elements()
          .map((option) => option.textContent)
      )
      .toEqual(["Register meter reading"]);
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await userEvent.keyboard("zzz");
    await expect.element(page.getByText("No results.", { exact: true })).toBeVisible();
    expect(page.getByRole("option").elements()).toEqual([]);
  });

  it("keeps a server's items unfiltered and announces the search's state from a status that stays mounted", async () => {
    renderPalette(<ServerSearch />);
    const status = page.getByRole("status").element();
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");
    comboboxNamed("Search").focus();
    await userEvent.keyboard("zzz");
    await expect.poll(() => status.textContent).toBe("3 results for zzz");
    expect(
      page
        .getByRole("option")
        .elements()
        .map((option) => option.textContent)
    ).toEqual(["Customers", "Open invoices", "Register meter reading"]);
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}");
    await expect.poll(() => status.textContent).toBe("");
    expect(page.getByRole("status").element()).toBe(status);
  });

  it("opens a page from its trigger, focuses the page's input and names it after the page", async () => {
    renderPalette(<PagedPalette />);
    expect(page.getByText("Back", { exact: true }).elements()).toEqual([]);
    const customers = await openCustomers();
    expect(document.activeElement).toBe(customers);
    expect(customers.value).toBe("");
    await expect.poll(highlightedLabel).toBe("Ada Lovelace");
    await expect.element(page.getByText("Back", { exact: true })).toBeInTheDocument();
    expect(page.getByRole("combobox").elements()).toEqual([customers]);
  });

  it("focuses a pushed page's input once Suspense resolves it", async () => {
    let resolveSearch: (search: { default: () => ReactElement }) => void = () => undefined;
    const LazySearch = lazy(
      () =>
        new Promise<{ default: () => ReactElement }>((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderPalette(
      <Command.Root defaultPages={["home"]}>
        <Command.Page id="home" label="Commands" items={HOME}>
          <EntrySearch onRun={() => undefined} />
        </Command.Page>
        <Command.Page id="customers" label="Customers" items={CUSTOMERS}>
          <Suspense fallback={<p>Loading customers</p>}>
            <LazySearch />
          </Suspense>
        </Command.Page>
      </Command.Root>
    );
    comboboxNamed("Commands").focus();
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Loading customers", { exact: true })).toBeInTheDocument();
    resolveSearch({ default: () => <EntrySearch onRun={() => undefined} /> });
    const customers = await mountedInput("Customers");
    await expect.poll(() => document.activeElement).toBe(customers);
  });

  it("leaves focus alone when a stack change keeps the same page on top", async () => {
    function TrimmedStackPalette(): ReactElement {
      const [stack, setStack] = useState<string[]>(["home", "customers"]);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setStack(["customers"]);
            }}>
            Forget the first page
          </button>
          <Command.Root pages={stack} onPagesChange={setStack}>
            <EntryPages onRun={() => undefined} />
          </Command.Root>
        </>
      );
    }
    renderPalette(<TrimmedStackPalette />);
    const customers = comboboxNamed("Customers");
    const button = roleNamed("button", "Forget the first page");
    await userEvent.click(button);
    // The Back button unmounts with the first page, so once it is gone the stack change has rendered.
    await expect.element(page.getByRole("button", { name: "Back", exact: true })).not.toBeInTheDocument();
    expect(comboboxNamed("Customers")).toBe(customers);
    expect(document.activeElement).toBe(button);
  });

  it("goes back on Backspace in the empty input, and to a fresh parent", async () => {
    renderPalette(<PagedPalette />);
    comboboxNamed("Commands").focus();
    await userEvent.keyboard("cust");
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await mountedInput("Customers");
    await userEvent.keyboard("{Backspace}");
    const home = await mountedInput("Commands");
    expect(home.value).toBe("");
    expect(document.activeElement).toBe(home);
    await expect.poll(highlightedLabel).toBe("Customers");
    expect(page.getByText("Back", { exact: true }).elements()).toEqual([]);
  });

  it("keeps the parent's query when it is held above the Root", async () => {
    renderPalette(<KeptQueryPalette />);
    comboboxNamed("Commands").focus();
    await userEvent.keyboard("cust");
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await mountedInput("Customers");
    await userEvent.keyboard("{Backspace}");
    const home = await mountedInput("Commands");
    expect(home.value).toBe("cust");
  });

  it("stays on the page when Backspace edits text or comes from an IME composition", async () => {
    renderPalette(<PagedPalette />);
    const customers = await openCustomers();
    await userEvent.keyboard("a");
    await userEvent.keyboard("{Backspace}");
    expect(customers.value).toBe("");
    expect(comboboxNamed("Customers")).toBe(customers);
    customers.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", isComposing: true, bubbles: true })
    );
    customers.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", keyCode: 229, bubbles: true }));
    await expect.poll(() => page.getByRole("combobox").elements()).toEqual([customers]);
  });

  it("goes back with the Back button that leads a page's input", async () => {
    renderPalette(<PagedPalette />);
    await openCustomers();
    await userEvent.click(roleNamed("button", "Back"));
    await mountedInput("Commands");
    expect(page.getByRole("button", { name: "Back", exact: true }).elements()).toEqual([]);
  });

  it("hides the shortcut caps from the row's name and keeps the row's own shortcut", () => {
    renderPalette(
      <Command.Root items={["New customer"]}>
        <Command.Input />
        <Command.List>
          {(item: string) => (
            <Command.Item key={item} value={item} aria-keyshortcuts="Control+N">
              {item}
              <Command.Shortcut>
                <Kbd>Ctrl</Kbd>
                <Kbd>N</Kbd>
              </Command.Shortcut>
            </Command.Item>
          )}
        </Command.List>
      </Command.Root>
    );
    expect(roleNamed("option", "New customer").getAttribute("aria-keyshortcuts")).toBe("Control+N");
  });

  it("names each group with its label", () => {
    const groups = [
      { value: "Create", items: ["New customer"] },
      { value: "Go to", items: ["Invoices"] },
    ];
    renderPalette(
      <Command.Root grouped items={groups}>
        <Command.Input />
        <Command.List>
          {(group: { readonly value: string; readonly items: readonly string[] }) => (
            <Command.Group key={group.value} items={group.items}>
              <Command.Label>{group.value}</Command.Label>
              <Command.Collection>
                {(item: string) => (
                  <Command.Item key={item} value={item}>
                    {item}
                  </Command.Item>
                )}
              </Command.Collection>
            </Command.Group>
          )}
        </Command.List>
      </Command.Root>
    );
    expect(roleNamed("group", "Create").textContent).toContain("New customer");
    expect(roleNamed("group", "Go to").textContent).toContain("Invoices");
  });

  const noRender: Pick<ComponentProps<typeof Command.List>, "render"> = {};
  const divRender: Pick<ComponentProps<typeof Command.List>, "render"> = { render: <div /> };
  it.each([
    ["without a render value", noRender],
    ["inside a render element", divRender],
  ])("runs indexed row elements in a virtualized search %s, as Base UI does", async (_case, listProps) => {
    const onRun = vi.fn<(command: string) => void>();
    renderPalette(
      <Command.Root items={COMMANDS} virtualized>
        <Command.Input />
        <Command.List {...listProps}>
          {COMMANDS.map((command, index) => (
            <Command.Item
              key={command}
              index={index}
              value={command}
              onClick={() => {
                onRun(command);
              }}>
              {command}
            </Command.Item>
          ))}
        </Command.List>
      </Command.Root>
    );
    expect(
      page
        .getByRole("listbox")
        .getByRole("option")
        .elements()
        .map((option) => option.textContent)
    ).toEqual(COMMANDS);
    comboboxNamed("Search commands").focus();
    await expect.poll(highlightedLabel).toBe("New customer");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Open invoices"]]);
  });

  it("sizes a row with the row metric at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderPalette(
        <Command.Root items={[`Row ${density}`]}>
          <Command.Input />
          <Command.List>
            {(item: string) => (
              <Command.Item key={item} value={item}>
                {item}
              </Command.Item>
            )}
          </Command.List>
        </Command.Root>
      );
      const row = roleNamed("option", `Row ${density}`);
      // A single-line row is exactly --row-h.
      expect(px(getComputedStyle(row).height), density).toBe(ROW[density].height);
      unmount();
    }
    document.documentElement.removeAttribute("data-density");
  });
});

const COMMANDS = ["New customer", "Open invoices", "Register meter reading"];

type DialogPaletteProps = {
  readonly onRun?: (command: string) => void;
  readonly contentStyle?: CSSProperties;
};

/** The one-page palette in a dialog, with the search in the Root above the dialog's portal. */
function DialogPalette({ onRun = () => undefined, contentStyle }: DialogPaletteProps): ReactElement {
  return (
    <Command.Root items={COMMANDS}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content style={contentStyle}>
        <Command.Input />
        <Command.Empty />
        <Command.List>
          {(command: string) => (
            <Command.Item
              key={command}
              value={command}
              onClick={() => {
                onRun(command);
              }}>
              {command}
            </Command.Item>
          )}
        </Command.List>
      </Command.Content>
    </Command.Root>
  );
}

/** The paged palette in a dialog, with an uncontrolled stack. */
function PagedDialogPalette({ contentStyle }: { contentStyle?: CSSProperties }): ReactElement {
  return (
    <Command.Root defaultPages={["home"]}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content style={contentStyle}>
        <EntryPages onRun={() => undefined} />
      </Command.Content>
    </Command.Root>
  );
}

/** A query held above `Command.Root`, which outlasts the dialog. */
function HeldQueryDialogPalette(): ReactElement {
  const [query, setQuery] = useState("");
  return (
    <Command.Root items={COMMANDS} value={query} onValueChange={setQuery}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content>
        <Command.Input />
        <Command.List>
          {(command: string) => (
            <Command.Item key={command} value={command}>
              {command}
            </Command.Item>
          )}
        </Command.List>
      </Command.Content>
    </Command.Root>
  );
}

/** The controlled-stack recipe, in which Escape goes back a page before it closes the dialog. */
function EscapeBackPalette(): ReactElement {
  const [stack, setStack] = useState<string[]>(["home"]);
  return (
    <Command.Root
      pages={stack}
      onPagesChange={setStack}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "escape-key" && stack.length > 1) {
          details.cancel();
          setStack(stack.slice(0, -1));
          return;
        }
        if (next) {
          setStack(["home"]);
        }
      }}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content>
        <EntryPages onRun={() => undefined} />
      </Command.Content>
    </Command.Root>
  );
}

/** Opens the palette from its trigger and waits for the dialog to focus the input named `input`. */
async function openPalette(input = "Search commands"): Promise<HTMLElement> {
  await userEvent.click(roleNamed("button", "Open palette"));
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  await expect.poll(() => document.activeElement).toBe(comboboxNamed(input));
  return roleNamed("dialog", "Command palette");
}

async function closedPalette(): Promise<void> {
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
}

describe("Command.Content", () => {
  it("opens from Command.Trigger, names the popup from the dictionary and renders no close button", async () => {
    renderPalette(<DialogPalette />);
    expect(page.getByRole("dialog").elements()).toEqual([]);
    const dialog = await openPalette();
    expect(dialog.querySelectorAll("button")).toHaveLength(0);
  });

  it("moves the highlight with the arrow keys and runs the row on Enter, with the search above the portal", async () => {
    const onRun = vi.fn<(command: string) => void>();
    renderPalette(<DialogPalette onRun={onRun} />);
    await openPalette();
    await expect.poll(highlightedLabel).toBe("New customer");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{Enter}");
    expect(onRun.mock.calls).toEqual([["Open invoices"]]);
  });

  it("filters as the user types in the dialog", async () => {
    renderPalette(<DialogPalette />);
    await openPalette();
    await userEvent.keyboard("meter");
    await expect
      .poll(() =>
        page
          .getByRole("option")
          .elements()
          .map((option) => option.textContent)
      )
      .toEqual(["Register meter reading"]);
  });

  it("closes on Escape and returns focus to Command.Trigger", async () => {
    renderPalette(<DialogPalette />);
    await openPalette();
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await expect.poll(() => document.activeElement).toBe(roleNamed("button", "Open palette"));
  });

  it("keeps a closed palette closed when Command.Content remounts", async () => {
    function RemountedContentPalette(): ReactElement {
      const [contentKey, setContentKey] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setContentKey((key) => key + 1);
            }}>
            Remount content
          </button>
          <Command.Root items={COMMANDS} defaultOpen>
            <Command.Trigger>Open palette</Command.Trigger>
            <Command.Content key={contentKey}>
              <Command.Input />
            </Command.Content>
          </Command.Root>
        </>
      );
    }
    renderPalette(<RemountedContentPalette />);
    await expect.element(page.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(comboboxNamed("Search commands"));
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await userEvent.click(roleNamed("button", "Remount content"));
    await closedPalette();
    expect(page.getByRole("dialog").elements()).toEqual([]);
    await openPalette();
  });

  it("opens a controlled palette from Command.Trigger and returns focus to it on close", async () => {
    const changes = vi.fn<(open: boolean) => void>();
    function ControlledPalette(): ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <Command.Root
          items={COMMANDS}
          open={open}
          onOpenChange={(next) => {
            changes(next);
            setOpen(next);
          }}>
          <Command.Trigger>Open palette</Command.Trigger>
          <Command.Content>
            <Command.Input />
          </Command.Content>
        </Command.Root>
      );
    }
    renderPalette(<ControlledPalette />);
    await openPalette();
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await expect.poll(() => document.activeElement).toBe(roleNamed("button", "Open palette"));
    expect(changes.mock.calls).toEqual([[true], [false]]);
  });

  it("starts each opening with an empty query and the first match highlighted", async () => {
    renderPalette(<DialogPalette />);
    await openPalette();
    await userEvent.keyboard("invoices");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    const input = await openPalette().then(() => comboboxNamed("Search commands"));
    expect(input.value).toBe("");
    await expect.poll(highlightedLabel).toBe("New customer");
  });

  it("keeps a query held above Command.Root from one opening to the next", async () => {
    renderPalette(<HeldQueryDialogPalette />);
    await openPalette();
    await userEvent.keyboard("invoices");
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await openPalette();
    expect(comboboxNamed("Search commands").value).toBe("invoices");
  });

  it("closes on Escape from a page above the first, and reopens on the first page", async () => {
    renderPalette(<PagedDialogPalette />);
    await openPalette("Commands");
    await userEvent.keyboard("{Enter}");
    await mountedInput("Customers");
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await openPalette("Commands");
    expect(page.getByRole("combobox").elements()).toEqual([comboboxNamed("Commands")]);
  });

  it("starts each opening with an empty query when the page wraps Command.Content", async () => {
    renderPalette(
      <Command.Root defaultPages={["home"]}>
        <Command.Trigger>Open palette</Command.Trigger>
        <Command.Page id="home" label="Commands" items={COMMANDS}>
          <Command.Content>
            <Command.Input />
            <Command.List>
              {(command: string) => (
                <Command.Item key={command} value={command}>
                  {command}
                </Command.Item>
              )}
            </Command.List>
          </Command.Content>
        </Command.Page>
      </Command.Root>
    );
    await openPalette("Commands");
    await userEvent.keyboard("invoices");
    await expect.poll(() => comboboxNamed("Commands").value).toBe("invoices");
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await openPalette("Commands");
    expect(comboboxNamed("Commands").value).toBe("");
  });

  it("goes back a page on Escape with the controlled-stack recipe, and closes from the first page", async () => {
    renderPalette(<EscapeBackPalette />);
    await openPalette("Commands");
    await userEvent.keyboard("{Enter}");
    await mountedInput("Customers");
    await userEvent.keyboard("{Escape}");
    const home = await mountedInput("Commands");
    expect(roleNamed("dialog", "Command palette")).toBeInstanceOf(HTMLElement);
    await expect.poll(() => document.activeElement).toBe(home);
    await userEvent.keyboard("{Escape}");
    await closedPalette();
  });

  it("lets Dialog.Close inside an inline palette close the consumer's Dialog.Content around it", async () => {
    renderPalette(
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Content showCloseButton={false} aria-label="Pick a command">
          <Command.Root items={COMMANDS}>
            <Command.Input />
            <Command.List>
              {(command: string) => (
                <Command.Item key={command} value={command}>
                  {command}
                </Command.Item>
              )}
            </Command.List>
            <Command.Footer>
              <Dialog.Close>Done</Dialog.Close>
            </Command.Footer>
          </Command.Root>
        </Dialog.Content>
      </Dialog.Root>
    );
    await userEvent.click(roleNamed("button", "Open dialog"));
    await expect.element(page.getByRole("dialog", { name: "Pick a command" })).toBeInTheDocument();
    await userEvent.click(roleNamed("button", "Done"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});

/** Stretches the close animation to a second, so a reopening lands before it ends. */
const SLOW_EXIT: CSSProperties = { animationDuration: "1000ms" };

/**
 * A palette whose stack and first page's query the consumer controls, and sets back to the first
 * page and an empty query each time the palette opens.
 */
function ResetOnOpenPalette(): ReactElement {
  const [stack, setStack] = useState<string[]>(["home"]);
  const [query, setQuery] = useState("");
  return (
    <Command.Root
      pages={stack}
      onPagesChange={setStack}
      onOpenChange={(next) => {
        if (next) {
          setStack(["home"]);
          setQuery("");
        }
      }}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content style={SLOW_EXIT}>
        <EntryPages onRun={() => undefined} held={{ value: query, onValueChange: setQuery }} />
      </Command.Content>
    </Command.Root>
  );
}

/** Opens the palette with `reopen` while its close animation runs. */
async function interruptClose(reopen: () => Promise<void> | void): Promise<void> {
  const closing = roleNamed("dialog", "Command palette");
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => closing.hasAttribute("data-ending-style")).toBe(true);
  await reopen();
  await expect.poll(() => closing.hasAttribute("data-open")).toBe(true);
  // The same popup: the opening kept it from its close.
  expect(roleNamed("dialog", "Command palette")).toBe(closing);
}

/**
 * Closes the palette on Escape and opens it again from `trigger` while the close animation runs,
 * then waits for the dialog to focus the input named `input`.
 */
async function reopenMidClose(trigger: HTMLElement, input = "Search commands"): Promise<void> {
  // A DOM click, since the closing dialog's overlay still covers the trigger.
  await interruptClose(() => {
    trigger.click();
  });
  // The input is looked up on each poll, since the children mount fresh.
  await expect.poll(() => document.activeElement === comboboxNamed(input)).toBe(true);
}

/** A button that counts its own clicks, as state a fresh mount sets back to zero. */
function TallyButton(): ReactElement {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount((current) => current + 1);
      }}>
      {`Tally ${String(count)}`}
    </button>
  );
}

describe("Command.Content reopened before its close ends", () => {
  it("starts with an empty query and the first match highlighted, and keeps the trigger", async () => {
    renderPalette(<DialogPalette contentStyle={SLOW_EXIT} />);
    const trigger = roleNamed("button", "Open palette");
    await openPalette();
    await userEvent.keyboard("invoices");
    await expect.poll(highlightedLabel).toBe("Open invoices");
    await reopenMidClose(trigger);
    expect(comboboxNamed("Search commands").value).toBe("");
    await expect.poll(highlightedLabel).toBe("New customer");
    // The reopening kept the trigger's element, which closing then returns focus to.
    expect(trigger.isConnected).toBe(true);
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    expect(roleNamed("button", "Open palette")).toBe(trigger);
    await expect.poll(() => document.activeElement).toBe(trigger);
  });

  it("highlights the first match again after the arrows moved it down an empty query", async () => {
    renderPalette(<DialogPalette contentStyle={SLOW_EXIT} />);
    const trigger = roleNamed("button", "Open palette");
    await openPalette();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await reopenMidClose(trigger);
    await expect.poll(highlightedLabel).toBe("New customer");
  });

  it("goes back to the first page of an uncontrolled stack, with an empty query", async () => {
    renderPalette(<PagedDialogPalette contentStyle={SLOW_EXIT} />);
    const trigger = roleNamed("button", "Open palette");
    await openPalette("Commands");
    await userEvent.keyboard("{Enter}");
    await mountedInput("Customers");
    await userEvent.keyboard("grace");
    await expect.poll(highlightedLabel).toBe("Grace Hopper");
    await reopenMidClose(trigger, "Commands");
    expect(page.getByRole("combobox").elements()).toEqual([comboboxNamed("Commands")]);
    expect(comboboxNamed("Commands").value).toBe("");
    await expect.poll(highlightedLabel).toBe("Customers");
  });

  it("mounts a stateful child passed as Command.Content's children fresh", async () => {
    renderPalette(
      <Command.Root items={COMMANDS}>
        <Command.Trigger>Open palette</Command.Trigger>
        <Command.Content style={SLOW_EXIT}>
          <Command.Input />
          <TallyButton />
        </Command.Content>
      </Command.Root>
    );
    const trigger = roleNamed("button", "Open palette");
    await openPalette();
    await userEvent.click(roleNamed("button", "Tally 0"));
    await expect.element(page.getByRole("button", { name: "Tally 1", exact: true })).toBeInTheDocument();
    await interruptClose(() => {
      trigger.click();
    });
    await expect.element(page.getByRole("button", { name: "Tally 0", exact: true })).toBeInTheDocument();
  });

  it("keeps the state of content a render element writes itself, as documented", async () => {
    renderPalette(
      <Command.Root items={COMMANDS}>
        <Command.Trigger>Open palette</Command.Trigger>
        <Command.Content
          style={SLOW_EXIT}
          render={
            <div>
              <Command.Input />
              <TallyButton />
            </div>
          }
        />
      </Command.Root>
    );
    const trigger = roleNamed("button", "Open palette");
    await openPalette();
    await userEvent.click(roleNamed("button", "Tally 0"));
    await expect.element(page.getByRole("button", { name: "Tally 1", exact: true })).toBeInTheDocument();
    await interruptClose(() => {
      trigger.click();
    });
    expect(roleNamed("button", "Tally 1")).toBeInstanceOf(HTMLButtonElement);
  });

  it("returns focus to the element that opened it, after an opening interrupted the close", async () => {
    function ShortcutPalette(): ReactElement {
      const [open, setOpen] = useState(false);
      useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "k" && event.metaKey) {
            event.preventDefault();
            setOpen((current) => !current);
          }
        };
        document.addEventListener("keydown", onKeyDown, { capture: true });
        return () => {
          document.removeEventListener("keydown", onKeyDown, { capture: true });
        };
      }, []);
      return (
        <>
          <input aria-label="Notes" />
          <Command.Root items={COMMANDS} open={open} onOpenChange={setOpen}>
            <Command.Trigger>Open palette</Command.Trigger>
            <Command.Content style={SLOW_EXIT}>
              <Command.Input />
            </Command.Content>
          </Command.Root>
        </>
      );
    }
    renderPalette(<ShortcutPalette />);
    const notes = roleNamed("textbox", "Notes");
    notes.focus();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await expect.poll(() => document.activeElement === comboboxNamed("Search commands")).toBe(true);
    await interruptClose(() => userEvent.keyboard("{Meta>}k{/Meta}"));
    await expect.poll(() => document.activeElement === comboboxNamed("Search commands")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await expect.poll(() => document.activeElement).toBe(notes);
  });

  it("highlights the first match of a controlled stack and query the consumer resets on opening", async () => {
    renderPalette(<ResetOnOpenPalette />);
    const trigger = roleNamed("button", "Open palette");
    await openPalette("Commands");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await reopenMidClose(trigger, "Commands");
    await expect.poll(highlightedLabel).toBe("Customers");
  });
});

/** A render target that calls its children as a function, as some layout components do. */
function CallingShell({
  children,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { children: () => ReactNode }): ReactElement {
  return <div {...props}>{children()}</div>;
}

/** A render target with default children, which it shows when nothing replaces them. */
function DefaultSearchShell({ children = <Command.Input />, ...props }: ComponentProps<"div">): ReactElement {
  return <div {...props}>{children}</div>;
}

describe("Command.Content render composition", () => {
  it("passes a render element's function children through untouched", async () => {
    renderPalette(
      <Command.Root items={COMMANDS}>
        <Command.Trigger>Open palette</Command.Trigger>
        <Command.Content render={<CallingShell>{() => <Command.Input />}</CallingShell>} />
      </Command.Root>
    );
    await openPalette();
  });

  it("keeps a render target's default children when Command.Content has none", async () => {
    renderPalette(
      <Command.Root items={COMMANDS}>
        <Command.Trigger>Open palette</Command.Trigger>
        <Command.Content render={<DefaultSearchShell />} />
      </Command.Root>
    );
    await openPalette();
  });
});

describe("Command.Root without Command.Content", () => {
  it("keeps an inline palette's query when its controlled open state flips, since no dialog closes", async () => {
    function ToggledInlinePalette(): ReactElement {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen((current) => !current);
            }}>
            Flip open
          </button>
          <Command.Root items={COMMANDS} open={open}>
            <Command.Input />
            <Command.List>
              {(command: string) => (
                <Command.Item key={command} value={command}>
                  {command}
                </Command.Item>
              )}
            </Command.List>
          </Command.Root>
        </>
      );
    }
    renderPalette(<ToggledInlinePalette />);
    const input = comboboxNamed("Search commands");
    input.focus();
    await userEvent.keyboard("invoices");
    await expect.poll(() => input.value).toBe("invoices");
    const flip = roleNamed("button", "Flip open");
    await userEvent.click(flip);
    await userEvent.click(flip);
    await expect.poll(highlightedLabel).toBe("Open invoices");
    expect(comboboxNamed("Search commands").value).toBe("invoices");
  });
});

/** A paged palette in a dialog that opens with focus on its title. */
function TitledPagedDialogPalette(): ReactElement {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Command.Root defaultPages={["home"]}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content initialFocus={titleRef}>
        <Dialog.Title ref={titleRef} isFocusable>
          Commands palette
        </Dialog.Title>
        <EntryPages onRun={() => undefined} />
      </Command.Content>
    </Command.Root>
  );
}

/** A controlled stack that opens straight onto the customers page, with focus on the title. */
function OpenOnSubPagePalette(): ReactElement {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [stack, setStack] = useState<string[]>(["home"]);
  return (
    <Command.Root
      pages={stack}
      onPagesChange={setStack}
      onOpenChange={(next) => {
        setStack(next ? ["home", "customers"] : ["home"]);
      }}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content initialFocus={titleRef}>
        <Dialog.Title ref={titleRef} isFocusable>
          Commands palette
        </Dialog.Title>
        <EntryPages onRun={() => undefined} />
      </Command.Content>
    </Command.Root>
  );
}

/**
 * A controlled palette whose Content mounts on the first opening, as a code-split chunk would, and
 * whose opening also moves the stack's top, with focus on the title.
 */
function LateContentPalette(): ReactElement {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stack, setStack] = useState<string[]>(["home"]);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setLoaded(true);
          setStack(["home", "customers"]);
        }}>
        Open palette
      </button>
      <Command.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setStack(["home"]);
          }
        }}
        pages={stack}
        onPagesChange={setStack}>
        {loaded ? (
          <Command.Content initialFocus={titleRef}>
            <Dialog.Title ref={titleRef} isFocusable>
              Commands palette
            </Dialog.Title>
            <EntryPages onRun={() => undefined} />
          </Command.Content>
        ) : null}
      </Command.Root>
    </>
  );
}

describe("Command.Content focus", () => {
  it("leaves initialFocus in charge when the opening also moves the stack's top", async () => {
    renderPalette(<OpenOnSubPagePalette />);
    await userEvent.click(roleNamed("button", "Open palette"));
    await mountedInput("Customers");
    await expect.poll(() => document.activeElement).toBe(roleNamed("heading", "Commands palette"));
  });

  it("leaves initialFocus in charge when the opening mounts Command.Content and moves the stack's top", async () => {
    renderPalette(<LateContentPalette />);
    await userEvent.click(roleNamed("button", "Open palette"));
    await mountedInput("Customers");
    await expect.poll(() => document.activeElement).toBe(roleNamed("heading", "Commands palette"));
  });

  it("leaves the dialog's initialFocus in charge of a paged palette's first page", async () => {
    renderPalette(<TitledPagedDialogPalette />);
    await userEvent.click(roleNamed("button", "Open palette"));
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    const title = roleNamed("heading", "Commands palette");
    await expect.poll(() => document.activeElement).toBe(title);
    // Reopening mounts the first page again, which is no page swap either.
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await userEvent.click(roleNamed("button", "Open palette"));
    await expect.poll(() => document.activeElement).toBe(roleNamed("heading", "Commands palette"));
  });

  it("leaves initialFocus in charge after closing on a pushed page resets the stack", async () => {
    renderPalette(<TitledPagedDialogPalette />);
    await userEvent.click(roleNamed("button", "Open palette"));
    await expect.poll(() => document.activeElement).toBe(roleNamed("heading", "Commands palette"));
    comboboxNamed("Commands").focus();
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => document.activeElement).toBe(comboboxNamed("Customers"));
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    // The stack went back to its first page while the palette was closed, which is no page swap.
    await userEvent.click(roleNamed("button", "Open palette"));
    await expect.element(page.getByRole("combobox", { name: "Commands", exact: true })).toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(roleNamed("heading", "Commands palette"));
  });

  it("focuses the input a push mounts in the dialog", async () => {
    renderPalette(<PagedDialogPalette />);
    await openPalette("Commands");
    await userEvent.keyboard("{Enter}");
    const customers = await mountedInput("Customers");
    await expect.poll(() => document.activeElement).toBe(customers);
  });
});

describe("Command composition errors", () => {
  it.each([
    [
      "Command.Page outside a Root with a stack",
      () => (
        <Command.Root items={COMMANDS}>
          <Command.Page id="home" label="Commands" />
        </Command.Root>
      ),
      "Command.Page must be used within a Command.Root that holds a stack of pages. Give the Root defaultPages, or pages with onPagesChange.",
    ],
    [
      "Command.PageTrigger outside a Root with a stack",
      () => (
        <Command.Root items={["Customers"]}>
          <Command.List>
            {(item: string) => (
              <Command.PageTrigger key={item} value={item} page="customers">
                {item}
              </Command.PageTrigger>
            )}
          </Command.List>
        </Command.Root>
      ),
      "Command.PageTrigger must be used within a Command.Root that holds a stack of pages. Give the Root defaultPages, or pages with onPagesChange.",
    ],
    [
      "Command.Trigger outside a Root",
      () => <Command.Trigger>Open palette</Command.Trigger>,
      "Command.Trigger must be used within Command.Root. Wrap the palette's parts in Command.Root.",
    ],
    [
      "groups without `grouped`",
      () => <Command.Root items={[{ items: ["New customer"] }]} />,
      "Command.Root received groups of items without `grouped`. Add `grouped` beside `items`, or pass a flat list.",
    ],
    [
      "`grouped` with a flat list",
      () => (
        <Command.Root defaultPages={["home"]}>
          {/* @ts-expect-error -- the types also reject this case's flat list beside `grouped` */}
          <Command.Page id="home" label="Commands" grouped items={["New customer"]} />
        </Command.Root>
      ),
      "Command.Page received `grouped` with a flat list of items. Pass groups, each with its own `items`, or drop `grouped`.",
    ],
    [
      "`virtualized` beside `grouped`",
      () => <Command.Root grouped virtualized items={[{ items: ["New customer"] }]} />,
      "Command.Root received `virtualized` beside `grouped`, and a virtual list renders flat items only. Drop `grouped` and pass a flat list, or drop `virtualized`.",
    ],
    [
      "a row function without a render value in a virtualized search",
      () => (
        <Command.Root virtualized items={COMMANDS}>
          <Command.List>
            {(command: string) => (
              <Command.Item key={command} value={command}>
                {command}
              </Command.Item>
            )}
          </Command.List>
        </Command.Root>
      ),
      "Command.List renders a virtualized search's rows through a row function without a render value, which mounts every row without its index. Pass render={<CommandVirtual.List />}, or render indexed Command.Item elements as children.",
    ],
  ])("throws a named error for %s", (_case, Tree, message) => {
    renderPalette(
      <CaughtError>
        <Tree />
      </CaughtError>
    );
    expect(caughtError()).toEqual({ name: "CommandCompositionError", message });
  });
});
