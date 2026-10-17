import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

function query(sql: string) {
  return JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' })).rows;
}

describe('Atomic face presence rules', () => {
  it('records arrival once and does not alternate it on repeated frames', () => {
    const rows = query(`BEGIN;
      SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.user_roles WHERE role='admin' LIMIT 1),true);
      INSERT INTO public.students(id,first_name,last_name) VALUES('3f9e60ce-c62e-43df-b125-34d337de2860','Presence','Test');
      INSERT INTO public.student_face_templates(student_id,descriptors,consent_confirmed_by) VALUES('3f9e60ce-c62e-43df-b125-34d337de2860','[[],[],[]]',auth.uid());
      SELECT public.record_face_presence('3f9e60ce-c62e-43df-b125-34d337de2860','student','in',0.1)->>'status' AS first_status;
      SELECT public.record_face_presence('3f9e60ce-c62e-43df-b125-34d337de2860','student','in',0.1)->>'status' AS second_status;
      SELECT count(*)::int AS event_count FROM public.face_presence_events WHERE student_id='3f9e60ce-c62e-43df-b125-34d337de2860';
      ROLLBACK;`);
    expect(rows.find((row: { first_status?: string }) => row.first_status)?.first_status).toBe('allowed');
    expect(rows.find((row: { second_status?: string }) => row.second_status)?.second_status).toBe('duplicate');
    expect(rows.find((row: { event_count?: number }) => row.event_count !== undefined)?.event_count).toBe(1);
  });
  it('records departure without creating lesson attendance', () => {
    const rows = query(`BEGIN;
      SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.user_roles WHERE role='admin' LIMIT 1),true);
      INSERT INTO public.students(id,first_name,last_name) VALUES('3f9e60ce-c62e-43df-b125-34d337de2861','Departure','Test');
      INSERT INTO public.student_face_templates(student_id,descriptors,consent_confirmed_by) VALUES('3f9e60ce-c62e-43df-b125-34d337de2861','[[],[],[]]',auth.uid());
      SELECT public.record_face_presence('3f9e60ce-c62e-43df-b125-34d337de2861','student','out',0.1)->>'attendance_result' AS outcome;
      SELECT count(*)::int AS marks FROM public.attendance WHERE student_id='3f9e60ce-c62e-43df-b125-34d337de2861';
      ROLLBACK;`);
    expect(rows.find((row: { outcome?: string }) => row.outcome)?.outcome).toBe('departure');
    expect(rows.find((row: { marks?: number }) => row.marks !== undefined)?.marks).toBe(0);
  });
  it('does not grant phone activation to browser or anonymous callers', () => {
    const rows = query(`SELECT has_function_privilege('authenticated','public.activate_teacher_contact(text,text)','EXECUTE') AS browser, has_function_privilege('anon','public.activate_teacher_contact(text,text)','EXECUTE') AS anonymous`);
    expect(rows[0].browser).toBe(false);
    expect(rows[0].anonymous).toBe(false);
  });
});