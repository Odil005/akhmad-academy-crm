import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('repaired enrollment relationships', () => {
  it('shows all 24 assigned students in Matematika 8-10 with subject and teacher', () => {
    const sql = `select count(*)::int as count from public.student_enrollments e join public.groups g on g.id=e.group_id where g.id='b69d3d29-2561-425f-a8b6-633675f5f963' and e.status='active' and e.subject_id=g.subject_id and e.teacher_user_id=g.teacher_id`;
    const result = JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' }));
    expect(result.rows[0].count).toBe(24);
  });
});