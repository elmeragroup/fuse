import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tabs } from "./index";

describe("Tabs SSR markup", () => {
  it("stamps data-orientation on Root in SSR markup before hydration", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Tabs.Root,
        { defaultValue: "account", orientation: "vertical" },
        createElement(
          Tabs.List,
          null,
          createElement(Tabs.Trigger, { value: "account" }, "Account"),
          createElement(Tabs.Trigger, { value: "password" }, "Password")
        ),
        createElement(Tabs.Content, { value: "account" }, "Account panel"),
        createElement(Tabs.Content, { value: "password" }, "Password panel")
      )
    );
    expect(markup).toContain('data-slot="tabs"');
    expect(markup).toContain('data-orientation="vertical"');
    expect(markup).toContain('data-slot="tabs-list"');
    expect(markup).toContain('data-variant="default"');
  });
});
