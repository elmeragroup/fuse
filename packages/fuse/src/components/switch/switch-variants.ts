import { tv } from "../../styles/tv";

/**
 * The Switch's track and thumb. The size reads `data-size` on the track, and the checked face
 * reads `data-checked` and `data-unchecked` on each part, so any element that carries those
 * attributes draws the same switch. The data table filter's toggle row draws one this way, as a
 * picture of its own checked state. Runtime-free, so that row borrows the look without
 * Switch's client graph. Switch adds the control's `peer`, outline reset and hit area itself.
 */
export const switchVariants = tv({
  slots: {
    // The root is a <span>, so the state face keys off Base UI's `data-disabled` and
    // `data-invalid` attributes, plus a consumer's `aria-invalid`. The unchecked track is an
    // outline: its edge and thumb take `muted-foreground`, held to 3:1 on every surface by the
    // matrix rule in `contrast-matrix.test.ts`, and the surface shows through. The checked
    // track is the `primary` fill with a `background` thumb, so on versus off reads as outline
    // versus fill in every palette, as on Checkbox and Radio.
    root: "group/switch shadow-xs relative inline-flex shrink-0 items-center rounded-full border border-muted-foreground transition-colors data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:border-primary data-checked:bg-primary",
    thumb:
      "pointer-events-none block rounded-full bg-muted-foreground ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:bg-background group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] data-unchecked:scale-75 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0",
  },
});
