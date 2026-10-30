import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  FrameDescriptionProps,
  FrameFooterProps,
  FrameHeaderProps,
  FrameLayout,
  FramePanelProps,
  FrameRootProps,
  FrameTitleProps,
} from "@elmeragroup/fuse/frame";
import * as FrameModule from "@elmeragroup/fuse/frame";
import { Frame } from "@elmeragroup/fuse/frame";

test("public API exports only the namespace, the part prop types and the layout union, and parts take native attributes, a layout, and no polymorphic as prop", () => {
  expectTypeOf<FrameRootProps>().toMatchTypeOf<ComponentProps<"div">>();
  expectTypeOf<FrameRootProps["layout"]>().toEqualTypeOf<"gutter" | "stacked" | "flush" | undefined>();
  expectTypeOf<FrameLayout>().toEqualTypeOf<"gutter" | "stacked" | "flush">();
  expectTypeOf<FramePanelProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<FrameHeaderProps>().toEqualTypeOf<ComponentProps<"header">>();
  expectTypeOf<FrameTitleProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<FrameDescriptionProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<FrameFooterProps>().toEqualTypeOf<ComponentProps<"footer">>();
  expectTypeOf<FrameRootProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();

  expectTypeOf(FrameModule).not.toHaveProperty("frameVariants");
  expectTypeOf(FrameModule).not.toHaveProperty("FramePanel");
  expectTypeOf(FrameModule).not.toHaveProperty("FrameHeader");
  expectTypeOf(FrameModule).not.toHaveProperty("FrameTitle");
  expectTypeOf(FrameModule).not.toHaveProperty("FrameDescription");
  expectTypeOf(FrameModule).not.toHaveProperty("FrameFooter");

  const _root = (
    <Frame.Root layout="stacked" className="max-w-lg">
      <Frame.Header>
        <Frame.Title>
          <h2>Invoices</h2>
        </Frame.Title>
        <Frame.Description>Last 30 days</Frame.Description>
      </Frame.Header>
      <Frame.Panel>March</Frame.Panel>
      <Frame.Footer>Export</Frame.Footer>
    </Frame.Root>
  );
  const _ref = <Frame.Root ref={null} />;

  const _flush = <Frame.Root layout="flush" />;

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Frame.Root as="section" />;
  // @ts-expect-error `dense` is a document density, never a Frame layout
  const _noDense = <Frame.Root layout="dense" />;
  // @ts-expect-error the stacked layout replaced the stackedPanels boolean
  const _noStackedPanels = <Frame.Root stackedPanels />;
});
