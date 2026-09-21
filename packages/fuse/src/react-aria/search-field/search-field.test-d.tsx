import type { ReactNode, Ref } from "react";

import type { ValidationResult } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/fuse";
import type * as SearchFieldApi from "@elmeragroup/fuse/react-aria/search-field";
import type { SearchFieldProps } from "@elmeragroup/fuse/react-aria/search-field";
import { SearchField } from "@elmeragroup/fuse/react-aria/search-field";

test("SearchField is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("SearchField");
});

test("the public value surface is exactly SearchField", () => {
  expectTypeOf(SearchField).toBeFunction();
  expectTypeOf<typeof SearchFieldApi.SearchField>().toEqualTypeOf<typeof SearchField>();
});

test("searchFieldVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof SearchFieldApi>().not.toHaveProperty("searchFieldVariants");
  // @ts-expect-error the module-private recipe is not a public type either
  type _NoRecipe = SearchFieldApi.searchFieldVariants;
  // @ts-expect-error ValidationResult is not re-exported from this entry
  type _NoValidation = SearchFieldApi.ValidationResult;
  // @ts-expect-error RAC SearchFieldProps is not leaked under a bare RAC name
  type _NoAria = SearchFieldApi.AriaSearchFieldProps;
  // @ts-expect-error RAC SearchFieldRenderProps is not a public export
  type _NoRenderProps = SearchFieldApi.SearchFieldRenderProps;
  // @ts-expect-error SearchFieldContext is not a public export
  type _NoContext = SearchFieldApi.SearchFieldContext;
});

test("SearchFieldProps has the composite face plus RAC passthroughs and no size axis", () => {
  expectTypeOf<SearchFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["errorMessage"]>().toEqualTypeOf<
    ReactNode | ((validation: ValidationResult) => ReactNode) | undefined
  >();
  expectTypeOf<SearchFieldProps["placeholder"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["clearLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps>().toHaveProperty("value");
  expectTypeOf<SearchFieldProps>().toHaveProperty("defaultValue");
  expectTypeOf<SearchFieldProps>().toHaveProperty("onChange");
  expectTypeOf<SearchFieldProps>().toHaveProperty("onSubmit");
  expectTypeOf<SearchFieldProps>().toHaveProperty("onClear");
  expectTypeOf<SearchFieldProps>().toHaveProperty("isDisabled");
  expectTypeOf<SearchFieldProps>().toHaveProperty("isReadOnly");
  expectTypeOf<SearchFieldProps>().toHaveProperty("isRequired");
  expectTypeOf<SearchFieldProps>().toHaveProperty("isInvalid");
  expectTypeOf<SearchFieldProps>().toHaveProperty("name");
  expectTypeOf<SearchFieldProps>().toHaveProperty("validate");
  expectTypeOf<SearchFieldProps>().toHaveProperty("autoFocus");
  expectTypeOf<SearchFieldProps>().toHaveProperty("className");
  expectTypeOf<SearchFieldProps>().toHaveProperty("aria-label");
  expectTypeOf<SearchFieldProps>().not.toHaveProperty("size");
});

test("the element takes the public props, forwards a ref to the input, and rejects a size axis", () => {
  const _nodeError = <SearchField label="Meter search" errorMessage={<span>Required</span>} isInvalid />;
  const _functionError = (
    <SearchField
      label="Meter search"
      isRequired
      errorMessage={(result) => result.validationErrors.join(" ")}
    />
  );
  const _open = (
    <SearchField
      label="Meter search"
      description="Search by meter number."
      placeholder="Meter number"
      clearLabel="Clear this search"
      defaultValue="735999123"
      value="735999123"
      isDisabled
      isReadOnly
      isRequired
      isInvalid
      name="q"
      autoFocus
      aria-label="Meter search"
      onChange={(value) => {
        const _next: string = value;
        return _next;
      }}
      onSubmit={(value) => {
        const _query: string = value;
        return _query;
      }}
      onClear={() => undefined}
    />
  );
  const _ref = (
    <SearchField
      ref={(node: HTMLInputElement | null) => {
        node?.blur();
      }}
      label="Meter search"
    />
  );
  const _refObject: Ref<HTMLInputElement> = null;
  const _refProp = <SearchField ref={_refObject} label="Meter search" />;

  // @ts-expect-error no size axis
  const _noSize = <SearchField size="md" />;
});

test("there is no bare search-field entry", () => {
  // @ts-expect-error quarantined path only — never a bare search-field entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/fuse/search-field");
});
