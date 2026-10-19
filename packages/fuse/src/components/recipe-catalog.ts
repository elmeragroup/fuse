/**
 * Workspace-only facade for the Figma component sync. It is not published and not in the
 * root barrel. It re-exports the component recipes from their runtime-free `*-variants.ts`
 * modules, because Node scripts cannot load the component entries, which re-export client
 * TSX. The sync calls each recipe for every cell of a Figma variant matrix and compiles the
 * class string it returns.
 */

export { buttonVariants } from "./button/button-variants";
