import { expectTypeOf, test } from "vitest";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import type { FileRejection, FileUploadRootProps, useFileUpload } from "@elmeragroup/fuse/file-upload";

test("onSelect receives File[] and onReject receives FileRejection[]", () => {
  expectTypeOf<NonNullable<FileUploadRootProps["onSelect"]>>().toEqualTypeOf<(files: File[]) => void>();
  expectTypeOf<NonNullable<FileUploadRootProps["onReject"]>>().toEqualTypeOf<
    (rejections: FileRejection[]) => void
  >();
  // @ts-expect-error onSelect hands out an array the consumer owns, never a live FileList
  const _fileList = <FileUpload.Root onSelect={(_files: FileList) => undefined} />;
});

test("FileRejection narrows on reason to a file or a name", () => {
  const describe = (rejection: FileRejection): string => {
    switch (rejection.reason) {
      case "type":
      case "count":
        expectTypeOf(rejection.file).toEqualTypeOf<File>();
        return rejection.file.name;
      case "directory":
      case "unreadable":
        // A folder or an unreadable entry carries a name, not a File.
        expectTypeOf(rejection).not.toHaveProperty("file");
        return rejection.name;
    }
  };
  expectTypeOf(describe).returns.toEqualTypeOf<string>();
});

test("Root takes only the documented capture values", () => {
  const _root = <FileUpload.Root accept="image/*,.pdf" multiple directory capture="user" disabled />;
  // @ts-expect-error capture is user | environment
  const _badCapture = <FileUpload.Root capture="front" />;
});

test("Trigger composes Button through render", () => {
  const _trigger = <FileUpload.Trigger render={<Button size="sm" />}>Add files</FileUpload.Trigger>;
  const _description = <FileUpload.Description id="limits">Up to 3 files.</FileUpload.Description>;
});

test("useFileUpload exposes state and actions, and keeps meta private", () => {
  type Upload = ReturnType<typeof useFileUpload>;
  expectTypeOf<Upload["state"]>().toEqualTypeOf<{ readonly dragging: boolean; readonly disabled: boolean }>();
  expectTypeOf<Upload["actions"]["add"]>().toEqualTypeOf<(files: File[]) => void>();
  expectTypeOf<Upload["actions"]["open"]>().toEqualTypeOf<() => void>();
  expectTypeOf<Upload>().not.toHaveProperty("meta");
});
