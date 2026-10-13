import { cn } from "../../styles/cn";

/**
 * The Separator hairline: a 1px line in the border color across its orientation, stretched along a
 * vertical one's flex row. Separator and Toolbar.Separator draw it.
 */
export const separatorClass = cn(
  "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch"
);
