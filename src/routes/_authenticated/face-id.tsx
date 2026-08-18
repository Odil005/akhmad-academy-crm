import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, MapPin, ScanFace, Trash2 } from "lucide-react";
import { distanceMeters, type CheckinLocation } from "@/lib/geo";
import { toast } from "sonner";

type Enrollment = { id: string; image_url: string; created_at: string };
type Checkin = {
  id: string;
  checked_in_at: string;
  method: string;
  photo_url: string | null;
  location_name: string | null;
  distance_m: number | null;
  within_zone: boolean | null;
  latitude: number | null;
  longitude: number | null;
};

export const Route = createFileRoute("/_authenticated/face-id")({
  component: FaceIdPage,
});

function FaceIdPage() {
  const { user, roles } = Route.useRouteContext();
  const isTeacher = roles.includes("teacher");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState<CheckinLocation[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = async () => {
    const [{ data: enr }, { data: ci }, { data: locs }] = await Promise.all([
      supabase.from("teacher_face_enrollments").select("id, image_url, created_at").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("teacher_checkins")
        .select("id, checked_in_at, method, photo_url, location_name, distance_m, within_zone, latitude, longitude")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(20),
      supabase
        .from("checkin_locations")
        .select("id, name, address, latitude, longitude, radius_m")
        .eq("active", true),
    ]);
    setEnrollment((enr as Enrollment | null) ?? null);
    setCheckins((ci as Checkin[] | null) ?? []);
    setZones((locs as CheckinLocation[] | null) ?? []);
  };

  useEffect(() => { load(); return () => stopCamera(); /* eslint-disable-next-line */ }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setStreaming(true);
    } catch (e) {
      toast.error("Kameraga ruxsat berilmadi");
    }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  const capture = (): string | null => {
    const v = videoRef.current; if (!v) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.8);
  };

  const enroll = async () => {
    const img = capture(); if (!img) return;
    setBusy(true);
    const { error } = await supabase.from("teacher_face_enrollments").upsert(
      { user_id: user.id, image_url: img },
      { onConflict: "user_id" }
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Yuz ro'yxatga olindi");
    stopCamera(); load();
  };

  /** Aniq lokatsiya: brauzer GPS koordinatasini oladi va eng yaqin ruxsat etilgan nuqtaga tekshiradi. */
  const readPosition = () =>
    new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });

  const checkin = async () => {
    const img = capture();
    setBusy(true);
    const position = await readPosition();
    if (!position) {
      setBusy(false);
      toast.error("Lokatsiyaga ruxsat bering — kirish faqat aniq joylashuv bilan qayd etiladi.");
      return;
    }
    const { latitude, longitude, accuracy } = position.coords;
    const nearest = zones
      .map((zone) => ({ zone, distance: distanceMeters(latitude, longitude, zone.latitude, zone.longitude) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const within = nearest ? nearest.distance <= nearest.zone.radius_m : false;

    const { error } = await supabase.from("teacher_checkins").insert({
      user_id: user.id,
      method: "face",
      photo_url: img,
      latitude,
      longitude,
      accuracy_m: accuracy ?? null,
      location_name: nearest?.zone.name ?? null,
      distance_m: nearest ? Math.round(nearest.distance) : null,
      within_zone: nearest ? within : null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!nearest) {
      toast.warning("Kirish qayd etildi, lekin ruxsat etilgan lokatsiya belgilanmagan.");
    } else if (within) {
      toast.success(`Kirish qayd etildi — ${nearest.zone.name} (${Math.round(nearest.distance)} m)`);
    } else {
      toast.warning(
        `Kirish qayd etildi, lekin siz markazdan tashqarida (${Math.round(nearest.distance)} m).`,
      );
    }
    stopCamera();
    load();
  };

  if (!isTeacher) {
    return <p className="text-sm text-muted-foreground">Bu bo'lim faqat o'qituvchilar uchun.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Face ID</h1>
        <p className="text-sm text-muted-foreground">Yuz orqali ish kunini boshlash</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold"><ScanFace className="h-4 w-4 text-primary" /> Kamera</div>
          {!streaming ? (
            <button onClick={startCamera} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Camera className="h-4 w-4" /> Kamerani yoqish
            </button>
          ) : (
            <button onClick={stopCamera} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">To'xtatish</button>
          )}
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-black">
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
          {!streaming && (
            <div className="absolute inset-0 grid place-items-center text-xs text-white/70">Kamerani yoqing</div>
          )}
        </div>
        {streaming && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={enroll} disabled={busy} className="rounded-lg border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary disabled:opacity-60">
              {enrollment ? "Yuzni yangilash" : "Yuzni ro'yxatga olish"}
            </button>
            <button onClick={checkin} disabled={busy || !enrollment} className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              Kirish (Check-in)
            </button>
          </div>
        )}
        {!enrollment && <p className="mt-2 text-[11px] text-muted-foreground">Avval "Yuzni ro'yxatga olish" tugmasi orqali profil suratini saqlang.</p>}
      </div>

      {enrollment && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Ro'yxatdagi surat</div>
            <button
              onClick={async () => {
                if (!confirm("O'chirilsinmi?")) return;
                await supabase.from("teacher_face_enrollments").delete().eq("id", enrollment.id);
                load();
              }}
              className="text-destructive hover:opacity-70"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <img src={enrollment.image_url} alt="Enrollment" className="max-h-40 rounded-lg border border-border" loading="lazy" decoding="async" />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4 text-sm font-bold">Oxirgi kirishlar</div>
        {checkins.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Hali kirish yozuvi yo'q</p>
        ) : (
          <ul className="divide-y divide-border">
            {checkins.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{new Date(c.checked_in_at).toLocaleString("uz-UZ")}</div>
                  <div className="text-xs text-muted-foreground">
                    Usul: {c.method}
                    {c.location_name ? ` · ${c.location_name}` : ""}
                    {c.distance_m != null ? ` · ${c.distance_m} m` : ""}
                    {c.within_zone === false ? " · hudud tashqarisida" : ""}
                  </div>
                  {c.latitude != null && c.longitude != null && (
                    <a
                      href={`https://maps.google.com/?q=${c.latitude},${c.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <MapPin className="h-3 w-3" /> Xaritada ko'rish
                    </a>
                  )}
                </div>
                {c.photo_url && <img src={c.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" width={40} height={40} loading="lazy" decoding="async" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
