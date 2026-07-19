import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MessageSquare, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TEMPLATE =
  "Assalomu alaykum! Farzandingiz {student} bugungi {subject} darsida {rating} baho oldi ({score}/{max}). Sana: {date}. EduNest.";

export const Route = createFileRoute("/_authenticated/settings/grade-template")({
  component: GradeTemplatePage,
});

function GradeTemplatePage() {
  const [text, setText] = useState(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "parent_grade_template")
        .maybeSingle();
      const t = (data?.value as { text?: string } | null)?.text;
      if (t) setText(t);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: "parent_grade_template", value: { text }, scope: "global" },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saqlandi");
  };

  const preview = text
    .replaceAll("{student}", "Ali Valiyev")
    .replaceAll("{subject}", "Matematika")
    .replaceAll("{rating}", "Yaxshi")
    .replaceAll("{score}", "4")
    .replaceAll("{max}", "5")
    .replaceAll("{date}", new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MessageSquare className="h-5 w-5 text-primary" /> Ota-onaga baho xabari (Telegram)
        </h2>
        <p className="text-sm text-muted-foreground">
          O'qituvchi 4 rangli baho (Qoniqarsiz / Qoniqarli / Yaxshi / A'lo) qo'yganda bu shablon ota-onaga yuboriladi.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          O'rin egallovchilar
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {["{student}", "{subject}", "{rating}", "{score}", "{max}", "{date}"].map((k) => (
            <code
              key={k}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-primary"
            >
              {k}
            </code>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Xabar matni
        </label>
        <textarea
          disabled={loading}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Namuna (Yaxshi bahoda)
        </div>
        <p className="whitespace-pre-wrap text-sm">{preview}</p>
      </div>

      <div className="flex gap-2">
        <button
          disabled={saving || loading}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "..." : "Saqlash"}
        </button>
        <button
          onClick={() => setText(DEFAULT_TEMPLATE)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" /> Standart matn
        </button>
      </div>
    </div>
  );
}
