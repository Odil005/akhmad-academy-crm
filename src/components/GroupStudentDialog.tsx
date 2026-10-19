import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { emitDataChanged } from '@/lib/data-events';

type Group = { id: string; name: string; monthly_fee: number; subject_id: string | null; teacher_id: string | null };
type Candidate = { id: string; first_name: string | null; last_name: string | null; parent_phone: string | null };

export function GroupStudentDialog({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ first: '', last: '', phone: '', fee: String(group.monthly_fee) });

  useEffect(() => {
    let cancelled = false;
    if (mode !== 'existing') return;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError('');
      let query = supabase.from('students').select('id, first_name, last_name, parent_phone').order('first_name').limit(30);
      const words = search.replace(/[,()%_.*"\\]/g, ' ').trim().slice(0, 64).split(/\s+/).filter(Boolean);
      for (const word of words) query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,full_name.ilike.%${word}%,parent_phone.ilike.%${word}%`);
      const [students, enrollments] = await Promise.all([
        query,
        supabase.from('student_enrollments').select('student_id').eq('group_id', group.id).in('status', ['active', 'trial']),
      ]);
      if (cancelled) return;
      if (students.error || enrollments.error) setError(students.error?.message ?? enrollments.error?.message ?? 'Ro‘yxat yuklanmadi');
      const enrolled = new Set((enrollments.data ?? []).map(row => row.student_id));
      setCandidates((students.data ?? []).filter(row => !enrolled.has(row.id)));
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, group.id, mode]);

  const complete = () => {
    emitDataChanged('students');
    toast.success('O‘quvchi guruhga qo‘shildi');
    onDone();
    onClose();
  };

  const enroll = async (studentId: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const previous = await supabase.from('student_enrollments').select('id, monthly_fee').eq('student_id', studentId).eq('group_id', group.id).maybeSingle();
      if (previous.error) throw previous.error;
      const payload = { student_id: studentId, group_id: group.id, subject_id: group.subject_id, teacher_user_id: group.teacher_id, monthly_fee: previous.data?.monthly_fee ?? group.monthly_fee, status: 'active', ended_at: null };
      const result = previous.data
        ? await supabase.from('student_enrollments').update(payload).eq('id', previous.data.id).select('id').single()
        : await supabase.from('student_enrollments').insert(payload).select('id').single();
      if (result.error) throw result.error;
      complete();
    } catch (err) { setError(err instanceof Error ? err.message : (err as { message?: string }).message ?? 'Saqlanmadi'); }
    finally { setBusy(false); }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!form.first.trim() || !form.last.trim()) { setError('Ism va familiyani kiriting'); return; }
    setBusy(true);
    setError('');
    try {
      // The primary-group trigger creates the enrollment in the same transaction.
      const result = await supabase.from('students').insert({
        first_name: form.first.trim(), last_name: form.last.trim(), full_name: `${form.first.trim()} ${form.last.trim()}`,
        parent_phone: form.phone.trim() || null, group_id: group.id, monthly_fee: Number(form.fee), status: 'active', status_enum: 'active',
      }).select('id').single();
      if (result.error) throw result.error;
      complete();
    } catch (err) { setError(err instanceof Error ? err.message : (err as { message?: string }).message ?? 'Saqlanmadi'); }
    finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>O‘quvchi qo‘shish</DialogTitle></DialogHeader>
      <p className="break-words text-sm font-semibold text-primary">{group.name}</p>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="O‘quvchi tanlash">
        <Button role="tab" aria-selected={mode === 'existing'} variant={mode === 'existing' ? 'default' : 'outline'} disabled={busy} onClick={() => { setMode('existing'); setError(''); }}><Search /> Mavjud o‘quvchi</Button>
        <Button role="tab" aria-selected={mode === 'new'} variant={mode === 'new' ? 'default' : 'outline'} disabled={busy} onClick={() => { setMode('new'); setError(''); }}><UserPlus /> Yangi o‘quvchi</Button>
      </div>
      {mode === 'existing' ? <div className="space-y-3">
        <Input autoFocus aria-label="O‘quvchini qidirish" placeholder="Ism, familiya yoki telefon" value={search} onChange={e => setSearch(e.target.value)} disabled={busy} />
        <div className="max-h-72 min-h-24 overflow-y-auto">
          {searching ? <p className="py-4 text-center text-sm text-muted-foreground">Yuklanmoqda…</p> : candidates.length ? <ul className="space-y-1">
            {candidates.map(student => <li key={student.id}>
              <Button variant="ghost" disabled={busy} className="h-auto min-h-12 w-full justify-between whitespace-normal px-2 text-left" onClick={() => enroll(student.id)}>
                <span className="min-w-0 break-words"><span className="block">{student.first_name} {student.last_name}</span><span className="text-xs text-muted-foreground">{student.parent_phone}</span></span>
                <UserPlus className="shrink-0 text-primary" />
              </Button>
            </li>)}
          </ul> : <div className="space-y-2 py-4 text-center"><p className="text-sm text-muted-foreground">O‘quvchi topilmadi</p><Button variant="outline" onClick={() => { setMode('new'); setError(''); }}><UserPlus /> Yangi o‘quvchi</Button></div>}
        </div>
      </div> : <form onSubmit={create} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Ism<Input autoFocus required value={form.first} onChange={e => setForm({ ...form, first: e.target.value })} disabled={busy} /></label>
          <label className="space-y-1 text-sm">Familiya<Input required value={form.last} onChange={e => setForm({ ...form, last: e.target.value })} disabled={busy} /></label>
        </div>
        <label className="block space-y-1 text-sm">Ota-ona telefoni<Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={busy} /></label>
        <label className="block space-y-1 text-sm">Oylik to‘lov (so‘m)<Input type="number" min="0" required value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} disabled={busy} /></label>
        <Button type="submit" className="w-full" disabled={busy}><UserPlus />{busy ? 'Saqlanmoqda…' : 'Guruhga qo‘shish'}</Button>
      </form>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}