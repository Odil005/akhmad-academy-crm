import { describe, expect, it } from 'vitest';
import { matchingGroups, scheduleTime } from '../../src/features/schedule/group-assignment';
const groups = [
  { name: 'Matematika 8-10', subject_id: 'math', teacher_id: 'dilnoza' },
  { name: 'Matematika 10-12', subject_id: 'math', teacher_id: 'dilnoza' },
  { name: 'Matematika 8-10', subject_id: 'math', teacher_id: 'other' },
];
describe('subject teacher and time assignment', () => {
  it('reads the imported 08-10 range', () => expect(scheduleTime('08-10 juft')).toBe('08:00'));
  it('selects the 8-10 group and never the 10-12 group', () => {
    expect(matchingGroups(groups, 'math', 'dilnoza', '08:00')).toEqual([groups[0]]);
  });
  it('keeps multiple matches ambiguous rather than choosing the first teacher', () => {
    expect(matchingGroups(groups, 'math', null, '08:00')).toHaveLength(2);
  });
  it('does not assign a different subject', () => expect(matchingGroups(groups, 'bio', 'dilnoza', '08:00')).toEqual([]));
});