import { useState } from "react";
import type { ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import { Form as AriaForm, FormValidationContext } from "react-aria-components";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { cellNamed, describedTextsFor, segmentNamed } from "../../../test/rac-calendar-testing";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Form } from "../../components/form/form";
import type { FormProps } from "../../components/form/form";
import { TextField } from "../../components/text-field/text-field";
import { DateField } from "../date-field/date-field";
import { DatePicker } from "../date-picker/date-picker";
import { DateRangePicker } from "../date-range-picker/date-range-picker";
import { SearchField } from "../search-field/search-field";
import { UiProviders } from "../ui-providers/ui-providers";

const june2 = new CalendarDate(2026, 6, 2);

function render(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/** The issue's fixture: a Base UI TextField beside each interim React Aria field in one Form. */
function Booking({ errors, children }: { errors?: FormProps["errors"]; children?: ReactNode }) {
  return (
    <Form aria-label="Booking" errors={errors}>
      <TextField name="email" label="Email" />
      <DatePicker name="startDate" label="Start date" defaultValue={june2} />
      <DateField name="dueDate" label="Due date" />
      <DateRangePicker startName="from" endName="to" label="Stay" />
      <SearchField name="query" label="Search" />
      {children}
    </Form>
  );
}

const ALL_ERRORS = {
  email: "Enter a work address.",
  startDate: "Pick a later date.",
  dueDate: "Pick a due date.",
  to: "The stay is fully booked.",
  query: "Search for something else.",
};

/** A date field's segment group; RAC names it after the field label. */
function dateGroup(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group ${name}`);
  }
  return element;
}

/** The RAC root around a date group, which carries `data-invalid`. */
function dateRoot(name: string): HTMLElement {
  const root = dateGroup(name).parentElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected the root around ${name}`);
  }
  return root;
}

/**
 * The texts that describe a control, less the "Selected Date: …" summary RAC adds to a picker
 * with a value, so what is left is the field's error.
 */
function errorTexts(element: HTMLElement): string[] {
  return describedTextsFor(element).filter((text) => !text.startsWith("Selected "));
}

/** Each field's described error, or `null`, and whether it is marked invalid. */
function fieldStates() {
  const email = roleNamed("textbox", "Email");
  const search = roleNamed("searchbox", "Search");
  const date = (name: string) => ({
    invalid: dateRoot(name).hasAttribute("data-invalid"),
    texts: errorTexts(dateGroup(name)),
  });
  return {
    email: { invalid: email.getAttribute("aria-invalid") === "true", texts: errorTexts(email) },
    startDate: date("Start date"),
    dueDate: date("Due date"),
    stay: date("Stay"),
    query: { invalid: search.getAttribute("aria-invalid") === "true", texts: errorTexts(search) },
  };
}

async function pickDay(field: string, day: RegExp) {
  await userEvent.click(page.getByRole("button", { name: new RegExp(`^calendar.*${field}`, "i") }));
  await userEvent.click(cellNamed(day));
}

describe("Form errors on the interim React Aria fields", () => {
  it("shows each field's error under its name and marks it invalid, the range under either endpoint", () => {
    render(<Booking errors={ALL_ERRORS} />);
    expect(fieldStates()).toEqual({
      email: { invalid: true, texts: ["Enter a work address."] },
      startDate: { invalid: true, texts: ["Pick a later date."] },
      dueDate: { invalid: true, texts: ["Pick a due date."] },
      stay: { invalid: true, texts: ["The stay is fully booked."] },
      query: { invalid: true, texts: ["Search for something else."] },
    });
  });

  it("clears only the edited field's error, keeps it cleared through a sibling's edit, and shows a new errors object", async () => {
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>(ALL_ERRORS);
      return (
        <Booking errors={errors}>
          <button type="button" onClick={() => setErrors({ ...ALL_ERRORS })}>
            Resubmit
          </button>
        </Booking>
      );
    }
    render(<Fixture />);

    await pickDay("Start date", /Tuesday, June 9, 2026/);
    await expect.poll(() => fieldStates().startDate).toEqual({ invalid: false, texts: [] });
    expect(fieldStates().email.texts).toEqual(["Enter a work address."]);
    expect(fieldStates().dueDate.texts).toEqual(["Pick a due date."]);

    // The text field's edit makes a new errors object; the picker's cleared error stays cleared.
    await userEvent.fill(roleNamed("textbox", "Email"), "kari@example.com");
    await expect.poll(() => fieldStates().email).toEqual({ invalid: false, texts: [] });
    expect(fieldStates().startDate).toEqual({ invalid: false, texts: [] });

    await userEvent.type(roleNamed("searchbox", "Search"), "x");
    await expect.poll(() => fieldStates().query).toEqual({ invalid: false, texts: [] });

    await userEvent.click(segmentNamed("month, Due date"));
    await userEvent.keyboard("07142026");
    await expect.poll(() => fieldStates().dueDate).toEqual({ invalid: false, texts: [] });

    await userEvent.click(segmentNamed("month, Start Date, Stay"));
    await userEvent.keyboard("07142026");
    await userEvent.click(segmentNamed("month, End Date, Stay"));
    await userEvent.keyboard("07172026");
    await expect.poll(() => fieldStates().stay).toEqual({ invalid: false, texts: [] });
    expect(fieldStates().startDate).toEqual({ invalid: false, texts: [] });

    await userEvent.click(roleNamed("button", "Resubmit"));
    await expect
      .poll(() => fieldStates().startDate)
      .toEqual({ invalid: true, texts: ["Pick a later date."] });
    expect(fieldStates()).toEqual({
      email: { invalid: true, texts: ["Enter a work address."] },
      startDate: { invalid: true, texts: ["Pick a later date."] },
      dueDate: { invalid: true, texts: ["Pick a due date."] },
      stay: { invalid: true, texts: ["The stay is fully booked."] },
      query: { invalid: true, texts: ["Search for something else."] },
    });
  });

  it("keeps an explicit errorMessage ahead of the Form error, and isInvalid as the caller passes it", () => {
    render(
      <Form
        aria-label="Booking"
        errors={{ startDate: "Pick a later date.", query: "Search for something else." }}>
        <DatePicker name="startDate" label="Start date" errorMessage="Choose a weekday." />
        <SearchField name="query" label="Search" isInvalid={false} />
        <DateField name="dueDate" label="Due date" isInvalid errorMessage="Due dates are closed." />
      </Form>
    );
    expect(errorTexts(dateGroup("Start date"))).toEqual(["Choose a weekday."]);
    expect(dateRoot("Start date")).toHaveAttribute("data-invalid");
    expect(roleNamed("searchbox", "Search").getAttribute("aria-invalid")).toBeNull();
    expect(errorTexts(roleNamed("searchbox", "Search"))).toEqual([]);
    expect(errorTexts(dateGroup("Due date"))).toEqual(["Due dates are closed."]);
  });

  it("shows a range's errors under its start name, its end name or both, and clears both on a change", async () => {
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>({
        from: "Arrive later.",
        to: "Leave earlier.",
        email: "Enter an email.",
      });
      return (
        <Form aria-label="Booking" errors={errors}>
          <TextField name="email" label="Email" />
          <DateRangePicker startName="from" endName="to" label="Stay" />
          <button
            type="button"
            onClick={() => setErrors({ from: "Arrive later.", email: "Enter an email." })}>
            Start only
          </button>
        </Form>
      );
    }
    render(<Fixture />);
    expect(errorTexts(dateGroup("Stay"))).toEqual(["Arrive later. Leave earlier."]);

    await userEvent.click(segmentNamed("month, Start Date, Stay"));
    await userEvent.keyboard("07142026");
    await userEvent.click(segmentNamed("month, End Date, Stay"));
    await userEvent.keyboard("07172026");
    await expect.poll(() => errorTexts(dateGroup("Stay"))).toEqual([]);
    // Clearing the email error makes a new errors object; the range's cleared keys stay cleared.
    await userEvent.fill(roleNamed("textbox", "Email"), "kari@example.com");
    await expect.poll(() => errorTexts(roleNamed("textbox", "Email"))).toEqual([]);
    expect(errorTexts(dateGroup("Stay"))).toEqual([]);

    await userEvent.click(roleNamed("button", "Start only"));
    await expect.poll(() => errorTexts(dateGroup("Stay"))).toEqual(["Arrive later."]);
    expect(dateRoot("Stay")).toHaveAttribute("data-invalid");
  });

  it("keeps an outer React Aria context's errors for names the Fuse Form leaves out", () => {
    render(
      <FormValidationContext.Provider value={{ startDate: "Taken by another booking." }}>
        <Form aria-label="Booking" errors={{ query: "Search for something else." }}>
          <DatePicker name="startDate" label="Start date" />
          <SearchField name="query" label="Search" />
        </Form>
      </FormValidationContext.Provider>
    );
    expect(errorTexts(dateGroup("Start date"))).toEqual(["Taken by another booking."]);
    expect(errorTexts(roleNamed("searchbox", "Search"))).toEqual(["Search for something else."]);
  });

  it("keeps a picker's edit clearing an error both an outer React Aria context and the Fuse Form hold", async () => {
    const errors = { startDate: "Pick a later date." };
    render(
      <FormValidationContext.Provider value={errors}>
        <Form aria-label="Booking" errors={errors}>
          <TextField name="email" label="Email" />
          <DatePicker name="startDate" label="Start date" defaultValue={june2} />
        </Form>
      </FormValidationContext.Provider>
    );
    expect(errorTexts(dateGroup("Start date"))).toEqual(["Pick a later date."]);
    await pickDay("Start date", /Tuesday, June 9, 2026/);
    await expect.poll(() => errorTexts(dateGroup("Start date"))).toEqual([]);
    await userEvent.fill(roleNamed("textbox", "Email"), "kari@example.com");
    expect(errorTexts(dateGroup("Start date"))).toEqual([]);
  });

  it("keeps React Aria's own server errors outside a Fuse Form", async () => {
    render(
      <AriaForm validationErrors={{ startDate: "Taken by another booking." }}>
        <DatePicker name="startDate" label="Start date" defaultValue={june2} />
      </AriaForm>
    );
    expect(errorTexts(dateGroup("Start date"))).toEqual(["Taken by another booking."]);
    await pickDay("Start date", /Tuesday, June 9, 2026/);
    await expect.poll(() => errorTexts(dateGroup("Start date"))).toEqual([]);
  });
});
