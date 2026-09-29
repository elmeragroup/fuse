import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as SearchFieldApi from "@elmeragroup/fuse/react-aria/search-field";
import { SearchField } from "@elmeragroup/fuse/react-aria/search-field";

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
