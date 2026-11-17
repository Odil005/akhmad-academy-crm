ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 15 CHECK (capacity > 0 AND capacity <= 500);

CREATE OR REPLACE FUNCTION public.director_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
WITH
pay AS (
  SELECT p.amount, p.paid_at, p.student_id, p.teacher_user_id
    FROM public.payments p
   WHERE p.status = 'paid' AND p.paid_at >= p_from::timestamptz AND p.paid_at < (p_to + 1)::timestamptz
),
active_enr AS (
  SELECT e.* FROM public.student_enrollments e WHERE e.status = 'active'
),
att AS (
  SELECT a.status, a.student_id, a.lesson_id FROM public.attendance a WHERE a.date BETWEEN p_from AND p_to
),
left_hist AS (
  SELECT DISTINCT h.student_id FROM public.student_status_history h
   WHERE h.to_status::text IN ('left','archived') AND h.created_at >= p_from::timestamptz AND h.created_at < (p_to + 1)::timestamptz
),
months AS (
  SELECT generate_series(date_trunc('month', p_to::timestamp) - interval '11 months', date_trunc('month', p_to::timestamp), interval '1 month')::date AS m
),
group_counts AS (
  SELECT g.id, g.name, g.capacity, g.monthly_fee, g.teacher_id, g.subject_id,
         (SELECT count(DISTINCT e.student_id) FROM active_enr e WHERE e.group_id = g.id) AS students
    FROM public.groups g
)
SELECT jsonb_build_object(
  'kpi', jsonb_build_object(
    'income', (SELECT coalesce(sum(amount),0) FROM pay),
    'expense', (SELECT coalesce(sum(x.amount),0) FROM public.expenses x WHERE x.paid_at BETWEEN p_from AND p_to),
    'debt_total', (SELECT coalesce(sum(coalesce(p.total_amount,p.amount)),0) FROM public.payments p WHERE p.status='pending'),
    'debtors', (SELECT count(DISTINCT p.student_id) FROM public.payments p WHERE p.status='pending'),
    'active_students', (SELECT count(*) FROM public.students s WHERE coalesce(s.status_enum::text, s.status) IN ('active','trial')),
    'frozen_students', (SELECT count(*) FROM public.students s WHERE s.status_enum::text = 'frozen'),
    'new_students', (SELECT count(*) FROM public.students s WHERE s.enrolled_at >= p_from::timestamptz AND s.enrolled_at < (p_to + 1)::timestamptz),
    'left_students', (SELECT count(*) FROM left_hist),
    'attendance_total', (SELECT count(*) FROM att),
    'attendance_present', (SELECT count(*) FROM att WHERE status IN ('present','late')),
    'groups', (SELECT count(*) FROM group_counts),
    'capacity_total', (SELECT coalesce(sum(capacity),0) FROM group_counts),
    'seats_taken', (SELECT coalesce(sum(students),0) FROM group_counts)
  ),
  'monthly', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.m, 'YYYY-MM'),
      'income', (SELECT coalesce(sum(p.amount),0) FROM public.payments p WHERE p.status='paid' AND p.paid_at >= m.m::timestamptz AND p.paid_at < (m.m + interval '1 month')),
      'expense', (SELECT coalesce(sum(x.amount),0) FROM public.expenses x WHERE x.paid_at >= m.m AND x.paid_at < (m.m + interval '1 month')::date),
      'new_students', (SELECT count(*) FROM public.students s WHERE s.enrolled_at >= m.m::timestamptz AND s.enrolled_at < (m.m + interval '1 month')),
      'left_students', (SELECT count(DISTINCT h.student_id) FROM public.student_status_history h WHERE h.to_status::text IN ('left','archived') AND h.created_at >= m.m::timestamptz AND h.created_at < (m.m + interval '1 month'))
    ) ORDER BY m.m), '[]'::jsonb) FROM months m),
  'subjects', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'income')::numeric DESC, (r->>'students')::int DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object(
        'name', coalesce(sj.name, 'Fansiz'),
        'groups', count(DISTINCT gc.id),
        'students', coalesce(sum(gc.students),0),
        'income', coalesce((SELECT sum(p.amount) FROM pay p JOIN public.students s ON s.id=p.student_id JOIN public.groups g2 ON g2.id=s.group_id WHERE g2.subject_id IS NOT DISTINCT FROM sj.id),0)
      ) AS r
      FROM group_counts gc LEFT JOIN public.subjects sj ON sj.id = gc.subject_id
      GROUP BY sj.id, sj.name) t),
  'teachers', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'students')::int DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object(
        'name', coalesce(pr.full_name, 'Biriktirilmagan'),
        'groups', count(DISTINCT gc.id),
        'students', coalesce(sum(gc.students),0),
        'income', coalesce((SELECT sum(p.amount) FROM pay p LEFT JOIN public.students s ON s.id=p.student_id LEFT JOIN public.groups g2 ON g2.id=s.group_id WHERE coalesce(p.teacher_user_id, g2.teacher_id) IS NOT DISTINCT FROM gc.teacher_id),0),
        'attendance_total', (SELECT count(*) FROM att a JOIN public.lessons l ON l.id=a.lesson_id JOIN public.groups g3 ON g3.id=l.group_id WHERE g3.teacher_id IS NOT DISTINCT FROM gc.teacher_id),
        'attendance_present', (SELECT count(*) FROM att a JOIN public.lessons l ON l.id=a.lesson_id JOIN public.groups g3 ON g3.id=l.group_id WHERE g3.teacher_id IS NOT DISTINCT FROM gc.teacher_id AND a.status IN ('present','late'))
      ) AS r
      FROM group_counts gc LEFT JOIN public.profiles pr ON pr.id = gc.teacher_id
      GROUP BY gc.teacher_id, pr.full_name) t),
  'groups', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', gc.id, 'name', gc.name, 'capacity', gc.capacity, 'students', gc.students,
      'teacher', pr.full_name, 'subject', sj.name, 'monthly_fee', gc.monthly_fee
    ) ORDER BY gc.students::numeric / gc.capacity DESC, gc.name), '[]'::jsonb)
    FROM group_counts gc LEFT JOIN public.profiles pr ON pr.id=gc.teacher_id LEFT JOIN public.subjects sj ON sj.id=gc.subject_id)
);
$$;

REVOKE ALL ON FUNCTION public.director_analytics(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.director_analytics(date, date) TO authenticated, service_role;