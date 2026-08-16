import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createManagedUser } from "@/lib/user-admin.functions";
import { generateUsername, generateAccessCode } from "@/lib/credentials";
import { Camera, Copy, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

/** Quick teacher creation: makes the auth login + teacher role, so the new
 *  teacher shows up in the teachers list automatically. */
export function NewTeacherModal({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const create = useServerFn(createManagedUser);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", username: "", access_code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; access_code: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  /** Rasmni brauzerda 256px kvadratga siqib, kichik data-URL sifatida saqlaymiz. */
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Faqat rasm fayli"); return; }
    const bitmap = await createImageBitmap(file);
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
  };

  const regenerate = () =>
    setForm((f) => ({
      ...f,
      username: generateUsername(f.first_name, f.last_name, f.phone),
      access_code: generateAccessCode(8),
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const full_name = `${form.first_name} ${form.last_name}`.trim();
    const username = (form.username || generateUsername(form.first_name, form.last_name, form.phone)).trim().toLowerCase();
    const access_code = form.access_code || generateAccessCode(8);
    try {
      const res = await create({
        data: { username, access_code, full_name, phone: form.phone || null, role: "teacher", avatar_url: photo },
      });
      if (!res.ok) { setError(res.error ?? "Xatolik"); return; }
      setCreated({ username: res.username!, access_code: res.access_code! });
      toast.success("O'qituvchi yaratildi va ro'yxatga qo'shildi");
      onDone?.();
    } catch (err: any) {
      setError(err?.message ?? "Xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yangi o'qituvchi</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Login ma'lumotlarini o'qituvchiga bering (bir marta ko'rsatiladi):</p>
            {([["Login", created.username], ["Parol", created.access_code]] as const).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{k}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  {v}
                  <button onClick={() => { navigator.clipboard.writeText(v); toast.success("Nusxalandi"); }}>
                    <Copy className="h-3.5 w-3.5 text-primary" />
                  </button>
                </span>
              </div>
            ))}
            <button onClick={onClose} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground">
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary">
                {photo ? (
                  <img src={photo} alt="O'qituvchi rasmi" className="h-16 w-16 object-cover" width={64} height={64} />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary">
                  <Camera className="h-3.5 w-3.5" /> Rasm tanlash
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
                </label>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="ml-2 text-xs text-destructive">O'chirish</button>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">Ixtiyoriy. Profil ro'yxatida ko'rinadi.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Ism" value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <input placeholder="Familiya" value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            </div>
            <input placeholder="Telefon" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <div className="flex gap-2">
              <input placeholder="Login (avtomatik)" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm" />
              <input placeholder="Parol (avtomatik)" value={form.access_code}
                onChange={(e) => setForm({ ...form, access_code: e.target.value })}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm" />
              <button type="button" onClick={regenerate} className="rounded-lg border border-border px-3" title="Yaratish">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {loading ? "..." : "Yaratish"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
