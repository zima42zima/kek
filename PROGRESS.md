# FRENS — Build & decision log

Living notes for handoff (humans + AI). Last updated: July 2026.

---

## Recently built (code in repo)

### Onboarding (invite gate + unique names)
- **Invite gate** — `InviteGate.jsx` before signup; validates code via `validate_invite` RPC.
- **First fren bootstrap** — if no profiles exist, gate opens without a code.
- **Double password** — confirm field on `CreateAccount.jsx`.
- **Invite generator** — `InviteGenerator.jsx` on Home + success: copy code, **copy message**, **copy link**, native **share**.
- **Invite links** — `/?invite=CODE` pre-fills gate; cleared from URL after entry.
- **Gate peek** — shows “Invited by {fren name}” when code is valid (no email).
- **Auto-follow** — new fren quietly follows whoever invited them on `claim_invite`.
- **Cap** — max 10 unused codes per account.
- **Unique fren names** — `check_fren_name_available` + unique index on `lower(silly_name)`; enforced in `upsert_my_profile`.
- SQL: `supabase-patch-onboarding.sql` (run after `supabase-fix-profile-permissions.sql`).

- **Owl letter composer** restored in Owl Post panel (envelope+ button → pick fren → full composer).
- `OwlComposeLetter.jsx`, `SendOwlLetterModal.jsx`, `OwlLetterComposer.jsx` (fonts, occasions, live preview, print).

### Playlists
- **Optional cover photos** — `PlaylistCover.jsx`, `set_playlist_cover` RPC.
- SQL: `supabase-patch-playlist-covers.sql` (must `DROP FUNCTION` before recreate for return type change).
- **Edit mode** — playback view default; **Edit** toggles add tracks, reorder, cover upload, delete (`Playlists.jsx`).

### Cave playlists
- Per-cave playlists; founder or **Seasonal DJ** can moderate.
- `CavePlaylists.jsx`, `src/lib/cavePlaylists.js`, Chat | Playlists tab in `CaveDetail.jsx`.
- SQL: `supabase-patch-cave-playlists.sql`.

### Show to frens
- **Show to frens** button next to aura on `PostCard` — human curation, no public count.
- Home feed uses `list_feed_posts()` (follow graph + posts frens showed you); falls back to `list_posts()` if patch not applied.
- Feed line: “{name} thought your frens might like this” when a fren showed the post.
- `post_shows` table, `toggle_show_to_frens`, daily cap of 10; only `everyone` / `frens` audience.
- Private hint when ≤3 shows left today (`get_show_to_frens_quota`, `ShowToFrensQuotaHint` on Home).
- SQL: `supabase-patch-show-to-frens.sql`, `supabase-patch-show-to-frens-quota.sql`.

### UI / icons
- Monochrome SVG icons extended (`UiIcons.jsx`); colored emoji badges reduced app-wide (echo, caves, roles, etc.).

### Echo Map — **LOCKED** (env-onboarding, Jul 2026)

**Branch checkpoint:** `58d31a9` → `0f351a4` on `env-onboarding`.

**Working:**
- Map · My Echoes · Collection · Log tabs
- Meme spots (image), discover radius 420m–city, CARTO dark explore map
- Cross-account discovery (location + Realtime + fren graph both directions)
- Publish notifications (`echo_published` / `echo_friends`) + `get_echo` deep-link
- Collection save/remove; previews refresh from `mediaPath` (not expired signed URLs)
- Echo modal: no delete button (edit menu only); world icon → map fly-to
- Focus `?echo=` consumed once — no popup loop after save/comment/refresh

**Key files:** `src/pages/EchoMap.jsx`, `src/lib/echo{Storage,Privacy,Range,es}.js`, `src/components/echo/*`

**SQL run order (echoes):**
1. `supabase-patch-echoes.sql`, `supabase-patch-echoes-images.sql`
2. Browse: `2a-publish` → `2b-explore` → `2c-near` → `2d-mine` (+ `2-functions`, `1-columns` as needed)
3. `supabase-patch-echo-range.sql`, `supabase-patch-echo-aura.sql`, `supabase-patch-echoes-read.sql` (**required** for other frens’ meme images)
4. `supabase-patch-echo-publish-notify.sql`

**Do not regress:** auto-locate on map tab, `sortByDistance` export, collection URL refresh, frenGraph on discover checks.

Cursor rule: `.cursor/rules/echo-map-lock.mdc`

### Echo map (earlier)
- Discover radius per echo; viewer search radius; in-range gallery; `supabase-patch-echo-range.sql`.

---

## SQL patches — run order (when applicable)

1. `supabase-fix-profile-permissions.sql` (base)
2. `supabase-patch-onboarding.sql` (invite gate + unique fren names)
3. `supabase-patch-invite-share.sql` (invite links, peek inviter, auto-follow — safe if onboarding already run)
4. `supabase-patch-playlists.sql` (+ social, saves, reorder)
2. `supabase-patch-playlist-covers.sql`
3. `supabase-patch-cave-roles.sql` (for cave DJ)
4. `supabase-patch-cave-playlists.sql`
5. **`supabase-patch-show-to-frens.sql`** (follow-based home feed + show button)
6. **`supabase-patch-show-to-frens-quota.sql`** (private “N left today” hint)
7. Echo / moodboard / pin patches as needed

Verify: `node scripts/check-supabase.mjs` (includes `list_feed_posts` + `list_cave_playlists`).

---

## Decided — not implemented yet

### Subscription & storage (wait for Stripe)

| Item | Decision |
|------|----------|
| Base price | **$24/year** ($2/mo feel), **yearly billing only** |
| Model | One tier — full app, **no Premium / Pro** |
| Included | **~40–50 MB shelf** (photos, short echoes, cave/DM media) |
| Links | YouTube/Vimeo playlists, Cosmos/moodboards — **not hosted** |
| Add-on | **Buy more shelf** — stackable storage only (e.g. +100 MB / +$12 yr); for heavy uploaders / future podcast or hosted live |
| Tone | Human: “more room on the shelf,” not “upgrade your account” |
| Live / calls | Calls: P2P + TURN (~$5k/mo at 100k users). Live: **embed/link default**; hosted live only with shelf add-on, capped |

### Economics snapshot (100k paying, FB/X-style usage, 3-person team)

- Net ~$192k/mo after Stripe (annual $24)
- Infra ~$70–85k/mo (content + DMs + calls; link-first)
- Team ~$35k/mo → **~$75–80k/mo profit** if shelf metered

**Do not implement billing until Stripe is ready.**

---

## Product summary (for other AI)

FRENS: invite-only, human-first social pocket — anti-performative, no ads. Text + links + small groups + short location echoes; not Instagram. Cave = safe pocket; goal is real life. Stack: React + Supabase. Link-first hosting; FRENS hosts only compressed photos, short echoes, DMs/cave media. Compare usage/costs to **X/Facebook**, not Instagram.

---

## Reference docs

- `GROK.md` — philosophy + technical brief
- `SPEC.md` — original locked spec
- `README.md` — setup
