"use client";

import { createContext, use, useEffect, useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type {
  ToastManagerAddOptions as PrimitiveAddOptions,
  ToastManagerUpdateOptions as PrimitiveUpdateOptions,
  ToastObject,
} from "@base-ui/react/toast";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMediaQuery } from "../../hooks/use-media-query";
import { CheckCircle } from "../../icons/generated/check-circle";
import { Info } from "../../icons/generated/info";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { Warning } from "../../icons/generated/warning";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { X } from "../../icons/generated/x";
import { definedProps } from "../../internal/defined-props";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { Button } from "../button/button";
import { overlayCloseStrings } from "../overlay/intl";
import { toastLayer } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { toastVariants, toastViewportVariants } from "./toast-variants";

/** Resolved once at module scope — these slots carry no status axis (no per-render work). */
const { content, title, description } = toastVariants();

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
   * the new default; omitting both preserves the existing priority. Explicit
   * `type: undefined` clears status to neutral and derives low priority.
   */
  type?: ToastStatus;
};

export type ToastManagerPromiseOptions<Value, Data extends object = object> = {
  /**
   * Loading state — a description string or a full options object. Omit it to show
   * nothing until the promise settles.
   */
  loading?: string | ToastManagerUpdateOptions<Data>;
  /** Success state after the promise resolves. A returned `type` replaces `"success"`. */
  success:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((result: Value) => string | ToastManagerUpdateOptions<Data>);
  /**
   * Error state after the promise rejects. Defaults high/assertive. A returned `type`
   * replaces `"error"`.
   */
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
  /**
   * Shows a toast for the life of `promise`. With `loading`, a loading toast appears at
   * once and moves to the settled state; without it, the settled toast is the first one
   * shown. The settled status is the `type` that `success` or `error` returns, else
   * `"success"` or `"error"`, and priority derives from that status unless the state
   * sets `priority`. A `success` factory that throws moves the toast to the error state.
   * A loading toast the user closed stays closed when the promise settles.
   *
   * @returns The original promise's value, or a rejection with its error (or the error a
   *   state factory threw). The error toast does not consume the rejection.
   */
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

/** Resolved once per status at module scope — the axis is a closed six-value set. */
const STATUS_SLOTS = {
  neutral: toastVariants({ status: "neutral" }),
  error: toastVariants({ status: "error" }),
  info: toastVariants({ status: "info" }),
  success: toastVariants({ status: "success" }),
  warning: toastVariants({ status: "warning" }),
  loading: toastVariants({ status: "loading" }),
} satisfies Record<keyof typeof STATUS_ICONS, ReturnType<typeof toastVariants>>;

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
  if (options.priority !== undefined) {
    return { ...options };
  }
  if (Object.hasOwn(options, "type")) {
    return { ...options, priority: derivedPriority(options.type) };
  }
  const { priority: _priority, ...rest } = options;
  return rest;
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
 * not a `ReactNode`, and no shared guard narrows a callable.
 */
function isShorthandDescription<Data extends object>(
  value: string | ToastManagerUpdateOptions<Data>
): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: the string shorthand for `description` is a documented public contract, not an internal type guess
  return typeof value === "string";
}

function isPromiseStateFactory<Value, Data extends object>(
  value: PromiseStateInput<Value, Data>
): value is (result: Value) => string | ToastManagerUpdateOptions<Data> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: `promise()` states are documented as a value or a factory over the settled value, and the callable arm can only be told apart at runtime
  return typeof value === "function";
}

function stateOptions<Data extends object>(
  state: string | ToastManagerUpdateOptions<Data>
): ToastManagerUpdateOptions<Data> {
  return isShorthandDescription(state) ? { description: state } : state;
}

function settledStateOptions<Value, Data extends object>(
  state: PromiseStateInput<Value, Data>,
  settled: Value
): ToastManagerUpdateOptions<Data> {
  return stateOptions(isPromiseStateFactory(state) ? state(settled) : state);
}

type PrimitiveManager = {
  add: (options: PrimitiveAddOptions<object>) => string;
  update: (id: string, options: PrimitiveUpdateOptions<object>) => void;
  close: (id?: string) => void;
};

function wrapManagerMethods(manager: PrimitiveManager): CreateToastManagerReturnValue {
  const add: CreateToastManagerReturnValue["add"] = (options) => {
    // SAFETY: the adapter only writes `priority`; custom `data` is forwarded unchanged.
    return manager.add(adaptAddOptions(options));
  };
  const update: CreateToastManagerReturnValue["update"] = (id, options) => {
    // SAFETY: the adapter only writes `priority` when `type` changes; other fields pass through.
    manager.update(id, adaptUpdateOptions(options));
  };
  return {
    add,
    update,
    close: (id) => {
      manager.close(id);
    },
    // Base UI's promiseToast forces `type: "success" | "error"` over the state's own
    // type, so the lifecycle runs over the wrapped add/update, which derive priority.
    promise: (promiseValue, options) => {
      const loadingId =
        options.loading === undefined
          ? undefined
          : add({ ...stateOptions(options.loading), type: "loading" });
      const settle = <T extends object>(
        state: ToastManagerUpdateOptions<T>,
        fallback: "success" | "error"
      ) => {
        const type = state.type ?? fallback;
        if (loadingId === undefined) {
          add({ ...state, type });
          return;
        }
        // Writing `timeout` even when undefined drops a timeout the loading state set,
        // so the settled toast falls back to the provider default.
        update(loadingId, { ...state, type, timeout: state.timeout });
      };
      return promiseValue
        .then((value) => {
          settle(settledStateOptions(options.success, value), "success");
          return value;
        })
        .catch((cause: unknown) => {
          // SAFETY: the public `error` factory has always received the rejection as an
          // `Error`, as Base UI passed it through untyped; rejections are not re-parsed.
          settle(settledStateOptions(options.error, cause as Error), "error");
          return Promise.reject(cause);
        });
    },
  };
}

/**
 * Imperative toast manager for a tree under `Toast.Provider`. Returns the live
 * `toasts` array plus `add` / `update` / `close` / `promise`, which keep their
 * identity as toasts change, so effects can list them as dependencies.
 */
export function useToastManager<Data extends object = object>(): UseToastManagerReturnValue<Data> {
  const { toasts, add, update, close } = ToastPrimitive.useToastManager<Data>();
  // Base UI rebuilds its manager object whenever `toasts` changes, but the store's
  // add/update/close keep their identity. Keying the wrappers on those functions keeps
  // ours stable too, so an effect that lists `add` does not re-run after every toast.
  const methods = useMemo(
    // SAFETY: these are the primitive store's methods, typed over the caller's `Data`;
    // wrapManagerMethods forwards custom `data` unchanged, so widening it to `object` is sound.
    () => wrapManagerMethods({ add, update, close } as PrimitiveManager),
    [add, update, close]
  );
  return useMemo(() => ({ ...methods, toasts }), [methods, toasts]);
}

/** Connects a provider's store to a module manager; the returned function disconnects it. */
type ConnectToastStore = (store: PrimitiveManager) => () => void;

/**
 * Keys each manager's connect function. It is an own enumerable property, so a spread
 * copy of the manager keeps it, and the symbol stays private, so the public type does not
 * list it.
 */
const connectToastStore = Symbol("fuse.connectToastStore");

type ConnectableToastManager = CreateToastManagerReturnValue & {
  readonly [connectToastStore]?: ConnectToastStore;
};

function storeConnection(manager: CreateToastManagerReturnValue): ConnectToastStore | undefined {
  // SAFETY: the symbol is module-private, and only createToastManager writes it, always
  // with that manager's connect function.
  return (manager as ConnectableToastManager)[connectToastStore];
}

/**
 * Counts ids minted across every manager. One provider keeps its store when its
 * `toastManager` changes, so ids from two managers must not collide.
 */
let mintedToastIds = 0;

/**
 * Module-scope manager for code outside the React tree (timers, query-cache
 * listeners). Same `add` / `update` / `close` / `promise` methods as the hook,
 * with no reactive `toasts` array. Pass the result, or a spread copy of it, to
 * `<Toast.Provider toastManager={…}>`.
 *
 * The manager queues calls made before that provider connects, including calls made
 * before it mounts and calls from mount effects in its subtree, and replays them in
 * call order when it connects. `add` returns the toast id at once either way, so a
 * queued toast can still be updated or closed. A minted id is unique across managers.
 * Mount a manager in one provider at a time: the most recently connected provider
 * receives every call, and once it unmounts, calls queue again even while an earlier
 * provider stays mounted.
 */
export function createToastManager<Data extends object = object>(): CreateToastManagerReturnValue<Data> {
  let store: PrimitiveManager | undefined;
  // Every call goes through this one queue. A call made during a replay, such as from a
  // replayed toast's `onClose`, joins the end instead of overtaking calls queued earlier.
  const queued: Array<(target: PrimitiveManager) => void> = [];
  let draining = false;
  const drain = () => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (store !== undefined) {
        const call = queued.shift();
        if (call === undefined) {
          return;
        }
        call(store);
      }
    } finally {
      draining = false;
    }
  };
  const send = (call: (target: PrimitiveManager) => void) => {
    queued.push(call);
    drain();
  };
  // Fuse mints ids so a queued `add` can return one before any store exists. Like the
  // store, it treats an empty id as none.
  const mintId = () => {
    mintedToastIds += 1;
    return `fuse-toast-${mintedToastIds}`;
  };
  const connect: ConnectToastStore = (next) => {
    store = next;
    drain();
    return () => {
      if (store === next) {
        store = undefined;
      }
    };
  };
  const manager: ConnectableToastManager = {
    ...wrapManagerMethods({
      add: (options) => {
        const id = options.id === undefined || options.id === "" ? mintId() : options.id;
        send((target) => target.add({ ...options, id }));
        return id;
      },
      update: (id, options) => {
        send((target) => {
          target.update(id, options);
        });
      },
      close: (id) => {
        send((target) => {
          target.close(id);
        });
      },
    }),
    [connectToastStore]: connect,
  };
  return manager;
}

/**
 * Connects the provider's store to a module manager, replaying its queue. The Base UI
 * provider gets no `toastManager`: its subscription reads a private key and starts in
 * the provider's own effect, after every descendant's mount effect, so calls made
 * earlier were dropped. This bridge reads only the public store-backed hook and, as the
 * provider's first child, connects before any later sibling's mount effect runs. Every
 * call takes this one path, so none is delivered twice.
 *
 * Under StrictMode the replay runs on the first connection, then the provider's replayed
 * cleanup clears the store's auto-dismiss timers. The toasts keep their timeout anyway:
 * each `Toast.Root` registers its height when it mounts, in a later commit, and that
 * store write schedules the timer a toast is missing.
 */
function ToastManagerBridge({ connect }: { connect: ConnectToastStore }): null {
  // `add` / `update` / `close` are the store's own bound methods and keep their identity
  // across toast changes, so the bridge connects once per store.
  const { add, update, close } = ToastPrimitive.useToastManager();
  useEffect(() => connect({ add, update, close }), [connect, add, update, close]);
  return null;
}

export type ToastProviderProps = Omit<ComponentProps<typeof ToastPrimitive.Provider>, "toastManager"> & {
  /**
   * Optional manager from `Toast.createToastManager()` so non-React code
   * (timers, query-cache listeners) can dispatch through the same adapter as
   * `Toast.useToastManager()`. The manager queues calls made before this provider
   * connects and replays them in order.
   */
  toastManager?: CreateToastManagerReturnValue;
};

export function ToastProvider({ toastManager, children, ...props }: ToastProviderProps): ReactElement {
  const connect = toastManager === undefined ? undefined : storeConnection(toastManager);
  return (
    <ToastPrimitive.Provider {...props}>
      {connect === undefined ? null : <ToastManagerBridge connect={connect} />}
      {children}
    </ToastPrimitive.Provider>
  );
}

type ToastPlacement = NonNullable<VariantProps<typeof toastViewportVariants>["placement"]>;

type ToastSwipeDirection = NonNullable<ComponentProps<typeof ToastPrimitive.Root>["swipeDirection"]>;

/** Tailwind's `sm:` breakpoint, where a placement starts to move the stack. */
const SM_UP_MEDIA_QUERY = "(width >= 40rem)";

/**
 * Swipe-to-dismiss directions per anchored edge: toward the horizontal side the stack sits
 * on (right for center), and toward the vertical edge. Module constants keep the array
 * identity stable across renders.
 */
const SWIPE_DIRECTIONS = {
  "bottom-left": ["down", "left"],
  "bottom-right": ["down", "right"],
  "top-left": ["up", "left"],
  "top-right": ["up", "right"],
} as const satisfies Record<string, ToastSwipeDirection>;

/**
 * Placement only moves the stack from `sm` up. Below `sm` every placement renders the
 * default bottom stack, so it keeps the default down/right swipe too.
 */
function swipeDirectionFor(placement: ToastPlacement, isSmUp: boolean): ToastSwipeDirection {
  if (!isSmUp) {
    return SWIPE_DIRECTIONS["bottom-right"];
  }
  const vertical = placement.startsWith("top") ? "top" : "bottom";
  const horizontal = placement.endsWith("left") ? "left" : "right";
  return SWIPE_DIRECTIONS[`${vertical}-${horizontal}`];
}

type ToastPlacementContextValue = {
  readonly placement: ToastPlacement;
  readonly swipeDirection: ToastSwipeDirection;
};

/** Read by `Toast.Root`; a root outside a Fuse viewport keeps the bottom-right defaults. */
const ToastPlacementContext = createContext<ToastPlacementContextValue>({
  placement: "bottom-right",
  swipeDirection: SWIPE_DIRECTIONS["bottom-right"],
});

export type ToastViewportProps = ComponentProps<typeof ToastPrimitive.Viewport> &
  OverlayContainerProps & {
    /**
     * Where the toast stack sits from the `sm` breakpoint up: a top or bottom edge, aligned
     * left, center or right. A top placement stacks downward and enters from above. Toasts
     * dismiss by swiping toward the anchored edge and toward their side (right for center),
     * unless a `Toast.Root` sets `swipeDirection`. Below `sm` every placement sits at the
     * bottom, spans the screen width and swipes down or right.
     */
    placement?: VariantProps<typeof toastViewportVariants>["placement"];
  };

export function ToastViewport({
  className,
  container,
  placement = "bottom-right",
  children,
  ...props
}: ToastViewportProps): ReactElement | null {
  const isSmUp = useMediaQuery(SM_UP_MEDIA_QUERY);
  const swipeDirection = swipeDirectionFor(placement, isSmUp);
  const placementContext = useMemo(() => ({ placement, swipeDirection }), [placement, swipeDirection]);
  // The provider wraps the part, not its children: a `render` element's own children
  // replace the part's, and roots rendered there must still read the placement.
  return (
    <ToastPlacementContext value={placementContext}>
      <OverlayPortal portal={ToastPrimitive.Portal} container={container}>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className={mergeClassName(
            className,
            toastViewportVariants({ placement }),
            toastLayer,
            selfFocusRingClass
          )}
          {...props}>
          {children ?? <ToastList />}
        </ToastPrimitive.Viewport>
      </OverlayPortal>
    </ToastPlacementContext>
  );
}

/**
 * One toast. Inside `Toast.Viewport` it stacks and swipes for the viewport's `placement`;
 * an explicit `swipeDirection` replaces the placement default. It publishes `--inner-corner`,
 * its corner less its padding, for parts that round with `rounded-inner`.
 */
export function ToastRoot({
  className,
  toast,
  ...props
}: ComponentProps<typeof ToastPrimitive.Root>): ReactElement {
  const { placement, swipeDirection } = use(ToastPlacementContext);
  const status = statusFromType(toast.type);
  const { root } = STATUS_SLOTS[status];
  return (
    <ToastPrimitive.Root
      data-slot="toast-root"
      data-status={status}
      data-placement={placement}
      swipeDirection={swipeDirection}
      toast={toast}
      className={mergeClassName(className, root())}
      {...definedProps(props)}
    />
  );
}

export function ToastContent({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Content>): ReactElement {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={mergeClassName(className, content())}
      {...props}
    />
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Title>): ReactElement {
  return (
    <ToastPrimitive.Title data-slot="toast-title" className={mergeClassName(className, title())} {...props} />
  );
}

export function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Description>): ReactElement {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={mergeClassName(className, description())}
      {...props}
    />
  );
}

export function ToastAction({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Action>): ReactElement {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={mergeClassName(className, "mt-2 w-fit")}
      render={<Button size="sm" variant="outline" />}
      {...props}
    />
  );
}

export type ToastCloseProps = ComponentProps<typeof ToastPrimitive.Close> & {
  /**
   * Accessible name for the icon-only close button. An explicit `aria-label` wins over
   * it; both default to the locale dictionary `toast.close`. Visible children replace
   * the icon face and name the control themselves.
   */
  label?: string;
};

function hasVisibleChildren(children: ReactNode): boolean {
  return children != null && children !== false && children !== true && children !== "";
}

export function ToastClose({ className, label, children, ...props }: ToastCloseProps): ReactElement {
  const strings = useLocalizedStrings(overlayCloseStrings);
  const closeClassName = mergeClassName(className, "absolute top-2 right-2 text-muted-foreground");
  if (hasVisibleChildren(children)) {
    return (
      <ToastPrimitive.Close
        data-slot="toast-close"
        className={closeClassName}
        render={<Button variant="ghost" size="sm" />}
        {...props}>
        {children}
      </ToastPrimitive.Close>
    );
  }
  // The render element's props win in Base UI's merge, and Button's icon sizes require
  // aria-label, so the icon face repeats the part's resolved accessible name.
  const accessibleName = props["aria-label"] ?? label ?? strings.format("close");
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label={accessibleName}
      className={closeClassName}
      render={<Button variant="ghost" size="icon-sm" aria-label={accessibleName} />}
      {...props}>
      <X aria-hidden="true" />
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
  const { icon } = STATUS_SLOTS[status];
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
