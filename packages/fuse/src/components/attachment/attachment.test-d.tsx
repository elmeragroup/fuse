import { expectTypeOf, test } from "vitest";

import type { AspectRatioProps } from "@elmeragroup/fuse/aspect-ratio";
import { Attachment } from "@elmeragroup/fuse/attachment";
import type { AttachmentAspectRatioProps, AttachmentRootProps } from "@elmeragroup/fuse/attachment";

test("Attachment.AspectRatio takes AspectRatio's props", () => {
  expectTypeOf<AttachmentAspectRatioProps>().toEqualTypeOf<AspectRatioProps>();
});

test("Root, Media and Action take only their documented values", () => {
  expectTypeOf<NonNullable<AttachmentRootProps["state"]>>().toEqualTypeOf<
    "idle" | "uploading" | "processing" | "error" | "done"
  >();
  expectTypeOf<NonNullable<AttachmentRootProps["size"]>>().toEqualTypeOf<"default" | "sm" | "xs">();
  expectTypeOf<NonNullable<AttachmentRootProps["orientation"]>>().toEqualTypeOf<"horizontal" | "vertical">();

  const _root = <Attachment.Root state="uploading" size="xs" orientation="vertical" />;
  const _icon = <Attachment.Media variant="icon" />;
  const _image = <Attachment.Media variant="image" />;
  const _action = <Attachment.Action aria-label="Remove" variant="destructive" size="icon-sm" />;
  const _trigger = <Attachment.Trigger aria-label="Open" render={<a href="#file" />} />;

  // @ts-expect-error the lifecycle is idle | uploading | processing | error | done
  const _badState = <Attachment.Root state="failed" />;
  // @ts-expect-error the size axis is default | sm | xs
  const _badSize = <Attachment.Root size="lg" />;
  // @ts-expect-error the layout prop is orientation, horizontal | vertical
  const _badOrientation = <Attachment.Root orientation="grid" />;
  // @ts-expect-error the media axis is icon | image
  const _badMedia = <Attachment.Media variant="avatar" />;
  // @ts-expect-error an icon-only action needs an accessible name
  const _unnamedAction = <Attachment.Action />;
  // @ts-expect-error an action is an icon button and takes no text size
  const _textAction = <Attachment.Action aria-label="Remove" size="sm" />;
  // @ts-expect-error the root renders its own div; polymorphism belongs to Attachment.Trigger
  const _rootRender = <Attachment.Root render={<a href="#file" />} />;
});
