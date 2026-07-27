/**
 * AmbientBackground — ultra-light global background.
 *
 * Perf notes:
 * - Static, composited gradient layers only (no full-screen blur/conic/noise)
 * - Two small drifting orbs, animation paused on small screens & reduced motion
 * - `contain: strict` + `-z-10` + `pointer-events-none` → zero layout/paint impact
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient-bg">
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-vignette" />
    </div>
  );
}

export default AmbientBackground;
