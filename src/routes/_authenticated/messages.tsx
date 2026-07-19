import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, Send, User, Clock, CheckCheck } from "lucide-react";
import {
  listMessageThreads,
  getMessageThread,
  replyToParent,
  markThreadRead,
} from "@/lib/parent-messaging.functions";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const listFn = useServerFn(listMessageThreads);
  const getFn = useServerFn(getMessageThread);
  const replyFn = useServerFn(replyToParent);
  const markFn = useServerFn(markThreadRead);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<{ studentId: string; teacherId: string } | null>(null);
  const [draft, setDraft] = useState("");

  const threadsQ = useQuery({
    queryKey: ["ptm-threads"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
  });

  const threadQ = useQuery({
    queryKey: ["ptm-thread", selected?.studentId, selected?.teacherId],
    queryFn: () => getFn({ data: selected! }),
    enabled: !!selected,
    refetchInterval: 10_000,
  });

  const replyM = useMutation({
    mutationFn: (message: string) =>
      replyFn({ data: { studentId: selected!.studentId, teacherId: selected!.teacherId, message } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["ptm-thread"] });
      qc.invalidateQueries({ queryKey: ["ptm-threads"] });
    },
  });

  const markM = useMutation({
    mutationFn: () => markFn({ data: selected! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ptm-threads"] }),
  });

  const openThread = (t: { studentId: string; teacherId: string; unread: number }) => {
    setSelected({ studentId: t.studentId, teacherId: t.teacherId });
    if (t.unread > 0) markM.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Ota-ona xabarlari</h1>
          <p className="text-sm text-muted-foreground">Ota-onalar bilan Telegram bot orqali yozishmalar</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="glass rounded-2xl border border-primary/10 p-2 h-[70vh] overflow-y-auto">
          {threadsQ.isLoading && <div className="p-4 text-sm text-muted-foreground">Yuklanmoqda...</div>}
          {!threadsQ.isLoading && (threadsQ.data ?? []).length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Hozircha xabarlar yo'q.</div>
          )}
          {(threadsQ.data ?? []).map((t) => (
            <button
              key={t.key}
              onClick={() => openThread(t)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-primary/5 ${
                selected?.studentId === t.studentId && selected?.teacherId === t.teacherId ? "bg-primary/10" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.studentName}</span>
                {t.unread > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {t.unread}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">👨‍🏫 {t.teacherName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {t.last?.sender_role === "parent" ? "👨‍👩‍👧 " : "↩️ "}
                {t.last?.message}
              </div>
            </button>
          ))}
        </aside>

        <section className="glass rounded-2xl border border-primary/10 flex flex-col h-[70vh]">
          {!selected ? (
            <div className="m-auto text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-2">Yozishmani tanlang</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(threadQ.data ?? []).map((m) => {
                  const mine = m.sender_role === "teacher";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                          {mine ? <CheckCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          <span>{mine ? "Siz" : "Ota-ona"}</span>
                          <Clock className="h-3 w-3 ml-1" />
                          <span>{new Date(m.created_at).toLocaleString("uz-UZ", { hour12: false })}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); if (draft.trim()) replyM.mutate(draft.trim()); }}
                className="border-t border-primary/10 p-3 flex gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ota-onaga javob yozing..."
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || replyM.isPending}
                  className="rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
