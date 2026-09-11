"use client";

import { useEffect, useState, useTransition } from "react";
import {
  attachPersonDocumentLink,
  deletePersonDocument,
  getPersonDocumentUrl,
  listPersonDocuments,
  uploadPersonDocument,
} from "@/lib/people/documents";
import {
  categoriesFor,
  formatBytes,
  MAX_DOCUMENT_BYTES,
  type DocumentSubjectType,
  type PersonDocument,
} from "@/lib/people/documents-shared";

/**
 * Documents attached to one person.
 *
 * Files never travel through the browser to storage — the upload posts to a
 * server action which checks permission and then writes with the service role.
 * Opening a document asks for a fresh signed URL each time rather than rendering
 * a stored link, so revoking someone's access actually revokes it.
 */
export function PersonDocumentsPanel({
  subjectType,
  subjectId,
  canEdit = true,
}: {
  subjectType: DocumentSubjectType;
  subjectId: string;
  canEdit?: boolean;
}) {
  const [documents, setDocuments] = useState<PersonDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"none" | "upload" | "link">("none");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    setLoading(true);
    const result = await listPersonDocuments(subjectType, subjectId);
    if ("error" in result) setError(result.error);
    else {
      setDocuments(result.documents);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, subjectId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("subject_type", subjectType);
    formData.set("subject_id", subjectId);
    const form = e.currentTarget;

    startTransition(async () => {
      const result =
        mode === "upload"
          ? await uploadPersonDocument(formData)
          : await attachPersonDocumentLink(formData);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      form.reset();
      setMode("none");
      await refresh();
    });
  }

  async function open(documentId: string) {
    const result = await getPersonDocumentUrl(documentId);
    if ("error" in result) {
      setError(result.error ?? "That document could not be opened.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function remove(doc: PersonDocument) {
    // No window.confirm — it blocks and there is no undo either way. The button
    // says what it does and the row disappears; the file is genuinely gone.
    startTransition(async () => {
      const result = await deletePersonDocument(doc.id);
      if ("error" in result && result.error) setError(result.error);
      else await refresh();
    });
  }

  const categories = categoriesFor(subjectType);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-500">
            Files and links held against this record. Uploads are private and open through a
            short-lived link.
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "upload" ? "none" : "upload")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upload a file
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "link" ? "none" : "link")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Link a Google Doc
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="mx-4 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {error}
        </div>
      ) : null}

      {mode !== "none" && canEdit ? (
        <form onSubmit={handleSubmit} className="space-y-3 border-b border-slate-100 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                name="title"
                required={mode === "link"}
                placeholder={mode === "upload" ? "Defaults to the file name" : "e.g. Signed contract"}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <input
                name="category"
                list="person-document-categories"
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <datalist id="person-document-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          {mode === "upload" ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">File</span>
              <input
                name="file"
                type="file"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Any file type, up to {formatBytes(MAX_DOCUMENT_BYTES)}.
              </span>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Link</span>
              <input
                name="external_url"
                type="url"
                required
                placeholder="https://docs.google.com/document/d/…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                JAG stores the link, not a copy. Whoever opens it still needs access in Google.
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-academy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : mode === "upload" ? "Upload" : "Attach"}
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          Nothing attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void open(doc.id)}
                  className="truncate text-sm font-medium text-academy hover:underline"
                >
                  {doc.title}
                </button>
                <p className="truncate text-xs text-slate-500">
                  {[
                    doc.category,
                    doc.source === "upload"
                      ? `${doc.fileName ?? "file"} · ${formatBytes(doc.fileSizeBytes)}`
                      : doc.source === "google_doc"
                        ? "Google Doc"
                        : "Link",
                    doc.uploadedByName ? `added by ${doc.uploadedByName}` : null,
                    new Date(doc.createdAt).toLocaleDateString(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {doc.notes ? <p className="mt-1 text-xs text-slate-600">{doc.notes}</p> : null}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  disabled={pending}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
