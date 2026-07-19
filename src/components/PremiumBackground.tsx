/**
 * Barcha authenticated sahifalar orqa fonida ishlaydigan premium fon:
 * - Katta EduNest watermark logo (10-15% opacity, animatsiyali)
 * - Suzuvchi oltin orblar
 * - Ingichka particle nurlari
 * - Ustki gradient overlay
 */
export function PremiumBackground() {
  const particles = Array.from({ length: 14 });
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, oklch(0.86 0.17 92 / 0.14), transparent 60%), radial-gradient(900px 600px at 110% 110%, oklch(0.86 0.17 92 / 0.10), transparent 55%), var(--color-background)",
      }}
    >
      {/* Watermark logo — juda katta, past opacity */}
      <div
        className="animate-watermark absolute left-1/2 top-1/2 select-none whitespace-nowrap"
        style={{
          fontSize: "clamp(14rem, 32vw, 32rem)",
          fontWeight: 900,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          transform: "translate(-50%, -50%)",
          background:
            "linear-gradient(135deg, oklch(0.86 0.17 92 / 0.35), oklch(1 0 0 / 0.12) 60%, oklch(0.86 0.17 92 / 0.28))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: 0.12,
          filter: "blur(0.5px)",
        }}
      >
        EduNest
      </div>

      {/* Suzuvchi oltin orblar */}
      <div
        className="animate-float-orb absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.86 0.17 92 / 0.35), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="animate-float-orb-2 absolute -right-32 bottom-0 h-[32rem] w-[32rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, oklch(0.86 0.17 92 / 0.25), transparent 65%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="animate-float-orb absolute right-1/3 top-0 h-64 w-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.9 0.16 92 / 0.22), transparent 60%)",
          filter: "blur(30px)",
          animationDelay: "-6s",
        }}
      />

      {/* Particle nurlari */}
      {particles.map((_, i) => {
        const left = (i * 73) % 100;
        const delay = -(i * 1.7);
        const duration = 14 + (i % 5) * 3;
        const size = 3 + (i % 4);
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: "-10vh",
              width: `${size}px`,
              height: `${size}px`,
              background:
                "radial-gradient(circle, oklch(0.92 0.16 92 / 0.9), oklch(0.86 0.17 92 / 0) 70%)",
              boxShadow: "0 0 12px oklch(0.86 0.17 92 / 0.6)",
              animation: `particle-drift ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}

      {/* Subtle grain / vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.45) 100%)",
        }}
      />
    </div>
  );
}
