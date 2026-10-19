import { describe, expect, it } from 'vitest';
import { groupWeekSchedule } from '../../src/features/schedule/group-week';
describe('group weekly schedule', () => {
  it('stores chosen Monday Wednesday Friday days with both lesson times', () => {
    expect(groupWeekSchedule([5, 1, 3, 1], '08:00', '10:00')).toEqual({ schedule_days: [1, 3, 5], schedule_start: '08:00', schedule_end: '10:00', schedule: 'Du/Chor/Ju 08:00–10:00' });
  });
  it('does not schedule lessons without chosen weekdays', () => {
    expect(groupWeekSchedule([], '', '')).toEqual({ schedule_days: [], schedule_start: null, schedule_end: null, schedule: null });
  });
  it('rejects a lesson ending before it starts', () => expect(() => groupWeekSchedule([1], '10:00', '08:00')).toThrow());
});