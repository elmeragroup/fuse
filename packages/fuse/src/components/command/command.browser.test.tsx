import { useEffect, useState } from "react";
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
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
    await userEvent.keyboard("zzz");
    await expect.element(page.getByText("No results.", { exact: true })).toBeVisible();
    expect(page.getByRole("option").elements()).toEqual([]);
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

  it("closes on Escape and returns focus to Command.Trigger", async () => {
    renderPalette(<DialogPalette />);
    await openPalette();
    await userEvent.keyboard("{Escape}");
    await closedPalette();
    await expect.poll(() => document.activeElement).toBe(roleNamed("button", "Open palette"));
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
});

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
      <Command.Content>
        <EntryPages onRun={() => undefined} held={{ value: query, onValueChange: setQuery }} />
      </Command.Content>
    </Command.Root>
  );
}

/**
 * Opens the palette with `reopen` while its close animation runs. The close ends when the popup's
 * animations finish, so they are paused at their first moment, in the microtask after the commit
 * that marks the popup ending, before any frame can advance them. Paused at `animationstart`, a
 * runner that stalls longer than the animation between its start and that event's dispatch would
 * already have finished it, so the reopening would land after the close.
 */
async function interruptClose(reopen: () => Promise<void> | void): Promise<void> {
  const closing = roleNamed("dialog", "Command palette");
  const held = new Promise<Animation[]>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!closing.hasAttribute("data-ending-style")) return;
      observer.disconnect();
      // Reading them computes the ending style, which creates the close's animations.
      const animations = closing.getAnimations({ subtree: true });
      for (const animation of animations) animation.pause();
      resolve(animations);
    });
    observer.observe(closing, { attributes: true, attributeFilter: ["data-ending-style"] });
  });
  await userEvent.keyboard("{Escape}");
  const animations = await held;
  // The close waits on an animation the pause holds, so it cannot end before the reopening.
  expect(animations.map((animation) => animation.playState)).toContain("paused");
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

describe("Command.Content reopened before its close ends", () => {
  it("highlights the first match again after the arrows moved it down an empty query", async () => {
    renderPalette(<DialogPalette />);
    const trigger = roleNamed("button", "Open palette");
    await openPalette();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.poll(highlightedLabel).toBe("Register meter reading");
    await reopenMidClose(trigger);
    await expect.poll(highlightedLabel).toBe("New customer");
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
            <Command.Content>
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

/** A render target with default children, which it shows when nothing replaces them. */
function DefaultSearchShell({ children = <Command.Input />, ...props }: ComponentProps<"div">): ReactElement {
  return <div {...props}>{children}</div>;
}

describe("Command.Content render composition", () => {
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

describe("Command.Content focus", () => {
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
