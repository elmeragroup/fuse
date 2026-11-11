import type { Ref } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  ListDetailDetailProps,
  ListDetailRootProps,
  ListDetailSplit,
} from "@elmeragroup/fuse/list-detail";
import { ListDetail } from "@elmeragroup/fuse/list-detail";

test("the root's open state is controlled and its split names a container size or never", () => {
  expectTypeOf<ListDetailSplit>().toEqualTypeOf<"3xl" | "4xl" | "5xl" | "never">();
  expectTypeOf<ListDetailRootProps["open"]>().toEqualTypeOf<boolean>();
  expectTypeOf<ListDetailRootProps["onOpenChange"]>().toEqualTypeOf<(open: boolean) => void>();

  const _root = <ListDetail.Root open={false} onOpenChange={() => undefined} split="never" />;

  // @ts-expect-error the app owns the open item, so `open` is required
  const _uncontrolled = <ListDetail.Root onOpenChange={() => undefined} />;

  // @ts-expect-error the breakpoint is a container size, never a raw length
  const _rawSplit = <ListDetail.Root open onOpenChange={() => undefined} split="40rem" />;

  // @ts-expect-error the Sheet's side follows the pane, beside the list's end
  const _side = <ListDetail.Detail side="left" />;

  const _detail = <ListDetail.Detail aria-label="Order details" size="lg" showCloseButton={false} />;

  // The Detail composes like the other parts: a ref to the mounted pane or dialog, and `render`.
  expectTypeOf<ListDetailDetailProps["ref"]>().toEqualTypeOf<Ref<HTMLElement> | undefined>();
  const _composed = <ListDetail.Detail ref={null} render={<section />} />;
});
