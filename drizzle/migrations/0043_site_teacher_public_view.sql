create or replace view public.site_teacher_public as
with norm as (
  select g.teacher_id,
    case
      when lower(s.name) like '%ingliz%' then 'Ingliz tili'
      when lower(s.name) like '%matem%' then 'Matematika'
      when lower(s.name) like '%koreys%' or lower(s.name) like '%kareys%' then 'Koreys tili'
      when lower(s.name) like '%rus%' then 'Rus tili'
      when lower(s.name) like '%turk%' then 'Turk tili'
      when lower(s.name) like '%nemis%' then 'Nemis tili'
      when lower(s.name) like '%kimyo%' then 'Kimyo'
      when lower(s.name) like '%biolog%' or lower(s.name) like '%bialog%' then 'Biologiya'
      when lower(s.name) like '%mental%' then 'Mental arifmetika'
      when lower(s.name) like '%adabiyot%' or lower(s.name) like '%ona tili%' then 'Ona tili va adabiyot'
      else null
    end as subject
  from public.groups g
  join public.subjects s on s.id = g.subject_id
  where g.teacher_id is not null
),
ranked as (
  select teacher_id, subject,
         row_number() over (partition by teacher_id order by count(*) desc, subject) as rn
  from norm
  where subject is not null
  group by teacher_id, subject
)
select
  p.id,
  p.full_name as name,
  coalesce((select r.subject from ranked r where r.teacher_id = p.id and r.rn = 1), '') as subject,
  coalesce(p.teacher_level::text, '') as level,
  (select count(*) from public.groups g where g.teacher_id = p.id) as group_count,
  (select count(*) from public.student_enrollments e join public.groups g on g.id = e.group_id where g.teacher_id = p.id and e.status = 'active') as student_count
from public.profiles p
where p.full_name is not null
  and exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'teacher')
  and exists (select 1 from public.user_centers uc join public.centers c on c.id = uc.center_id where uc.user_id = p.id and c.is_flagship)
  and exists (select 1 from public.groups g where g.teacher_id = p.id)
order by student_count desc, name;

grant select on public.site_teacher_public to anon, authenticated;
grant all on public.site_teacher_public to service_role;