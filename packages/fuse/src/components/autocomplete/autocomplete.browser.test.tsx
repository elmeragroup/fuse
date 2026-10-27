import { Fragment, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  ROW,
  formNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Field } from "../field";
import { Form } from "../form/form";
import { Autocomplete } from "./index";

const FRUITS = ["Apple", "Banana", "Cherry", "Date"] as const;

type Company = { readonly name: string; readonly orgNumber: string };

const NORDLYS: Company = { name: "Nordlys Energi AS", orgNumber: "912345670" };
const FJELLKRAFT: Company = { name: "Fjellkraft AS", orgNumber: "998877665" };
const HAVBRIS: Company = { name: "Havbris Strøm AS", orgNumber: "987654321" };
const COMPANIES: readonly Company[] = [NORDLYS, FJELLKRAFT, HAVBRIS];

const EMPTY_COPY = {
  "nb-NO": "Ingen resultater.",
  "sv-SE": "Inga resultat.",
  "en-US": "No results.",
  "fi-FI": "Ei tuloksia.",
} as const;

const CLEAR_COPY = {
  "nb-NO": "Tøm teksten",
  "sv-SE": "Rensa texten",
  "en-US": "Clear text",
  "fi-FI": "Tyhjennä teksti",
} as const;

const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul forslag",
  "sv-SE": "Visa eller dölj förslag",
  "en-US": "Toggle suggestions",
  "fi-FI": "Näytä tai piilota ehdotukset",
} as const;

function renderAutocomplete(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function autocompleteNamed(name: string): HTMLInputElement {
  const element = roleNamed("combobox", name);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> combobox named ${name}`);
  }
  return element;
}

/** The field box around the input, the InputGroup that names itself a group. */
function fieldBoxOf(input: HTMLElement): HTMLElement {
  const group = input.closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error("expected an input group around the input");
  }
  return group;
}

/** Base UI mounts the popup a frame or more after the opening event, so wait for it. */
async function openedListbox(): Promise<HTMLElement> {
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  const listbox = page.getByRole("listbox").element();
  if (!(listbox instanceof HTMLElement)) {
    throw new Error("expected a listbox");
  }
  return listbox;
}

async function closedListbox(): Promise<void> {
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).toBeNull();
  });
}

function optionNames(): string[] {
  return page
    .getByRole("option")
    .elements()
    .map((option) => option.textContent);
}

function formEntries(name: string): [string, FormDataEntryValue][] {
  return [...new FormData(formNamed(name)).entries()];
}

function FruitAutocomplete({
  name,
  showTrigger,
  showClear,
  disabled,
  triggerLabel,
  clearLabel,
  empty,
}: {
  name?: string;
  showTrigger?: boolean;
  showClear?: boolean;
  disabled?: boolean;
  triggerLabel?: string;
  clearLabel?: string;
  empty?: ReactNode;
}) {
  return (
    <Autocomplete.Root items={[...FRUITS]} name={name}>
      <Autocomplete.Input
        aria-label="Fruit"
        showTrigger={showTrigger}
        showClear={showClear}
        disabled={disabled}
        triggerLabel={triggerLabel}
        clearLabel={clearLabel}
      />
      <Autocomplete.Content>
        <Autocomplete.Empty>{empty}</Autocomplete.Empty>
        <Autocomplete.List>
          {(fruit: string) => (
            <Autocomplete.Item key={fruit} value={fruit}>
              {fruit}
            </Autocomplete.Item>
          )}
        </Autocomplete.List>
      </Autocomplete.Content>
    </Autocomplete.Root>
  );
}

/** A company field that fills the organization number from the company the user picks. */
function CompanyForm() {
  const [orgNumber, setOrgNumber] = useState("");
  return (
    <form aria-label="Business">
      <Autocomplete.Root items={COMPANIES} name="company" itemToStringValue={(company) => company.name}>
        <Autocomplete.Input aria-label="Company" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(company: Company) => (
              <Autocomplete.Item
                key={company.orgNumber}
                value={company}
                onClick={() => {
                  setOrgNumber(company.orgNumber);
                }}>
                {company.name}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
      <input
        aria-label="Organization number"
        name="orgNumber"
        value={orgNumber}
        onChange={(event) => {
          setOrgNumber(event.currentTarget.value);
        }}
      />
    </form>
  );
}

type CompanyRequest = { readonly query: string } & PromiseWithResolvers<readonly Company[]>;

/**
 * A search that runs elsewhere, as the company register's does. Each change of the text starts a
 * request the test settles, `filter={null}` shows the results as given, and the request state
 * lives here, with the consumer.
 */
function CompanySearch({ requests }: { requests: CompanyRequest[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Company[]>([]);
  const [state, setState] = useState<"loading" | "failed" | "done">("done");
  return (
    <Autocomplete.Root
      items={results}
      filter={null}
      value={query}
      onValueChange={(next) => {
        setQuery(next);
        setState("loading");
        const request = { query: next, ...Promise.withResolvers<readonly Company[]>() };
        requests.push(request);
        request.promise.then(
          (found) => {
            setResults(found);
            setState("done");
          },
          () => {
            setResults([]);
            setState("failed");
          }
        );
      }}
      itemToStringValue={(company) => company.name}>
      <Autocomplete.Input aria-label="Company" />
      <Autocomplete.Status>
        {state === "done" && results.length > 0
          ? `${String(results.length)} ${results.length === 1 ? "company" : "companies"}`
          : null}
      </Autocomplete.Status>
      <Autocomplete.Content>
        <Autocomplete.Empty>
          {state === "loading"
            ? "Searching…"
            : state === "failed"
              ? "The search failed."
              : `No company matches ${query}.`}
        </Autocomplete.Empty>
        <Autocomplete.List>
          {(company: Company) => (
            <Autocomplete.Item key={company.orgNumber} value={company}>
              {company.name}
            </Autocomplete.Item>
          )}
        </Autocomplete.List>
      </Autocomplete.Content>
    </Autocomplete.Root>
  );
}

describe("Autocomplete", () => {
  it("suggests the items that contain the text, in a popup as wide as the field box, with no caret by default", async () => {
    // A box narrower than the viewport, so the available width does not clamp the popup.
    renderAutocomplete(
      <div style={{ width: 240, marginInline: 40 }}>
        <FruitAutocomplete />
      </div>
    );
    expect(page.getByRole("button").query()).toBeNull();

    const input = autocompleteNamed("Fruit");
    await userEvent.fill(input, "an");
    const listbox = await openedListbox();
    expect(optionNames()).toEqual(["Banana"]);

    // Layout widths, not client rects, so the popup's entry zoom does not scale them.
    const box = fieldBoxOf(input);
    const popup = listbox.parentElement;
    if (!(popup instanceof HTMLElement)) {
      throw new Error("expected the popup around the listbox");
    }
    expect(px(getComputedStyle(popup).width)).toBeCloseTo(box.getBoundingClientRect().width, 1);
    const positioner = popup.parentElement;
    if (!(positioner instanceof HTMLElement)) {
      throw new Error("expected the positioner around the popup");
    }
    expect(positioner.getBoundingClientRect().left).toBeCloseTo(box.getBoundingClientRect().left, 1);
  });

  it("keeps typed text that matches no item after blur and submits it under name", async () => {
    renderAutocomplete(
      <form aria-label="Order">
        <input aria-label="Note" name="note" />
        <FruitAutocomplete name="fruit" />
      </form>
    );
    const input = autocompleteNamed("Fruit");
    // Base UI hides the page outside the field from assistive technology while the popup is
    // open, so the other field is found before it opens. It sits above the field, where the
    // popup does not cover it.
    const note = roleNamed("textbox", "Note");
    await userEvent.fill(input, "Kiwi");
    await expect.element(page.getByText("No results.", { exact: true })).toBeVisible();
    expect(page.getByRole("option").query()).toBeNull();

    await userEvent.click(note);
    await closedListbox();
    expect(input.value).toBe("Kiwi");
    expect(formEntries("Order")).toEqual([
      ["note", ""],
      ["fruit", "Kiwi"],
    ]);
  });

  it("submits one entry inside a Field, under the Field's name, which wins over the Root's, or under the Root's", async () => {
    renderAutocomplete(
      <>
        <form aria-label="Field name">
          <Field.Root name="fruit">
            <Field.Label>Favourite</Field.Label>
            <Autocomplete.Root items={[...FRUITS]}>
              <Autocomplete.Input />
            </Autocomplete.Root>
          </Field.Root>
        </form>
        <form aria-label="Root name">
          <Field.Root>
            <Field.Label>Snack</Field.Label>
            <Autocomplete.Root items={[...FRUITS]} name="snack">
              <Autocomplete.Input />
            </Autocomplete.Root>
          </Field.Root>
        </form>
        <form aria-label="Both names">
          <Field.Root name="dessert">
            <Field.Label>Dessert</Field.Label>
            <Autocomplete.Root items={[...FRUITS]} name="treat">
              <Autocomplete.Input />
            </Autocomplete.Root>
          </Field.Root>
        </form>
      </>
    );
    await userEvent.fill(autocompleteNamed("Favourite"), "Kiwi");
    await userEvent.fill(autocompleteNamed("Snack"), "Plum");
    await userEvent.fill(autocompleteNamed("Dessert"), "Fig");
    expect(formEntries("Field name")).toEqual([["fruit", "Kiwi"]]);
    expect(formEntries("Root name")).toEqual([["snack", "Plum"]]);
    expect(formEntries("Both names")).toEqual([["dessert", "Fig"]]);
  });

  it("filters grouped items through each item's itemToStringValue, names each group by its Label and hides a group with no match", async () => {
    type Fruit = { readonly name: string };
    type FruitGroup = { readonly value: string; readonly items: readonly Fruit[] };
    const groups: readonly FruitGroup[] = [
      { value: "Citrus", items: [{ name: "Lemon" }, { name: "Orange" }] },
      { value: "Berries", items: [{ name: "Blueberry" }, { name: "Strawberry" }] },
      { value: "Stone fruit", items: [{ name: "Cherry" }, { name: "Plum" }] },
    ];
    renderAutocomplete(
      <Autocomplete.Root items={groups} itemToStringValue={(fruit) => fruit.name}>
        <Autocomplete.Input aria-label="Fruit" />
        <Autocomplete.Content>
          <Autocomplete.List>
            <Autocomplete.Collection>
              {(group: FruitGroup, index: number) => (
                <Fragment key={group.value}>
                  {index > 0 ? <Autocomplete.Separator /> : null}
                  <Autocomplete.Group items={group.items}>
                    <Autocomplete.Label>{group.value}</Autocomplete.Label>
                    <Autocomplete.Collection>
                      {(fruit: Fruit) => (
                        <Autocomplete.Item key={fruit.name} value={fruit}>
                          {fruit.name}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                </Fragment>
              )}
            </Autocomplete.Collection>
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
    );

    await userEvent.fill(autocompleteNamed("Fruit"), "rry");
    await openedListbox();
    expect(optionNames()).toEqual(["Blueberry", "Strawberry", "Cherry"]);
    const optionsIn = (name: string) =>
      [...roleNamed("group", name).querySelectorAll('[role="option"]')].map((option) => option.textContent);
    expect(optionsIn("Berries")).toEqual(["Blueberry", "Strawberry"]);
    expect(optionsIn("Stone fruit")).toEqual(["Cherry"]);
    expect(page.getByRole("group", { name: "Citrus", exact: true }).query()).toBeNull();
  });

  it("fills the input with a picked item and submits it, then submits the text the user edits it to", async () => {
    renderAutocomplete(
      <form aria-label="Order">
        <FruitAutocomplete name="fruit" />
      </form>
    );
    const input = autocompleteNamed("Fruit");
    await userEvent.fill(input, "Ba");
    await openedListbox();
    await userEvent.click(roleNamed("option", "Banana"));
    await closedListbox();
    expect(input.value).toBe("Banana");
    expect(formEntries("Order")).toEqual([["fruit", "Banana"]]);

    await userEvent.keyboard("s");
    expect(input.value).toBe("Bananas");
    expect(formEntries("Order")).toEqual([["fruit", "Bananas"]]);
  });

  it("submits an object item's itemToStringValue and runs its onClick, which fills another field, on Enter and on click", async () => {
    renderAutocomplete(<CompanyForm />);
    const input = autocompleteNamed("Company");

    await userEvent.fill(input, "kraft");
    await openedListbox();
    expect(optionNames()).toEqual(["Fjellkraft AS"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await closedListbox();
    expect(input.value).toBe("Fjellkraft AS");
    expect(formEntries("Business")).toEqual([
      ["company", "Fjellkraft AS"],
      ["orgNumber", "998877665"],
    ]);

    await userEvent.fill(input, "Hav");
    await openedListbox();
    await userEvent.click(roleNamed("option", "Havbris Strøm AS"));
    await closedListbox();
    expect(formEntries("Business")).toEqual([
      ["company", "Havbris Strøm AS"],
      ["orgNumber", "987654321"],
    ]);
  });

  it("is named by Field.Label through the id on Root, and a Form error marks and describes it until the user edits it", async () => {
    renderAutocomplete(
      <Form aria-label="Business" errors={{ company: "Enter the registered name." }}>
        <Field.Root name="company">
          <Field.Label>Company</Field.Label>
          <Autocomplete.Root id="company" items={COMPANIES} itemToStringValue={(company) => company.name}>
            <Autocomplete.Input />
          </Autocomplete.Root>
          <Field.Error />
        </Field.Root>
      </Form>
    );
    const input = autocompleteNamed("Company");
    expect(input.id).toBe("company");
    expect(page.getByText("Company", { exact: true }).element().getAttribute("for")).toBe("company");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await expect.element(input).toHaveAccessibleDescription("Enter the registered name.");

    await userEvent.type(input, "N");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(page.getByText("Enter the registered name.", { exact: true }).query()).toBeNull();
  });

  it("keeps the Field label and description on the input when a wrapper forwards id and ARIA props as undefined", async () => {
    renderAutocomplete(
      <Field.Root>
        <Field.Label>Fruit</Field.Label>
        <Autocomplete.Root items={[...FRUITS]}>
          <Autocomplete.Input id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
        </Autocomplete.Root>
        <Field.Description>Type any fruit.</Field.Description>
      </Field.Root>
    );
    const input = autocompleteNamed("Fruit");
    expect(input.getAttribute("aria-labelledby")).toBe(page.getByText("Fruit", { exact: true }).element().id);
    await expect.element(input).toHaveAccessibleDescription("Type any fruit.");
  });

  it("shows Empty's children for an async list's states, while a Status beside the input stays mounted across the popup opening and closing", async () => {
    const requests: CompanyRequest[] = [];
    renderAutocomplete(<CompanySearch requests={requests} />);
    const status = page.getByRole("status").element();
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");
    // Visually hidden: the popup shows the list's state.
    expect(status.getBoundingClientRect().width).toBeLessThanOrEqual(1);

    const input = autocompleteNamed("Company");
    await userEvent.fill(input, "9876");
    await openedListbox();
    await expect.element(page.getByText("Searching…", { exact: true })).toBeVisible();
    expect(requests.map((request) => request.query)).toEqual(["9876"]);

    requests[0]?.resolve([]);
    await expect.element(page.getByText("No company matches 9876.", { exact: true })).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await closedListbox();
    expect(page.getByRole("status").elements()).toEqual([status]);

    // The register matches the organization number, which no name contains, and the list shows
    // the result as given.
    await userEvent.fill(input, "987654321");
    await openedListbox();
    expect(page.getByRole("status").elements()).toContain(status);
    requests[1]?.resolve([HAVBRIS]);
    await expect.element(page.getByRole("option", { name: "Havbris Strøm AS", exact: true })).toBeVisible();
    await expect.poll(() => status.textContent).toBe("1 company");
    expect(page.getByText("Searching…", { exact: true }).query()).toBeNull();

    await userEvent.fill(input, "98");
    requests[2]?.reject(new Error("offline"));
    await expect.element(page.getByText("The search failed.", { exact: true })).toBeVisible();
    await expect.poll(() => status.textContent).toBe("");
  });

  it("opens and closes from the caret trigger, and the clear button empties the text, hides the caret and returns focus", async () => {
    renderAutocomplete(<FruitAutocomplete showTrigger showClear />);
    const trigger = roleNamed("button", TOGGLE_COPY["en-US"]);
    expect(page.getByRole("button", { name: CLEAR_COPY["en-US"], exact: true }).query()).toBeNull();

    await userEvent.click(trigger);
    await openedListbox();
    expect(optionNames()).toEqual([...FRUITS]);
    await userEvent.click(trigger);
    await closedListbox();

    const input = autocompleteNamed("Fruit");
    await userEvent.fill(input, "Ch");
    await openedListbox();
    // Base UI hides the input's sibling buttons from assistive technology while the popup is
    // open, so the clear button is found by name once it closes.
    await userEvent.keyboard("{Escape}");
    await closedListbox();
    const clear = page.getByRole("button", { name: CLEAR_COPY["en-US"], exact: true });
    await expect.element(clear).toBeVisible();
    await expect.element(trigger).not.toBeVisible();

    await userEvent.click(clear.element());
    expect(input.value).toBe("");
    await expect.element(input).toHaveFocus();
    await vi.waitFor(() => {
      expect(clear.query()).toBeNull();
    });
    await expect.element(trigger).toBeVisible();
  });

  it.each([
    ["Autocomplete.Input disabled", <FruitAutocomplete key="input" showTrigger showClear disabled />],
    [
      "Autocomplete.Root disabled",
      <Autocomplete.Root key="root" items={[...FRUITS]} defaultValue="Apple" disabled>
        <Autocomplete.Input aria-label="Fruit" showTrigger showClear />
      </Autocomplete.Root>,
    ],
    [
      "Field.Root disabled",
      <Field.Root key="field" disabled>
        <Autocomplete.Root items={[...FRUITS]} defaultValue="Apple">
          <Autocomplete.Input aria-label="Fruit" showTrigger showClear />
        </Autocomplete.Root>
      </Field.Root>,
    ],
  ])("disables the input and its buttons through %s", async (_source, node) => {
    renderAutocomplete(node);
    await expect.element(autocompleteNamed("Fruit")).toBeDisabled();
    expect(page.getByRole("button").elements().length).toBeGreaterThan(0);
    for (const button of page.getByRole("button").elements()) {
      await expect.element(button).toBeDisabled();
    }
  });

  it("does not open from a press on the field box while Autocomplete.Input is disabled", async () => {
    // A box narrower than the viewport, so the whole field box is on screen to press.
    function OpenOnPress({ disabled }: { disabled: boolean }) {
      return (
        <div style={{ width: 240 }}>
          <Autocomplete.Root items={[...FRUITS]} openOnInputClick>
            <Autocomplete.Input aria-label="Fruit" showTrigger disabled={disabled} />
            <Autocomplete.Content>
              <Autocomplete.List>
                {(fruit: string) => (
                  <Autocomplete.Item key={fruit} value={fruit}>
                    {fruit}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Content>
          </Autocomplete.Root>
        </div>
      );
    }

    /**
     * Presses the addon rail beside the caret, a part of the field box that is not a control.
     * A disabled input or button gets no mousedown, so only the field box's own handler sees it.
     */
    async function pressAddonRail(): Promise<void> {
      const rail = roleNamed("button", TOGGLE_COPY["en-US"]).parentElement;
      if (!(rail instanceof HTMLElement) || rail.getAttribute("role") !== "group") {
        throw new Error("expected the addon rail around the caret");
      }
      const box = rail.getBoundingClientRect();
      const position = { x: box.width - 1, y: box.height / 2 };
      expect(document.elementFromPoint(box.left + position.x, box.top + position.y)).toBe(rail);
      await userEvent.click(rail, { position });
    }

    // The control: the same press on an enabled field box opens the popup.
    const enabled = renderAutocomplete(<OpenOnPress disabled={false} />);
    await pressAddonRail();
    await openedListbox();
    enabled.unmount();

    renderAutocomplete(<OpenOnPress disabled />);
    await pressAddonRail();
    await nextFrames(3);
    expect(page.getByRole("listbox").query()).toBeNull();
  });

  it("renders the Empty, Clear and caret defaults in all four locales and honors copy overrides", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderAutocomplete(<FruitAutocomplete showTrigger showClear />, locale);
      expect(roleNamed("button", TOGGLE_COPY[locale])).toBeTruthy();
      await userEvent.fill(autocompleteNamed("Fruit"), "zzz");
      await expect.element(page.getByText(EMPTY_COPY[locale], { exact: true })).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await closedListbox();
      await expect
        .element(page.getByRole("button", { name: CLEAR_COPY[locale], exact: true }))
        .toBeInTheDocument();
      unmount();
    }

    renderAutocomplete(
      <FruitAutocomplete showTrigger showClear triggerLabel="Open list" clearLabel="Wipe" empty="Nothing." />,
      "nb-NO"
    );
    expect(roleNamed("button", "Open list")).toBeTruthy();
    await userEvent.fill(autocompleteNamed("Fruit"), "zzz");
    await expect.element(page.getByText("Nothing.", { exact: true })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await closedListbox();
    await expect.element(page.getByRole("button", { name: "Wipe", exact: true })).toBeInTheDocument();
  });

  it.each(DENSITIES)(
    "pads the empty state with the row metrics at %s, and collapses it while items match",
    async (density) => {
      stampDensity(density);
      try {
        renderAutocomplete(<FruitAutocomplete />);
        const input = autocompleteNamed("Fruit");
        await userEvent.fill(input, "zzz");
        const empty = await vi.waitFor(() => page.getByText("No results.", { exact: true }).element());
        const style = getComputedStyle(empty);
        expect([style.paddingTop, style.paddingLeft].map(px)).toEqual([ROW[density].py, ROW[density].px]);

        await userEvent.fill(input, "Apple");
        await expect.element(roleNamed("option", "Apple")).toBeVisible();
        // Base UI keeps the live region mounted; with no children it takes no room.
        expect(empty.isConnected).toBe(true);
        expect(empty.getBoundingClientRect().height).toBe(0);
      } finally {
        document.documentElement.removeAttribute("data-density");
      }
    }
  );

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderAutocomplete(<FruitAutocomplete />);
    const scope = host.querySelector("[data-theme-brand]");
    await userEvent.fill(autocompleteNamed("Fruit"), "a");
    const listbox = await openedListbox();
    expect(scope).not.toBeNull();
    expect(scope?.contains(listbox)).toBe(true);
  });
});
