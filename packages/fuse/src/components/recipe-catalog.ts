/**
 * Workspace-only facade for the Figma component sync. It is not published and not in the
 * root barrel. It re-exports the component recipes from their runtime-free `*-variants.ts`
 * modules, because Node scripts cannot load the component entries, which re-export client
 * TSX. The sync calls each recipe for every cell of a Figma variant matrix and compiles the
 * class string it returns. It also re-exports the icon roster, from which the sync builds one
 * Figma component per icon `/icons` publishes.
 */

export { buttonVariants } from "./button/button-variants";
export { toggleVariants } from "./toggle/toggle-variants";
export { BESPOKE_ICON_NAMES, PHOSPHOR_ICON_NAMES } from "../icons/roster";
