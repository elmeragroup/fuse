/**
 * Unit under test: how SkeletonReveal keeps its ghost and leaving panes out of the page. Oracles:
 * what a form submits and whether it validates, read off `FormData`, `checkValidity` and
 * `onFormSubmit`; the live control's accessible name, label and description; and the page's
 * dialogs, focus and scroll lock, which a ghost must leave as they were.
 */
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { withLocale } from "../../../test/locale-matrix";
import { glidePointerTo } from "../../../test/pointer-press";
import {
  currentPane,
  pageScrollState,
  querySlot,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
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
    // DOM audit: the content pane has no role; on a refetch it is the one on its way out.
    const leaving = [...document.querySelectorAll('[data-slot="skeleton-reveal-content"]')];
    expect(leaving).toHaveLength(1);
    expect(leaving[0]?.textContent).toContain("Already registered");
    form.requestSubmit();
    expect(submitted).toEqual([{}, {}]);
  });
});

describe("SkeletonReveal outgoing content", () => {
  it("keeps its controls' own look while it leaves, and lets nobody focus or click them", async () => {
    const pressed: string[] = [];
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="smart">
        <div className="flex w-72 flex-col gap-2">
          <Input aria-label="Reference" defaultValue="4711" />
          <Button onClick={() => pressed.push("pay")}>Pay</Button>
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
    // Hold the pane's exit so it cannot finish, and unmount the pane, while the presses run.
    const exit = leaving.getAnimations();
    expect(exit.length).toBeGreaterThan(0);
    for (const animation of exit) animation.pause();
    // DOM audit: the outgoing pane is inert, so its controls are out of the accessibility tree.
    const input = leaving.querySelector("input");
    const button = leaving.querySelector("button");
    if (input === null || button === null) throw new Error("expected the outgoing input and button");
    await nextFrames(2);
    for (const control of [input, button]) {
      expect(control.matches(":disabled")).toBe(false);
      expect(getComputedStyle(control).opacity).toBe("1");
      control.focus();
      expect(document.activeElement).not.toBe(control);
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      expect(hit === control || control.contains(hit)).toBe(false);
      // A real press at the control's centre, through raw page coordinates, since the pane is inert.
      await glidePointerTo(control, 1);
      await commands.pointerDown();
      await commands.pointerUp();
    }
    expect(leaving.isConnected).toBe(true);
    expect(pressed).toEqual([]);
  });
});

describe("SkeletonReveal Fields", () => {
  it("keeps the ghost out of a Field that wraps the reveal: no submitted value, no validation of it", async () => {
    type Submitted = { readonly email?: string };
    const submitted: Submitted[] = [];
    const validated: unknown[] = [];
    const view = (loading: boolean, value: string) => (
      <Form<Submitted> aria-label="Account" onFormSubmit={(values) => submitted.push(values)}>
        <Field.Root
          name="email"
          validate={(candidate) => {
            validated.push(candidate);
            return null;
          }}>
          <Field.Label>Email</Field.Label>
          <SkeletonReveal loading={loading} label="Henter" reveal="together">
            <Input defaultValue={value} />
          </SkeletonReveal>
        </Field.Root>
      </Form>
    );
    const { rerender } = renderThemed(view(true, "sample@example.com"));
    const form = roleNamed("form", "Account");
    if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
    form.requestSubmit();
    expect(submitted).toEqual([{}]);
    expect(validated).not.toContain("sample@example.com");

    // Once revealed, the live input is the Field's control, as it would be without the reveal.
    rerender(view(false, "kari@example.com"));
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    form.requestSubmit();
    expect(submitted).toEqual([{}, { email: "kari@example.com" }]);
    expect(validated).toContain("kari@example.com");
    expect(validated).not.toContain("sample@example.com");
    expect(roleNamed("textbox", "Email")).toBeInstanceOf(HTMLInputElement);
  });

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
    // DOM audit: the content pane has no role; on a refetch it is the one on its way out.
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
    // DOM audit: the reveal's panes have no role; wait until the old content has left.
    await expect.poll(() => querySlot("skeleton-reveal-content")).toBeNull();
    rerender(view(false, "email-b"));
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    await nextFrames(2);
    const input = roleNamed("textbox", "Email");
    expect(input.id).toBe("email-b");
    // DOM audit: the Field's label is located by its text; its `for` names the control.
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
    // DOM audit: the reveal's panes have no role; wait until only the live content is left.
    await expect
      .poll(() => document.querySelectorAll('[data-slot="skeleton-reveal-content"]').length)
      .toBe(1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    await nextFrames(2);
    const input = roleNamed("textbox", "Email");
    expect((input.getAttribute("aria-describedby") ?? "").split(" ")).toContain("email-help");
  });
});

describe("SkeletonReveal ids", () => {
  it("resolves ids in the incoming content to its own elements while the ghost leaves", () => {
    type Account = { readonly email: string };
    const view = (data: Account | null) => (
      <SkeletonReveal data={data} sample={{ email: "sample@example.com" }} label="Henter" reveal="together">
        {(account) => (
          <div className="flex flex-col">
            <label htmlFor="reveal-email">Email</label>
            <input id="reveal-email" defaultValue={account.email} />
          </div>
        )}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    rerender(view({ email: "kari@example.com" }));
    expect(querySlot("skeleton-reveal-skeleton")).not.toBeNull();
    const live = roleNamed("textbox", "Email");
    expect(live).toBeInstanceOf(HTMLInputElement);
    if (live instanceof HTMLInputElement) expect(live.value).toBe("kari@example.com");
    // DOM audit: the label has no role of its own; it is the live content's.
    const label = currentPane("skeleton-reveal-content", slot("skeleton-reveal")).querySelector("label");
    label?.click();
    expect(document.activeElement).toBe(live);
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
