import type { ComponentProps, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

const studioReadout = tv({
  slots: {
    detail: "min-w-0 wrap-break-word tabular-nums",
  },
  variants: {
    // An identifier the reader matches against source, set in the list's own size and leading.
    code: { true: { detail: "font-mono" } },
  },
});

const styles = studioReadout();

/**
 * An inspector readout: terms and their values, one {@link ReadoutRow} each. `className` lays
 * out the list's box; the other props, such as an accessible name, go on the `<dl>`.
 */
export function ReadoutList({
  className,
  ...props
}: ComponentProps<typeof DescriptionList.Content>): ReactElement {
  return (
    <DescriptionList.Root className={className}>
      <DescriptionList.Content {...props} />
    </DescriptionList.Root>
  );
}

/** A term and its value in a readout; `code` sets the value as an identifier. */
export function ReadoutRow({
  term,
  code,
  children,
}: {
  term: string;
  code?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <DescriptionList.Term>{term}</DescriptionList.Term>
      <DescriptionList.Details className={styles.detail({ code })}>{children}</DescriptionList.Details>
    </>
  );
}
