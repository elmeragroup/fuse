import { createElement as h, useState } from "react";
import type { ChangeEvent } from "react";

import { createRoot } from "react-dom/client";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import "@elmeragroup/fuse/styles.css";
import { LocaleProvider } from "@elmeragroup/fuse/theme";
import "@elmeragroup/fuse/themes.css";

function App() {
  const [country, setCountry] = useState<"NO" | "SE">("NO");
  return h(LocaleProvider, {
    locale: "en-US",
    children: h(
      "div",
      null,
      h(
        "select",
        {
          id: "country-choice",
          "aria-label": "Country",
          value: country,
          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
            setCountry(event.target.value === "SE" ? "SE" : "NO"),
        },
        h("option", { value: "NO" }, "Norway"),
        h("option", { value: "SE" }, "Sweden")
      ),
      h(PhoneNumberField, { key: country, defaultCountryCode: country, "aria-label": "Phone" })
    ),
  });
}

const container = document.getElementById("app");
if (container === null) throw new Error("Missing app container");
createRoot(container).render(h(App));
