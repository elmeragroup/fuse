// Source entry facade for `@elmeragroup/fuse/toast` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe — status chrome stays module-private.
export { Toast } from "./components/toast/toast";
export type {
  CreateToastManagerReturnValue,
  ToastCloseProps,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastProviderProps,
  ToastStatus,
  ToastViewportProps,
  UseToastManagerReturnValue,
} from "./components/toast/toast";
