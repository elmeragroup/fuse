import type { ReactElement, ReactNode } from "react";

import "./component-sections.css";

export type ProseProps = {
  children: ReactNode;
};

/**
 * The authored prose of a page — the markdown a `page.mdx` writes between its generated
 * sections. Wrapping it keeps prose typography scoped to what a human wrote, so the
 * generated API and token sections below are not restyled by it.
 */
export function Prose({ children }: ProseProps): ReactElement {
  return <div className="ComponentProse">{children}</div>;
}
