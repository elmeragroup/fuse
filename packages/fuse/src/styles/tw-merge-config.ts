/**
 * The tailwind-merge extension every Fuse merge uses, `cn` and the configured `tv` alike.
 * `rounded-inner` and `mark-fill-*` are Fuse utilities from fuse.css. Registering `inner` as a
 * radius value puts it in the `rounded-*` conflict group, so a consumer's `rounded-*` class
 * replaces it. Adding `mark-fill-*` to the background-color group does the same for a
 * consumer's `bg-*` class. The extension imports nothing, so `tv` reads it without loading
 * `cn`'s merge.
 */
export const twMergeConfig = {
  extend: {
    theme: { radius: ["inner"] },
    // tailwind-merge passes the part after `mark-fill-`, without an opacity modifier. Tailwind
    // emits the class only for a `--color-*` theme name, so any value belongs to the group.
    classGroups: { "bg-color": [{ "mark-fill": [(value: string) => value !== ""] }] },
  },
};
