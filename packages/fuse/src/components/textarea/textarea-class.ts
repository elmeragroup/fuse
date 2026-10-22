import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";

/** Textarea's field box: at least 64px tall, growing with its text through `field-sizing-content`. */
export const textareaClass = cn(fieldBox({ box: "content" }), "flex field-sizing-content");
