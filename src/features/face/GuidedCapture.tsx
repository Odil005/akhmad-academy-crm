import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ScanFace, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POSES } from './domain';
import { readFace } from './engine';

type Props = {
  video: HTMLVideoElement;
  onComplete: (samples: number[][], image: string) => Promise<void>;
  onCancel: () => void;
};
const labels = ['Kameraga to‘g‘ri qarang', 'Boshingizni o‘ngga buring', 'Boshingizni chapga buring'];

export function GuidedCapture({ video, onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('Yuz tanish tayyorlanmoqda…');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0, stable = 0;
    const samples: number[][] = [];
    let image = '';
    const started = Date.now();
    const tick = async () => {
      try {
        if (cancelled) return;
        if (Date.now() - started > 90000) { setMessage('Vaqt tugadi. Bekor qilib qayta boshlang.'); return; }
        const result = await readFace(video);
        if (cancelled) return;
        if ('descriptor' in result && result.pose === POSES[index]) {
          stable++;
          setMessage('Qimirlamang…');
          if (stable >= 3) {
            if (index === 0) {
              const canvas = document.createElement('canvas');
              canvas.width = 640; canvas.height = Math.round(640 * video.videoHeight / video.videoWidth);
              canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
              image = canvas.toDataURL('image/jpeg', 0.75);
            }
            samples.push(result.descriptor);
            index++; stable = 0;
            setStep(index);
            if (index === 3) {
              setSaving(true); setMessage('Tekshirilmoqda…');
              await onComplete(samples, image);
              return;
            }
          }
        } else {
          stable = 0;
          setMessage(result.message || 'Ko‘rsatilgan tomonga sekin buring');
        }
        if (!cancelled) timer = setTimeout(tick, 450);
      } catch (error) {
        if (!cancelled) { setSaving(false); setMessage(error instanceof Error ? error.message : 'Yuzni tekshirib bo‘lmadi'); }
      }
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [video, onComplete]);

  const Icon = step === 1 ? ArrowRight : step === 2 ? ArrowLeft : ScanFace;
  return <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
    <div className="flex items-center gap-3"><Icon className="size-6 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-semibold">{labels[step] || 'Yuz tekshirilmoqda'}</p><p className="text-sm text-muted-foreground">{message}</p></div><Button variant="ghost" size="icon" aria-label="Yuz tekshiruvini bekor qilish" onClick={onCancel} disabled={saving}><X /></Button></div>
    <div className="flex gap-2">{POSES.map((pose, i) => <div key={pose} className={`h-1.5 flex-1 rounded ${i < step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
  </div>;
}