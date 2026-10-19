import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('transactional group enrollment', () => {
  it('links a primary group and preserves individual pricing when teacher metadata changes', () => {
    const sql = `BEGIN;
DO $$
DECLARE c uuid; g uuid; s uuid; n integer;
BEGIN
 SELECT id INTO c FROM public.centers LIMIT 1;
 INSERT INTO public.groups(name,monthly_fee,center_id) VALUES('Enrollment test',300000,c) RETURNING id INTO g;
 INSERT INTO public.students(first_name,last_name,status,group_id,monthly_fee,center_id) VALUES('Enrollment','Test','active',g,123456,c) RETURNING id INTO s;
 SELECT count(*) INTO n FROM public.student_enrollments WHERE student_id=s AND group_id=g AND monthly_fee=123456 AND status='active';
 IF n<>1 THEN RAISE EXCEPTION 'Primary group must create exactly one enrollment with individual fee'; END IF;
 UPDATE public.groups SET teacher_id=NULL WHERE id=g;
 SELECT count(*) INTO n FROM public.student_enrollments WHERE student_id=s AND monthly_fee=123456;
 IF n<>1 THEN RAISE EXCEPTION 'Group edit changed individual fee'; END IF;
 UPDATE public.students SET group_id=g WHERE id=s;
 SELECT count(*) INTO n FROM public.student_enrollments WHERE student_id=s AND group_id=g;
 IF n<>1 THEN RAISE EXCEPTION 'Repeated assignment created a duplicate'; END IF;
END $$;
ROLLBACK;`;
    expect(() => execFileSync('lovable', ['supabase', 'query', sql], { encoding: 'utf8' })).not.toThrow();
  });
});