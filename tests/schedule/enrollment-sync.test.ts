import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('repaired enrollment relationships', () => {
  it('keeps every active primary-group student linked to that enrollment', () => {
    const sql = `select count(*)::int as count from public.students s where s.status='active' and s.group_id is not null and not exists(select 1 from public.student_enrollments e where e.student_id=s.id and e.group_id=s.group_id and e.status='active')`;
    const result = JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' }));
    expect(result.rows[0].count).toBe(0);
  });
});