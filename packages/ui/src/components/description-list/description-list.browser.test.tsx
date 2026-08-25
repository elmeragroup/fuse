import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { DescriptionList } from "./description-list";

function slot(name: string): HTMLElement {
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

function headingNamed(name: string, level?: 1 | 2 | 3 | 4 | 5 | 6): HTMLElement {
  const element = page.getByRole("heading", { name, exact: true, level }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a heading named ${name}`);
  }
  return element;
}

function renderBasicList() {
  renderThemed(
    <DescriptionList.Root>
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        <DescriptionList.Term>Meter point</DescriptionList.Term>
        <DescriptionList.Details>7070575000</DescriptionList.Details>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}

describe("DescriptionList", () => {
  it("renders a heading, a dl, and alternating terms and details in DOM order", () => {
    renderBasicList();
    const heading = headingNamed("Customer", 2);
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("description-list-heading");
    expect(heading.getAttribute("data-slot")).not.toBe("heading");

    const content = slot("description-list-content");
    expect(content.tagName).toBe("DL");
    const terms = [...content.querySelectorAll("dt")];
    const details = [...content.querySelectorAll("dd")];
    expect(terms.map((term) => term.textContent)).toEqual(["Name", "Meter point"]);
    expect(details.map((item) => item.textContent)).toEqual(["Kari Nordmann", "7070575000"]);
    expect(content.children[0]).toBe(terms[0]);
    expect(content.children[1]).toBe(details[0]);
    expect(content.children[2]).toBe(terms[1]);
    expect(content.children[3]).toBe(details[1]);
  });

  it("resolves term and definition roles where the platform exposes them", () => {
    renderBasicList();
    const terms = page.getByRole("term").elements();
    const definitions = page.getByRole("definition").elements();
    if (terms.length > 0) {
      expect(terms.map((term) => term.textContent)).toEqual(["Name", "Meter point"]);
    }
    if (definitions.length > 0) {
      expect(definitions.map((item) => item.textContent)).toEqual(["Kari Nordmann", "7070575000"]);
    }
    expect(slot("description-list-term").tagName).toBe("DT");
    expect(slot("description-list-details").tagName).toBe("DD");
  });

  it("lets a render override change the heading level without losing classes or data-slot", () => {
    renderThemed(
      <DescriptionList.Root>
        <DescriptionList.Heading>Customer</DescriptionList.Heading>
        <DescriptionList.Heading render={<h3 />}>Section</DescriptionList.Heading>
      </DescriptionList.Root>
    );
    const defaultHeading = headingNamed("Customer", 2);
    expect(defaultHeading.tagName).toBe("H2");
    expect(defaultHeading.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["font-heading", "text-lg", "leading-snug", "font-medium", "text-inherit"])
    );
    const override = headingNamed("Section", 3);
    expect(override.tagName).toBe("H3");
    expect(override.getAttribute("data-slot")).toBe("description-list-heading");
    expect(override.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["font-heading", "text-lg", "leading-snug", "font-medium", "text-inherit"])
    );
  });

  it("passes Root attributes through and adds no classes of its own", () => {
    renderThemed(
      <DescriptionList.Root id="customer" data-track="profile">
        <DescriptionList.Heading>Customer</DescriptionList.Heading>
      </DescriptionList.Root>
    );
    const root = slot("description-list");
    expect(root.tagName).toBe("DIV");
    expect(root.id).toBe("customer");
    expect(root.getAttribute("data-track")).toBe("profile");
    expect(root.className).toBe("");
  });

  it("lets a consumer className win over Details base classes", () => {
    renderThemed(
      <DescriptionList.Content>
        <DescriptionList.Details className="text-primary">Kari Nordmann</DescriptionList.Details>
      </DescriptionList.Content>
    );
    const details = slot("description-list-details");
    const classes = details.className.split(/\s+/);
    expect(classes).toContain("text-primary");
    expect(classes).not.toContain("text-foreground");
    expect(classes).toContain("py-2");
  });

  it("forms two columns at sm with the term column capped at min(50%, 20rem)", async () => {
    await page.viewport(1280, 720);
    renderThemed(
      <DescriptionList.Content style={{ width: 800 }}>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        <DescriptionList.Term>Address</DescriptionList.Term>
        <DescriptionList.Details>Storgata 1, 3611 Kongsberg</DescriptionList.Details>
      </DescriptionList.Content>
    );
    const content = slot("description-list-content");
    const terms = [...content.querySelectorAll('[data-slot="description-list-term"]')].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const details = [...content.querySelectorAll('[data-slot="description-list-details"]')].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const [firstTerm, secondTerm] = terms;
    const [firstDetails, secondDetails] = details;
    if (
      firstTerm === undefined ||
      secondTerm === undefined ||
      firstDetails === undefined ||
      secondDetails === undefined
    ) {
      throw new Error("expected two terms and two details");
    }

    expect(getComputedStyle(content).display).toBe("grid");
    const firstTermBox = firstTerm.getBoundingClientRect();
    const firstDetailsBox = firstDetails.getBoundingClientRect();
    expect(firstDetailsBox.left).toBeGreaterThan(firstTermBox.right - 1);
    expect(Math.abs(firstTermBox.top - firstDetailsBox.top)).toBeLessThan(2);
    expect(firstTermBox.width).toBeLessThanOrEqual(320);
    expect(firstTermBox.width).toBeGreaterThan(300);

    expect(getComputedStyle(firstTerm).borderTopWidth).toBe("0px");
    expect(getComputedStyle(firstDetails).borderTopWidth).toBe("0px");
    expect(getComputedStyle(secondTerm).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(secondDetails).borderTopWidth).not.toBe("0px");
  });
});
