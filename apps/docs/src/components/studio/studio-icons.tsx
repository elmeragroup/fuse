import type { ReactElement, SVGProps } from "react";

/**
 * The two canvas tool glyphs Fuse's icon roster has no member for. They are decorative: the
 * button around each one carries its name.
 */
function ToolGlyph({ children, ...props }: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}>
      {children}
    </svg>
  );
}

/** The Select tool: an arrow pointer. */
export function PointerGlyph(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <ToolGlyph {...props}>
      <path d="M5.5 3.5 19 10.4l-6.1 1.7-2.9 6.4z" />
    </ToolGlyph>
  );
}

/** The Hand tool: an open hand. */
export function HandGlyph(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <ToolGlyph {...props}>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V13a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-5-2.7l-1.4-2.2a1.5 1.5 0 0 1 2.4-1.8L8 14.5" />
    </ToolGlyph>
  );
}
