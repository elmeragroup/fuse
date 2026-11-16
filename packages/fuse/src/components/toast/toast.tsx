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
import { toastStrings } from "./intl";
import { toastVariants, toastViewportVariants } from "./toast-variants";

/** Resolved once at module scope, because these slots have no status axis. */
const { content, title, description } = toastVariants();

export type ToastStatus = "error" | "info" | "success" | "warning" | "loading";

type ToastPriority = "low" | "high";

export type ToastManagerAddOptions<Data extends object = object> = Omit<PrimitiveAddOptions<Data>, "type"> & {
  /**
   * The toast's status, which sets its colours and icon. Unset, the toast is neutral. It also
   * sets the default `priority`: `error` is `high`, and every other status is `low`.
   */
  type?: ToastStatus;
};

export type ToastManagerUpdateOptions<Data extends object = object> = Omit<
  PrimitiveUpdateOptions<Data>,
  "type"
> & {
  /**
   * The toast's new status. An update that sets `type` without `priority` also sets the
   * priority the new status defaults to. An update without either keeps the priority.
   * `type: undefined` makes the toast neutral with `low` priority.
   */
  type?: ToastStatus;
};

export type ToastManagerPromiseOptions<Value, Data extends object = object> = {
  /**
   * The loading toast, as a description string or an options object. Leave it out to show no
   * toast until the promise settles.
   */
  loading?: string | ToastManagerUpdateOptions<Data>;
  /**
   * The toast after the promise resolves, as a description string, an options object or a
   * function of the resolved value. A `type` it returns, such as `"warning"`, replaces
   * `"success"` and sets the priority.
   */
  success:
    | string
    | ToastManagerUpdateOptions<Data>
    | ((result: Value) => string | ToastManagerUpdateOptions<Data>);
  /**
   * The toast after the promise rejects, as a description string, an options object or a
   * function of the error. Its priority defaults to `high`, which screen readers announce at
   * once. A `type` it returns replaces `"error"` and sets the priority.
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
   * Shows a toast for the life of `promise`. With `loading`, a loading toast appears at once
   * and changes to the settled toast. Without it, the settled toast is the first one shown.
   * The settled status is the `type` that `success` or `error` returns, or else `"success"`
   * or `"error"`. The priority follows that status unless the state sets `priority`. A
   * `success` factory that throws shows the error toast. If the loading toast closes before
   * the promise settles, no settled toast appears.
   *
   * @returns A new promise. It resolves with the promise's value, or rejects with its error
   *   or with the error a state factory threw. The error toast does not handle the
   *   rejection, so handle the returned promise.
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

/** Resolved once per status at module scope, because the axis has a closed set of six values. */
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
 * The two guards below ask a runtime question about consumer input. Both used to spell it
 * `Object.prototype.toString.call(…)`, which passed the lint rule without answering it. They
 * are now `typeof` checks with a named disable.
 *
 * Neither can use the shared `isTextNode` or `isTextValueNode` helpers. Those narrow a
 * `ReactNode`, and these values are Toast's own manager unions. An options object is not a
 * `ReactNode`, and no shared guard narrows a callable.
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
 * Returns the toast manager of the nearest `Toast.Provider`. It holds the current `toasts`
 * and the `add`, `update`, `close` and `promise` methods. The methods keep their identity as
 * toasts change, so an effect can list them as dependencies.
 *
 * `promise(promise, { loading, success, error })` shows a toast for the life of `promise`.
 * With `loading`, a loading toast appears at once and changes to the settled toast. Leave
 * `loading` out to show no toast until the promise settles. The settled toast has the
 * `success` or `error` status, unless that state sets its own `type`. An `error` state that
 * returns `type: "warning"` shows a warning with `low` priority, where an error toast has
 * `high` priority. A state's own `priority` wins over its status. A `success` function that
 * throws shows the error toast. If the user or `close` closes the loading toast before the
 * promise settles, no settled toast appears.
 *
 * `promise` returns a new promise, not the one you passed. It resolves with that promise's
 * value, or rejects with its error or with the error a `success` or `error` function threw.
 * The error toast does not handle the rejection, so handle the returned promise.
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
 * Creates a toast manager for code outside the React tree, such as a timer or a query-cache
 * listener. Create it at module scope. It has the hook's `add`, `update`, `close` and
 * `promise` methods, without the `toasts` array. Pass it, or a spread copy of it, to
 * `<Toast.Provider toastManager={…}>`.
 *
 * The manager queues calls made before that provider connects, including calls made before
 * it mounts and calls from mount effects in its subtree. It replays them in call order when
 * the provider connects. `add` returns the toast id at once either way, so a queued toast can
 * still be updated or closed. A minted id is unique across managers. Mount a manager in one
 * provider at a time. The provider that connected last receives every call, and once it
 * unmounts, calls queue again even while an earlier provider stays mounted.
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
   * A manager from `Toast.createToastManager()`, for code outside React, such as a timer or a
   * query-cache listener, to raise toasts in this provider. The manager queues calls made
   * before this provider connects and replays them in order.
   */
  toastManager?: CreateToastManagerReturnValue;
  /**
   * The part of the app that raises toasts, and one `Toast.Viewport`. Use one provider and
   * one viewport for the app's notification stack.
   */
  children?: ReactNode;
};

/** Holds the toast stack for its subtree. */
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
     * Where the toast stack sits from the `sm` breakpoint up. It names the top or bottom edge
     * and a left, center or right alignment. A top placement stacks downward, and its toasts
     * slide in from above. A toast dismisses with a swipe toward its edge or toward its side,
     * or toward the right in a centered stack, unless its `Toast.Root` sets `swipeDirection`.
     * Below `sm`, every placement sits at the bottom, spans the screen width and swipes down or
     * right.
     */
    placement?: VariantProps<typeof toastViewportVariants>["placement"];
  };

/**
 * The portalled landmark region the toasts stack in, named by the locale dictionary's
 * "Notifications" unless an `aria-label` replaces it. It renders `Toast.List` when given no
 * children.
 */
export function ToastViewport({
  className,
  container,
  placement = "bottom-right",
  children,
  ...props
}: ToastViewportProps): ReactElement | null {
  const strings = useLocalizedStrings(toastStrings);
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
          // Base UI hard-codes the English "Notifications"; a consumer `aria-label` still wins
          // through the later spread, which drops undefined keys so a wrapper's unset label
          // cannot erase the default.
          aria-label={strings.format("notifications")}
          className={mergeClassName(
            className,
            toastViewportVariants({ placement }),
            toastLayer,
            selfFocusRingClass
          )}
          {...definedProps(props)}>
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

/** The toast's body, which hides behind the front toast while the stack is collapsed. */
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

/** The toast's title. Unless you pass children, it shows the toast's `title`. */
export function ToastTitle({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Title>): ReactElement {
  return (
    <ToastPrimitive.Title data-slot="toast-title" className={mergeClassName(className, title())} {...props} />
  );
}

/** The toast's description. Unless you pass children, it shows the toast's `description`. */
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

/** The toast's action, a small outline Button that renders the toast's `actionProps`. */
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
   * The accessible name of the icon close button. An `aria-label` wins over it. Unset, both
   * read `overlay.close` from the locale dictionary. Visible children replace the icon and
   * name the button themselves.
   */
  label?: string;
};

function hasVisibleChildren(children: ReactNode): boolean {
  return children != null && children !== false && children !== true && children !== "";
}

/** Closes the toast from its top-right corner. Without children, it is a ghost icon Button. */
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
