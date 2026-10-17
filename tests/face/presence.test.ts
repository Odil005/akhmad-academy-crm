import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

function query(sql: string) {
  return JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' })).rows;
}

describe('Atomic face presence rules', () => {
  it('does not alternate arrival on repeated frames', () => {
    const rows = query(`SELECT public.face_presence_repeat_status('in','in','2026-10-17T10:00:00Z','2026-10-17T10:00:10Z') AS result`);
    expect(rows[0].result).toBe('duplicate');
  });
  it('accepts an explicit departure after the repeat interval', () => {
    const rows = query(`SELECT public.face_presence_repeat_status('in','out','2026-10-17T10:00:00Z','2026-10-17T10:05:00Z') AS result`);
    expect(rows[0].result).toBe('new');
  });
  it('blocks an immediate mode switch from writing another event', () => {
    const rows = query(`SELECT public.face_presence_repeat_status('in','out','2026-10-17T10:00:00Z','2026-10-17T10:00:10Z') AS result`);
    expect(rows[0].result).toBe('cooldown');
  });
  it('does not grant phone activation to browser or anonymous callers', () => {
    const rows = query(`SELECT has_function_privilege('authenticated','public.activate_teacher_contact(text,text)','EXECUTE') AS browser, has_function_privilege('anon','public.activate_teacher_contact(text,text)','EXECUTE') AS anonymous`);
    expect(rows[0].browser).toBe(false);
    expect(rows[0].anonymous).toBe(false);
  });
});