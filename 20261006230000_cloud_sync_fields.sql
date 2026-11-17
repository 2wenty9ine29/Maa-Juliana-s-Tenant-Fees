alter table public.payments add column if not exists net_amount numeric(12,2);
alter table public.payments add column if not exists ecg_deduction numeric(12,2) not null default 0;
alter table public.payments add column if not exists ecg_updated_at timestamptz;
create index if not exists payments_tenant_updated_idx on public.payments(tenant_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
