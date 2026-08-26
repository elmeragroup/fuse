import type { ComponentProps, ReactElement, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { tv } from "tailwind-variants";

const docsTable = tv({
  slots: {
    wrap: "not-prose mb-[1.2rem] overflow-x-auto",
    root: "w-full border-collapse text-[0.8rem]",
    headerCell:
      "border-docs-line text-docs-sub border-b py-[0.45rem] pl-0 align-top text-[0.72rem] font-[550] normal-case",
    bodyCell: "border-docs-line border-b py-[0.45rem] pl-0 align-top",
    caption: "text-docs-sub caption-top pb-2 text-left text-[0.72rem]",
  },
  variants: {
    numeric: {
      false: {
        headerCell: "pr-[0.7rem] text-left",
        bodyCell: "pr-[0.7rem] text-left",
      },
      true: {
        headerCell: "font-docs-mono pr-0 text-right whitespace-nowrap tabular-nums",
        bodyCell: "font-docs-mono pr-0 text-right text-[0.72rem] whitespace-nowrap tabular-nums",
      },
    },
  },
  defaultVariants: {
    numeric: false,
  },
});

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
  const { wrap } = docsTable();
  return <div className={wrap({ className })} {...props} />;
}

function DocsTableRoot({ className, ...props }: DocsTableRootProps): ReactElement {
  const { root } = docsTable();
  return <table className={root({ className })} {...props} />;
}

function DocsTableCaption({ className, ...props }: DocsTableCaptionProps): ReactElement {
  const { caption } = docsTable();
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
