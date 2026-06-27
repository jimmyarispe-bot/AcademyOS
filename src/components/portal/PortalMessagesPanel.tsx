"use client";

import { useTransition } from "react";
import { sendPortalMessageAction, startPortalConversationAction } from "@/lib/portal/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

interface PortalMessagesPanelProps {
  conversations: {
    id: string;
    subject: string;
    category: string;
    last_message_at: string | null;
    students?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }[];
  messages: {
    id: string;
    body: string;
    sender_user_id: string | null;
    created_at: string;
    message_category: string;
  }[];
  selectedConversationId?: string;
  students: { id: string; first_name: string; last_name: string }[];
  currentUserId: string;
}

export function PortalMessagesPanel({
  conversations,
  messages,
  selectedConversationId,
  students,
  currentUserId,
}: PortalMessagesPanelProps) {
  const [pending, startTransition] = useTransition();
  const selected = conversations.find((c) => c.id === selectedConversationId);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-1">
        <h2 className="font-semibold">Conversations</h2>
        <ul className="mt-3 space-y-2">
          {conversations.map((c) => {
            const st = Array.isArray(c.students) ? c.students[0] : c.students;
            return (
              <li key={c.id}>
                <a
                  href={`/portal/messages?conversation=${c.id}`}
                  className={`block rounded-lg px-3 py-2 text-sm ${selectedConversationId === c.id ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50"}`}
                >
                  <p className="font-medium">{c.subject}</p>
                  <p className="text-xs capitalize text-slate-500">{c.category.replace(/_/g, " ")}{st ? ` · ${st.first_name}` : ""}</p>
                </a>
              </li>
            );
          })}
          {!conversations.length && <li className="text-sm text-slate-500">No messages yet.</li>}
        </ul>

        <form
          className="mt-6 space-y-2 border-t border-slate-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await startPortalConversationAction(new FormData(e.currentTarget));
            });
          }}
        >
          <h3 className="text-sm font-medium">New message</h3>
          <select name="student_id" required className={inputClass}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <select name="category" className={inputClass}>
            <option value="teacher">Teacher</option>
            <option value="therapist">Therapist</option>
            <option value="finance">Finance</option>
            <option value="admissions">Admissions</option>
            <option value="school_leader">School leader</option>
            <option value="general">General</option>
          </select>
          <input name="subject" placeholder="Subject" required className={inputClass} />
          <textarea name="body" placeholder="Message" required rows={3} className={inputClass} />
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">Send</button>
        </form>
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
        {selected ? (
          <>
            <h2 className="font-semibold">{selected.subject}</h2>
            <ul className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.sender_user_id === currentUserId ? "ml-8 bg-brand-50" : "mr-8 bg-slate-50"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const fd = new FormData(e.currentTarget);
                  fd.set("conversation_id", selected.id);
                  await sendPortalMessageAction(fd);
                  e.currentTarget.reset();
                });
              }}
            >
              <input type="hidden" name="conversation_id" value={selected.id} />
              <input name="body" placeholder="Reply…" required className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Send</button>
            </form>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">Select a conversation or start a new message.</p>
        )}
      </section>
    </div>
  );
}
