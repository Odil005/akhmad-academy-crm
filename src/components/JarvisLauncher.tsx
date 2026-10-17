import { lazy, Suspense, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Jarvis = lazy(() => import('./Jarvis').then(module => ({ default: module.Jarvis })));

export function JarvisLauncher() {
  const [activated, setActivated] = useState(false);
  const launcher = <Button size="icon" title="Jarvis" aria-label="Jarvis" data-tour="jarvis-button"
    className="fixed bottom-5 right-5 z-50 size-14 rounded-full shadow-lg"
    onClick={() => setActivated(true)}><Bot className="size-6" /></Button>;
  if (!activated) return launcher;
  return <Suspense fallback={<Button size="icon" aria-label="Jarvis ochilmoqda" disabled
    className="fixed bottom-5 right-5 z-50 size-14 rounded-full shadow-lg"><Loader2 className="size-6 animate-spin" /></Button>}>
    <Jarvis initiallyOpen />
  </Suspense>;
}