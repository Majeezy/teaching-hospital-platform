// Shared between actions/documents.ts, the upload token route, and the
// client upload component -- kept out of actions/documents.ts itself
// because a "use server" file may only export async functions, not
// plain constants.
export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
