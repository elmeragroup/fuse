"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";

/** `DescriptionList.Heading` takes a native heading's props and `render`. */
export type DescriptionListHeadingProps = ComponentProps<"h2"> & {
  /**
   * Replaces the host `<h2>`, such as `render={<h3 />}` for another outline level. The heading
   * keeps its level-2 type.
   */
  render?: useRender.RenderProp;
};

/**
 * The list's heading, an `<h2>`. It is a client module because `useRender` is; the rest of the
 * compound stays server.
 *
 * @param props - The host element and the native heading props.
 * @returns The rendered heading.
 */
export function DescriptionListHeading({
  className,
  render,
  ...props
}: DescriptionListHeadingProps): ReactElement {
  return useRender({
    defaultTagName: "h2",
    props: mergeProps<"h2">(
      {
        className: cn("text-lg leading-snug font-medium font-heading text-inherit", className),
      },
      props
    ),
    render,
    state: { slot: "description-list-heading" },
  });
}

DescriptionListHeading.displayName = "DescriptionList.Heading";
