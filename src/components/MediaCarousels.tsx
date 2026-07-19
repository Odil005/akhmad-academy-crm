import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * ImageCarousel — sertifikatlar uchun autoplay carousel.
 * - autoplay + pause on hover / offscreen / lightbox ochiq
 * - swipe (touch/pointer)
 * - klik → lightbox
 * - `prefers-reduced-motion` qo'llab-quvvatlanadi
 */

export type CarouselImage = { src: string; alt: string; caption?: string };

type Props = {
  images: CarouselImage[];
  intervalMs?: number;
  aspect?: string; // e.g. "4/3"
};

export function ImageCarousel({
  images,
  intervalMs = 4000,
  aspect = "4/3",
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mm.matches);
    upd();
    mm.addEventListener("change", upd);
    return () => mm.removeEventListener("change", upd);
  }, []);

  // Pause when offscreen
  useEffect(() => {
    if (!containerRef.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, []);

  const total = images.length;
  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + total) % total),
    [total],
  );

  useEffect(() => {
    if (paused || lightbox !== null || !visible || reduced || total < 2) return;
    const id = window.setInterval(() => go(1), intervalMs);
    return () => window.clearInterval(id);
  }, [paused, lightbox, visible, reduced, go, intervalMs, total]);

  // Swipe
  const startX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    startX.current = null;
  };

  

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="overflow-hidden rounded-2xl"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div
          ref={trackRef}
          className="flex transition-transform duration-700 ease-out will-change-transform"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {images.map((img, i) => (
            <div key={i} className="w-full shrink-0 px-2">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="group relative mx-auto block w-full max-w-2xl overflow-hidden rounded-xl border border-primary/15 bg-card/40 hover-lift"
                style={{ aspectRatio: aspect }}
                aria-label={`Kattalashtirish: ${img.alt}`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-semibold text-white">
                    {img.caption}
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Oldingi"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-card/70 p-2 text-foreground backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Keyingi"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-card/70 p-2 text-foreground backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mt-4 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Slayd ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/60"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {lightbox !== null && (
        <Lightbox
          images={images}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/**
 * InfiniteSlider — CSS transform bilan cheksiz aylanuvchi marquee.
 * Faqat bitta transform animatsiyasi — juda arzon.
 */
export function InfiniteSlider({
  images,
  speed = 40, // sekundlarda bitta aylanish
  itemWidth = "18rem",
  aspect = "16/10",
}: {
  images: CarouselImage[];
  speed?: number;
  itemWidth?: string;
  aspect?: string;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const doubled = [...images, ...images];

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex w-max gap-4"
        style={{
          animation: `marquee ${speed}s linear infinite`,
          animationPlayState: paused || lightbox !== null ? "paused" : "running",
        }}
      >
        {doubled.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(i % images.length)}
            className="relative shrink-0 overflow-hidden rounded-2xl border border-primary/15 bg-card/40 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_oklch(0.86_0.17_92/0.5)]"
            style={{ width: itemWidth, aspectRatio: aspect }}
            aria-label={img.alt}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {img.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-medium text-white">
                {img.caption}
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .group > div { animation: none !important; }
        }
      `}</style>

      {lightbox !== null && (
        <Lightbox
          images={images}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/** Umumiy Lightbox — Esc, chap/o'ng navigatsiya, swipe */
export function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: CarouselImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const total = images.length;
  const go = useCallback(
    (dir: 1 | -1) => setI((v) => (v + dir + total) % total),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  const startX = useRef<number | null>(null);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur"
      onClick={onClose}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        startX.current = null;
      }}
    >
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Oldingi"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Keyingi"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <figure
        className="relative flex max-h-full max-w-6xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[i].src}
          alt={images[i].alt}
          className="max-h-[85vh] w-auto rounded-xl object-contain shadow-2xl"
        />
        {images[i].caption && (
          <figcaption className="mt-3 text-sm text-white/80">
            {images[i].caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
