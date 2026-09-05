import type { ReactElement } from "react";

import "./SkipNav.css";

export const MAIN_CONTENT_ID = "main-content";

export function SkipNav(): ReactElement {
  return (
    <a className="SkipNav" href={`#${MAIN_CONTENT_ID}`}>
      Skip to contents
    </a>
  );
}
