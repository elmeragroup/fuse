import { expectTypeOf, test } from "vitest";

import { Attachment } from "@elmeragroup/fuse/attachment";
import type { AttachmentRootProps } from "@elmeragroup/fuse/attachment";

test("Attachment.AspectRatio takes the AspectRatio set and nothing else", () => {
  const _square = <Attachment.AspectRatio ratio="1:1" />;
  const _landscape = <Attachment.AspectRatio ratio="4:3" />;
  const _portrait = <Attachment.AspectRatio ratio="3:4" />;
  const _photo = <Attachment.AspectRatio ratio="3:2" />;
  const _portraitPhoto = <Attachment.AspectRatio ratio="2:3" />;
  const _video = <Attachment.AspectRatio ratio="16:9" />;
  const _story = <Attachment.AspectRatio ratio="9:16" />;

  // @ts-expect-error a number is not a ratio string
  const _number = <Attachment.AspectRatio ratio={16 / 9} />;
  // @ts-expect-error ratio has no default
  const _missing = <Attachment.AspectRatio />;
  // @ts-expect-error 21:9 is outside the set
  const _wide = <Attachment.AspectRatio ratio="21:9" />;
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
