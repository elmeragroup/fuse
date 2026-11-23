import type { ReactNode } from "react";

import type { LayoutName } from "../deck/vocabulary.ts";

type LayoutProps = { readonly children?: ReactNode };

function layout(name: LayoutName) {
  return function Layout({ children }: LayoutProps) {
    return <div className={`deck-layout deck-layout-${name}`}>{children}</div>;
  };
}

/** Each layout `describe` lists, by name. */
export const LAYOUTS = {
  content: layout("content"),
  cover: layout("cover"),
  section: layout("section"),
  center: layout("center"),
} satisfies Record<LayoutName, (props: LayoutProps) => ReactNode>;
