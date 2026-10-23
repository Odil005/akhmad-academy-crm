insert into public.cash_accounts (center_id, name, type, is_active, balance)
select c.id, v.name, v.type, true, 0
from public.centers c
cross join (values
  ('Naqd kassa', 'cash'::public.cash_account_type),
  ('Karta kassa', 'card'::public.cash_account_type),
  ('Bank hisobi', 'bank'::public.cash_account_type)
) as v(name, type)
where c.custom_domain = 'ilmnuri.xyz'
  and not exists (
    select 1 from public.cash_accounts a
    where a.center_id = c.id and a.type = v.type
  );