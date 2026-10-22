/**
 * Workspace-only facade for the Figma component sync. It is not published and not in the
 * root barrel. It re-exports the component recipes from their runtime-free `*-variants.ts` and
 * `*-class.ts` modules, because Node scripts cannot load the component entries, which re-export
 * client TSX. The sync calls each recipe for every cell of a Figma variant matrix and compiles the
 * class string it returns. It also re-exports `cn`, with which the sync adds a docs demo's
 * consumer classes to a recipe as a component merges its `className`, and the icon roster, from
 * which the sync builds one Figma component per icon `/icons` publishes.
 */

export { badgeVariants } from "./badge/badge-variants";
export { buttonVariants } from "./button/button-variants";
export { checkboxVariants } from "./checkbox/checkbox-variants";
export { fieldVariants } from "./field/field-variants";
export { kbdVariants } from "./kbd/kbd-variants";
export { loaderVariants } from "./loader/loader-variants";
export { radioIconButtonVariants, radioVariants } from "./radio-group/radio-group-variants";
export { separatorClass } from "./separator/separator-class";
export { skeletonClass } from "./skeleton/skeleton-class";
export { switchVariants } from "./switch/switch-variants";
export { toggleVariants } from "./toggle/toggle-variants";
export { cn } from "../styles/cn";
export { BESPOKE_ICON_NAMES, PHOSPHOR_ICON_NAMES } from "../icons/roster";
