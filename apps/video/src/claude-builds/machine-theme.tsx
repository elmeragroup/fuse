import type { ReactElement, ReactNode } from "react";

import { SceneTheme } from "../primitives/scene-theme";

/**
 * The developer's machine the session runs on: Elmera's internal app theme, dark, for the
 * backdrop, the terminal and the browser's chrome. Fuse's light themes cannot nest inside a dark
 * scope, so every part of the machine wears its own scope beside the page, never around it.
 *
 * @param props.className - Places and styles the scope's element.
 * @param props.children - The machine's part.
 * @returns The themed element.
 */
export function MachineTheme({
  className,
  children,
}: {
  readonly className?: string;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <SceneTheme brand="elma" scheme="dark" variant="internal" className={className}>
      {children}
    </SceneTheme>
  );
}
