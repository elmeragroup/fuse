"use client";

import { Component, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefObject, SetStateAction } from "react";

// Base UI's own Form and Field wiring, as the phone field uses it: the contexts every Field and
// control joins its form through.
import { FieldRootContext, useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { FormContext, useFormContext } from "@base-ui/react/internals/form-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";

import { isFocusRoot } from "../../internal/dom-node";
import { OverlayExclusionContext, useOverlayExcluded } from "../../internal/overlay-exclusion";
import { useOwnLabelableScope } from "./skeleton-reveal-labelable";
import type { LabelableValue } from "./skeleton-reveal-labelable";

/**
 * A Field write that does nothing, for a control detached from the Field around it. It is not Base
 * UI's `NOOP`. Base UI reads `setValidityData === NOOP` as "no Field here", in
 * `internals/field-root-context`, and its Label, Description and Error then throw, so the
 * detached context must keep a write of its own to stay a Field's context.
 */
function ignoreWrite(): void {
  // The write is dropped, because the Field this control stands in for is not the one it would
  // report to.
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
 * The Field's labelable scope as a live pane sees it. Every registration goes through to the
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
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- SetStateAction is a value or an updater
      recorded.current.label = typeof action === "function" ? action(recorded.current.label) : action;
      fieldSetLabel(action);
    },
    [fieldSetLabel]
  );
  const setMessageIds = useCallback(
    (action: SetStateAction<string[]>) => {
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- SetStateAction is a value or an updater
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

/** Props for `RadioGroupIsolation`. */
type RadioGroupIsolationProps = {
  /** Whether the pane is content on its way out. */
  readonly leaving: boolean;
  /** The pane's fieldset, which holds its radios. */
  readonly scope: RefObject<HTMLFieldSetElement | null>;
  readonly children: ReactNode;
};

/** The native radios. HTML matches the `type` attribute without regard to case. */
const RADIOS = 'input[type="radio"]';

/** How many private radio forms this module has made, which numbers the next one's id. */
let radioForms = 0;

/** A private radio form, with the id its radios name. */
type PrivateRadioForm = { readonly element: HTMLFormElement; readonly id: string };

/**
 * Makes an empty form that nobody sees or submits, with an id no other element in `fieldset`'s
 * tree has, and appends it to that tree, which is the shadow root that holds `fieldset` or else the
 * document's body. The id is kept beside the form because a radio named `id` that the form owns
 * would shadow `form.id`.
 */
function privateRadioForm(fieldset: HTMLFieldSetElement): PrivateRadioForm {
  const { ownerDocument } = fieldset;
  const root = fieldset.getRootNode();
  // Compared with the document, not tested for `host`, which an element named `host` puts on it.
  const shadow = isFocusRoot(root) && root !== ownerDocument ? root : null;
  let id: string;
  do {
    radioForms += 1;
    id = `fuse-skeleton-reveal-radios-${radioForms}`;
  } while ((shadow ?? ownerDocument).getElementById(id) !== null);
  const form = ownerDocument.createElement("form");
  form.id = id;
  form.hidden = true;
  // An author rule such as `form { display: grid }` would otherwise give it a box.
  form.style.display = "none";
  form.setAttribute("aria-hidden", "true");
  // A `dialog` form outside a dialog submits nowhere, and the listener also cancels the submit
  // event that `requestSubmit()` fires, so a consumer's autosave on a leaving radio never navigates.
  form.method = "dialog";
  form.addEventListener("submit", (event) => event.preventDefault());
  (shadow ?? ownerDocument.body).append(form);
  return { element: form, id };
}

/**
 * The pane's content, with its native radios moved into groups of their own once it starts
 * leaving. It is package-private. Radios share a group only when they share a tree, a name and a
 * form owner, and a `form` attribute makes the form with that id in the radio's tree the owner.
 * So for each form owner the pane's radios have, none included, the class makes one private form
 * and points those radios at it. Radios that shared a group still share one, apart from the rest
 * of the page, and they keep their `name`, so author styles still match.
 *
 * It works in `getSnapshotBeforeUpdate` because that runs before the commit changes the DOM, so
 * the radios have moved before React inserts the ghost, whose checked copy of a group would
 * otherwise take the selection away from the content the user still sees. A class component is
 * the only kind with such a lifecycle. A mutation observer on the fieldset moves radios that mount
 * in the pane later.
 *
 * It has three known limits. The observer runs after the commit, so a checked radio that mounts in
 * the leaving pane can uncheck a radio on screen before it moves. A radio whose `form` prop changes
 * there joins that form's group again, since the observer watches only for added nodes. A required
 * group split across the pane's edge can match `:invalid` while the pane leaves.
 *
 * The radios are still connected when the pane unmounts, and removing the private forms would put
 * them back in a live group. So the class unchecks them first, which fires no event.
 */
class RadioGroupIsolation extends Component<RadioGroupIsolationProps, Record<string, never>, null> {
  /** The leaving pane's fieldset, from the moment it starts leaving. */
  private fieldset: HTMLFieldSetElement | null = null;
  /** The private form for each form owner the pane's radios had, with `null` for none. */
  private readonly forms = new Map<HTMLFormElement | null, PrivateRadioForm>();
  private observer: MutationObserver | null = null;

  override getSnapshotBeforeUpdate(previous: RadioGroupIsolationProps): null {
    const fieldset = this.props.scope.current;
    if (previous.leaving || !this.props.leaving || fieldset === null) return null;
    this.fieldset = fieldset;
    this.claim(fieldset);
    this.observer = new MutationObserver(() => this.claim(fieldset));
    this.observer.observe(fieldset, { childList: true, subtree: true });
    return null;
  }

  override componentDidUpdate(): void {
    // React logs an error for a `getSnapshotBeforeUpdate` without a `componentDidUpdate`.
  }

  override componentWillUnmount(): void {
    this.observer?.disconnect();
    if (this.fieldset !== null && this.forms.size > 0) {
      for (const radio of this.fieldset.querySelectorAll<HTMLInputElement>(RADIOS)) radio.checked = false;
    }
    // A radio named `remove` that the form owns shadows `form.remove`.
    for (const { element } of this.forms.values()) Element.prototype.remove.call(element);
    this.forms.clear();
  }

  override render(): ReactNode {
    return this.props.children;
  }

  /** Points each radio in `fieldset` that has not moved yet at the private form for its form owner. */
  private claim(fieldset: HTMLFieldSetElement): void {
    const moved = new Set([...this.forms.values()].map(({ element }) => element));
    for (const radio of fieldset.querySelectorAll<HTMLInputElement>(RADIOS)) {
      const owner = radio.form;
      if (owner !== null && moved.has(owner)) continue;
      let form = this.forms.get(owner);
      if (form === undefined) {
        form = privateRadioForm(fieldset);
        this.forms.set(owner, form);
        moved.add(form.element);
      }
      radio.setAttribute("form", form.id);
    }
  }
}

/**
 * How a pane is kept out of the page: not at all for the content on screen, as the skeleton's
 * ghost, unseen and excluded in server HTML with no script, or as content on its way out, which is
 * still seen.
 */
type PaneExclusionKind = false | "ghost" | "leaving";

/**
 * The listed form controls other than radios, which `RadioGroupIsolation` moves. A listed control
 * takes a form owner and so a `form` attribute.
 */
const LISTED_CONTROLS = 'button, fieldset, input:not([type="radio"]), object, output, select, textarea';

/**
 * Keeps a pane that is not the content on screen, a SkeletonReveal's ghost or content on its way
 * out, out of the page's forms and overlays, while it still looks the same. It is package-private.
 *
 * - Forms: the ghost sits in a disabled fieldset, which removes every native control under it
 *   from submission and constraint validation in server HTML too, before any script runs; it is
 *   unseen behind its bones, so the disabled look its controls take never shows. Content on its
 *   way out is still seen, and a disabled control takes Fuse's disabled look, so its fieldset is
 *   `inert` instead, which has no look, and a layout effect sets `form=""` on every listed control
 *   under it but its radios as it starts leaving. A control whose `form` names no form has no
 *   form owner, so it is neither submitted nor validated, nor any form's default button. A leaving
 *   pane never comes back, so nothing restores the attribute. Either fieldset is
 *   `display: contents`, with no box,
 *   and `role="none"` keeps it out of the accessibility tree. Fuse's `Form`, which is Base UI's,
 *   serializes and validates its own registry of Fields instead, which every Field joins through
 *   the form context, disabled or not, so an excluded pane hands its Fields a registry of their own
 *   that no form reads. The form's displayed errors pass through read-only, so an excluded field shows the
 *   error the field it stands for shows, and takes its height; clearing one is a no-op. A Field
 *   around the reveal reaches an excluded control through the Field context instead, so that is
 *   detached too. The control keeps the Field's name, invalid state and validity for its look,
 *   while registering, validating and reporting touched, dirty, filled or focused state do
 *   nothing.
 * - Radios: content on its way out moves its native radios into groups of their own; see
 *   `RadioGroupIsolation`.
 * - Labels: a live pane registers its controls, label and messages in the Field's labelable scope
 *   through a recording scope, which takes back exactly those registrations when the pane is
 *   excluded. An excluded pane registers in a labelable scope of its own, so a copy never claims
 *   the Field's label, and one on its way out never leaves its control id registered or removes a
 *   description id the content on screen also uses.
 * - Overlays: the overlay exclusion renders no Fuse overlay portal, and keeps a dialog-family root
 *   that mounts here closed, in `internal/overlay-exclusion.ts`. Exclusions nest, so content
 *   inside an excluded pane stays excluded.
 *
 * The providers are always rendered, so a content pane that starts leaving keeps its DOM and
 * state. Its Fields move from the form's registry to the excluded one.
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
      <RadioGroupIsolation leaving={leaving} scope={fieldsetRef}>
        {children}
      </RadioGroupIsolation>
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
