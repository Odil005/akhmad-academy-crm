import { describe, expect, it } from 'vitest';
import { acceptsMatch, accessAllowed, classifyPose, identifyFace, samplesSchema } from '../../src/features/face/domain';

const face = Array.from({ length: 128 }, (_, i) => Math.sin(i) / 10);
describe('Student Face ID rules', () => {
  it('identifies an enrolled person without selecting their name', () => {
    expect(identifyFace([face, face, face], [{ id: 'student', descriptors: [face, face, face] }])?.id).toBe('student');
  });
  it('does not guess between similar enrolled identities', () => {
    expect(identifyFace([face, face, face], [{ id: 'one', descriptors: [face, face, face] }, { id: 'two', descriptors: [face, face, face] }])).toBeNull();
  });
  it('accepts matching front, right and left samples', () => {
    expect(acceptsMatch([face, face, face], [face, face, face])).toBe(true);
  });
  it('rejects another face even if one pose matches', () => {
    const other = face.map(v => v + 0.2);
    expect(acceptsMatch([face, other, face], [face, face, face])).toBe(false);
  });
  it('requires three 128-dimensional samples, not only a photo', () => {
    expect(samplesSchema.safeParse([face]).success).toBe(false);
    expect(acceptsMatch([[], [], []], [face, face, face])).toBe(false);
  });
  it('requires distinct front, right and left poses', () => {
    expect(classifyPose(50, 0, 100)).toBe('front');
    expect(classifyPose(30, 0, 100)).toBe('right');
    expect(classifyPose(70, 0, 100)).toBe('left');
  });
  it('blocks overdue students without an administrator exception', () => {
    expect(accessAllowed(100000, null, Date.parse('2026-10-17T10:00:00Z'))).toBe(false);
  });
  it('accepts an exception only during its valid period', () => {
    const expiry = '2026-10-17T11:00:00Z';
    expect(accessAllowed(100000, expiry, Date.parse('2026-10-17T10:00:00Z'))).toBe(true);
    expect(accessAllowed(100000, expiry, Date.parse(expiry))).toBe(false);
  });
});