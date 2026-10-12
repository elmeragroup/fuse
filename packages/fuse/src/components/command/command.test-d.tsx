import { expectTypeOf, test } from "vitest";

import type { CommandGroupedRootProps, CommandPagesProps, CommandRootProps } from "@elmeragroup/fuse/command";
import * as CommandModule from "@elmeragroup/fuse/command";
import { Command } from "@elmeragroup/fuse/command";
import type { CommandVirtualListProps, CommandVirtualRootProps } from "@elmeragroup/fuse/command-virtual";
import { CommandVirtual } from "@elmeragroup/fuse/command-virtual";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";

type Entry = { readonly value: string; readonly label: string };

test("the palette parts compose, and the Root takes the locale from LocaleProvider", () => {
  expectTypeOf<CommandRootProps<Entry>>().not.toHaveProperty("locale");
  expectTypeOf(CommandModule).not.toHaveProperty("CommandRowContext");
  expectTypeOf(Command).not.toHaveProperty("VirtualList");
  expectTypeOf<CommandPagesProps["onValueChange"]>().toEqualTypeOf<((value: string[]) => void) | undefined>();

  const _tree = (
    <Command.Pages defaultValue={["home"]}>
      <Command.Page id="home" label="Commands">
        <Command.Root items={[{ value: "invoices", label: "Invoices" }]}>
          <Command.Input placeholder="Search…" />
          <Command.Empty />
          <Command.List>
            {(entry: Entry) => (
              <Command.Item key={entry.value} value={entry} aria-keyshortcuts="Control+I">
                {entry.label}
                <Command.Shortcut>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>I</Kbd>
                </Command.Shortcut>
              </Command.Item>
            )}
          </Command.List>
          <Command.Footer>
            <Command.NavigateHint />
            <Command.SelectHint>Open</Command.SelectHint>
            <Command.BackHint />
            <Command.CloseHint />
            <Command.Hint>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>I</Kbd>
              </KbdGroup>
              Invoices
            </Command.Hint>
          </Command.Footer>
        </Command.Root>
      </Command.Page>
    </Command.Pages>
  );
});

test("a stack is either controlled or uncontrolled, and a page trigger names its page", () => {
  const _controlled = <Command.Pages value={["home"]} onValueChange={() => undefined} />;
  // @ts-expect-error a stack needs a `value` or a `defaultValue` to start from
  const _neither = <Command.Pages />;
  // @ts-expect-error `value` and `defaultValue` exclude each other
  const _both = <Command.Pages value={["home"]} defaultValue={["home"]} />;
  // @ts-expect-error a page trigger opens a named page
  const _noPage = <Command.PageTrigger value="customers">Customers</Command.PageTrigger>;
  // @ts-expect-error a page has a label that names its input
  const _noLabel = <Command.Page id="customers" />;
  // @ts-expect-error Back is one icon button; it takes no size
  const _sizedBack = <Command.Back size="lg" />;
});

test("the virtual list renders flat items through a child function", () => {
  expectTypeOf<CommandVirtualRootProps<string>>().not.toHaveProperty("virtualized");
  expectTypeOf<CommandVirtualListProps<string>["children"]>().toEqualTypeOf<
    (item: string, index: number) => React.ReactNode
  >();

  const _tree = (
    <CommandVirtual.Root items={["Meter point 0001"]}>
      <Command.Input />
      <CommandVirtual.List>
        {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
      </CommandVirtual.List>
    </CommandVirtual.Root>
  );
  // @ts-expect-error the virtual list renders its rows through a child function
  const _elements = <CommandVirtual.List>{null}</CommandVirtual.List>;
});

// Each Root copies one of Base UI's two Autocomplete.Root overloads, so each case below behaves
// as the matching Base UI overload does: Command.Root the flat one, Command.GroupedRoot the
// grouped one.

type Action = { readonly label: string; readonly key: string };

type ActionGroup = { readonly value: string; readonly items: readonly Action[] };

const ACTION_GROUPS = [
  { value: "Create", items: [{ label: "New customer", key: "N" }] },
  { value: "Go to", items: [{ label: "Invoices", key: "I" }] },
];

const ACTIONS: readonly Action[] = [
  { label: "New customer", key: "N" },
  { label: "Invoices", key: "I" },
];

/** The leaf of `ACTION_GROUPS` as TypeScript infers it from the literal. */
type InferredAction = { label: string; key: string };

test("Command.Root infers its item from a flat list, inline, as a variable or `as const`", () => {
  const _variable = (
    <Command.Root
      items={ACTIONS}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action>();
        return item.label;
      }}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action | undefined>();
      }}
    />
  );
  const _inline = (
    <Command.Root
      items={[{ label: "Invoices" }]}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<{ label: string }>();
        return item.label;
      }}
    />
  );
  const constItems = [
    { label: "New customer", key: "N" },
    { label: "Invoices", key: "I" },
  ] as const;
  const _constItems = (
    <Command.Root
      items={constItems}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<(typeof constItems)[number]>();
        return item.label;
      }}
    />
  );
  const options = { language: ["Norsk bokmål", "Svenska"], theme: ["Light", "Dark"] } as const;
  const optionsFor = (setting: keyof typeof options) => options[setting];
  const _pickedByKey = (
    <Command.Root
      items={optionsFor("theme")}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<"Norsk bokmål" | "Svenska" | "Light" | "Dark">();
        return item;
      }}
    />
  );
});

test("Command.Root infers its item from filtered items alone or from an annotated callback", () => {
  const _filteredAlone = (
    <Command.Root
      filteredItems={[{ label: "Invoices" }]}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<{ label: string }>();
        return item.label;
      }}
    />
  );
  const _undefinedItems = (
    <Command.Root
      items={undefined}
      filteredItems={[{ label: "Invoices" }]}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<{ label: string }>();
        return item.label;
      }}
    />
  );
  const _annotated = <Command.Root itemToStringValue={(item: Action) => item.label} />;
  const _empty = <Command.Root items={[]} itemToStringValue={(item: Action) => item.label} />;
});

test("Command.Root forwards from generic and typed wrappers", () => {
  function Choices<T extends string>({ items }: { items: readonly T[] }) {
    return <Command.Root items={items} itemToStringValue={(item) => item} />;
  }
  function EntryPalette(props: CommandRootProps<Entry>) {
    return <Command.Root {...props} />;
  }
  function GenericPalette<T>(props: CommandRootProps<T>) {
    return <Command.Root {...props} />;
  }
  const _forwarded = (
    <>
      <Choices items={["Light", "Dark"]} />
      <EntryPalette
        items={[{ value: "invoices", label: "Invoices" }]}
        itemToStringValue={(item) => {
          expectTypeOf(item).toEqualTypeOf<Entry>();
          return item.label;
        }}
      />
      <GenericPalette items={ACTIONS} itemToStringValue={(item) => item.label} />
    </>
  );
});

test("Command.GroupedRoot types its callbacks with one item of a group", () => {
  const _variable = (
    <Command.GroupedRoot
      items={ACTION_GROUPS}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<InferredAction>();
        return item.label;
      }}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<InferredAction | undefined>();
      }}
    />
  );
  const _inline = (
    <Command.GroupedRoot
      items={[{ value: "Create", items: [{ label: "New customer", key: "N" }] }]}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<{ label: string; key: string }>();
        return item.label;
      }}
    />
  );
  // oxlint-disable-next-line typescript/consistent-type-definitions -- an interface has no implicit index signature, the case under test
  interface Shortcut {
    label: string;
    key: string;
  }
  // oxlint-disable-next-line typescript/consistent-type-definitions -- an interface has no implicit index signature, the case under test
  interface ShortcutGroup {
    value: string;
    items: Shortcut[];
  }
  const shortcutGroups: ShortcutGroup[] = [{ value: "Create", items: [{ label: "New customer", key: "N" }] }];
  const _interfaces = (
    <Command.GroupedRoot
      items={shortcutGroups}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Shortcut>();
        return item.label;
      }}
    />
  );
  const _interfaceFiltered = (
    <Command.GroupedRoot
      items={shortcutGroups}
      // @ts-expect-error as in Base UI, a filtered group needs an index signature, which an interface lacks
      filteredItems={shortcutGroups}
    />
  );
  /* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-member-access -- the accesses below are the type errors under test, so their values are the error type */
  const _groupAccess = (
    <Command.GroupedRoot
      items={ACTION_GROUPS}
      // @ts-expect-error a grouped Root's callbacks receive an item of a group, never the group
      itemToStringValue={(item) => item.items[0]?.label ?? ""}
    />
  );
  /* oxlint-enable typescript/no-unsafe-return, typescript/no-unsafe-member-access */
  const _groupAnnotated = (
    <Command.GroupedRoot
      items={ACTION_GROUPS}
      // @ts-expect-error a callback annotated with the group type does not match the item it receives
      itemToStringValue={(group: ActionGroup) => group.value}
    />
  );
  // @ts-expect-error a flat list belongs in Command.Root
  const _flat = <Command.GroupedRoot items={ACTIONS} />;
});

test("Command.GroupedRoot keeps every group's item type", () => {
  const constGroups = [
    { value: "Create", items: [{ label: "New customer", key: "N" }] },
    { value: "Go to", items: [{ label: "Invoices", key: "I" }] },
  ] as const;
  const _constGroups = (
    <Command.GroupedRoot
      items={constGroups}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<(typeof constGroups)[number]["items"][number]>();
        return item.label;
      }}
    />
  );
  type Run = { readonly label: string; readonly run: () => void };
  type Link = { readonly label: string; readonly href: string };
  const runs: readonly Run[] = [{ label: "New customer", run: () => undefined }];
  const links: readonly Link[] = [{ label: "Invoices", href: "/invoices" }];
  const mixedKinds = [{ items: runs }, { items: links }];
  const _mixedKinds = (
    <Command.GroupedRoot
      items={mixedKinds}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Run | Link>();
        return item.label;
      }}
    />
  );
  /* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-member-access -- the access below is the type error under test, so its value is the error type */
  const _href = (
    <Command.GroupedRoot
      items={mixedKinds}
      // @ts-expect-error `href` is only on the link items
      itemToStringValue={(item) => item.href}
    />
  );
  /* oxlint-enable typescript/no-unsafe-return, typescript/no-unsafe-member-access */
});

test("Command.GroupedRoot takes filtered subsets and filtered groups with metadata", () => {
  const groups = [
    {
      value: "Create",
      items: [
        { label: "New customer", key: "N" },
        { label: "New contract", key: "C" },
      ],
    },
  ] as const;
  const _subset = (
    <Command.GroupedRoot
      items={groups}
      filteredItems={groups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.key === "N"),
      }))}
      itemToStringValue={(item) => item.label}
    />
  );
  const _metadata = (
    <Command.GroupedRoot
      items={ACTION_GROUPS}
      filteredItems={[{ value: "Create", id: 7, items: [{ label: "New customer", key: "N" }] }]}
      itemToStringValue={(item) => item.label}
    />
  );
  const _emptyGroup = (
    <Command.GroupedRoot items={ACTION_GROUPS} filteredItems={[{ value: "Create", items: [] }]} />
  );
});

test("Command.GroupedRoot forwards from a generic wrapper", () => {
  function GroupedPalette<Items extends readonly { readonly items: readonly unknown[] }[]>(
    props: CommandGroupedRootProps<Items>
  ) {
    return <Command.GroupedRoot {...props} />;
  }
  const _forwarded = <GroupedPalette items={ACTION_GROUPS} itemToStringValue={(item) => item.label} />;
});

test("CommandVirtual.Root infers its item from a flat list and forwards from a generic wrapper", () => {
  const _flat = (
    <CommandVirtual.Root
      items={ACTIONS}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action>();
        return item.label;
      }}
    />
  );
  function VirtualPalette<T>(props: CommandVirtualRootProps<T>) {
    return <CommandVirtual.Root {...props} />;
  }
  const _forwarded = <VirtualPalette items={ACTIONS} itemToStringValue={(item) => item.label} />;
});
