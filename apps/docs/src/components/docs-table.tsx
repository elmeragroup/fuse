import type { ComponentProps, ReactElement, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { tv } from "tailwind-variants";

const docsTable = tv({
  slots: {
    wrap: "not-prose mb-[1.2rem] overflow-x-auto",
    root: "text-sm w-full border-collapse",
    headerCell:
      "text-xs font-medium border-b border-border py-2 pl-0 align-top text-muted-foreground normal-case",
    bodyCell: "border-b border-border py-2 pl-0 align-top",
    caption: "text-xs caption-top pb-2 text-left text-muted-foreground",
  },
  variants: {
    numeric: {
      false: {
        headerCell: "pr-3 text-left",
        bodyCell: "pr-3 text-left",
      },
      true: {
        headerCell: "pr-0 text-right font-mono whitespace-nowrap tabular-nums",
        bodyCell: "text-xs pr-0 text-right font-mono whitespace-nowrap tabular-nums",
      },
    },
  },
  defaultVariants: {
    numeric: false,
  },
});

const { wrap, root, caption } = docsTable();

export type DocsTableWrapProps = ComponentProps<"div">;
export type DocsTableRootProps = ComponentProps<"table">;
export type DocsTableCaptionProps = ComponentProps<"caption">;
export type DocsTableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};
export type DocsTableBodyCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

function DocsTableWrap({ className, ...props }: DocsTableWrapProps): ReactElement {
  return <div className={wrap({ className })} {...props} />;
}

function DocsTableRoot({ className, ...props }: DocsTableRootProps): ReactElement {
  return <table className={root({ className })} {...props} />;
}

function DocsTableCaption({ className, ...props }: DocsTableCaptionProps): ReactElement {
  return <caption className={caption({ className })} {...props} />;
}

function DocsTableHeaderCell({
  className,
  numeric = false,
  ...props
}: DocsTableHeaderCellProps): ReactElement {
  const { headerCell } = docsTable({ numeric });
  return <th className={headerCell({ className })} {...props} />;
}

function DocsTableBodyCell({ className, numeric = false, ...props }: DocsTableBodyCellProps): ReactElement {
  const { bodyCell } = docsTable({ numeric });
  return <td className={bodyCell({ className })} {...props} />;
}

DocsTableWrap.displayName = "DocsTable.Wrap";
DocsTableRoot.displayName = "DocsTable.Root";
DocsTableCaption.displayName = "DocsTable.Caption";
DocsTableHeaderCell.displayName = "DocsTable.HeaderCell";
DocsTableBodyCell.displayName = "DocsTable.BodyCell";

export const DocsTable = {
  Wrap: DocsTableWrap,
  Root: DocsTableRoot,
  Caption: DocsTableCaption,
  HeaderCell: DocsTableHeaderCell,
  BodyCell: DocsTableBodyCell,
};
