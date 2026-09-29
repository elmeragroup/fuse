import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as GridListApi from "@elmeragroup/fuse/react-aria/grid-list";
import { GridList, GridListItem } from "@elmeragroup/fuse/react-aria/grid-list";

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
