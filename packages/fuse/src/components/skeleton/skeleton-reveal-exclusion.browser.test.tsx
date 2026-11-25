/**
 * Unit under test: how SkeletonReveal keeps its ghost and leaving panes out of the page. Oracles:
 * what a form submits and whether it validates, read off `FormData`, `checkValidity` and
 * `onFormSubmit`; the live control's accessible name, label and description; and the page's
 * dialogs, focus and scroll lock, which a ghost must leave as they were.
 */
import { useState } from "react";

import { createPortal } from "react-dom";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { withLocale } from "../../../test/locale-matrix";
import {
  currentPane,
  querySlot,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import { pageScrollState } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { AlertDialog } from "../alert-dialog";
import { Button } from "../button/button";
import { Command } from "../command";
import { Dialog } from "../dialog";
import { Field } from "../field";
import { Form } from "../form/form";
import { Input } from "../input/input";
import { Popover } from "../popover";
import { Sheet } from "../sheet";
import { TextField } from "../text-field/text-field";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

describe("SkeletonReveal forms", () => {
  it("keeps ghost and outgoing form controls out of their form's submission and validation", async () => {
    type Account = { readonly email: string };
    const view = (data: Account | null, loading = false) => (
      <form aria-label="Account">
        <SkeletonReveal data={data} sample={{ email: "" }} label="Henter" reveal="together" loading={loading}>
          {(account) => <input name="email" aria-label="Email" defaultValue={account.email} required />}
        </SkeletonReveal>
      </form>
    );
    const { rerender } = renderThemed(view(null));
    const form = roleNamed("form", "Account");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    // The sample's empty required input neither submits nor blocks the form.
    expect(new FormData(form).getAll("email")).toEqual([]);
    expect(form.checkValidity()).toBe(true);

    rerender(view({ email: "kari@example.com" }));
    // The ghost is still fading out beside the real input; only the real one submits.
    expect(querySlot("skeleton-reveal-skeleton")).not.toBeNull();
    expect(new FormData(form).getAll("email")).toEqual(["kari@example.com"]);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();

    rerender(view({ email: "kari@example.com" }, true));
    // A refetch: the outgoing content and the ghost drawn from it both stay out.
    expect(new FormData(form).getAll("email")).toEqual([]);
    expect(form.checkValidity()).toBe(true);
  });

  it("keeps ghost fields out of a Fuse Form's submitted values and its validation", () => {
    type Account = { readonly email: string };
    /** What the form submits: the email field's value, when a field of the form holds one. */
    type Submitted = { readonly email?: string };
    const submitted: Submitted[] = [];
    const view = (data: Account | null, sample: Account) => (
      <Form<Submitted> aria-label="Account" onFormSubmit={(values) => submitted.push(values)}>
        <SkeletonReveal data={data} sample={sample} label="Henter" reveal="together">
          {(account) => (
            <TextField
              label="Email"
              name="email"
              defaultValue={account.email}
              isInvalid={account.email === ""}
            />
          )}
        </SkeletonReveal>
      </Form>
    );
    const { rerender } = renderThemed(view(null, { email: "sample@example.com" }));
    const form = roleNamed("form", "Account");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    form.requestSubmit();
    expect(submitted).toEqual([{}]);

    // An invalid ghost field, from an empty sample, blocks nothing.
    rerender(view(null, { email: "" }));
    form.requestSubmit();
    expect(submitted).toEqual([{}, {}]);

    // Mid-reveal, only the live field submits.
    rerender(view({ email: "kari@example.com" }, { email: "" }));
    expect(querySlot("skeleton-reveal-skeleton")).not.toBeNull();
    form.requestSubmit();
    expect(submitted).toEqual([{}, {}, { email: "kari@example.com" }]);
  });

  it("keeps the form's displayed errors on ghost and leaving fields, and still leaves them out of the submit", async () => {
    type Account = { readonly email: string };
    type Submitted = { readonly email?: string };
    const submitted: Submitted[] = [];
    const view = (data: Account | null, loading = false) => (
      <Form<Submitted>
        aria-label="Account"
        errors={{ email: "Already registered" }}
        onFormSubmit={(values) => submitted.push(values)}>
        <SkeletonReveal
          data={data}
          sample={{ email: "sample@example.com" }}
          label="Henter"
          reveal="together"
          loading={loading}>
          {(account) => <TextField label="Email" name="email" defaultValue={account.email} />}
        </SkeletonReveal>
      </Form>
    );
    const { rerender } = renderThemed(view(null));
    expect(slot("skeleton-reveal-ghost").textContent).toContain("Already registered");
    const form = roleNamed("form", "Account");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    form.requestSubmit();
    expect(submitted).toEqual([{}]);

    rerender(view({ email: "kari@example.com" }));
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    // A refetch: the field on its way out keeps the error it showed.
    rerender(view({ email: "kari@example.com" }, true));
    // The content pane has no role; on a refetch it is the one on its way out.
    const leaving = [...document.querySelectorAll('[data-slot="skeleton-reveal-content"]')];
    expect(leaving).toHaveLength(1);
    expect(leaving[0]?.textContent).toContain("Already registered");
    form.requestSubmit();
    expect(submitted).toEqual([{}, {}]);
  });
});

describe("SkeletonReveal outgoing content", () => {
  it("lets nobody focus or click its controls while it leaves", async () => {
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="smart">
        <div className="flex w-72 flex-col gap-2">
          <Input aria-label="Reference" defaultValue="4711" />
          <Button>Pay</Button>
        </div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(false));
    await nextFrames(2);
    // A refetch: under `smart` the content stays on screen through the skeleton's 150 ms hold.
    rerender(view(true));
    const leaving = currentPane("skeleton-reveal-skeleton", slot("skeleton-reveal")).nextElementSibling;
    if (!(leaving instanceof HTMLElement)) throw new Error("expected the outgoing content pane");
    expect(leaving.hasAttribute("data-exiting")).toBe(true);
    // Hold the pane's exit so it cannot finish, and unmount the pane, while the checks run.
    const exit = leaving.getAnimations();
    expect(exit.length).toBeGreaterThan(0);
    for (const animation of exit) animation.pause();
    // The outgoing pane is inert, so its controls are out of the accessibility tree.
    const input = leaving.querySelector("input");
    const button = leaving.querySelector("button");
    if (input === null || button === null) throw new Error("expected the outgoing input and button");
    await nextFrames(2);
    for (const control of [input, button]) {
      control.focus();
      expect(document.activeElement).not.toBe(control);
      // A press at the control's center lands on whatever is above it, never the control.
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      expect(hit === control || control.contains(hit)).toBe(false);
    }
    expect(leaving.isConnected).toBe(true);
  });

  /** Each plan picker's version bump, by its group element, so a test can render one copy again. */
  const pickers = new WeakMap<Element, () => void>();

  /**
   * A plan picker of native radios that checks Fixed first. `uncontrolled` leaves the choice to the
   * inputs, and `controlled` keeps it in state. Each radio carries the picker's version, and
   * `remount` mounts the radios afresh whenever the version changes. `name` is the group's name.
   */
  function PlanRadios({
    radios,
    remount,
    name,
  }: {
    radios: "uncontrolled" | "controlled";
    remount: boolean;
    name: string;
  }) {
    const [version, setVersion] = useState(0);
    const [plan, setPlan] = useState("fixed");
    const radio = (value: string, label: string) => (
      <label>
        <input
          type="radio"
          name={name}
          value={value}
          data-version={version}
          {...(radios === "controlled"
            ? { checked: plan === value, onChange: () => setPlan(value) }
            : { defaultChecked: value === "fixed" })}
        />
        {label}
      </label>
    );
    return (
      <div
        role="radiogroup"
        aria-label="Plan"
        key={remount ? version : undefined}
        ref={(group) => {
          if (group !== null) pickers.set(group, () => setVersion((current) => current + 1));
        }}>
        {radio("fixed", "Fixed")}
        {radio("spot", "Spot")}
      </div>
    );
  }

  // A radio a form owns is also a named property of that form, so the names `id` and `remove` shadow
  // the private form's own `id` and `remove()`.
  it.each([
    {
      radios: "uncontrolled",
      remount: false,
      form: true,
      updates: ["both"],
      resolves: "after the exit",
      name: "plan",
    },
    {
      radios: "controlled",
      remount: false,
      form: false,
      updates: ["ghost"],
      resolves: "after the exit",
      name: "plan",
    },
    {
      radios: "controlled",
      remount: true,
      form: false,
      updates: ["outgoing", "ghost"],
      resolves: "after the exit",
      name: "plan",
    },
    {
      radios: "uncontrolled",
      remount: false,
      form: false,
      updates: ["ghost"],
      resolves: "during the fade",
      name: "plan",
    },
    {
      radios: "uncontrolled",
      remount: false,
      form: false,
      updates: ["ghost"],
      resolves: "after the exit",
      name: "id",
    },
    {
      radios: "uncontrolled",
      remount: false,
      form: false,
      updates: ["ghost"],
      resolves: "after the exit",
      name: "remove",
    },
  ] as const)(
    "keeps the selection the user made in its native radios, and leaves other radios of that name alone, while a ghost holds a checked copy ($radios, remounting: $remount, in a form: $form, updating $updates, data arriving $resolves, named $name)",
    async ({ radios, remount, form, updates, resolves, name }) => {
      const reveal = (loading: boolean) => (
        <SkeletonReveal loading={loading} label="Henter" reveal="smart">
          <PlanRadios radios={radios} remount={remount} name={name} />
        </SkeletonReveal>
      );
      // Inside a form, a checked radio of the same name outside it, in the page's form-less group.
      const view = (loading: boolean) =>
        form ? (
          <>
            <label>
              <input type="radio" name={name} value="outside" defaultChecked />
              Outside
            </label>
            <form aria-label="Plan">{reveal(loading)}</form>
          </>
        ) : (
          reveal(loading)
        );
      const { rerender } = renderThemed(view(false));
      await nextFrames(2);
      await page.getByRole("radio", { name: "Spot" }).click();
      expect(roleNamed("radio", "Spot")).toMatchObject({ checked: true });

      const forms = document.forms.length;
      // A refetch: the ghost renders a copy of the group, with Fixed checked, before the outgoing
      // content, which stays on screen through the skeleton's hold and then fades.
      rerender(view(true));
      const root = slot("skeleton-reveal");
      const ghost = slot("skeleton-reveal-ghost", root);
      const leaving = currentPane("skeleton-reveal-skeleton", root).nextElementSibling;
      if (!(leaving instanceof HTMLElement)) throw new Error("expected the outgoing content pane");
      expect(leaving.hasAttribute("data-exiting")).toBe(true);
      // Hold every animation on the pane, so the test reaches the hold and the fade at set points.
      const animations = leaving.getAnimations();
      for (const animation of animations) animation.pause();
      const exit = animations.find((animation) => (animation.effect?.getTiming().delay ?? 0) > 0);
      if (exit === undefined) throw new Error("expected the outgoing content's held exit");
      const timing = exit.effect?.getTiming();
      const delay = timing?.delay ?? 0;
      const duration = Number(timing?.duration);
      if (!(duration > 0)) throw new Error("expected a held fade");
      const radioIn = (pane: Element, value: string) => {
        const input = pane.querySelector(`input[value="${value}"]`);
        if (!(input instanceof HTMLInputElement)) throw new Error(`expected a ${value} radio`);
        return input;
      };
      const outside = document.querySelector('input[value="outside"]');
      const outsideChecked = () => (outside instanceof HTMLInputElement ? outside.checked : null);
      const selection = () => ({
        spot: radioIn(leaving, "spot").checked,
        fixed: radioIn(leaving, "fixed").checked,
        outside: outsideChecked(),
      });
      const expected = { spot: true, fixed: false, outside: form ? true : null };

      exit.currentTime = delay / 2;
      expect(radioIn(ghost, "fixed").checked, "the ghost's Fixed radio is checked").toBe(true);
      for (const update of updates) {
        const panes = update === "both" ? [ghost, leaving] : [update === "ghost" ? ghost : leaving];
        for (const pane of panes) {
          const group = pane.querySelector('[role="radiogroup"]');
          const bump = group === null ? undefined : pickers.get(group);
          if (bump === undefined) throw new Error("expected a plan picker");
          bump();
        }
        // Each updated copy commits its radios again, with the new version on them.
        for (const pane of panes)
          await expect.poll(() => radioIn(pane, "spot").getAttribute("data-version")).toBe("1");
        expect(selection(), `through the hold, after updating ${update}`).toEqual(expected);
      }
      // The outgoing radios keep their name, so author styles that select it still match.
      expect(radioIn(leaving, "spot").matches(`[name="${name}"]`), "the outgoing radio keeps its name").toBe(
        true
      );

      exit.currentTime = delay + duration / 2;
      // A frame at the fade lets anything the pane runs on the animation's progress run first.
      await nextFrames(1);
      expect(selection(), "through the fade").toEqual(expected);

      // The data can arrive before the outgoing content has gone, which mounts content that checks
      // Fixed again.
      if (resolves === "during the fade") rerender(view(false));
      const incoming = resolves === "during the fade" ? currentPane("skeleton-reveal-content", root) : null;
      // Once the outgoing content has gone, every radio left keeps its checked state, and the page
      // has the forms it had before the refetch.
      for (const animation of animations) animation.finish();
      await expect.poll(() => leaving.isConnected).toBe(false);
      expect({
        outside: outsideChecked(),
        incoming: incoming === null ? null : radioIn(incoming, "fixed").checked,
      }).toEqual({ outside: expected.outside, incoming: incoming === null ? null : true });
      expect(document.forms.length, "forms after the exit").toBe(forms);
    }
  );

  it("keeps each form's selection in its own native radios while it leaves", async () => {
    const plans = (checked: string) => (
      <form aria-label={`Plan, ${checked} first`}>
        {["fixed", "spot"].map((value) => (
          <label key={value}>
            <input type="radio" name="plan" value={value} defaultChecked={value === checked} />
            {value}
          </label>
        ))}
      </form>
    );
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="smart">
        <div>
          {plans("fixed")}
          {plans("spot")}
        </div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(false));
    await nextFrames(2);
    rerender(view(true));
    const leaving = currentPane("skeleton-reveal-skeleton", slot("skeleton-reveal")).nextElementSibling;
    if (!(leaving instanceof HTMLElement)) throw new Error("expected the outgoing content pane");
    expect(leaving.hasAttribute("data-exiting")).toBe(true);
    const checked = [...leaving.querySelectorAll("input")].filter((radio) => radio.checked);
    expect(
      checked.map((radio) => `${radio.closest("form")?.getAttribute("aria-label")}: ${radio.value}`)
    ).toEqual(["Plan, fixed first: fixed", "Plan, spot first: spot"]);
  });

  // A form named `host` is a named property of its document, so `document.host` is that form.
  it("keeps the selection in its native radios while it leaves, in a document with a form named host", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    onTestFinished(() => {
      frame.remove();
    });
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) throw new Error("expected a same-origin frame");
    const host = frameDocument.createElement("form");
    host.name = "host";
    frameDocument.body.append(host);
    const view = (loading: boolean) =>
      createPortal(
        <SkeletonReveal loading={loading} label="Henter" reveal="smart">
          <PlanRadios radios="uncontrolled" remount={false} name="plan" />
        </SkeletonReveal>,
        frameDocument.body
      );
    const { rerender } = renderThemed(view(false));
    await nextFrames(2);
    // The frame's nodes come from its own realm, which the fixtures' `instanceof` checks reject.
    const spot = frameDocument.querySelector<HTMLInputElement>('input[value="spot"]');
    if (spot === null) throw new Error("expected the Spot radio");
    spot.click();

    rerender(view(true));
    // The reveal is loading, and the radio the user picked is still on the page, checked and
    // enabled. The ghost's copy sits in a disabled fieldset, so it cannot pass for it.
    const busy = frameDocument.querySelector('[aria-busy="true"]');
    expect(busy?.contains(spot)).toBe(true);
    expect(spot.isConnected).toBe(true);
    expect(spot.checked).toBe(true);
    expect(spot.matches(":enabled")).toBe(true);
  });
});

describe("SkeletonReveal Fields", () => {
  it("renders a wrapping Field's label, description and error in the ghost and the leaving pane, still out of the form", async () => {
    type Submitted = { readonly email?: string };
    const submitted: Submitted[] = [];
    const view = (loading: boolean) => (
      <Form<Submitted> aria-label="Account" onFormSubmit={(values) => submitted.push(values)}>
        <Field.Root name="email">
          <SkeletonReveal loading={loading} label="Henter" reveal="together">
            <div className="flex w-72 flex-col gap-1">
              <Field.Label>Email</Field.Label>
              <Input defaultValue={loading ? "sample@example.com" : "kari@example.com"} />
              <Field.Description>Used for invoices</Field.Description>
              <Field.Error match>Already registered</Field.Error>
            </div>
          </SkeletonReveal>
        </Field.Root>
      </Form>
    );
    const { rerender } = renderThemed(view(true));
    const ghost = slot("skeleton-reveal-ghost");
    expect(ghost.textContent).toContain("Email");
    expect(ghost.textContent).toContain("Used for invoices");
    expect(ghost.textContent).toContain("Already registered");
    const form = roleNamed("form", "Account");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    form.requestSubmit();
    expect(submitted).toEqual([{}]);

    rerender(view(false));
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    // A refetch: the content on its way out renders the same parts under the detached Field.
    rerender(view(true));
    // The content pane has no role; on a refetch it is the one on its way out.
    const leaving = document.querySelector('[data-slot="skeleton-reveal-content"]');
    expect(leaving?.textContent).toContain("Used for invoices");
    expect(leaving?.textContent).toContain("Already registered");
    form.requestSubmit();
    expect(submitted).toEqual([{}, {}]);
  });

  it("hands a wrapping Field's label to the new content's control id once the old content has left", async () => {
    const view = (loading: boolean, id: string) => (
      <Field.Root name="email">
        <Field.Label>Email</Field.Label>
        <SkeletonReveal loading={loading} label="Henter" reveal="together">
          <div className="w-72">
            <Input id={id} />
          </div>
        </SkeletonReveal>
      </Field.Root>
    );
    const { rerender } = renderThemed(view(false, "email-a"));
    await nextFrames(2);
    rerender(view(true, "email-a"));
    // The reveal's panes have no role; wait until the old content has left.
    await expect.poll(() => querySlot("skeleton-reveal-content")).toBeNull();
    rerender(view(false, "email-b"));
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    await nextFrames(2);
    const input = roleNamed("textbox", "Email");
    expect(input.id).toBe("email-b");
    // The Field's label is located by its text; its `for` names the control.
    const label = [...document.querySelectorAll("label")].find((element) => element.textContent === "Email");
    expect(label?.htmlFor).toBe("email-b");
  });

  it("keeps the live input described by a wrapping Field's description after a fast refetch", async () => {
    const view = (loading: boolean) => (
      <Field.Root name="email">
        <Field.Label>Email</Field.Label>
        <SkeletonReveal loading={loading} label="Henter" reveal="together">
          <div className="flex w-72 flex-col gap-1">
            <Input />
            <Field.Description id="email-help">Used for invoices</Field.Description>
          </div>
        </SkeletonReveal>
      </Field.Root>
    );
    const { rerender } = renderThemed(view(false));
    await nextFrames(2);
    // A refetch, and its content back before the old content has left.
    rerender(view(true));
    rerender(view(false));
    // The reveal's panes have no role; wait until only the live content is left.
    await expect
      .poll(() => document.querySelectorAll('[data-slot="skeleton-reveal-content"]').length)
      .toBe(1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    await nextFrames(2);
    const input = roleNamed("textbox", "Email");
    expect((input.getAttribute("aria-describedby") ?? "").split(" ")).toContain("email-help");
  });
});

describe("SkeletonReveal overlays", () => {
  it("opens no overlay from the ghost: no dialog, no focus moved, no scroll lock", async () => {
    const before = renderThemed(
      <button type="button" aria-label="Outside">
        Outside
      </button>
    );
    const outside = roleNamed("button", "Outside");
    outside.focus();
    const scroll = pageScrollState();
    const dialog = (
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Confirm plan</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>
    );
    const view = (loading: boolean) =>
      withLocale(
        "en-US",
        <SkeletonReveal loading={loading} label="Henter" reveal="together">
          <div className="w-72">{dialog}</div>
        </SkeletonReveal>
      );
    const { rerender } = renderThemed(view(true));
    await nextFrames(3);
    expect(page.getByRole("dialog").query()).toBeNull();
    expect(document.activeElement).toBe(outside);
    expect(pageScrollState()).toBe(scroll);

    // The content opens its dialog for real.
    rerender(view(false));
    await expect.poll(() => page.getByRole("dialog").all().length).toBe(1);
    // A refetch: the skeleton drawn from it, and the content on its way out, open no copy.
    rerender(view(true));
    await nextFrames(3);
    expect(page.getByRole("dialog").all()).toHaveLength(0);
    await expect.poll(pageScrollState).toBe(scroll);
    before.unmount();
  });

  it("keeps every dialog-family root closed and every anchored overlay unportaled in the ghost", async () => {
    const outside = renderThemed(
      <button type="button" aria-label="Outside">
        Outside
      </button>
    );
    roleNamed("button", "Outside").focus();
    const scroll = pageScrollState();
    renderThemed(
      withLocale(
        "en-US",
        <SkeletonReveal loading label="Henter" reveal="together">
          <div className="flex w-72 flex-col gap-2">
            <AlertDialog.Root defaultOpen>
              <AlertDialog.Content title="Cancel the contract?" actionLabel="Cancel contract">
                The contract ends on 1 June.
              </AlertDialog.Content>
            </AlertDialog.Root>
            <Sheet.Root defaultOpen>
              <Sheet.Content>
                <Sheet.Title>Filters</Sheet.Title>
              </Sheet.Content>
            </Sheet.Root>
            <Popover.Root defaultOpen>
              <Popover.Trigger>Plan</Popover.Trigger>
              <Popover.Content>
                <Popover.Title>Fixed price</Popover.Title>
              </Popover.Content>
            </Popover.Root>
          </div>
        </SkeletonReveal>
      )
    );
    await nextFrames(3);
    expect(page.getByRole("alertdialog").query()).toBeNull();
    expect(page.getByRole("dialog").query()).toBeNull();
    expect(page.getByText("Fixed price").query()).toBeNull();
    expect(document.activeElement).toBe(roleNamed("button", "Outside"));
    expect(pageScrollState()).toBe(scroll);
    outside.unmount();
  });

  it("opens no Command palette from the ghost: no dialog, no scroll lock", async () => {
    const scroll = pageScrollState();
    renderThemed(
      withLocale(
        "en-US",
        <SkeletonReveal loading label="Henter" reveal="together">
          <Command.Root items={["Open invoices", "Open contracts"]} defaultOpen>
            <Command.Content>
              <Command.Input />
              <Command.List>
                {(command: string) => (
                  <Command.Item key={command} value={command}>
                    {command}
                  </Command.Item>
                )}
              </Command.List>
            </Command.Content>
          </Command.Root>
        </SkeletonReveal>
      )
    );
    await nextFrames(3);
    expect(page.getByRole("dialog").query()).toBeNull();
    expect(pageScrollState()).toBe(scroll);
  });
});
