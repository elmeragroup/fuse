/**
 * Unit under test: how SkeletonReveal keeps its ghost and leaving panes out of the page. Oracles:
 * what a form submits and whether it validates, read off `FormData`, `checkValidity` and
 * `onFormSubmit`; the live control's accessible name, label and description; and the page's
 * dialogs, focus and scroll lock, which a ghost must leave as they were.
 */
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  currentPane,
  querySlot,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { Field } from "../field";
import { Form } from "../form/form";
import { Input } from "../input/input";
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
      // A press at the control's centre lands on whatever is above it, never the control.
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      expect(hit === control || control.contains(hit)).toBe(false);
    }
    expect(leaving.isConnected).toBe(true);
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
