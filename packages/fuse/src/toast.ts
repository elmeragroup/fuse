// The source entry for `@elmeragroup/fuse/toast`. It holds explicit named re-exports only,
// with no `export *`, no local declarations and no directives. The exports and barrel generators
// find this file, so never edit `package.json#exports` or `src/index.ts` by hand.
// It exports no public recipe, because the status styles stay module-private.
export { Toast } from "./components/toast";
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
