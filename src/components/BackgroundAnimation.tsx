import { useEffect, useState } from "react";

/**
 * BackgroundAnimation — sayt bo'ylab ishlatiladigan yengil, animatsiyali fon.
 *
 * Xususiyatlari:
 * - Sekin harakatlanuvchi qora + oltin gradient
 * - 3 ta suzuvchi oltin glow orb
 * - Nozik floating particles (mobil qurilmalarda kamaytiriladi)
 * - Markazda katta Akhmad Academy watermark logosi (5–10% opacity)
 * - `prefers-reduced-motion` qo'llab-quvvatlanadi (animatsiyalar to'xtaydi)
 * - `pointer-events-none` va `-z-10` — layoutga ta'sir qilmaydi
 *
 * Foydalanish:
 *   <BackgroundAnimation />
 *   <BackgroundAnimation variant="hero" /> // hero bo'limlar uchun kuchliroq glow
 */

type Props = {
  variant?: "default" | "hero" | "subtle";
  className?: string;
  position?: "fixed" | "absolute";
};

export function BackgroundAnimation({ variant = "default", className = "", position = "fixed" }: Props) {
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mob = window.matchMedia("(max-width: 767px)");
    const upd = () => {
      setReduced(mm.matches);
      setIsMobile(mob.matches);
    };
    upd();
    mm.addEventListener("change", upd);
    mob.addEventListener("change", upd);
    return () => {
      mm.removeEventListener("change", upd);
      mob.removeEventListener("change", upd);
    };
  }, []);

  const particleCount = reduced ? 0 : isMobile ? 6 : variant === "subtle" ? 8 : 14;
  const orbOpacity = variant === "hero" ? 0.5 : variant === "subtle" ? 0.2 : 0.32;
  const watermarkOpacity = variant === "subtle" ? 0.05 : 0.08;

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${position} inset-0 -z-10 overflow-hidden ${className}`}
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, oklch(0.86 0.17 92 / 0.12), transparent 60%), radial-gradient(900px 600px at 110% 110%, oklch(0.86 0.17 92 / 0.08), transparent 55%), var(--color-background)",
      }}
    >
      {/* Sekin siljuvchi gradient qatlam */}
      <div
        className={reduced ? "" : "animate-gradient"}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, oklch(0.14 0.01 60) 0%, oklch(0.18 0.02 70) 40%, oklch(0.16 0.03 85) 70%, oklch(0.14 0.01 60) 100%)",
          backgroundSize: "300% 300%",
          opacity: 0.6,
        }}
      />

      {/* Katta Akhmad Academy watermark */}
      <div
        className={reduced ? "" : "animate-watermark"}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "clamp(9rem, 26vw, 26rem)",
          fontWeight: 900,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          userSelect: "none",
          background:
            "linear-gradient(135deg, oklch(0.86 0.17 92 / 0.6), oklch(1 0 0 / 0.2) 60%, oklch(0.86 0.17 92 / 0.5))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: watermarkOpacity,
          filter: "blur(0.5px)",
        }}
      >
        Akhmad Academy
      </div>

      {/* Suzuvchi oltin orblar */}
      <div
        className={reduced ? "" : "animate-float-orb"}
        style={{
          position: "absolute",
          left: "-6rem",
          top: "20%",
          width: isMobile ? "18rem" : "28rem",
          height: isMobile ? "18rem" : "28rem",
          borderRadius: "9999px",
          background: `radial-gradient(circle at 30% 30%, oklch(0.86 0.17 92 / ${orbOpacity}), transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        className={reduced ? "" : "animate-float-orb-2"}
        style={{
          position: "absolute",
          right: "-8rem",
          bottom: 0,
          width: isMobile ? "20rem" : "32rem",
          height: isMobile ? "20rem" : "32rem",
          borderRadius: "9999px",
          background: `radial-gradient(circle at 60% 40%, oklch(0.86 0.17 92 / ${orbOpacity * 0.8}), transparent 65%)`,
          filter: "blur(50px)",
        }}
      />
      {variant === "hero" && !reduced && (
        <div
          className="animate-float-orb"
          style={{
            position: "absolute",
            right: "30%",
            top: 0,
            width: "16rem",
            height: "16rem",
            borderRadius: "9999px",
            background: "radial-gradient(circle, oklch(0.92 0.16 92 / 0.28), transparent 60%)",
            filter: "blur(30px)",
            animationDelay: "-6s",
          }}
        />
      )}

      {/* Particles */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const left = (i * 73) % 100;
        const delay = -(i * 1.7);
        const duration = 16 + (i % 5) * 3;
        const size = 3 + (i % 4);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              bottom: "-10vh",
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: "9999px",
              background:
                "radial-gradient(circle, oklch(0.92 0.16 92 / 0.9), oklch(0.86 0.17 92 / 0) 70%)",
              boxShadow: "0 0 12px oklch(0.86 0.17 92 / 0.55)",
              animation: `particle-drift ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.45) 100%)",
        }}
      />
    </div>
  );
}

export default BackgroundAnimation;
