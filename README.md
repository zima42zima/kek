# MISAO — setup steps

## 1. Run the database schema
In Supabase → SQL Editor, run **`BETA-100.md`** core patch list (or at minimum steps 1–13 + founder).

Quick verify: `npm run db:check`

## 2. Add your Supabase keys locally
Copy `.env.example` to `.env` in the project folder and fill in:
- `VITE_SUPABASE_URL` → from Supabase Project Settings → API
- `VITE_SUPABASE_ANON_KEY` → from Supabase Project Settings → API

Restart `npm run dev` after saving `.env`.

## Production domain (misao.app)

When you deploy to **https://misao.app**:

1. **DNS** — point `misao.app` (and `www` if you use it) at your host (Vercel, Netlify, Cloudflare Pages, etc.).
2. **Supabase Auth** → URL Configuration → add redirect URLs:
   - `https://misao.app`
   - `https://misao.app/**`
   - Keep `http://localhost:5173` (and your LAN/ngrok URLs) for local dev.
3. **Site URL** in Supabase can be set to `https://misao.app`.

Invite links, post shares, and cave invites use the current browser origin — on production they will be `https://misao.app/...` automatically.

## 3. Install dependencies
In the Replit Shell:
```
npm install
```

## 4. Run it
```
npm run dev
```

## 5. Sign up & invite frens
- **First account:** open the app — if no one has signed up yet, the gate opens automatically (no code needed).
- **Everyone else:** needs an invite code from an existing fren.
- **After login:** Home feed → **Invite a fren** → generate → **copy message** or **share** (text/iMessage — not from MISAO servers).
- Friend opens your **link** or enters **code** at gate → signup → email verify → they're in (and follow you quietly).
