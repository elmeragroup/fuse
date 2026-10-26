import { cn } from "../../styles/cn";

/**
 * Positions the overlay close button in the popup's top-right corner, 16px in from each edge.
 * Dialog and Sheet add it to `OverlayCloseButton`. It lives apart from the button, which imports
 * an icon, so the workspace-only recipe catalog can re-export it for the Figma component sync.
 */
export const overlayCornerCloseClass = cn("absolute top-4 right-4");
