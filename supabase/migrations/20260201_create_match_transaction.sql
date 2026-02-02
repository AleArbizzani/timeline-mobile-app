-- ============================================================
-- create_game_with_officials
-- Atomic match creation: games + members + clock + officials + reports
-- Assumes:
--   - user_profiles.id = auth.uid()
--   - user_profiles.org_id exists
--   - officials table has: id, org_id, active
--   - reports table has: org_id, game_id, game_official_id, author_id, status
-- ============================================================

drop function if exists public.create_game_with_officials(
  uuid, text, text, text, date, time, text, int8, boolean, int8, jsonb
);

create or replace function public.create_game_with_officials(
  p_org_id uuid,
  p_competition text,
  p_home_team text,
  p_away_team text,
  p_game_date date,
  p_kickoff_time time,
  p_ground text,
  p_half_length_minutes int8,
  p_has_extra_time boolean,
  p_extra_time_length_minutes int8,
  p_officials jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_org uuid;
  v_game_id uuid;
  v_officials jsonb := coalesce(p_officials, '[]'::jsonb);
  v_official_count bigint;
  v_distinct_official_count bigint;
begin
  -- Auth
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Org membership / validity
  select up.org_id
    into v_user_org
  from user_profiles up
  where up.id = v_user_id;

  if v_user_org is null or v_user_org <> p_org_id then
    raise exception 'Invalid organisation';
  end if;

  -- Officials JSON must be an array
  if jsonb_typeof(v_officials) <> 'array' then
    raise exception 'p_officials must be a JSON array';
  end if;

  -- Must include a REF
  if not exists (
    select 1
    from jsonb_array_elements(v_officials) elem
    where elem->>'role' = 'REF'
  ) then
    raise exception 'Referee required';
  end if;

  -- Validate role values
  if exists (
    select 1
    from jsonb_array_elements(v_officials) elem
    where coalesce(elem->>'role','') not in ('REF', 'AR1', 'AR2', 'FOURTH')
  ) then
    raise exception 'Invalid official role';
  end if;

  -- Validate official_id presence + UUID format BEFORE casting
  if exists (
    select 1
    from jsonb_array_elements(v_officials) elem
    where (elem->>'official_id') is null
       or (elem->>'official_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Invalid official_id format';
  end if;

  -- No duplicate officials (same official in multiple roles)
  select count(*)
    into v_official_count
  from jsonb_array_elements(v_officials);

  select count(distinct (elem->>'official_id'))
    into v_distinct_official_count
  from jsonb_array_elements(v_officials) elem;

  if v_official_count <> v_distinct_official_count then
    raise exception 'Duplicate officials not allowed';
  end if;

  -- No duplicate roles (e.g., two AR1 entries)
  if exists (
    select 1
    from (
      select (elem->>'role') as role, count(*) as c
      from jsonb_array_elements(v_officials) elem
      group by 1
    ) t
    where t.c > 1
  ) then
    raise exception 'Duplicate roles not allowed';
  end if;

  -- Validate officials exist, belong to org, and are active
  if exists (
    select 1
    from jsonb_array_elements(v_officials) elem
    left join officials o on o.id = (elem->>'official_id')::uuid
    where o.id is null
       or o.org_id <> p_org_id
       or o.active is not true
  ) then
    raise exception 'Invalid or inactive official';
  end if;

  -- Create game
  insert into games (
    org_id,
    created_by,
    game_date,
    kickoff_time,
    competition,
    ground,
    home_team,
    away_team,
    status,
    half_length_minutes,
    has_extra_time,
    extra_time_length_minutes
  )
  values (
    p_org_id,
    v_user_id,
    p_game_date,
    p_kickoff_time,
    p_competition,
    p_ground,
    p_home_team,
    p_away_team,
    'draft',
    p_half_length_minutes,
    p_has_extra_time,
    case when p_has_extra_time then p_extra_time_length_minutes else null end
  )
  returning id into v_game_id;

  -- Creator membership
  insert into game_members (game_id, profile_id, access_level)
  values (v_game_id, v_user_id, 'editor');

  -- Initialize clock
  insert into game_clock (game_id, period, paused_total_seconds, updated_at)
  values (v_game_id, '1H', 0, now());

  -- Insert officials + create reports for each inserted game_official
  with inserted_officials as (
    insert into game_officials (game_id, official_id, role)
    select
      v_game_id,
      (elem->>'official_id')::uuid,
      (elem->>'role')
    from jsonb_array_elements(v_officials) elem
    returning id
  )
  insert into reports (org_id, game_id, game_official_id, author_id, status)
  select
    p_org_id,
    v_game_id,
    io.id,
    v_user_id,
    'draft'
  from inserted_officials io;

  return jsonb_build_object('game_id', v_game_id);
end;
$$;

-- Recommended: lock down who can execute (adjust role names if yours differ)
revoke all on function public.create_game_with_officials(
  uuid, text, text, text, date, time, text, int8, boolean, int8, jsonb
) from public;

grant execute on function public.create_game_with_officials(
  uuid, text, text, text, date, time, text, int8, boolean, int8, jsonb
) to authenticated;