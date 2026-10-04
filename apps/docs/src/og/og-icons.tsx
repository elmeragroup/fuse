/* oxlint-disable anti-slop/no-object-parameters, anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof, anti-slop/no-unsafe-dictionary-type -- this module walks React's runtime element union (component functions, forwardRef objects, intrinsic tags with open props); no domain type exists to parse it into */
import { Children, createElement, Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";

import { compact } from "./satori-style";

/** A Fuse icon slot: the glyph is drawn by the caller at the slot's size and color. */
export type IconSlot = (size: number, color: string) => ReactElement;

/** The shape of a `forwardRef` component object, which carries its render function. */
type ForwardRefComponent = {
  readonly render: (props: object, ref: null) => ReactNode;
};

function isForwardRef(type: unknown): type is ForwardRefComponent {
  return typeof type === "object" && type !== null && "render" in type && typeof type.render === "function";
}

/**
 * Expands a tree to intrinsic elements: calls function and `forwardRef` components and
 * lifts fragment children into their parent. Satori draws only intrinsic elements inside
 * `<svg>`, and a Phosphor glyph is a `forwardRef` whose paths sit in a fragment. The glyphs are
 * pure (no hooks or context), which is what makes calling them here safe.
 */
function intrinsic(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map(intrinsic);
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }
  const { type, props } = node;
  if (type === Fragment) {
    return Children.toArray(props.children).map(intrinsic);
  }
  if (typeof type === "function") {
    // SAFETY: a function component takes its props and returns a node; the glyphs use no hooks.
    return intrinsic((type as (props: object) => ReactNode)(props));
  }
  if (isForwardRef(type)) {
    return intrinsic(type.render(props, null));
  }
  if (typeof type !== "string") {
    return node;
  }
  const { children, ...attributes } = props;
  return createElement(type, compact(attributes), ...Children.toArray(children).map(intrinsic));
}

/**
 * A Fuse icon as a specimen slot, drawn from the library's own Phosphor glyph.
 *
 * @param Icon - A Fuse icon component, such as `Check` from `@elmeragroup/fuse/icons`.
 * @param weight - Phosphor's glyph weight; `fill` for the solid forms the recipes use.
 * @returns A slot that draws the icon at a size and color.
 */
export function glyph(
  Icon: (props: ElmeraIconProps) => ReactElement,
  weight: "regular" | "fill" = "regular"
): IconSlot {
  return (size, color) => <>{intrinsic(<Icon size={size} color={color} weight={weight} />)}</>;
}
