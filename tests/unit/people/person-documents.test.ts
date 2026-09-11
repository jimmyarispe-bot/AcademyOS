/**
 * Validation and path rules for documents attached to a person.
 *
 * The panel calls these before a round trip and the server calls the identical
 * functions, so a hand-crafted request cannot get past what the UI enforces.
 */

import { describe, expect, it } from "vitest";
import {
  categoriesFor,
  detectSource,
  documentStoragePath,
  formatBytes,
  MAX_DOCUMENT_BYTES,
  validateDocumentDraft,
  type DocumentDraft,
} from "@/lib/people/documents-shared";

function draft(overrides: Partial<DocumentDraft> = {}): DocumentDraft {
  return {
    title: "Transcript 2025-26",
    category: "Transcript",
    notes: null,
    source: "upload",
    externalUrl: null,
    fileName: "transcript.pdf",
    fileSizeBytes: 1024,
    ...overrides,
  };
}

describe("validateDocumentDraft", () => {
  it("accepts a normal upload", () => {
    expect(validateDocumentDraft(draft())).toEqual([]);
  });

  it("requires a name, so two documents are not both untitled", () => {
    const issues = validateDocumentDraft(draft({ title: "   " }));
    expect(issues.map((i) => i.field)).toContain("title");
  });

  it("rejects a file over the bucket limit, and says how big it was", () => {
    const issues = validateDocumentDraft(draft({ fileSizeBytes: MAX_DOCUMENT_BYTES + 1 }));
    expect(issues[0].field).toBe("file");
    expect(issues[0].message).toMatch(/50\.0 MB/);
  });

  it("rejects an empty file", () => {
    const issues = validateDocumentDraft(draft({ fileSizeBytes: 0 }));
    expect(issues.map((i) => i.message).join(" ")).toMatch(/empty/i);
  });

  it("rejects an upload with no file chosen", () => {
    const issues = validateDocumentDraft(draft({ fileName: null }));
    expect(issues.map((i) => i.field)).toContain("file");
  });

  it("accepts an https link", () => {
    expect(
      validateDocumentDraft(
        draft({
          source: "google_doc",
          externalUrl: "https://docs.google.com/document/d/abc/edit",
          fileName: null,
          fileSizeBytes: null,
        })
      )
    ).toEqual([]);
  });

  it("refuses a plain http link to a school record", () => {
    const issues = validateDocumentDraft(
      draft({ source: "link", externalUrl: "http://example.com/x", fileName: null, fileSizeBytes: null })
    );
    expect(issues[0].field).toBe("externalUrl");
    expect(issues[0].message).toMatch(/https:\/\//);
  });

  it("refuses a link that is not a URL at all", () => {
    const issues = validateDocumentDraft(
      draft({ source: "link", externalUrl: "the shared drive", fileName: null, fileSizeBytes: null })
    );
    expect(issues.map((i) => i.field)).toContain("externalUrl");
  });

  it("refuses a link with nothing in it", () => {
    const issues = validateDocumentDraft(
      draft({ source: "link", externalUrl: "  ", fileName: null, fileSizeBytes: null })
    );
    expect(issues.map((i) => i.field)).toContain("externalUrl");
  });
});

describe("detectSource", () => {
  it("recognises Google URLs so a pasted Doc is labelled as one", () => {
    expect(detectSource("https://docs.google.com/document/d/x/edit")).toBe("google_doc");
    expect(detectSource("https://drive.google.com/file/d/x/view")).toBe("google_doc");
    expect(detectSource("https://sheets.google.com/x")).toBe("google_doc");
  });

  it("treats everything else as a plain link", () => {
    expect(detectSource("https://dropbox.com/s/x")).toBe("link");
    // Not Google, despite the string appearing in the host.
    expect(detectSource("https://notgoogle.com/docs.google.com")).toBe("link");
  });
});

describe("documentStoragePath", () => {
  it("scopes by subject and keeps the extension so browsers can open the file", () => {
    const path = documentStoragePath("student", "stu-1", "doc-1", "Report Card.PDF");
    expect(path).toBe("student/stu-1/doc-1.pdf");
  });

  it("drops an extension that is not a plausible extension", () => {
    // A filename ending in something long or odd must not become part of the
    // stored path, where it would be attacker-influenced text in a key.
    expect(documentStoragePath("employee", "emp-1", "doc-2", "contract.verylongextension")).toBe(
      "employee/emp-1/doc-2"
    );
    expect(documentStoragePath("employee", "emp-1", "doc-3", "noextension")).toBe(
      "employee/emp-1/doc-3"
    );
  });
});

describe("categories", () => {
  it("offers staff categories for employees and student categories otherwise", () => {
    expect(categoriesFor("employee")).toContain("Teaching licence");
    expect(categoriesFor("employee")).not.toContain("IEP / 504");
    expect(categoriesFor("student")).toContain("IEP / 504");
    expect(categoriesFor("lead")).toContain("Transcript");
  });
});

describe("formatBytes", () => {
  it("reads the way a person would say it", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
