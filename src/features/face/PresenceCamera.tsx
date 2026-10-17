import { useEffect, useRef, useState } from 'react';
import { readFace } from './engine';

export function PresenceCamera({ video, direction, onRecognize }: { video: HTMLVideoElement; direction: 'in' | 'out'; onRecognize: (samples: number[][]) => Promise<string> }) {
  const [message, setMessage] = useState('Yuz kutilmoqda…');
  const callback = useRef(onRecognize);
  callback.current = onRecognize;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let samples: number[][] = [];
    let pauseUntil = 0;
    const tick = async () => {
      try {
        if (cancelled) return;
        if (Date.now() >= pauseUntil) {
          const result = await readFace(video);
          if (cancelled) return;
          if ('descriptor' in result && result.pose === 'front') {
            samples.push(result.descriptor);
            if (samples.length === 3) {
              const collected = samples; samples = [];
              setMessage('Tekshirilmoqda…');
              const text = await callback.current(collected);
              if (!cancelled) setMessage(text);
              pauseUntil = Date.now() + 10000;
            }
          } else { samples = []; setMessage(result.message || 'Kameraga to‘g‘ri qarang'); }
        }
      } catch (error) {
        samples = []; pauseUntil = Date.now() + 10000;
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Yuz tekshirilmadi');
      }
      if (!cancelled) timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [video, direction]);
  return <p role="status" className="mt-3 text-sm text-primary">{message}</p>;
}