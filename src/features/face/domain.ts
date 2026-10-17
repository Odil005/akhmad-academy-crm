import { z } from 'zod';

export const FACE_MODEL = 'face-api-1.7.15';
export const MATCH_LIMIT = 0.48;
export const POSES = ['front', 'right', 'left'] as const;
export type Pose = typeof POSES[number];
export const descriptorSchema = z.array(z.number().finite().min(-10).max(10)).length(128);
export const samplesSchema = z.array(descriptorSchema).length(3);

export function distance(a: number[], b: number[]): number {
  if (a.length !== 128 || b.length !== 128 || [...a, ...b].some(v => !Number.isFinite(v))) return Infinity;
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0));
}

export function matchSamples(samples: number[][], templates: number[][]): number {
  if (!samplesSchema.safeParse(samples).success || !samplesSchema.safeParse(templates).success) return Infinity;
  // Every live pose must match at least one stored view. One good frame is insufficient.
  return Math.max(...samples.map(sample => Math.min(...templates.map(template => distance(sample, template)))));
}

export function acceptsMatch(samples: number[][], templates: number[][]): boolean {
  return matchSamples(samples, templates) < MATCH_LIMIT;
}

export function classifyPose(noseX: number, leftX: number, rightX: number): Pose | null {
  const width = rightX - leftX;
  if (width <= 0) return null;
  const offset = (noseX - (leftX + rightX) / 2) / width;
  // Preview is mirrored: negative image-space yaw is the student's right.
  if (offset < -0.12 && offset > -0.45) return 'right';
  if (offset > 0.12 && offset < 0.45) return 'left';
  return Math.abs(offset) <= 0.07 ? 'front' : null;
}

export function accessAllowed(debt: number, expiresAt: string | null, now: number): boolean {
  return debt <= 0 || (expiresAt !== null && Date.parse(expiresAt) > now);
}

export function identifyFace(samples: number[][], candidates: { id: string; descriptors: number[][] }[]): { id: string; score: number } | null {
  const ranked = candidates.map(candidate => ({ id: candidate.id, score: matchSamples(samples, candidate.descriptors) })).sort((a, b) => a.score - b.score);
  const best = ranked[0];
  if (!best || best.score >= MATCH_LIMIT) return null;
  // Similar identities require manual review, not a guessed attendance mark.
  if (ranked[1] && ranked[1].score - best.score < 0.06) return null;
  return best;
}