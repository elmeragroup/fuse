import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Dialog } from "../dialog";
import { Kbd } from "../kbd/kbd";
import type { CommandRootProps } from "./command";
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

/** The option Base UI marks highlighted, by its text. */
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

/** A query held above the stack, which makes the home page's Root controlled. */
type HeldQuery = Pick<CommandRootProps<Entry>, "value" | "onValueChange">;

function HomePage({ onRun, held = {} }: { onRun: (label: string) => void; held?: HeldQuery }): ReactElement {
  return (
    <Command.Page id="home" label="Commands">
      <Command.Root items={HOME} {...held}>
        <Command.Input />
        <Command.Empty />
        <EntryRows onRun={onRun} />
        <Command.Footer>
          <Command.NavigateHint />
          <Command.BackHint />
        </Command.Footer>
      </Command.Root>
    </Command.Page>
  );
}

function CustomersPage({ onRun }: { onRun: (label: string) => void }): ReactElement {
  return (
    <Command.Page id="customers" label="Customers">
      <Command.Root items={CUSTOMERS}>
        <Command.Input />
        <Command.Empty />
        <EntryRows onRun={onRun} />
        <Command.Footer>
          <Command.NavigateHint />
          <Command.BackHint />
        </Command.Footer>
      </Command.Root>
    </Command.Page>
  );
}

function PagedPalette({ onRun = () => undefined }: { onRun?: (label: string) => void }): ReactElement {
  return (
    <Command.Pages defaultValue={["home"]}>
      <HomePage onRun={onRun} />
      <CustomersPage onRun={onRun} />
    </Command.Pages>
  );
}

/** The parent page's query lives above the stack, so it outlasts the page. */
function KeptQueryPalette(): ReactElement {
  const [query, setQuery] = useState("");
  return (
    <Command.Pages defaultValue={["home"]}>
      <HomePage onRun={() => undefined} held={{ value: query, onValueChange: setQuery }} />
      <CustomersPage onRun={() => undefined} />
    </Command.Pages>
  );
}

async function openCustomers(): Promise<HTMLInputElement> {
  const home = comboboxNamed("Commands");
  home.focus();
  await expect.poll(highlightedLabel).toBe("Customers");
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("combobox", { name: "Customers", exact: true })).toBeInTheDocument();
  return comboboxNamed("Customers");
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

  it("leaves focus where it is when the palette first mounts", () => {
    renderPalette(<PagedPalette />);
    expect(document.activeElement).toBe(document.body);
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

  it("goes back on Backspace in the empty input, and to a fresh parent", async () => {
    renderPalette(<PagedPalette />);
    comboboxNamed("Commands").focus();
    await userEvent.keyboard("cust");
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("combobox", { name: "Customers", exact: true })).toBeInTheDocument();
    await userEvent.keyboard("{Backspace}");
    await expect.element(page.getByRole("combobox", { name: "Commands", exact: true })).toBeInTheDocument();
    const home = comboboxNamed("Commands");
    expect(home.value).toBe("");
    expect(document.activeElement).toBe(home);
    await expect.poll(highlightedLabel).toBe("Customers");
    expect(page.getByText("Back", { exact: true }).elements()).toEqual([]);
  });

  it("keeps the parent's query when it is held above the stack", async () => {
    renderPalette(<KeptQueryPalette />);
    comboboxNamed("Commands").focus();
    await userEvent.keyboard("cust");
    await expect.poll(highlightedLabel).toBe("Customers");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("combobox", { name: "Customers", exact: true })).toBeInTheDocument();
    await userEvent.keyboard("{Backspace}");
    await expect.element(page.getByRole("combobox", { name: "Commands", exact: true })).toBeInTheDocument();
    expect(comboboxNamed("Commands").value).toBe("cust");
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
    await expect.element(page.getByRole("combobox", { name: "Commands", exact: true })).toBeInTheDocument();
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
      // A single-line row is exactly --row-h: 32px dense, 36px comfortable.
      expect(px(getComputedStyle(row).height), density).toBe(density === "dense" ? 32 : 36);
      unmount();
    }
    document.documentElement.removeAttribute("data-density");
  });
});

/** The palette in a dialog, opened from a button. */
function DialogPalette(): ReactElement {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open palette</Dialog.Trigger>
      <Command.Dialog>
        <PagedPalette />
      </Command.Dialog>
    </Dialog.Root>
  );
}

/** The controlled-stack recipe: Escape goes back a page before it closes the dialog. */
function EscapeBackPalette(): ReactElement {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState(["home"]);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "escape-key" && stack.length > 1) {
          details.cancel();
          setStack(stack.slice(0, -1));
          return;
        }
        setOpen(next);
        if (!next) {
          setStack(["home"]);
        }
      }}>
      <Dialog.Trigger>Open palette</Dialog.Trigger>
      <Command.Dialog>
        <Command.Pages value={stack} onValueChange={setStack}>
          <HomePage onRun={() => undefined} />
          <CustomersPage onRun={() => undefined} />
        </Command.Pages>
      </Command.Dialog>
    </Dialog.Root>
  );
}

async function openPalette(): Promise<HTMLElement> {
  await userEvent.click(roleNamed("button", "Open palette"));
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  await expect.poll(() => document.activeElement).toBe(comboboxNamed("Commands"));
  return roleNamed("dialog", "Command palette");
}

describe("Command.Dialog", () => {
  it("names the popup from the dictionary, renders no close button and focuses the input", async () => {
    renderPalette(<DialogPalette />);
    const dialog = await openPalette();
    expect(dialog.querySelectorAll("button")).toHaveLength(0);
  });

  it("closes on Escape from a page above the first", async () => {
    renderPalette(<DialogPalette />);
    await openPalette();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("combobox", { name: "Customers", exact: true })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes back a page on Escape with the controlled-stack recipe, and closes from the first page", async () => {
    renderPalette(<EscapeBackPalette />);
    await openPalette();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("combobox", { name: "Customers", exact: true })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("combobox", { name: "Commands", exact: true })).toBeInTheDocument();
    expect(roleNamed("dialog", "Command palette")).toBeInstanceOf(HTMLElement);
    await expect.poll(() => document.activeElement).toBe(comboboxNamed("Commands"));
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
