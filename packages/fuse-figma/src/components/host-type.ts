/**
 * The type the host page gives a root whose classes set none, for a definition's `inheritedFor`.
 * The docs and the compare page both load a page whose `<html>` takes the browser's `medium` font
 * size, 16px, and Tailwind preflight's `line-height: 1.5`. A Pagination link inherits it, since
 * Button's `icon` square sets no type, and so does React Aria's Link, whose recipe sets no type
 * size.
 */
import type { OuterDeclaration } from "./component-spec";

/** The browser's `medium` 16px and preflight's `line-height: 1.5` on `<html>`. */
export const HOST_TYPE: readonly OuterDeclaration[] = [
  { className: "html, the browser's medium font size", property: "font-size", value: "16px" },
  { className: "html, Tailwind preflight", property: "line-height", value: "1.5" },
];
