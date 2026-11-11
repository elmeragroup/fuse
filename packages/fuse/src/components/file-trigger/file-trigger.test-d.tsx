import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type * as FileTriggerApi from "@elmeragroup/fuse/file-trigger";
import type { FileTriggerProps } from "@elmeragroup/fuse/file-trigger";
import { FileTrigger } from "@elmeragroup/fuse/file-trigger";
import type { FileRejection } from "@elmeragroup/fuse/file-upload";

test("the entry exports the component and its props, and no recipe", () => {
  expectTypeOf<typeof FileTriggerApi>().not.toHaveProperty("buttonVariants");
  // @ts-expect-error the borrowed Button recipe is not a public export of this entry
  type _NoRecipe = FileTriggerApi.buttonVariants;
});

test("onSelect receives File[] and onReject receives FileRejection[]", () => {
  expectTypeOf<NonNullable<FileTriggerProps["onSelect"]>>().toEqualTypeOf<(files: File[]) => void>();
  expectTypeOf<NonNullable<FileTriggerProps["onReject"]>>().toEqualTypeOf<
    (rejections: FileRejection[]) => void
  >();
  // @ts-expect-error onSelect hands out an array the consumer owns, never a live FileList
  const _fileList = <FileTrigger onSelect={(_files: FileList | null) => undefined}>Attach</FileTrigger>;
});

test("the element takes FileUpload's picker props and the Button look, and forwards a ref to the button", () => {
  const _open = (
    <FileTrigger
      accept="image/png,.pdf"
      multiple
      directory
      capture="environment"
      withIcon={false}
      disabled
      variant="outline"
      size="lg"
      className="underline"
      aria-describedby="hint"
      onReject={(rejections) => rejections.length}>
      Attach files
    </FileTrigger>
  );
  const _refObject: Ref<HTMLButtonElement> = null;
  const _ref = <FileTrigger ref={_refObject}>Attach files</FileTrigger>;
  const _inputRef = (
    <FileTrigger
      // @ts-expect-error ref is the visible button, not the hidden input
      ref={(node: HTMLInputElement | null) => node?.showPicker()}>
      Attach files
    </FileTrigger>
  );
  // @ts-expect-error capture is user | environment
  const _badCapture = <FileTrigger capture="front">Take photo</FileTrigger>;
  // @ts-expect-error the square icon sizes need an aria-label and no visible label
  const _iconSize = <FileTrigger size="icon">Attach files</FileTrigger>;
});

test("the React Aria prop names are gone", () => {
  // @ts-expect-error accept takes the attribute's syntax as one string
  const _acceptedFileTypes = <FileTrigger acceptedFileTypes={[".pdf"]}>Attach</FileTrigger>;
  // @ts-expect-error multiple replaces allowsMultiple
  const _allowsMultiple = <FileTrigger allowsMultiple>Attach</FileTrigger>;
  // @ts-expect-error directory replaces acceptDirectory
  const _acceptDirectory = <FileTrigger acceptDirectory>Attach</FileTrigger>;
  // @ts-expect-error capture replaces defaultCamera
  const _defaultCamera = <FileTrigger defaultCamera="user">Attach</FileTrigger>;
  // @ts-expect-error disabled replaces isDisabled
  const _isDisabled = <FileTrigger isDisabled>Attach</FileTrigger>;
});
