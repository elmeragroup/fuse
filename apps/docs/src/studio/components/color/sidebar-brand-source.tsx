"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Text } from "@elmeragroup/fuse/text";

import { aliasTarget, currentCss } from "../../lib/token-values";
import type { TokenName } from "../../lib/tokens";
import { useArtboardScope } from "../studio-artboard";
import { useStudioEdits } from "../studio-edits";

const sidebarBrandSource = tv({
  slots: {
    row: "flex flex-wrap items-center gap-2",
    name: "font-mono",
  },
});

const styles = sidebarBrandSource();

/**
 * Whether `name` holds an alias or a literal on this artboard, as the base theme declares it or
 * an edit replaced it: a chip naming the alias's source, such as `→ brand`, or `Literal`.
 */
export function SidebarBrandSource({ name }: { name: TokenName }): ReactElement {
  const { overrides, seed } = useStudioEdits();
  const { scheme } = useArtboardScope();
  const css = currentCss(overrides, seed, scheme, name);
  const target = css === undefined ? undefined : aliasTarget(css);
  return (
    <span className={styles.row()} data-brand-source={name}>
      <Text elementType="span" size="sm" variant="muted" className={styles.name()}>{`--${name}`}</Text>
      {css === undefined ? null : (
        <Badge size="sm" variant="outline" data-source={target === undefined ? "literal" : "alias"}>
          {target === undefined ? "Literal" : `→ ${target}`}
        </Badge>
      )}
    </span>
  );
}
