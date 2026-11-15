// This file is the source entry for `@elmeragroup/fuse/toast`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. It exports no public recipe, because
// the status styles stay module-private.
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
