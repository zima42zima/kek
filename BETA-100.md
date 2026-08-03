# MISAO — Beta 100 launch checklist

Invite-only launch for ~100 frens using **existing features only** (no Grok, no billing).

Target: **~90% ready** — functional, safe enough to play, founder can moderate.

---

## 1. Supabase — run in order (production)

Run each file in **Supabase → SQL Editor** on your **production** project.  
If a patch says “safe to re-run”, you can run it again.

### Core (required)

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase-fix-profile-permissions.sql` | Profiles, posts, follows, caves base |
| 2 | `supabase-patch-onboarding.sql` | Invite gate, unique names |
| 3 | `supabase-patch-invite-share.sql` | Invite links, auto-follow inviter |
| 4 | `supabase-patch-invite-daily-limit.sql` | 3 invites / 24h, 10 unused cap |
| 5 | `supabase-patch-fren-handle.sql` | @handles |
| 6 | `supabase-patch-show-to-frens.sql` | Follow-based home feed |
| 7 | `supabase-patch-show-to-frens-quota.sql` | Daily show-to-frens hint |
| 8 | `supabase-patch-dms.sql` | Messages |
| 9 | `supabase-patch-rabbit-hole.sql` | Rabbit Hole base |
| 10 | `supabase-patch-rabbit-hole-v2.sql` | Tags, mod, reports |
| 11 | `supabase-patch-platform-moderation.sql` | Founder, suspend, report inbox |
| 12 | `supabase-patch-search-profiles.sql` | People search (signed-in only) |
| 13 | `supabase-patch-beta-100-security.sql` | **Suspended users blocked on writes** |
| 14 | `supabase-patch-staff-investigate-1.sql` then `-2.sql` | Staff dossier: profile, posts, DMs, reports |

### Founder

| # | File | Purpose |
|---|------|---------|
| 15 | `supabase-set-founder.sql` | Your account → founder |

### Features you enable at launch (run if tab is on)

| Area | Patches |
|------|---------|
| **P.S. letters** | `supabase-patch-owl-post.sql`, `supabase-patch-owl-anon-notifications.sql` |
| **Folds** | `supabase-patch-folds.sql` |
| **Aftersound map** | See `PROGRESS.md` echo SQL order |
| **Playlists** | `supabase-patch-playlists.sql` + social/saves/covers as needed |
| **Gatherer** | `supabase-patch-moodboards.sql` |
| **DM calls** | `supabase-patch-dm-calls.sql` |
| **Caves (full)** | `supabase-patch-cave-members.sql`, roles, reactions, playlists |

Verify: `npm run db:check`

---

## 2. Supabase Auth settings

- [ ] **Confirm email** enabled (recommended)
- [ ] **Site URL** → `https://misao.app`
- [ ] **Redirect URLs** → `https://misao.app/**` + `http://localhost:5173/**`
- [ ] **Storage** → `media` bucket exists with upload policies

---

## 3. Deploy

```bash
npm run build
```

Host `dist/` on Vercel/Netlify/Cloudflare Pages → **misao.app**

Env vars on host:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_GIPHY_KEY`, map keys

---

## 4. Security baseline (beta 100)

| Control | Status |
|---------|--------|
| Invite-only signup | ✅ Gate + codes |
| Invite rate limits | ✅ 3/day, 10 unused |
| RLS + RPC writes | ✅ Base schema |
| Founder moderation | ✅ Console + suspend |
| Suspension enforced server-side | ✅ `beta-100-security` patch |
| People search not public | ✅ `search_profiles` authenticated only |
| Report → notification → console | ✅ Tap report notif → Profile → Founder console |

**Still manual / cultural at 100 users:**
- No rate limit on posts/DM volume (trust + invites)
- Media URLs are public if shared
- Report UI: Rabbit Hole + profiles (not every surface)
- Short privacy/rules page (link in invite message)

---

## 5. Smoke tests (two accounts)

1. **Invite** — generate code, sign up second account, lands in app  
2. **Feed** — post, comment, show to frens  
3. **Follow** — follow each other, see feed  
4. **DM** — message + photo  
5. **Cave** — create, invite member, chat  
6. **Rabbit Hole** — topic, reply, report  
7. **P.S.** — send letter, print/save PDF flow  
8. **Founder** — report appears in console, dismiss or hide  
9. **Suspend** — suspend test account, confirm they cannot post/DM  
10. **Unsuspend** — restore access  

---

## 6. What “90%” means here

- **Included:** everything you’ve built that passes the SQL + smoke tests above  
- **Excluded:** Grok onboarding, live photo proof, Stripe, full legal suite, automated rate limits  
- **Good enough for 100 invite-only frens** who know you and the vibe  

When something breaks: **Founder console** → suspend → fix → unsuspend.

---

## 7. Quick status command

```bash
npm run db:check
```

Extend this checklist as you add patches to prod.
