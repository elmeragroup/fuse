import type { DialogRootChangeEventDetails } from "@base-ui/react/dialog";
import { expectTypeOf, test } from "vitest";

import type { CommandPageProps, CommandRootProps, CommandSearchProps } from "@elmeragroup/fuse/command";
import * as CommandModule from "@elmeragroup/fuse/command";
import { Command } from "@elmeragroup/fuse/command";
import type { CommandVirtualListProps } from "@elmeragroup/fuse/command-virtual";
import { CommandVirtual } from "@elmeragroup/fuse/command-virtual";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";

type Entry = { readonly value: string; readonly label: string };

test("the palette parts compose, and the Root takes the locale from LocaleProvider", () => {
  expectTypeOf<CommandRootProps<Entry>>().not.toHaveProperty("locale");
  expectTypeOf(CommandModule).not.toHaveProperty("CommandRowContext");
  expectTypeOf(CommandModule).not.toHaveProperty("CommandCompositionError");
  expectTypeOf(Command).not.toHaveProperty("VirtualList");
  expectTypeOf(Command).not.toHaveProperty("Pages");
  expectTypeOf(Command).not.toHaveProperty("GroupedRoot");
  expectTypeOf(Command).not.toHaveProperty("Dialog");
  expectTypeOf(Command).not.toHaveProperty("GroupLabel");

  const _tree = (
    <Command.Root defaultPages={["home"]}>
      <Command.Trigger>Open</Command.Trigger>
      <Command.Content>
        <Command.Page id="home" label="Commands" items={[{ value: "invoices", label: "Invoices" }]}>
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
        </Command.Page>
      </Command.Content>
    </Command.Root>
  );
});

test("the Root holds either a search or a stack of pages, and a stack is controlled or not", () => {
  expectTypeOf<NonNullable<CommandRootProps["onPagesChange"]>>().toEqualTypeOf<(pages: string[]) => void>();
  const _controlled = <Command.Root pages={["home"]} onPagesChange={() => undefined} />;
  const _uncontrolled = <Command.Root defaultPages={["home"]} />;
  const _search = <Command.Root items={["Invoices"]} value="inv" onValueChange={() => undefined} />;
  // @ts-expect-error `pages` and `defaultPages` exclude each other
  const _both = <Command.Root pages={["home"]} defaultPages={["home"]} />;
  // @ts-expect-error a Root with a stack holds no items; each Command.Page does
  const _stackItems = <Command.Root defaultPages={["home"]} items={["Invoices"]} />;
  // @ts-expect-error a Root with a stack holds no query; each Command.Page does
  const _stackValue = <Command.Root pages={["home"]} value="inv" />;
  // @ts-expect-error a Root with a stack is not grouped; a Command.Page is
  const _stackGrouped = <Command.Root defaultPages={["home"]} grouped />;
  // @ts-expect-error a Root with a stack takes no `virtualized`; a Command.Page does
  const _stackVirtualized = <Command.Root defaultPages={["home"]} virtualized />;
  // @ts-expect-error a page trigger opens a named page
  const _noPage = <Command.PageTrigger value="customers">Customers</Command.PageTrigger>;
  // @ts-expect-error a page has a label that names its input
  const _noLabel = <Command.Page id="customers" />;
  // @ts-expect-error a page has an id the stack holds
  const _noId = <Command.Page label="Customers" />;
  // @ts-expect-error Back is one icon button; it takes no size
  const _sizedBack = <Command.Back size="lg" />;
});

test("the Root takes Dialog Root's state props, with Dialog's own event details", () => {
  const _dialog = (
    <Command.Root
      items={["Invoices"]}
      defaultOpen={false}
      modal="trap-focus"
      disablePointerDismissal
      onOpenChangeComplete={(open) => {
        expectTypeOf(open).toEqualTypeOf<boolean>();
      }}
      onOpenChange={(open, details) => {
        expectTypeOf(open).toEqualTypeOf<boolean>();
        expectTypeOf(details).toEqualTypeOf<DialogRootChangeEventDetails>();
        if (!open && details.reason === "escape-key") {
          details.cancel();
        }
      }}
    />
  );
  const _stackDialog = <Command.Root pages={["home"]} open onOpenChange={() => undefined} />;
  // @ts-expect-error Autocomplete's popup is always open inline; `inline` is not a palette prop
  const _inline = <Command.Root items={["Invoices"]} inline={false} />;
  // @ts-expect-error the trigger's handle comes from the Root
  const _handle = <Command.Trigger handle={undefined} />;
});

test("the virtual list is Command.List's render element and takes its rows from it", () => {
  expectTypeOf(CommandVirtual).not.toHaveProperty("Root");
  // Command.List passes its row function as `children`, so the element is written without one.
  expectTypeOf<undefined>().toExtend<CommandVirtualListProps["children"]>();
  expectTypeOf<CommandVirtualListProps["overscan"]>().toEqualTypeOf<number | undefined>();

  const _tree = (
    <Command.Root items={["Meter point 0001"]} virtualized>
      <Command.Input />
      <Command.List render={<CommandVirtual.List />}>
        {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
      </Command.List>
    </Command.Root>
  );
  const _page = (
    <Command.Root defaultPages={["points"]}>
      <Command.Page id="points" label="Meter points" items={["Meter point 0001"]} virtualized>
        <Command.List render={<CommandVirtual.List estimateSize={() => 40} overscan={4} />}>
          {(item: string) => <Command.Item value={item}>{item}</Command.Item>}
        </Command.List>
      </Command.Page>
    </Command.Root>
  );
  // @ts-expect-error Command.List's row function renders the rows
  const _elements = <CommandVirtual.List>{null}</CommandVirtual.List>;
});

// Without `grouped`, the Root types its props as Base UI's flat Autocomplete.Root overload; with
// `grouped`, as its grouped overload. Each case below behaves as the matching overload does.

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

test("a flat Root gives its callbacks one entry, inferred from a list inline, as a variable or `as const`", () => {
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

test("a flat Root infers its item from filtered items alone, from a callback alone or from a type argument", () => {
  const _filteredAlone = (
    <Command.Root
      filteredItems={[{ label: "Invoices" }]}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<{ label: string }>();
        return item.label;
      }}
    />
  );
  const _filteredVariable = (
    <Command.Root
      filteredItems={ACTIONS}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action | undefined>();
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
  const _explicitUndefined = <Command.Root items={undefined} />;
  const _filteredSubset = (
    <Command.Root
      items={ACTIONS}
      filteredItems={ACTIONS.filter((action) => action.key === "N")}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action>();
        return item.label;
      }}
    />
  );
  const _constSubset = (
    <Command.Root
      items={["New customer", "Invoices"] as const}
      filteredItems={["Invoices"]}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<"New customer" | "Invoices" | undefined>();
      }}
    />
  );
  const _mixedLiteral = (
    <Command.Root
      items={[{ count: 1 }, { name: "Invoices" }]}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<
          { count: number; name?: undefined } | { name: string; count?: undefined } | undefined
        >();
      }}
    />
  );
  const _empty = <Command.Root items={[]} itemToStringValue={(item: Action) => item.label} />;
  const _annotated = (
    <Command.Root
      itemToStringValue={(item: Action) => item.label}
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action | undefined>();
      }}
    />
  );
  const _annotatedPage = (
    <Command.Root defaultPages={["home"]}>
      <Command.Page id="home" label="Commands" itemToStringValue={(item: Action) => item.label} />
    </Command.Root>
  );
  const _named = (
    <Command.Root<Action>
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Action>();
        return item.label;
      }}
    />
  );
});

test("the Root forwards from generic and typed wrappers, flat and grouped", () => {
  function Choices<T extends string>({ items }: { items: readonly T[] }) {
    return <Command.Root items={items} itemToStringValue={(item) => item} />;
  }
  function FlatPalette<Item>({ items, onRun }: { items: readonly Item[]; onRun: (item: Item) => void }) {
    return (
      <Command.Root
        items={items}
        onItemHighlighted={(item) => {
          if (item !== undefined) {
            onRun(item);
          }
        }}
      />
    );
  }
  function GroupedPalette<Group extends { readonly items: readonly unknown[] }>({
    groups,
    onRun,
  }: {
    groups: readonly Group[];
    onRun: (item: Group["items"][number]) => void;
  }) {
    return (
      <Command.Root
        grouped
        items={groups}
        onItemHighlighted={(item) => {
          if (item !== undefined) {
            onRun(item);
          }
        }}
      />
    );
  }
  function EntrySearch(props: CommandSearchProps<Entry>) {
    return <Command.Root {...props} />;
  }
  function EntryPage(props: CommandPageProps<Entry>) {
    return <Command.Page {...props} />;
  }
  const _forwarded = (
    <>
      <Choices items={["Light", "Dark"]} />
      <FlatPalette
        items={ACTIONS}
        onRun={(item) => {
          expectTypeOf(item).toEqualTypeOf<Action>();
        }}
      />
      <GroupedPalette
        groups={ACTION_GROUPS}
        onRun={(item) => {
          expectTypeOf(item).toEqualTypeOf<InferredAction>();
        }}
      />
      <EntrySearch
        items={[{ value: "invoices", label: "Invoices" }]}
        itemToStringValue={(item) => {
          expectTypeOf(item).toEqualTypeOf<Entry>();
          return item.label;
        }}
      />
      <Command.Root defaultPages={["home"]}>
        <EntryPage id="home" label="Commands" items={[{ value: "invoices", label: "Invoices" }]} />
      </Command.Root>
    </>
  );
});

test("a grouped Root gives its callbacks one item of a group", () => {
  const _variable = (
    <Command.Root
      grouped
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
    <Command.Root
      grouped
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
    <Command.Root
      grouped
      items={shortcutGroups}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Shortcut>();
        return item.label;
      }}
    />
  );
  const _interfaceFiltered = (
    <Command.Root
      grouped
      items={shortcutGroups}
      // @ts-expect-error as in Base UI, a filtered group needs an index signature, which an interface lacks
      filteredItems={shortcutGroups}
    />
  );
  /* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-member-access -- the accesses below are the type errors under test, so their values are the error type */
  const _groupAccess = (
    <Command.Root
      grouped
      items={ACTION_GROUPS}
      // @ts-expect-error a grouped Root's callbacks receive an item of a group, never the group
      itemToStringValue={(item) => item.items[0]?.label ?? ""}
    />
  );
  /* oxlint-enable typescript/no-unsafe-return, typescript/no-unsafe-member-access */
  const _groupAnnotated = (
    <Command.Root
      grouped
      items={ACTION_GROUPS}
      // @ts-expect-error a callback annotated with the group type does not match the item it receives
      itemToStringValue={(group: ActionGroup) => group.value}
    />
  );
  // @ts-expect-error a flat list is not groups
  const _flat = <Command.Root grouped items={ACTIONS} />;
  // @ts-expect-error `grouped` needs `items`, as Base UI's grouped overload does
  const _noItems = <Command.Root grouped />;
});

test("a grouped Root keeps every group's item type", () => {
  const constGroups = [
    { value: "Create", items: [{ label: "New customer", key: "N" }] },
    { value: "Go to", items: [{ label: "Invoices", key: "I" }] },
  ] as const;
  const _constGroups = (
    <Command.Root
      grouped
      items={constGroups}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<(typeof constGroups)[number]["items"][number]>();
        return item.label;
      }}
    />
  );
  const _constMixedLeaves = (
    <Command.Root
      grouped
      items={
        [
          { value: "A", items: ["x"] },
          { value: "B", items: [1] },
        ] as const
      }
      onItemHighlighted={(item) => {
        expectTypeOf(item).toEqualTypeOf<"x" | 1 | undefined>();
      }}
    />
  );
  type Run = { readonly label: string; readonly run: () => void };
  type Link = { readonly label: string; readonly href: string };
  const runs: readonly Run[] = [{ label: "New customer", run: () => undefined }];
  const links: readonly Link[] = [{ label: "Invoices", href: "/invoices" }];
  const mixedKinds = [{ items: runs }, { items: links }];
  const _mixedKinds = (
    <Command.Root
      grouped
      items={mixedKinds}
      itemToStringValue={(item) => {
        expectTypeOf(item).toEqualTypeOf<Run | Link>();
        return item.label;
      }}
    />
  );
  /* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-member-access -- the access below is the type error under test, so its value is the error type */
  const _href = (
    <Command.Root
      grouped
      items={mixedKinds}
      // @ts-expect-error `href` is only on the link items
      itemToStringValue={(item) => item.href}
    />
  );
  /* oxlint-enable typescript/no-unsafe-return, typescript/no-unsafe-member-access */
});

test("a grouped Root takes filtered subsets and filtered groups with metadata", () => {
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
    <Command.Root
      grouped
      items={groups}
      filteredItems={groups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.key === "N"),
      }))}
      itemToStringValue={(item) => item.label}
    />
  );
  const _metadata = (
    <Command.Root
      grouped
      items={ACTION_GROUPS}
      filteredItems={[{ value: "Create", id: 7, items: [{ label: "New customer", key: "N" }] }]}
      itemToStringValue={(item) => item.label}
    />
  );
  const _sameGroups = <Command.Root grouped items={ACTION_GROUPS} filteredItems={ACTION_GROUPS} />;
  const _emptyGroup = (
    <Command.Root grouped items={ACTION_GROUPS} filteredItems={[{ value: "Create", items: [] }]} />
  );
});

test("a page types its search as a Root without a stack does", () => {
  const _pages = (
    <Command.Root defaultPages={["home"]}>
      <Command.Page
        id="home"
        label="Commands"
        items={ACTIONS}
        itemToStringValue={(item) => {
          expectTypeOf(item).toEqualTypeOf<Action>();
          return item.label;
        }}
      />
      <Command.Page
        id="actions"
        label="Actions"
        grouped
        items={ACTION_GROUPS}
        onItemHighlighted={(item) => {
          expectTypeOf(item).toEqualTypeOf<InferredAction | undefined>();
        }}
      />
    </Command.Root>
  );
  // @ts-expect-error a flat list is not groups
  const _flat = <Command.Page id="home" label="Commands" grouped items={ACTIONS} />;
  // @ts-expect-error a page's search has no dialog; the Root holds it
  const _open = <Command.Page id="home" label="Commands" open />;
});
