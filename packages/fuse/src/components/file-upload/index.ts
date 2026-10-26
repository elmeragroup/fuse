import { FileUploadRoot } from "./file-upload";
/**
 * Server-visible namespace for `FileUpload`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference.
 */
import { FileUploadDescription } from "./file-upload-description";
import { FileUploadDropzone } from "./file-upload-dropzone";
import { FileUploadTrigger } from "./file-upload-trigger";

export const FileUpload = {
  Root: FileUploadRoot,
  Dropzone: FileUploadDropzone,
  Trigger: FileUploadTrigger,
  Description: FileUploadDescription,
};
