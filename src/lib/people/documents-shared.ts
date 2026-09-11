/**
 * Client-safe types and validation for documents attached to a person.
 *
 * Split from `documents.ts` for the same reason the People directory needed a
 * split: that module reaches the database through next/headers and cannot be
 * bundled into the browser. Validation lives here so the panel can refuse a bad
 * value before a round trip, and the server calls the identical function so a
 * hand-crafted request cannot get past it.
 */

/** Matches the subject_type CHECK in migration 245. */
export type DocumentSubjectType = "student" | "lead" | "employee";

export type DocumentSource = "upload" | "google_doc" | "link";

export const DOCUMENT_SUBJECT_LABELS: Record<DocumentSubjectType, string> = {
  student: "Student",
  lead: "Prospect",
  employee: "Staff",
};

/**
 * Suggested, not enforced. The column is free text on purpose — a school will
 * need a category nobody thought of, and a locked taxonomy just means everything
 * lands in "Other".
 */
export const STUDENT_DOCUMENT_CATEGORIES = [
  "Transcript",
  "Report card",
  "IEP / 504",
  "Assessment",
  "Medical",
  "Immunisation",
  "Enrollment contract",
  "Birth certificate",
  "Proof of address",
  "Funding / scholarship",
  "Correspondence",
  "Other",
] as const;

export const STAFF_DOCUMENT_CATEGORIES = [
  "Contract",
  "Offer letter",
  "Certification",
  "Teaching licence",
  "Background check",
  "I-9 / eligibility",
  "Performance review",
  "Training record",
  "Correspondence",
  "Other",
] as const;

export function categoriesFor(subjectType: DocumentSubjectType): readonly string[] {
  return subjectType === "employee" ? STAFF_DOCUMENT_CATEGORIES : STUDENT_DOCUMENT_CATEGORIES;
}

export interface PersonDocument {
  readonly id: string;
  readonly subjectType: DocumentSubjectType;
  readonly subjectId: string;
  readonly title: string;
  readonly category: string | null;
  readonly notes: string | null;
  readonly source: DocumentSource;
  readonly storagePath: string | null;
  readonly externalUrl: string | null;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly fileSizeBytes: number | null;
  readonly uploadedByName: string | null;
  readonly createdAt: string;
}

/** 50 MiB, matching the bucket's file_size_limit in migration 245. */
export const MAX_DOCUMENT_BYTES = 52_428_800;

export interface DocumentIssue {
  readonly field: "title" | "file" | "externalUrl" | "category";
  readonly message: string;
}

export interface DocumentDraft {
  title: string;
  category: string | null;
  notes: string | null;
  source: DocumentSource;
  externalUrl: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
}

export function validateDocumentDraft(draft: DocumentDraft): DocumentIssue[] {
  const issues: DocumentIssue[] = [];

  if (!draft.title.trim()) {
    // Without this the list shows an untitled row and the only way to tell two
    // documents apart is to open both.
    issues.push({ field: "title", message: "Give the document a name." });
  }

  if (draft.source === "upload") {
    if (!draft.fileName) {
      issues.push({ field: "file", message: "Choose a file to upload." });
    }
    if (draft.fileSizeBytes !== null && draft.fileSizeBytes > MAX_DOCUMENT_BYTES) {
      issues.push({
        field: "file",
        message: `That file is ${formatBytes(draft.fileSizeBytes)}. The limit is ${formatBytes(
          MAX_DOCUMENT_BYTES
        )}.`,
      });
    }
    if (draft.fileSizeBytes === 0) {
      issues.push({ field: "file", message: "That file is empty." });
    }
  } else {
    const url = (draft.externalUrl ?? "").trim();
    if (!url) {
      issues.push({ field: "externalUrl", message: "Paste the link to the document." });
    } else if (!/^https:\/\//i.test(url)) {
      // http:// links to a school record are worth refusing outright.
      issues.push({
        field: "externalUrl",
        message: "The link must start with https:// — paste the whole address.",
      });
    } else {
      try {
        new URL(url);
      } catch {
        issues.push({ field: "externalUrl", message: "That link could not be read as a URL." });
      }
    }
  }

  return issues;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Recognise a Google URL so the panel can label it, and so pasting a Doc link
 * into the "link" field still records it as what it is.
 */
export function detectSource(url: string): DocumentSource {
  return /^https:\/\/(docs|drive|sheets|slides)\.google\.com\//i.test(url.trim())
    ? "google_doc"
    : "link";
}

/** Storage path inside the private bucket. Scoped by subject so a listing is cheap. */
export function documentStoragePath(
  subjectType: DocumentSubjectType,
  subjectId: string,
  documentId: string,
  fileName: string
): string {
  // Keep the original extension — it is what tells a browser how to open the
  // file when the signed URL is followed.
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const safeExt = /^\.[A-Za-z0-9]{1,12}$/.test(ext) ? ext.toLowerCase() : "";
  return `${subjectType}/${subjectId}/${documentId}${safeExt}`;
}
