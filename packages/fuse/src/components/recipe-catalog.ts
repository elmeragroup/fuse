/**
 * Workspace-only facade for the Figma component sync. It is not published and not in the
 * root barrel. It re-exports the component recipes from their runtime-free `*-variants.ts` and
 * `*-class.ts` modules, because Node scripts cannot load the component entries, which re-export
 * client TSX. The sync calls each recipe for every cell of a Figma variant matrix and compiles the
 * class string it returns. It also re-exports `cn`, with which the sync adds a docs demo's
 * consumer classes to a recipe as a component merges its `className`, and the icon roster, from
 * which the sync builds one Figma component per icon `/icons` publishes. Meter's constants and its
 * `meterToneCell` lookup come along, so the sync picks each Meter cell's tone and icon from the
 * table the component reads.
 */

export {
  avatarFallbackClass,
  avatarGroupClass,
  avatarImageClass,
  avatarRootClass,
} from "./avatar/avatar-class";
export { badgeVariants } from "./badge/badge-variants";
export { breadcrumbVariants } from "./breadcrumb/breadcrumb-variants";
export { buttonVariants } from "./button/button-variants";
export { checkboxVariants } from "./checkbox/checkbox-variants";
export { confirmButtonVariants } from "./confirm-button/confirm-button-variants";
export { fieldVariants } from "./field/field-variants";
export { inputClass } from "./input/input-class";
export { kbdVariants } from "./kbd/kbd-variants";
export { loaderVariants } from "./loader/loader-variants";
export { METER_CONSTANTS } from "./meter/meter-constants";
export { meterToneCell } from "./meter/meter-tone";
export { meterVariants } from "./meter/meter-variants";
export { paginationVariants } from "./pagination/pagination-variants";
export { radioIconButtonVariants, radioVariants } from "./radio-group/radio-group-variants";
export { selectTriggerVariants } from "./select/select-variants";
export { separatorClass } from "./separator/separator-class";
export { skeletonClass } from "./skeleton/skeleton-class";
export { switchVariants } from "./switch/switch-variants";
export { textareaClass } from "./textarea/textarea-class";
export { toggleVariants } from "./toggle/toggle-variants";
export { cn } from "../styles/cn";
export { BESPOKE_ICON_NAMES, PHOSPHOR_ICON_NAMES } from "../icons/roster";
