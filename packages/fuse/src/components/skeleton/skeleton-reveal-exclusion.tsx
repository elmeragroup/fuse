"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode, SetStateAction } from "react";

// Base UI's own Form and Field wiring, as the phone field uses it: the contexts every Field and
// control joins its form through.
import { FieldRootContext, useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { FormContext, useFormContext } from "@base-ui/react/internals/form-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";

import { OverlayExclusionContext, useOverlayExcluded } from "../../internal/overlay-exclusion";
import { useOwnLabelableScope } from "./skeleton-reveal-labelable";
import type { LabelableValue } from "./skeleton-reveal-labelable";

/**
 * A Field write that does nothing, for a control detached from the Field around it. Not Base UI's
 * `NOOP`: Base UI reads `setValidityData === NOOP` as "no Field here"
 * (`internals/field-root-context`), and its Label, Description and Error then throw, so the
 * detached context must keep a write of its own to stay a Field's context.
 */
function ignoreWrite(): void {
  // Detached: the Field this control stands in for is not the one it would report to.
}

/** What a live pane registered in the Field's labelable scope, so it can take exactly that back. */
type LabelableRecord = {
  /** The control ids, by the source each control registered under. */
  readonly controls: Map<symbol, string | null>;
  /** The label id the pane last set, while it has one set. */
  label: string | undefined;
  /** The message ids the pane added, one entry per registration. */
  messages: string[];
};

/** `list` without one occurrence of each of `ids`, so another registration of the same id stays. */
function withoutOnce(list: readonly string[], ids: readonly string[]): string[] {
  const remaining = [...list];
  for (const id of ids) {
    const index = remaining.indexOf(id);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

/**
 * The Field's labelable scope as a live pane sees it: every registration goes through to the
 * Field's scope, and the pane remembers what it registered. Base UI's controls, labels and
 * messages unregister through callbacks that read the context current when they run, so once a
 * pane switches to a scope of its own, their cleanup reaches that scope, not the Field's. The
 * pane takes back exactly what it registered as it switches instead, bound to the scope that
 * accepted it: its control ids, the label id it set, and one occurrence of each message id, so a
 * copy the content on screen registered under the same id stays.
 *
 * @param field - The Field's labelable scope around the reveal.
 * @param excluded - Whether the pane has stopped being the content on screen.
 * @returns The scope to give the live pane.
 */
function useRecordingLabelableScope(field: LabelableValue, excluded: boolean): LabelableValue {
  const recorded = useRef<LabelableRecord>({ controls: new Map(), label: undefined, messages: [] });
  const {
    registerControlId: fieldRegister,
    setLabelId: fieldSetLabel,
    setMessageIds: fieldSetMessages,
  } = field;
  const registerControlId = useCallback(
    (source: symbol, id: string | null | undefined) => {
      if (id === undefined) recorded.current.controls.delete(source);
      else recorded.current.controls.set(source, id);
      fieldRegister(source, id);
    },
    [fieldRegister]
  );
  const setLabelId = useCallback(
    (action: SetStateAction<string | undefined>) => {
      // Base UI's label sets its id outright; an updater is applied to what this pane set.
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- React's SetStateAction is a value or an updater function
      recorded.current.label = typeof action === "function" ? action(recorded.current.label) : action;
      fieldSetLabel(action);
    },
    [fieldSetLabel]
  );
  const setMessageIds = useCallback(
    (action: SetStateAction<string[]>) => {
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- React's SetStateAction is a value or an updater function
      recorded.current.messages = typeof action === "function" ? action(recorded.current.messages) : action;
      fieldSetMessages(action);
    },
    [fieldSetMessages]
  );

  // Runs after the pane's own parts have moved to its own scope in the same commit, so nothing
  // registers in the Field's scope again once this has taken it back.
  useLayoutEffect(() => {
    if (!excluded) return;
    for (const source of recorded.current.controls.keys()) fieldRegister(source, undefined);
    recorded.current.controls.clear();
    const label = recorded.current.label;
    if (label !== undefined) fieldSetLabel((current) => (current === label ? undefined : current));
    recorded.current.label = undefined;
    const messages = recorded.current.messages;
    if (messages.length > 0) fieldSetMessages((current) => withoutOnce(current, messages));
    recorded.current.messages = [];
  }, [excluded, fieldRegister, fieldSetLabel, fieldSetMessages]);

  return useMemo(
    () => ({ ...field, registerControlId, setLabelId, setMessageIds }),
    [field, registerControlId, setLabelId, setMessageIds]
  );
}

/**
 * How a pane is kept out of the page: not at all for the content on screen, as the skeleton's
 * ghost, unseen and excluded in server HTML with no script, or as content on its way out, which is
 * still seen.
 */
type PaneExclusionKind = false | "ghost" | "leaving";

/** The listed form controls, which take a form owner and so a `form` attribute. */
const LISTED_CONTROLS = "button, fieldset, input, object, output, select, textarea";

/**
 * Package-private. Keeps a pane that is not the content on screen, a SkeletonReveal's ghost or
 * content on its way out, out of the page's forms and overlays, while it still looks the same.
 *
 * - Forms: the ghost sits in a disabled fieldset, which removes every native control under it
 *   from submission and constraint validation in server HTML too, before any script runs; it is
 *   unseen behind its bones, so the disabled look its controls take never shows. Content on its
 *   way out is still seen, and a disabled control takes Fuse's disabled look, so its fieldset is
 *   `inert` instead, which has no look, and a layout effect sets `form=""` on every listed control
 *   under it as it starts leaving: a control whose `form` names no form has no form owner, so it
 *   is neither submitted nor validated, nor any form's default button. A leaving pane never comes
 *   back, so nothing restores the attribute. Either fieldset is `display: contents`, with no box,
 *   and `role="none"` keeps it out of the accessibility tree. Fuse's `Form` (Base UI's) serializes
 *   and validates its own registry of Fields instead, which every Field joins through the form
 *   context, disabled or not, so an excluded pane hands its Fields a registry of their own that no
 *   form reads. The form's displayed errors pass through read-only, so an excluded field shows the
 *   error the field it stands for shows, and takes its height; clearing one is a no-op. A Field
 *   around the reveal reaches an excluded control through the Field context instead, so that is
 *   detached too: the control keeps the Field's name, invalid state and validity for its look,
 *   while registering, validating and reporting touched, dirty, filled or focused state do
 *   nothing.
 * - Labels: a live pane registers its controls, label and messages in the Field's labelable scope
 *   through a recording scope, which takes back exactly those registrations when the pane is
 *   excluded. An excluded pane registers in a labelable scope of its own, so a copy never claims
 *   the Field's label, and one on its way out never leaves its control id registered or removes a
 *   description id the content on screen also uses.
 * - Overlays: the overlay exclusion renders no Fuse overlay portal, and keeps a dialog-family root
 *   that mounts here closed (`internal/overlay-exclusion.ts`). An exclusion nests: content inside
 *   an excluded pane stays excluded.
 *
 * The providers are always rendered, so a content pane that starts leaving keeps its DOM and
 * state: its Fields move from the form's registry to the excluded one.
 *
 * @param props - Whether the pane is excluded, as the skeleton's ghost or as content on its way
 *   out, and its content.
 * @returns The content, wrapped in the exclusion's providers and fieldset.
 */
export function PaneExclusion({
  excluded: exclusion,
  children,
}: {
  excluded: PaneExclusionKind;
  children: ReactNode;
}): ReactElement {
  const excluded = exclusion !== false;
  const form = useFormContext();
  const field = useFieldRootContext();
  const overlaysExcluded = useOverlayExcluded();
  const fieldLabels = useLabelableContext();
  const liveLabels = useRecordingLabelableScope(fieldLabels, excluded);
  // Null only if Base UI changed how its labelable provider renders: the pane then shares the
  // Field's scope, as before it had one of its own, rather than failing to render.
  const ownScope = useOwnLabelableScope();
  const [registry] = useState<FormContext["formRef"]>(() => ({ current: { fields: new Map() } }));
  const isolated = useMemo<FormContext>(
    () => ({
      ...form,
      formRef: registry,
      clearErrors: () => undefined,
      elementRef: { current: null },
      submitCountRef: { current: 0 },
    }),
    [form, registry]
  );
  // Outside any Field the context is Base UI's default, which reports nothing to detach from.
  const insideField = field.setValidityData !== NOOP;
  const detachedField = useMemo<FieldRootContext>(
    () => ({
      ...field,
      setValidityData: ignoreWrite,
      setTouched: ignoreWrite,
      setDirty: ignoreWrite,
      setFilled: ignoreWrite,
      setFocused: ignoreWrite,
      focusOwnerRef: { current: undefined },
      shouldValidateOnChange: () => false,
      registerFieldControl: NOOP,
      validation: {
        ...field.validation,
        inputRef: { current: null },
        registeredInputs: new Map(),
        registerInput: NOOP,
        getInputControl: () => null,
        commit: () => Promise.resolve(),
        change: NOOP,
      },
    }),
    [field]
  );
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const leaving = exclusion === "leaving";
  useLayoutEffect(() => {
    const fieldset = fieldsetRef.current;
    if (!leaving || fieldset === null) return;
    for (const control of fieldset.querySelectorAll(LISTED_CONTROLS)) control.setAttribute("form", "");
  }, [leaving]);
  const fieldset = (
    <fieldset
      ref={fieldsetRef}
      data-slot="skeleton-reveal-fieldset"
      role="none"
      disabled={exclusion === "ghost"}
      inert={leaving}
      className="contents">
      {children}
    </fieldset>
  );
  return (
    <FormContext.Provider value={excluded ? isolated : form}>
      <FieldRootContext.Provider value={excluded && insideField ? detachedField : field}>
        <OverlayExclusionContext.Provider value={excluded || overlaysExcluded}>
          {ownScope === null ? (
            fieldset
          ) : (
            <ownScope.Provider value={excluded ? ownScope.own : liveLabels}>{fieldset}</ownScope.Provider>
          )}
        </OverlayExclusionContext.Provider>
      </FieldRootContext.Provider>
    </FormContext.Provider>
  );
}
