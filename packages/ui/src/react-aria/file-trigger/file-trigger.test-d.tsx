import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as FileTriggerApi from "@elmeragroup/ui/react-aria/file-trigger";
import type { FileTriggerProps } from "@elmeragroup/ui/react-aria/file-trigger";
import { FileTrigger } from "@elmeragroup/ui/react-aria/file-trigger";

test("FileTrigger is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("FileTrigger");
});

test("the public value surface is exactly FileTrigger", () => {
  expectTypeOf(FileTrigger).toBeFunction();
  expectTypeOf<typeof FileTriggerApi.FileTrigger>().toEqualTypeOf<typeof FileTrigger>();
});

test("buttonVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof FileTriggerApi>().not.toHaveProperty("buttonVariants");
  // @ts-expect-error the borrowed recipe is not a public export of this entry
  type _NoRecipe = FileTriggerApi.buttonVariants;
  // @ts-expect-error RAC FileTrigger is not leaked under a primitive name
  type _NoPrimitive = FileTriggerApi.FileTriggerPrimitive;
  // @ts-expect-error RAC FileTriggerProps is not leaked under a bare RAC name
  type _NoAria = FileTriggerApi.FileTriggerPrimitiveProps;
  // @ts-expect-error RAC FileTriggerContext is not a public export
  type _NoContext = FileTriggerApi.FileTriggerContext;
});

test("FileTriggerProps has the composite face plus RAC passthroughs and buttonVariants axes", () => {
  expectTypeOf<FileTriggerProps["withIcon"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<FileTriggerProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<FileTriggerProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<FileTriggerProps["acceptedFileTypes"]>().toEqualTypeOf<readonly string[] | undefined>();
  expectTypeOf<FileTriggerProps["allowsMultiple"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<FileTriggerProps["acceptDirectory"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<FileTriggerProps["defaultCamera"]>().toEqualTypeOf<"user" | "environment" | undefined>();
  expectTypeOf<FileTriggerProps["onSelect"]>().toEqualTypeOf<
    ((files: FileList | null) => void) | undefined
  >();
  expectTypeOf<FileTriggerProps["variant"]>().toEqualTypeOf<
    "default" | "outline" | "secondary" | "ghost" | "destructive" | "success" | "link" | undefined
  >();
  expectTypeOf<FileTriggerProps["size"]>().toEqualTypeOf<
    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-inline" | "icon-lg" | undefined
  >();
  expectTypeOf<FileTriggerProps>().toHaveProperty("children");
  expectTypeOf<FileTriggerProps>().toHaveProperty("ref");
});

test("the element takes the spec's props and forwards a ref to the hidden input", () => {
  const _open = (
    <FileTrigger
      acceptedFileTypes={["image/png", ".pdf"]}
      allowsMultiple
      acceptDirectory
      defaultCamera="environment"
      withIcon={false}
      isDisabled
      variant="outline"
      size="lg"
      className="underline"
      onSelect={(files) => {
        const _next: FileList | null = files;
        return _next;
      }}>
      Attach files
    </FileTrigger>
  );
  const _ref = (
    <FileTrigger
      ref={(node: HTMLInputElement | null) => {
        node?.blur();
      }}>
      Attach files
    </FileTrigger>
  );
  const _refObject: Ref<HTMLInputElement> = null;
  const _refProp = (
    <FileTrigger ref={_refObject} size="sm">
      Attach files
    </FileTrigger>
  );

  const _badClassName: FileTriggerProps = {
    // @ts-expect-error className is a class list, never a number
    className: 4,
  };
});

test("there is no bare file-trigger entry", () => {
  // @ts-expect-error quarantined path only — never a bare file-trigger entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/ui/file-trigger");
});
