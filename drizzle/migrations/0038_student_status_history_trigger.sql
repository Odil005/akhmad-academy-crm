create or replace function public.log_student_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status_enum is distinct from old.status_enum then
    insert into public.student_status_history (student_id, from_status, to_status, changed_by, reason)
    values (
      new.id,
      old.status_enum,
      new.status_enum,
      nullif(auth.uid()::text, '')::uuid,
      coalesce(
        nullif(current_setting('app.status_reason', true), ''),
        case when new.status_enum = 'frozen' then nullif(new.frozen_reason, '') end
      )
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.log_student_status_change() from public, anon, authenticated;

drop trigger if exists trg_students_status_history on public.students;

create trigger trg_students_status_history
  after update of status_enum on public.students
  for each row
  execute function public.log_student_status_change();
