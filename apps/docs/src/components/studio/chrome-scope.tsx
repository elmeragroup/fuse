"use client";

import type { ReactElement } from "react";

import { ThemeScope } from "@elmeragroup/fuse/theme";
import type { ThemeScopeProps } from "@elmeragroup/fuse/theme";

import { DOCUMENT_THEME } from "../../lib/theme";
import { useStudio } from "./studio-state";

/**
 * One region of the editor chrome: the docs' own internal theme in the chrome's scheme. The
 * chrome is never an ancestor of an artboard, because Fuse's dark rules are descendant
 * selectors and would darken a light artboard inside a dark chrome. So each chrome region is
 * its own scope, and the overlays it opens portal into it and wear its scheme.
 */
export function ChromeScope(props: Omit<ThemeScopeProps, "theme">): ReactElement {
  const { resolvedChromeScheme } = useStudio();
  return <ThemeScope theme={DOCUMENT_THEME} data-theme={resolvedChromeScheme} {...props} />;
}
