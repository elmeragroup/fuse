import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as FileTriggerApi from "@elmeragroup/fuse/react-aria/file-trigger";
import type { FileTriggerProps } from "@elmeragroup/fuse/react-aria/file-trigger";
import { FileTrigger } from "@elmeragroup/fuse/react-aria/file-trigger";

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

test("the element takes the public props and forwards a ref to the hidden input", () => {
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
