import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isStaff } from "@/lib/authz";
import { updateStudentMonthlyFee } from "@/lib/student-fees.functions";

export function StudentFeeEditor({ studentId, enrollmentId, amount, label, onSaved }: {
  studentId: string; enrollmentId?: string; amount: number; label: string; onSaved: () => void | Promise<void>;
}) {
  const { roles } = getRouteApi("/_authenticated").useRouteContext();
  const save = useServerFn(updateStudentMonthlyFee);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isStaff(roles)) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => { setValue(String(amount)); setError(null); setOpen(true); }}>
      <Pencil /> Oylikni o‘zgartirish
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Oylik to‘lovni o‘zgartirish</DialogTitle>
          <DialogDescription className="break-words">{label}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault(); setError(null);
          const monthlyFee = Number(value);
          if (!value.trim() || !Number.isFinite(monthlyFee) || monthlyFee <= 0) { setError("Noldan katta summa kiriting"); return; }
          setBusy(true);
          try {
            await save({ data: { studentId, enrollmentId, monthlyFee } });
            toast.success("Oylik to‘lov saqlandi"); setOpen(false); await onSaved();
          } catch (e) { setError(e instanceof Error ? e.message : "Saqlashda xato yuz berdi"); }
          finally { setBusy(false); }
        }}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Oylik summa (so‘m)</span>
            <input autoFocus type="number" inputMode="decimal" min="0.01" step="0.01" required value={value} disabled={busy}
              onChange={(e) => setValue(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <p className="text-xs text-muted-foreground">Yangi summa keyingi yaratiladigan oylik hisobga qo‘llanadi. Oldingi hisoblar va to‘lovlar o‘zgarmaydi.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Saqlash</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}