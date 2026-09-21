import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Frame as RootFrame } from "@elmeragroup/fuse";
import type {
  FrameDescriptionProps,
  FrameFooterProps,
  FrameHeaderProps,
  FramePanelProps,
  FrameRootProps,
  FrameTitleProps,
} from "@elmeragroup/fuse/frame";
import * as FrameModule from "@elmeragroup/fuse/frame";
import { Frame } from "@elmeragroup/fuse/frame";

test("the namespace ships all six parts from the frame entry and the root barrel", () => {
  expectTypeOf<typeof Frame>().toEqualTypeOf<typeof RootFrame>();
  expectTypeOf(Frame).toHaveProperty("Root");
  expectTypeOf(Frame).toHaveProperty("Panel");
  expectTypeOf(Frame).toHaveProperty("Header");
  expectTypeOf(Frame).toHaveProperty("Title");
  expectTypeOf(Frame).toHaveProperty("Description");
  expectTypeOf(Frame).toHaveProperty("Footer");
});

test("public API exports only the namespace and part prop types", () => {
  expectTypeOf<FrameRootProps>().toMatchTypeOf<ComponentProps<"div"> & { stackedPanels?: boolean }>();
  expectTypeOf<FrameRootProps["stackedPanels"]>().toEqualTypeOf<boolean | undefined>();
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
});

test("parts take native attributes, stackedPanels, and no polymorphic as prop", () => {
  const _root = (
    <Frame.Root stackedPanels className="max-w-lg">
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

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Frame.Root as="section" />;
});
