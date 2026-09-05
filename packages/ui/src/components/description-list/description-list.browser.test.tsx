import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { headingNamed, renderThemed, textNamed } from "../../../test/themed-browser-render";
import { DescriptionList } from "./description-list";

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

    const content = heading.nextElementSibling;
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the description list content");
    }
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
    expect(textNamed("Name").tagName).toBe("DT");
    expect(textNamed("Kari Nordmann").tagName).toBe("DD");
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
    expect(defaultHeading.getAttribute("data-slot")).toBe("description-list-heading");
    const override = headingNamed("Section", 3);
    expect(override.tagName).toBe("H3");
    expect(override.getAttribute("data-slot")).toBe("description-list-heading");
    expect(getComputedStyle(defaultHeading).fontFamily).toBe(getComputedStyle(override).fontFamily);
    expect(getComputedStyle(defaultHeading).fontSize).toBe(getComputedStyle(override).fontSize);
  });

  it("passes Root attributes through and adds no classes of its own", () => {
    renderThemed(
      <DescriptionList.Root id="customer" data-track="profile">
        <DescriptionList.Heading>Customer</DescriptionList.Heading>
      </DescriptionList.Root>
    );
    const root = document.getElementById("customer");
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the description-list root");
    }
    expect(root.tagName).toBe("DIV");
    expect(root.getAttribute("data-track")).toBe("profile");
    expect(root.className).toBe("");
  });

  it("lets a consumer className win over Details base classes", () => {
    renderThemed(
      <DescriptionList.Content>
        <DescriptionList.Details className="text-primary">Kari Nordmann</DescriptionList.Details>
      </DescriptionList.Content>
    );
    const details = textNamed("Kari Nordmann");
    expect(details.tagName).toBe("DD");
    expect(getComputedStyle(details).paddingTop).not.toBe("0px");
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
    const content = textNamed("Name").closest("dl");
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the description list");
    }
    const terms = [...content.querySelectorAll("dt")].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const details = [...content.querySelectorAll("dd")].filter(
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
