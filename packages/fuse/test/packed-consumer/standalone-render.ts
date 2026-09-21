import { createElement as h } from "react";

import process from "node:process";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "@elmeragroup/fuse/button";
import { Input } from "@elmeragroup/fuse/input";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { Textarea } from "@elmeragroup/fuse/textarea";
import { LocaleProvider } from "@elmeragroup/fuse/theme";

process.stdout.write(
  renderToStaticMarkup(
    h(LocaleProvider, {
      locale: "en-US",
      children: h(
        "div",
        { id: "host", style: { width: 200 } },
        h(Input, { id: "input", "aria-label": "Input" }),
        h(Button, { id: "button" }, "Button"),
        h(Button, { id: "link-button", render: h("a", { href: "#" }) }, "Link"),
        h(InputGroup.Root, { id: "group" }, h(InputGroup.Input, { "aria-label": "Grouped" })),
        h("div", { id: "number" }, h(NumberField, { "aria-label": "Number" })),
        h("div", { id: "phone" }, h(PhoneNumberField, { "aria-label": "Phone" })),
        h(Textarea, { id: "textarea", "aria-label": "Text", defaultValue: "One\nTwo\nThree\nFour\nFive" })
      ),
    })
  )
);
