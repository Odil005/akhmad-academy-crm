import { lazy, Suspense, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Jarvis = lazy(() => import('./Jarvis').then(module => ({ default: module.Jarvis })));

/** `phoneHidden` hides the assistant on phones where a page owns the bottom action bar. */
export function JarvisLauncher({ phoneHidden = false }: { phoneHidden?: boolean }) {
  return <div className={phoneHidden ? "max-lg:hidden" : undefined}><JarvisButton /></div>;
}

function JarvisButton() {
  const [activated, setActivated] = useState(false);
  const launcher = <Button size="icon" title="Jarvis" aria-label="Jarvis" data-tour="jarvis-button"
    className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 size-12 rounded-full shadow-lg lg:bottom-5 lg:right-5 lg:size-14"
    onClick={() => setActivated(true)}><Bot className="size-6" /></Button>;
  if (!activated) return launcher;
  return <Suspense fallback={<Button size="icon" aria-label="Jarvis ochilmoqda" disabled
    className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 size-12 rounded-full shadow-lg lg:bottom-5 lg:right-5 lg:size-14"><Loader2 className="size-6 animate-spin" /></Button>}>
    <Jarvis initiallyOpen />
  </Suspense>;
}