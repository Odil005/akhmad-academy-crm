import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { tashkentDate } from '../../src/features/face/attendance';

function eligible(overrides: { day?: number; active?: boolean; status?: string; start?: string; end?: string; started?: string; ended?: string; now?: string } = {}) {
  const { day = 6, active = true, status = 'active', start = '15:00', end = '16:00', started = '2026-10-01', ended, now = '2026-10-17 15:41:00' } = overrides;
  const sql = `select public.face_lesson_is_current(${day},'${start}','${end}',${active},'${status}','${started}',${ended ? `'${ended}'` : 'null'},'${now}') as eligible`;
  const result = JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' }));
  return result.rows[0].eligible;
}
describe('Akhmad internal attendance eligibility', () => {
  it('uses Tashkent date at the UTC day boundary', () => {
    expect(tashkentDate(new Date('2026-10-17T20:30:00Z'))).toBe('2026-10-18');
  });
  it('accepts the student’s active enrolled current lesson', () => expect(eligible()).toBe(true));
  it('does not mark an unrelated weekday', () => expect(eligible({ day: 5 })).toBe(false));
  it('does not mark inactive lessons', () => expect(eligible({ active: false })).toBe(false));
  it('does not mark inactive enrollments', () => expect(eligible({ status: 'frozen' })).toBe(false));
  it('does not mark before enrollment starts', () => expect(eligible({ started: '2026-10-18' })).toBe(false));
  it('does not mark after enrollment ends', () => expect(eligible({ ended: '2026-10-16' })).toBe(false));
  it('does not mark a lesson before its start', () => expect(eligible({ now: '2026-10-17 14:59:59' })).toBe(false));
  it('does not mark a lesson at or after its end', () => expect(eligible({ now: '2026-10-17 16:00:00' })).toBe(false));
});