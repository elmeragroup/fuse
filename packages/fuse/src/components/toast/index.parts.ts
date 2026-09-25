import {
  ToastProvider,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  useToastManager as useToastManagerValue,
  createToastManager as createToastManagerValue,
} from "./toast";

export const Provider = ToastProvider;
export const Viewport = ToastViewport;
export const Root = ToastRoot;
export const Content = ToastContent;
export const Title = ToastTitle;
export const Description = ToastDescription;
export const Action = ToastAction;
export const Close = ToastClose;
export const useToastManager = useToastManagerValue;
export const createToastManager = createToastManagerValue;
