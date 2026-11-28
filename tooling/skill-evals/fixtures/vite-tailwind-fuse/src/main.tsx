import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import { ThemeProvider } from "@elmeragroup/fuse/theme";

import App from "./App.tsx";
import "./index.css";
import { COLOR_SCHEME, THEME } from "./theme.ts";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={THEME} {...COLOR_SCHEME} injectColorSchemeScript={false}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
