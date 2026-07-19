/**
 * AmbientBackground — global, GPU-optimized animated background.
 *
 * - Pure CSS keyframe animations (no JS re-renders, no matchMedia listeners)
 * - Only 3 fixed layers → very low paint cost
 * - `will-change: transform` + `translate3d` for GPU compositing
 * - `pointer-events-none`, `aria-hidden`, `-z-10` — never affects layout
 * - Respects `prefers-reduced-motion` via CSS
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient-bg" />
  );
}

export default AmbientBackground;
