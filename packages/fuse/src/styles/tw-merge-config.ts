/**
 * The tailwind-merge extension every Fuse merge uses, `cn` and the configured `tv` alike.
 * `rounded-inner` is a Fuse utility from fuse.css. Registering `inner` as a radius value puts it
 * in the `rounded-*` conflict group, so a consumer's `rounded-*` class replaces it. It is plain
 * data, so `tv` reads it without loading `cn`'s merge.
 */
export const twMergeConfig = { extend: { theme: { radius: ["inner"] } } };
