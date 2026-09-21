import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/fuse";
import type * as GridListApi from "@elmeragroup/fuse/react-aria/grid-list";
import type { GridListItemProps, GridListProps } from "@elmeragroup/fuse/react-aria/grid-list";
import { GridList, GridListItem } from "@elmeragroup/fuse/react-aria/grid-list";

test("GridList and GridListItem are absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("GridList");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("GridListItem");
});

test("the public value surface is exactly GridList and GridListItem", () => {
  expectTypeOf(GridList).toBeFunction();
  expectTypeOf(GridListItem).toBeFunction();
  expectTypeOf<typeof GridListApi.GridList>().toEqualTypeOf<typeof GridList>();
  expectTypeOf<typeof GridListApi.GridListItem>().toEqualTypeOf<typeof GridListItem>();
});

test("itemStyles, checkboxVariants, and RAC types are not public exports", () => {
  expectTypeOf<typeof GridListApi>().not.toHaveProperty("itemStyles");
  expectTypeOf<typeof GridListApi>().not.toHaveProperty("gridListVariants");
  expectTypeOf<typeof GridListApi>().not.toHaveProperty("checkboxVariants");
  expectTypeOf<typeof GridListApi>().not.toHaveProperty("Checkbox");
  // @ts-expect-error the module-private recipe is not a public type either
  type _NoRecipe = GridListApi.itemStyles;
  // @ts-expect-error the private RAC Checkbox is not a public export
  type _NoCheckbox = GridListApi.Checkbox;
  // @ts-expect-error RAC GridListProps is not leaked under a bare RAC name
  type _NoAria = GridListApi.AriaGridListProps;
  // @ts-expect-error RAC GridListItemRenderProps is not a public export
  type _NoRenderProps = GridListApi.GridListItemRenderProps;
  // @ts-expect-error GridListContext is not a public export
  type _NoContext = GridListApi.GridListContext;
});

test("GridListProps forwards the RAC collection and selection surface", () => {
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("items");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("children");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("selectionMode");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("selectionBehavior");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("selectedKeys");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("defaultSelectedKeys");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("onSelectionChange");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("disabledKeys");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("disallowEmptySelection");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("onAction");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("renderEmptyState");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("dragAndDropHooks");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("className");
  expectTypeOf<GridListProps<{ id: string }>>().toHaveProperty("aria-label");
  expectTypeOf<GridListProps<{ id: string }>>().not.toHaveProperty("size");
});

test("GridListItemProps forwards the RAC item surface", () => {
  expectTypeOf<GridListItemProps>().toHaveProperty("id");
  expectTypeOf<GridListItemProps>().toHaveProperty("textValue");
  expectTypeOf<GridListItemProps>().toHaveProperty("isDisabled");
  expectTypeOf<GridListItemProps>().toHaveProperty("onAction");
  expectTypeOf<GridListItemProps>().toHaveProperty("href");
  expectTypeOf<GridListItemProps>().toHaveProperty("className");
  expectTypeOf<GridListItemProps>().toHaveProperty("children");
  expectTypeOf<GridListItemProps>().not.toHaveProperty("size");
});

test("the elements take the public props, forward a ref, and reject a size axis", () => {
  const _static = (
    <GridList aria-label="Meters" selectionMode="multiple" selectionBehavior="toggle">
      <GridListItem id="oslo" textValue="Oslo">
        Oslo
      </GridListItem>
    </GridList>
  );
  const _items = (
    <GridList
      aria-label="Meters"
      items={[{ id: "oslo", name: "Oslo" }]}
      disabledKeys={["oslo"]}
      renderEmptyState={() => "No meters match this filter."}
      onSelectionChange={() => undefined}
      onAction={() => undefined}>
      {(item) => <GridListItem id={item.id}>{item.name}</GridListItem>}
    </GridList>
  );
  const _ref = (
    <GridList
      aria-label="Meters"
      ref={(node: HTMLDivElement | null) => {
        node?.blur();
      }}
    />
  );
  const _refObject: Ref<HTMLDivElement> = null;
  const _refProp = <GridList ref={_refObject} aria-label="Meters" />;
  const _itemRef = (
    <GridList aria-label="Meters">
      <GridListItem
        ref={(node: HTMLDivElement | null) => {
          node?.blur();
        }}>
        Oslo
      </GridListItem>
    </GridList>
  );

  // @ts-expect-error no size axis
  const _noSize = <GridList aria-label="Meters" size="md" />;
  // @ts-expect-error GridListItem has no size axis
  const _noItemSize = <GridListItem size="md">Oslo</GridListItem>;
});

test("there is no bare grid-list entry", () => {
  // @ts-expect-error quarantined path only — never a bare grid-list entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/fuse/grid-list");
});
