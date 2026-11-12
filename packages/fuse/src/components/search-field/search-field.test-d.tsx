import type { ReactNode, Ref } from "react";

import { expectTypeOf, test } from "vitest";

import { SearchField } from "@elmeragroup/fuse/search-field";
import type { SearchFieldProps } from "@elmeragroup/fuse/search-field";

test("SearchFieldProps is the composite is* face, the search callbacks and the remaining native input props", () => {
  expectTypeOf<SearchFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<SearchFieldProps["value"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["defaultValue"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SearchFieldProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<SearchFieldProps["onSubmit"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<SearchFieldProps["onClear"]>().toEqualTypeOf<(() => void) | undefined>();
  expectTypeOf<SearchFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SearchFieldProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SearchFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SearchFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SearchFieldProps>().toHaveProperty("enterKeyHint");
  expectTypeOf<SearchFieldProps>().toHaveProperty("autoComplete");
  expectTypeOf<SearchFieldProps>().not.toHaveProperty("type");
  expectTypeOf<SearchFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<SearchFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<SearchFieldProps>().not.toHaveProperty("required");
});

test("the element forwards a ref to the input and rejects a function errorMessage", () => {
  const _refObject: Ref<HTMLInputElement> = null;
  const _ref = <SearchField ref={_refObject} label="Meter search" />;

  // @ts-expect-error errorMessage is a node; React Aria's validation render function is gone
  const _functionError = <SearchField label="Meter search" errorMessage={() => "Required"} />;
  // @ts-expect-error the field size is `"default"` or `"sm"`; it has no md name
  const _noSize = <SearchField size="md" />;
});
