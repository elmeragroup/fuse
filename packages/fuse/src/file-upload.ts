// Source entry facade for `@elmeragroup/fuse/file-upload` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The part classes stay module-private.
export { FileUpload } from "./components/file-upload";
export { useFileUpload } from "./components/file-upload/file-upload-context";
export type { FileUploadDescriptionProps } from "./components/file-upload/file-upload-description";
export type { FileUploadDropzoneProps } from "./components/file-upload/file-upload-dropzone";
export type { FileUploadRootProps } from "./components/file-upload/file-upload";
export type { FileUploadTriggerProps } from "./components/file-upload/file-upload-trigger";
export type { FileRejection } from "./components/file-upload/split-files";
