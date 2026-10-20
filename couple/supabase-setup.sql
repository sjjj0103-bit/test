-- 우리 둘 달력: Supabase 설정 (SQL Editor에 통째로 붙여넣고 Run 한 번)
-- 하는 일: 데이터 칸 만들기 + "커플 코드를 아는 기기만" 읽고 쓰게 잠그기 + 사진 보관함 만들기

create extension if not exists pgcrypto with schema extensions;

-- 커플 공간 하나 = 커플 하나. 코드는 원문 대신 암호화한 값(해시)만 저장해요.
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

-- 이 공간에 들어온 기기들 (폰, 노트북 등 최대 6대)
create table if not exists public.members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- 앱의 모든 데이터 (일정, 채팅, 기념일, 기록...)
create table if not exists public.items (
  space_id uuid not null references public.spaces(id) on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (space_id, col, id)
);

alter table public.spaces enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;

create or replace function public.is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where space_id = s and user_id = auth.uid());
$$;

drop policy if exists "members read own" on public.members;
create policy "members read own" on public.members for select using (user_id = auth.uid());

drop policy if exists "items read" on public.items;
drop policy if exists "items insert" on public.items;
drop policy if exists "items update" on public.items;
drop policy if exists "items delete" on public.items;
create policy "items read" on public.items for select using (public.is_member(space_id));
create policy "items insert" on public.items for insert with check (public.is_member(space_id));
create policy "items update" on public.items for update using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy "items delete" on public.items for delete using (public.is_member(space_id));

-- 커플 코드로 공간 만들기(make = true) / 들어가기(make = false)
create or replace function public.join_couple(code text, make boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
  s uuid;
  n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if length(trim(code)) < 8 then raise exception 'code_too_short'; end if;
  h := encode(digest(lower(trim(code)), 'sha256'), 'hex');
  select id into s from public.spaces where code_hash = h;
  if s is null then
    if not make then raise exception 'no_such_code'; end if;
    insert into public.spaces (code_hash) values (h) returning id into s;
  elsif make then
    raise exception 'code_taken';
  end if;
  if exists (select 1 from public.members where space_id = s and user_id = auth.uid()) then
    return s;
  end if;
  select count(*) into n from public.members where space_id = s;
  if n >= 6 then raise exception 'space_full'; end if;
  insert into public.members (space_id, user_id) values (s, auth.uid());
  return s;
end $$;
revoke all on function public.join_couple(text, boolean) from public, anon;
grant execute on function public.join_couple(text, boolean) to authenticated;

-- 실시간: 상대가 쓴 게 바로 보이게
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;

-- 사진 보관함 (비공개, 같은 커플만 볼 수 있어요)
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "couple photos read" on storage.objects;
drop policy if exists "couple photos upload" on storage.objects;
drop policy if exists "couple photos delete" on storage.objects;
create policy "couple photos read" on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (select m.space_id::text from public.members m where m.user_id = auth.uid()));
create policy "couple photos upload" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (select m.space_id::text from public.members m where m.user_id = auth.uid()));
create policy "couple photos delete" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (select m.space_id::text from public.members m where m.user_id = auth.uid()));
