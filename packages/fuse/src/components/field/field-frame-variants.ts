import { tv } from "../../styles/tv";

/**
 * Package-private FieldFrame layout. The frame has one layout, so the recipe has no axes.
 * TextField's public recipe composes these slots under its own names, and `field-frame.tsx`
 * resolves the same slots once. It lives apart from the frame, which
 * imports icons, so TextField's recipe and the workspace-only recipe catalog stay runtime-free.
 */
export const fieldFrameVariants = tv({
  slots: {
    root: "group flex flex-col gap-1",
    labelRow: "flex items-center justify-between",
    label: "",
    content: "flex flex-col gap-1",
    description: "text-pretty",
  },
  variants: {
    /**
     * A legend-mode description sits directly under a visible legend (Figma). The legend gives
     * up its trailing margin and the description cancels the fieldset's gap above it;
     * the fieldset gap still separates it from the options. Without a description the
     * legend keeps its margin, so the label-to-options distance does not change.
     */
    legendDescription: {
      true: { label: "mb-0", description: "-mt-(--surface-gap-md)" },
    },
  },
});
