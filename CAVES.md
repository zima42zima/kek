# Caves — SQL foundation

Caves grew as stacked patches. Several redefine `sync_cave` / `list_my_caves` / `get_cave`. **Wrong order can wipe joiners.** This doc is the source of truth.

## What “solid for 2 or 100k” means here

| Layer | Status | Notes |
|-------|--------|--------|
| **Membership integrity** | Required | `sync_cave` must **never** delete members from a client roster. Kicks only via `remove_cave_member` / `leave_cave`. |
| **Read path** | Required | Avatars = `coalesce(profile, message snapshot)`. Message payloads **capped**. |
| **Indexes** | Required | Members by user, messages by cave+time. |
| **Client poll of full histories** | Not 100k-ready yet | App still syncs caves every ~5s. Foundation caps SQL payload so 100 caves × unbounded history cannot melt the DB. Next client step: list = metadata; open cave = `get_cave` / `list_cave_messages`. |

## Run this (production)

Prerequisite: `supabase-fix-profile-permissions.sql` (creates `caves`, `cave_members`, `cave_messages` base).

### 1. Canonical core (re-run anytime)

```
supabase-caves.sql
```

Installs / repairs:

- schema columns + indexes  
- `is_cave_keeper` (minimal)  
- **upsert-only** `sync_cave`  
- `search_public_caves`, `join_public_cave`  
- `leave_cave`, `delete_cave`  
- `list_cave_messages`, `get_cave`, `list_my_caves` (avatar coalesce + message caps)

### 2. Feature packs (run once if you use the feature)

| File | Feature |
|------|---------|
| `supabase-patch-cave-roles.sql` | Fun titles, pin/hide, richer keeper checks |
| `supabase-patch-cave-members.sql` | Invite / kick / ban RPCs — **see warning below** |
| `supabase-patch-cave-message-replies.sql` | `parent_id` + send with reply |
| `supabase-patch-cave-reactions.sql` | Message reactions |
| `supabase-patch-cave-custom-roles.sql` | Custom role catalog — **see warning below** |
| `supabase-patch-cave-cover-publish.sql` | Cover upload RPC |
| `supabase-patch-profile-caves-public.sql` | Profile cave list + hide toggle |
| `supabase-patch-cave-playlists.sql` | Cave playlists |

After any feature pack that ships an old `sync_cave` / `list_my_caves`, **re-run `supabase-caves.sql` last.**

### 3. One-off cleanup (not product)

| File | Use |
|------|-----|
| `supabase-cleanup-old-zima-caves.sql` | Delete specific orphan test caves by name |

## Critical vs noise

### Critical (must be live)

- Upsert-only `sync_cave` (in `supabase-caves.sql`)
- `join_public_cave` → jsonb + owner notify
- `get_cave` / `list_my_caves` / `list_cave_messages` with avatar coalesce + caps
- `leave_cave`, `delete_cave`
- Indexes on `cave_members(user_id)`, `cave_messages(cave_id, created_at)`

### Superseded — do **not** re-run for “latest” RPCs

These were stepping stones. Headers in-file say so. Re-running them can **replace** good RPCs with worse ones:

| File | Why dangerous / obsolete |
|------|---------------------------|
| `supabase-patch-cave-members.sql` | Contains **destructive** `sync_cave` (deletes members not in client JSON) |
| `supabase-patch-cave-covers.sql` | Early covers; superseded |
| `supabase-patch-cave-covers-fix.sql` | Redefines `sync_cave` (destructive lineage) + old `list_my_caves` |
| `supabase-patch-cave-custom-roles.sql` | May redefine destructive `sync_cave` |
| `supabase-patch-get-cave.sql` | Merged into `supabase-caves.sql` |
| `supabase-patch-public-cave-join-fix.sql` | Merged into `supabase-caves.sql` |
| `supabase-patch-cave-avatar-coalesce.sql` | Merged into `supabase-caves.sql` |
| `supabase-patch-public-caves-search.sql` | Search included in `supabase-caves.sql` |
| `supabase-patch-live-avatars.sql` (caves section) | Older avatar path; caves reads live in foundation |

`supabase-patch-cave-members.sql` is still needed **once** for `add_cave_member` / `remove_cave_member` if those RPCs were never installed — then immediately re-run `supabase-caves.sql`.

## Message caps (foundation)

| RPC | Cap |
|-----|-----|
| `list_my_caves` | last **80** messages / cave |
| `get_cave` / `join_public_cave` | last **200** messages |
| `list_cave_messages` | last **500** messages |

Open-cave UX should use `get_cave` or `list_cave_messages`, not rely on an unbounded list sync.

## Smoke test (2 accounts)

1. Owner creates public cave + cover  
2. Joiner: profile → join → see history + **both avatars**  
3. Hard refresh joiner → avatars + members still correct  
4. Chat both ways; reply preview jump  
5. Joiner leaves; cave gone from their list  
6. Owner deletes; joiner gets notified / list clears  

## Verify sync_cave is safe

In Supabase SQL:

```sql
select pg_get_functiondef('public.sync_cave(jsonb)'::regprocedure);
```

Must **not** contain `delete from public.cave_members` (except unrelated helpers). Membership removal belongs only in leave / kick / delete-cave.
