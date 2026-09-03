"use client";

import { useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type {
  ToastManagerAddOptions as PrimitiveAddOptions,
  ToastManagerPromiseOptions as PrimitivePromiseOptions,
  ToastManagerUpdateOptions as PrimitiveUpdateOptions,
  ToastObject,
} from "@base-ui/react/toast";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CheckCircle } from "../../icons/generated/check-circle";
import { Info } from "../../icons/generated/info";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { Warning } from "../../icons/generated/warning";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { useResolvedPortalContainer } from "../../theme/use-resolved-portal-container";
import { Button } from "../button/button";
import { overlayCloseStrings } from "../overlay/intl";
import { overlayLayer } from "../overlay/overlay-classes";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { toastVariants } from "./toast-variants";

export type ToastStatus = "error" | "info" | "success" | "warning" | "loading";

type ToastPriority = "low" | "high";

export type ToastManagerAddOptions<Data extends object = object> = Omit<PrimitiveAddOptions<Data>, "type"> & {
  /**
   * Styled status. Unset is the neutral surface. Drives `-soft` chrome and the
   * accessible priority default unless `priority` is set.
   */
  type?: ToastStatus;
};

export type ToastManagerUpdateOptions<Data extends object = object> = Omit<
  PrimitiveUpdateOptions<Data>,
  "type"
> & {
  /**
   * Styled status. An update that changes `type` and omits `priority` derives
   * the new default; omitting both preserves the existing priority.
   */
  type?: ToastStatus;
};

export type ToastManagerPromiseOptions<Value, Data extends object = object> = {
  /** Loading state — a description string or a full options object. */
  loading: string | ToastManagerUpdateOptions<Data>;
  /** Success state after the promise resolves. */
  success:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((result: Value) => string | ToastManagerUpdateOptions<Data>);
  /** Error state after the promise rejects. Defaults high/assertive. */
  error:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((cause: Error) => string | ToastManagerUpdateOptions<Data>);
};

export type UseToastManagerReturnValue<Data extends object = object> = {
  toasts: ToastObject<Data>[];
  add: <T extends Data = Data>(options: ToastManagerAddOptions<T>) => string;
  close: (toastId?: string) => void;
  update: <T extends Data = Data>(toastId: string, options: ToastManagerUpdateOptions<T>) => void;
  promise: <Value, T extends Data = Data>(
    promise: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, T>
  ) => Promise<Value>;
};

export type CreateToastManagerReturnValue<Data extends object = object> = Omit<
  UseToastManagerReturnValue<Data>,
  "toasts"
>;

const STATUS_ICONS = {
  neutral: null,
  error: WarningOctagon,
  info: Info,
  success: CheckCircle,
  warning: Warning,
  loading: SpinnerGap,
};

function statusFromType(type: string | undefined): keyof typeof STATUS_ICONS {
  if (type === "error" || type === "info" || type === "success" || type === "warning" || type === "loading") {
    return type;
  }
  return "neutral";
}

function derivedPriority(type: string | undefined): ToastPriority {
  return type === "error" ? "high" : "low";
}

function adaptAddOptions<Data extends object>(
  options: ToastManagerAddOptions<Data>
): PrimitiveAddOptions<Data> {
  const { priority, ...rest } = options;
  return {
    ...rest,
    priority: priority ?? derivedPriority(options.type),
  };
}

function adaptUpdateOptions<Data extends object>(
  options: ToastManagerUpdateOptions<Data>
): PrimitiveUpdateOptions<Data> {
  const { priority, type, ...rest } = options;
  if (priority !== undefined) {
    return { ...rest, type, priority };
  }
  if (type !== undefined) {
    return { ...rest, type, priority: derivedPriority(type) };
  }
  return { ...rest };
}

type PromiseStateInput<Value, Data extends object> =
  | string
  | ToastManagerUpdateOptions<Data>
  | ((result: Value) => string | ToastManagerUpdateOptions<Data>);

/**
 * The two guards below ask a runtime question about consumer input, and both used to
 * spell it `Object.prototype.toString.call(…)` — an obfuscation that passed the lint
 * rule without answering it. They are honest `typeof` checks with a named disable now.
 *
 * Neither can borrow the shared `isTextNode`/`isTextValueNode` helpers: those narrow a
 * `ReactNode`, and these values are Toast's own manager unions — an options object is
 * not a `ReactNode`, and no shared guard narrows a callable (spec 08 names none).
 */
function isShorthandDescription<Data extends object>(
  value: string | ToastManagerUpdateOptions<Data>
): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: the string shorthand for `description` is a documented public contract (toast.md §3), not an internal type guess
  return typeof value === "string";
}

function isPromiseStateFactory<Value, Data extends object>(
  value: PromiseStateInput<Value, Data>
): value is (result: Value) => string | ToastManagerUpdateOptions<Data> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: `promise()` states are documented as a value or a factory over the settled value (toast.md §3), and the callable arm can only be told apart at runtime
  return typeof value === "function";
}

function adaptResolvedPromiseState<Data extends object>(
  resolved: string | ToastManagerUpdateOptions<Data>,
  stateType: "loading" | "success" | "error"
): PrimitiveUpdateOptions<Data> {
  if (isShorthandDescription(resolved)) {
    return { description: resolved, priority: derivedPriority(stateType) };
  }
  const { priority, ...rest } = resolved;
  return {
    ...rest,
    priority: priority ?? derivedPriority(stateType),
  };
}

function adaptPromiseOption<Value, Data extends object>(
  option:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((result: Value) => string | ToastManagerUpdateOptions<Data>),
  stateType: "loading" | "success" | "error"
): PrimitiveUpdateOptions<Data> | ((result: Value) => PrimitiveUpdateOptions<Data>) {
  if (isPromiseStateFactory<Value, Data>(option)) {
    return (result: Value) => adaptResolvedPromiseState(option(result), stateType);
  }
  return adaptResolvedPromiseState(option, stateType);
}

type PrimitiveManager = {
  add: (options: PrimitiveAddOptions<object>) => string;
  update: (id: string, options: PrimitiveUpdateOptions<object>) => void;
  close: (id?: string) => void;
  promise: <Value>(
    promiseValue: Promise<Value>,
    options: PrimitivePromiseOptions<Value, object>
  ) => Promise<Value>;
};

function wrapManagerMethods(manager: PrimitiveManager): CreateToastManagerReturnValue {
  return {
    ...manager,
    add: (options) => {
      // SAFETY: the adapter only writes `priority`; custom `data` is forwarded unchanged.
      return manager.add(adaptAddOptions(options));
    },
    update: (id, options) => {
      // SAFETY: the adapter only writes `priority` when `type` changes; other fields pass through.
      manager.update(id, adaptUpdateOptions(options));
    },
    close: (id) => {
      manager.close(id);
    },
    promise: (promiseValue, options) => {
      // SAFETY: each promise state is normalized to the primitive options shape with a
      // type-aware priority default; the settled value is the original promise's value.
      return manager.promise(promiseValue, {
        loading: adaptResolvedPromiseState(options.loading, "loading"),
        success: adaptPromiseOption(options.success, "success"),
        error: adaptPromiseOption(options.error, "error"),
      });
    },
  };
}

/**
 * Imperative toast manager for a tree under `Toast.Provider`. Returns the live
 * `toasts` array plus `add` / `update` / `close` / `promise`.
 */
function useToastManager<Data extends object = object>(): UseToastManagerReturnValue<Data> {
  const manager = ToastPrimitive.useToastManager<Data>();
  return useMemo(
    () => ({
      // SAFETY: the hook manager is the primitive store face; wrapManagerMethods only
      // rebinds add/update/close/promise and keeps `toasts` from this closure.
      ...wrapManagerMethods(manager as PrimitiveManager),
      toasts: manager.toasts,
    }),
    [manager]
  );
}

/**
 * Module-scope manager for code outside the React tree (timers, query-cache
 * listeners). Same `add` / `update` / `close` / `promise` methods as the hook,
 * with no reactive `toasts` array. Pass the result to
 * `<Toast.Provider toastManager={…}>`.
 */
function createToastManager<Data extends object = object>(): CreateToastManagerReturnValue<Data> {
  // SAFETY: createToastManager is the primitive emit face; wrapManagerMethods only
  // rebinds add/update/close/promise and preserves the private subscribe channel.
  return wrapManagerMethods(ToastPrimitive.createToastManager<Data>() as PrimitiveManager);
}

export type ToastProviderProps = Omit<ComponentProps<typeof ToastPrimitive.Provider>, "toastManager"> & {
  /**
   * Optional manager from `Toast.createToastManager()` so non-React code
   * (timers, query-cache listeners) can dispatch through the same adapter as
   * `Toast.useToastManager()`.
   */
  toastManager?: CreateToastManagerReturnValue;
};

function ToastProvider({ toastManager, ...props }: ToastProviderProps): ReactElement {
  return (
    <ToastPrimitive.Provider
      toastManager={
        // SAFETY: our adapter is a drop-in for the primitive manager; the private
        // subscribe channel is preserved by wrapManagerMethods' object spread.
        toastManager as ComponentProps<typeof ToastPrimitive.Provider>["toastManager"]
      }
      {...props}
    />
  );
}

export type ToastViewportProps = ComponentProps<typeof ToastPrimitive.Viewport> & OverlayContainerProps;

function ToastViewport({
  className,
  container,
  children,
  ...props
}: ToastViewportProps): ReactElement | null {
  const resolvedContainer = useResolvedPortalContainer(container);

  if (resolvedContainer === null) {
    return null;
  }

  return (
    <ToastPrimitive.Portal container={resolvedContainer}>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className={cn(
          "sm:right-8 sm:bottom-8 sm:w-[340px] fixed top-auto right-4 bottom-4 isolate mx-auto flex w-[calc(100%-2rem)]",
          overlayLayer,
          selfFocusRingClass,
          className
        )}
        {...props}>
        {children ?? <ToastList />}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

function ToastRoot({ className, toast, ...props }: ComponentProps<typeof ToastPrimitive.Root>): ReactElement {
  const status = statusFromType(toast.type);
  const { root } = toastVariants({ status });
  return (
    <ToastPrimitive.Root
      data-slot="toast-root"
      data-status={status}
      toast={toast}
      className={cn(root(), className)}
      {...props}
    />
  );
}

function ToastContent({ className, ...props }: ComponentProps<typeof ToastPrimitive.Content>): ReactElement {
  const { content } = toastVariants();
  return <ToastPrimitive.Content data-slot="toast-content" className={cn(content(), className)} {...props} />;
}

function ToastTitle({ className, ...props }: ComponentProps<typeof ToastPrimitive.Title>): ReactElement {
  const { title } = toastVariants();
  return <ToastPrimitive.Title data-slot="toast-title" className={cn(title(), className)} {...props} />;
}

function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Description>): ReactElement {
  const { description } = toastVariants();
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(description(), className)}
      {...props}
    />
  );
}

function ToastAction({ className, ...props }: ComponentProps<typeof ToastPrimitive.Action>): ReactElement {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn("mt-2 w-fit", className)}
      render={<Button size="sm" variant="outline" />}
      {...props}
    />
  );
}

export type ToastCloseProps = ComponentProps<typeof ToastPrimitive.Close> & {
  /**
   * Accessible name for the close button. Defaults to the locale dictionary
   * `toast.close`. Icon-only Close sets it as `aria-label`; visible children
   * replace the icon face and name the control themselves.
   */
  label?: string;
};

function hasVisibleChildren(children: ReactNode): boolean {
  return children != null && children !== false && children !== true && children !== "";
}

function ToastClose({ className, label, children, ...props }: ToastCloseProps): ReactElement {
  const strings = useLocalizedStrings(overlayCloseStrings);
  const resolvedLabel = label ?? strings.format("close");
  const visible = hasVisibleChildren(children);
  const closeButton = visible ? (
    <Button variant="ghost" size="sm" />
  ) : (
    <Button variant="ghost" size="icon-sm" aria-label={resolvedLabel} />
  );

  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn("absolute top-2 right-2 text-muted-foreground", className)}
      render={closeButton}
      {...props}>
      {visible ? children : <X aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}

function ToastList(): ReactElement {
  const { toasts } = useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <BuiltInToast key={toast.id} toast={toast} />
      ))}
    </>
  );
}

function BuiltInToast({ toast }: { toast: ToastObject<object> }): ReactElement {
  const status = statusFromType(toast.type);
  const { icon } = toastVariants({ status });
  const Glyph = STATUS_ICONS[status];

  return (
    <ToastRoot toast={toast}>
      <ToastContent>
        <div className="flex items-start gap-2 pr-8">
          {Glyph ? <Glyph data-toast-icon aria-hidden="true" className={icon()} /> : null}
          <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
            <ToastTitle />
            <ToastDescription />
            <ToastAction />
          </div>
        </div>
        <ToastClose />
      </ToastContent>
    </ToastRoot>
  );
}

ToastProvider.displayName = "Toast.Provider";
ToastViewport.displayName = "Toast.Viewport";
ToastRoot.displayName = "Toast.Root";
ToastContent.displayName = "Toast.Content";
ToastTitle.displayName = "Toast.Title";
ToastDescription.displayName = "Toast.Description";
ToastAction.displayName = "Toast.Action";
ToastClose.displayName = "Toast.Close";

export const Toast = {
  Provider: ToastProvider,
  Viewport: ToastViewport,
  Root: ToastRoot,
  Content: ToastContent,
  Title: ToastTitle,
  Description: ToastDescription,
  Action: ToastAction,
  Close: ToastClose,
  useToastManager,
  createToastManager,
};
