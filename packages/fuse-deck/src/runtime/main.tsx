/**
 * The deck's module entry. It loads every slide before the first render, so the first paint shows
 * the slide the URL names and every later slide change is ready to animate.
 */

import { StrictMode } from "react";

import { createRoot } from "react-dom/client";
import manifest from "virtual:fuse-deck";

import { Deck } from "./deck.tsx";

const slides = await Promise.all(
  manifest.slides.map(async (slide) => ({ ...slide, Content: (await slide.load()).default }))
);

const container = document.getElementById("deck");
if (container === null) {
  throw new Error("The deck page has no #deck element.");
}

createRoot(container).render(
  <StrictMode>
    <Deck deck={{ title: manifest.title, aspect: manifest.aspect, slides }} />
  </StrictMode>
);
