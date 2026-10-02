import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { statusTone } from "./funnel-orders";
import type { OrderStatus } from "./funnel-orders";

const statusIcon = tv({
  slots: {
    root: "size-3.5 shrink-0",
    ring: "stroke-current",
    // The glyph on a filled disc is cut out of it in the surface colour.
    glyph: "stroke-background",
  },
  variants: {
    tone: {
      success: { root: "text-success" },
      warning: { root: "text-warning" },
      destructive: { root: "text-error" },
    },
  },
});

/** A wedge from twelve o'clock clockwise, filling `turn` of the inner disc. */
const WEDGES = {
  quarter: "M7 7V3.5A3.5 3.5 0 0 1 10.5 7Z",
  half: "M7 7V3.5A3.5 3.5 0 0 1 7 10.5Z",
  threeQuarters: "M7 7V3.5A3.5 3.5 0 1 1 3.5 7Z",
} as const;

/** The glyph each finished or failed status cuts out of its disc. */
const GLYPHS = {
  check: "M4.5 7.2 6.2 8.9 9.6 5.4",
  cross: "M5 5l4 4M9 5l-4 4",
  alert: "M7 4.2v3.4M7 9.6v.2",
  forward: "M4.6 7h4.6M7.4 5l2 2-2 2",
} as const;

type Mark =
  | { _tag: "dashed" }
  | { _tag: "wedge"; wedge: keyof typeof WEDGES }
  | { _tag: "disc"; glyph: keyof typeof GLYPHS };

/** Progress reads left to right: drafts are open rings, work fills its disc, endings are solid. */
const MARKS = {
  Ready: { _tag: "dashed" },
  AwaitingCustomerApproval: { _tag: "wedge", wedge: "quarter" },
  InProgress: { _tag: "wedge", wedge: "half" },
  AwaitingStartup: { _tag: "wedge", wedge: "threeQuarters" },
  Done: { _tag: "disc", glyph: "check" },
  SendtToTm: { _tag: "disc", glyph: "forward" },
  Cancelled: { _tag: "disc", glyph: "cross" },
  ElhubFailed: { _tag: "disc", glyph: "alert" },
  VerifyPersonFailed: { _tag: "disc", glyph: "alert" },
} as const satisfies Record<OrderStatus, Mark>;

export type OrderStatusIconProps = {
  status: OrderStatus;
};

/**
 * One status as a 14px glyph in the tone Funnel paints it, every stroke 1.5px. Decorative: the
 * row or menu item beside it names the status.
 */
export function OrderStatusIcon({ status }: OrderStatusIconProps): ReactElement {
  const styles = statusIcon({ tone: statusTone(status) });
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={styles.root()} strokeWidth={1.5} strokeLinecap="round">
      <StatusMark mark={MARKS[status]} ring={styles.ring()} glyph={styles.glyph()} />
    </svg>
  );
}

type StatusMarkProps = { mark: Mark; ring: string; glyph: string };

function StatusMark({ mark, ring, glyph }: StatusMarkProps): ReactElement {
  switch (mark._tag) {
    case "dashed":
      return <circle cx={7} cy={7} r={5.75} className={ring} fill="none" strokeDasharray="2.26 2.26" />;
    case "wedge":
      return (
        <>
          <circle cx={7} cy={7} r={5.75} className={ring} fill="none" />
          <path d={WEDGES[mark.wedge]} className="fill-current" />
        </>
      );
    case "disc":
      return (
        <>
          <circle cx={7} cy={7} r={6.25} className="fill-current" />
          <path d={GLYPHS[mark.glyph]} className={glyph} fill="none" strokeLinejoin="round" />
        </>
      );
  }
}
