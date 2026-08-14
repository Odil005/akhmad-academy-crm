import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Plus, X, DoorOpen, Power } from "lucide-react";
import { toast } from "sonner";

type Room = {
  id: string;
  name: string;
  capacity: number;
  floor: string | null;
  notes: string | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/rooms")({
  component: RoomsPage,
});

function RoomsPage() {
  const { roles } = Route.useRouteContext();
  const isStaff = roles.includes("director") || roles.includes("admin");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rooms")
      .select("id, name, capacity, floor, notes, is_active")
      .order("name");
    setRooms((data as Room[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (room: Room) => {
    if (room.is_active) {
      const { count, error } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("is_active", true);
      if (error) return toast.error(error.message);
      const warning = count
        ? `Bu xonada ${count} ta faol dars bor. Xona faolsiz holatga o'tkazilsinmi?`
        : "Xona faolsiz holatga o'tkazilsinmi?";
      if (!confirm(warning)) return;
    } else if (!confirm("Xona yana faol holatga o'tkazilsinmi?")) {
      return;
    }
    const { error } = await supabase
      .from("rooms")
      .update({ is_active: !room.is_active })
      .eq("id", room.id);
    if (error) return toast.error(error.message);
    toast.success(room.is_active ? "Xona faolsiz qilindi" : "Xona faollashtirildi");
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Xonalar</h1>
          <p className="text-sm text-muted-foreground">O'quv xonalari va sig'imi</p>
        </div>
        {isStaff && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Xona qo'shish
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Hozircha xona yo'q
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <DoorOpen className="h-8 w-8 text-primary" />
                {isStaff && (
                  <button
                    onClick={() => void toggleActive(r)}
                    className={
                      r.is_active
                        ? "text-amber-600 hover:opacity-70"
                        : "text-emerald-600 hover:opacity-70"
                    }
                    title={r.is_active ? "Faolsiz qilish" : "Faollashtirish"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold">{r.name}</h3>
              <p className="text-sm text-muted-foreground">
                {r.floor ? `${r.floor}-qavat · ` : ""}Sig'im: {r.capacity}
              </p>
              {r.notes && <p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>}
              {!r.is_active && (
                <div className="mt-3 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  Faol emas
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <NewRoomModal
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewRoomModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", capacity: 20, floor: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("rooms").insert({
      name: form.name,
      capacity: form.capacity,
      floor: form.floor || null,
      notes: form.notes || null,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yangi xona</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nomi">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              placeholder="203-xona"
            />
          </Field>
          <Field label="Sig'im">
            <input
              required
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
            />
          </Field>
          <Field label="Qavat">
            <input
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              placeholder="2"
            />
          </Field>
          <Field label="Izoh">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
              placeholder="Proyektor bor"
            />
          </Field>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
