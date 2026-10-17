import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GuidedCapture } from '@/features/face/GuidedCapture';
import { accessAllowed } from '@/features/face/domain';
import { saveStudentFace, verifyStudentFace } from '@/lib/student-face.functions';
import { Camera, CheckCircle2, Clock, ScanFace, Search, ShieldOff, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { tashkentDate } from '@/features/face/attendance';

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};
type CheckinRow = {
  id: string;
  student_id: string;
  status: string;
  debt_amount: number | null;
  created_at: string;
  attendance_result: string | null;
  students?: { first_name: string; last_name: string } | null;
};

export const Route = createFileRoute("/_authenticated/face-checkin")({
  head: () => ({ meta: [
    { title: "Face ID kirish | Akhmad CRM" },
    { name: "description", content: "Akhmad CRM \u2014 face id kirish va o\u2018quv markazini boshqarish." },
    { property: "og:title", content: "Face ID kirish | Akhmad CRM" },
    { property: "og:description", content: "Akhmad CRM \u2014 face id kirish va o\u2018quv markazini boshqarish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: FaceCheckinPage,
});

function FaceCheckinPage() {
  const { roles, user } = Route.useRouteContext();
  const isStaff = roles.includes("admin") || roles.includes("director");

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [enrolled, setEnrolled] = useState<string | null>(null); // image_url
  const [debt, setDebt] = useState<number>(0);
  const [overrideUntil, setOverrideUntil] = useState<string | null>(null);
  const [overrideDays, setOverrideDays] = useState(3);
  const [recent, setRecent] = useState<CheckinRow[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'enroll' | 'verify' | null>(null);
  const [consent, setConsent] = useState(false);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saveFace = useServerFn(saveStudentFace);
  const verifyFace = useServerFn(verifyStudentFace);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraWanted = useRef(false);
  const cameraGeneration = useRef(0);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("student_face_checkins")
      .select("id, student_id, status, debt_amount, created_at, attendance_result, students(first_name, last_name)")
      .gte('created_at', `${tashkentDate(new Date())}T00:00:00+05:00`)
      .order("created_at", { ascending: false })
      .limit(15);
    setRecent((data as CheckinRow[] | null) ?? []);
  };

  useEffect(() => {
    loadRecent();
    navigator.mediaDevices?.enumerateDevices().then((all) => {
      const cams = all.filter((d) => d.kind === "videoinput");
      setDevices(cams);
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(clock); stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async (id?: string) => {
    try {
      stopCamera();
      cameraWanted.current = true;
      const generation = cameraGeneration.current;
      const s = await navigator.mediaDevices.getUserMedia({
        video: { ...(id ? { deviceId: { exact: id } } : { facingMode: 'user' }), width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
      });
      if (!cameraWanted.current || generation !== cameraGeneration.current) { s.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = s;
      // Kamera uzilib qolsa (USB chiqib ketsa) 3 soniyadan keyin o'zi qayta ulanadi
      s.getVideoTracks().forEach((t) => {
        t.onended = () => {
          if (streamRef.current !== s) return;
          setStreaming(false);
          setMode(null);
          restartRef.current = setTimeout(() => { if (cameraWanted.current) void startCamera(id); }, 3000);
        };
      });
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setStreaming(true);
      // USB kamera ulangach ro'yxatni yangilash
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
    } catch {
      toast.error("Kameraga ruxsat berilmadi yoki kamera topilmadi");
    }
  };
  const stopCamera = () => {
    cameraWanted.current = false;
    cameraGeneration.current++;
    if (restartRef.current) clearTimeout(restartRef.current);
    restartRef.current = null;
    setMode(null);
    streamRef.current?.getVideoTracks().forEach(t => { t.onended = null; });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setStudents([]);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, status")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .neq("status", "archived")
      .limit(10);
    setStudents((data as Student[] | null) ?? []);
  };

  const pick = async (s: Student) => {
    setMode(null); setConsent(false); setHasTemplate(false); setEnrolled(null); setDebt(0); setOverrideUntil(null);
    setSelected(s);
    setStudents([]);
    setQuery(`${s.first_name} ${s.last_name}`);
    const [{ data: enr }, { data: debts }, { data: ov }, { data: template }] = await Promise.all([
      supabase.from("student_face_enrollments").select("image_url").eq("student_id", s.id).maybeSingle(),
      supabase
        .from("payments")
        .select("amount, paid_amount")
        .eq("student_id", s.id)
        .eq("status", "pending")
        .lt("due_date", tashkentDate(new Date())),
      supabase
        .from("face_access_overrides")
        .select("expires_at")
        .eq("student_id", s.id)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('student_face_templates').select('student_id').eq('student_id', s.id).maybeSingle(),
    ]);
    setHasTemplate(Boolean(template));
    setEnrolled(enr?.image_url ?? null);
    setDebt(
      ((debts as { amount: number; paid_amount: number | null }[] | null) ?? []).reduce(
        (sum, p) => sum + (Number(p.amount) - Number(p.paid_amount ?? 0)),
        0,
      ),
    );
    setOverrideUntil(ov?.expires_at ?? null);
  };

  const completeCapture = useCallback(async (samples: number[][], image: string) => {
    if (!selected || !mode) return;
    setBusy(true);
    try {
      if (mode === 'enroll') {
        await saveFace({ data: { studentId: selected.id, samples, image, consent: true } });
        setEnrolled(image); setHasTemplate(true);
        toast.success(`${selected.first_name} yuzi uch tomondan ro‘yxatga olindi`);
      } else {
        const result = await verifyFace({ data: { studentId: selected.id, samples, image } });
        if (result.status === 'blocked') toast.error(`Kirish rad etildi — qarz: ${Number(result.debt_amount).toLocaleString()} so‘m`);
        else if (result.attendance_result === 'recorded' || result.attendance_result === 'already_recorded') toast.success(`${selected.first_name} ${selected.last_name} — ${attendanceLabels[result.attendance_result]}`);
        else toast.warning(`${selected.first_name} — yuz tasdiqlandi. ${attendanceLabels[result.attendance_result ?? ''] ?? 'Davomatni tekshiring'}`);
        await loadRecent();
      }
      setMode(null);
    } catch (error) { throw error; }
    finally { setBusy(false); }
  }, [selected, mode, saveFace, verifyFace]);

  const grantOverride = async () => {
    if (!selected) return;
    setBusy(true);
    const expires = new Date(Date.now() + overrideDays * 86400000).toISOString();
    const { error } = await supabase.from("face_access_overrides").insert({
      student_id: selected.id,
      expires_at: expires,
      reason: `${overrideDays} kunlik ruxsat`,
      granted_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOverrideUntil(expires);
    toast.success(`Ruxsat berildi — ${new Date(expires).toLocaleDateString("uz-UZ")} gacha`);
  };

  if (!isStaff) {
    return <p className="text-sm text-muted-foreground">Bu bo'lim faqat administrator va direktor uchun.</p>;
  }

  const blocked = !accessAllowed(debt, overrideUntil, now);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Face ID — o‘quvchilar davomati</h1>
        <p className="text-sm text-muted-foreground">
                  Akhmad CRM
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kamera */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ScanFace className="h-4 w-4 text-primary" /> Kamera
            </div>
            <div className="flex items-center gap-2">
              {devices.length > 1 && (
                <select
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(e.target.value);
                    startCamera(e.target.value || undefined);
                  }}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Standart kamera</option>
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
              {!streaming ? (
                <Button
                  onClick={() => startCamera(deviceId || undefined)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Camera className="h-4 w-4" /> Kamerani yoqish
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={stopCamera}>
                  To'xtatish
                </Button>
              )}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover -scale-x-100" />
            {!streaming && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Kamerani yoqing</div>
            )}
          </div>
          {mode && streaming && videoRef.current && <GuidedCapture video={videoRef.current} onComplete={completeCapture} onCancel={() => setMode(null)} />}
        </div>

        {/* O'quvchi tanlash va amallar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Search className="h-4 w-4 text-primary" /> O'quvchini toping (ism yoki familiya)
            </div>
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Masalan: Jasur yoki Karimov"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />
            {students.length > 0 && (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {students.map((s) => (
                  <li key={s.id}>
                    <Button variant="ghost"
                      onClick={() => pick(s)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-semibold">
                        {s.first_name} {s.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.status}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">
                  {selected.first_name} {selected.last_name}
                </div>
                {enrolled ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {hasTemplate ? 'Yuz tasdiqlangan' : 'Faqat eski surat'}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">Yuz ro'yxatda emas</span>
                )}
              </div>

              {enrolled && (
                <img src={enrolled} alt="" className="max-h-32 rounded-lg border border-border" loading="lazy" decoding="async" />
              )}

              {debt > 0 && (
                <div
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    blocked ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {blocked ? <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div>
                    <div className="font-bold">Qarz: {debt.toLocaleString()} so'm</div>
                    {blocked ? (
                      <div className="text-xs">Face ID kirishga ruxsat bermaydi — administrator ruxsat berishi kerak</div>
                    ) : (
                      <div className="text-xs">
                        Ruxsat berilgan: {overrideUntil ? new Date(overrideUntil).toLocaleString("uz-UZ") : '—'} gacha
                      </div>
                    )}
                  </div>
                </div>
              )}

              {debt > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={overrideDays}
                    onChange={(e) => setOverrideDays(Number(e.target.value))}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                  >
                    {[1, 3, 7, 14, 30].map((d) => (
                      <option key={d} value={d}>
                        {d} kun
                      </option>
                    ))}
                  </select>
                  <Button variant="outline"
                    onClick={grantOverride}
                    disabled={busy}
                    className="h-auto min-h-9 whitespace-normal text-xs"
                  >
                    <Clock className="h-3.5 w-3.5" /> Vaqtinchalik ruxsat berish
                  </Button>
                </div>
              )}

              <label className="flex items-start gap-2 text-sm"><Checkbox checked={consent} disabled={Boolean(mode)} onCheckedChange={value => setConsent(value === true)} aria-label="Ota-ona roziligi olingan" /><span>Ota-ona yoki qonuniy vakilning yuz ma’lumotini saqlashga roziligi olingan</span></label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="h-auto min-h-10 whitespace-normal" onClick={() => setMode('enroll')} disabled={busy || !streaming || !consent || Boolean(mode)}>{enrolled ? 'Yuzni qayta ro‘yxatga olish' : 'Yuzni ro‘yxatga olish'}</Button>
                <Button className="h-auto min-h-10 whitespace-normal" onClick={() => setMode('verify')} disabled={busy || !streaming || !hasTemplate || Boolean(mode)}>Yuz bilan kirishni tekshirish</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Oxirgi kirishlar */}
      <div className="border-t border-border">
        <div className="border-b border-border p-4 text-sm font-bold">Bugungi kirishlar</div>
        {recent.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Hali kirish yozuvi yo'q</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                {c.status === "allowed" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {c.students ? `${c.students.first_name} ${c.students.last_name}` : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("uz-UZ")}
                    {c.status === "blocked" && c.debt_amount != null
                      ? ` · rad etildi — qarz ${Number(c.debt_amount).toLocaleString()} so'm`
                      : ""}
                    {c.attendance_result && ` · ${attendanceLabels[c.attendance_result] ?? 'Davomatni tekshiring'}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
