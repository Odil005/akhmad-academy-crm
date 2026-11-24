create index if not exists students_center_first_name_idx on public.students (center_id, first_name);
create index if not exists students_center_last_name_idx on public.students (center_id, last_name, first_name);
create index if not exists students_center_status_idx on public.students (center_id, status_enum);
create index if not exists enroll_status_group_idx on public.student_enrollments (status, group_id);
create index if not exists enroll_group_status_started_idx on public.student_enrollments (group_id, status, started_at desc);
analyze public.students; analyze public.student_enrollments;