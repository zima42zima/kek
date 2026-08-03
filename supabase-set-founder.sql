-- Promote your main account to founder (platform owner).
-- Run once in Supabase → SQL Editor. Change the email below.

update public.profiles
set
  is_founder = true,
  is_cofounder = false
where id = (
  select id from auth.users
  where lower(email) = lower('alena_dizdarevic@icloud.com')
  limit 1
);

-- Verify:
select p.id, u.email, p.silly_name, p.is_founder, p.is_cofounder
from public.profiles p
join auth.users u on u.id = p.id
where p.is_founder = true;

-- Add a co-founder by handle (optional — or use Founder console in Profile):
-- update public.profiles set is_cofounder = true
-- where lower(fren_handle) = lower('their_handle');
