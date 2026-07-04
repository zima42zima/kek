# FRENS — setup steps

## 1. Run the database schema
In Supabase → SQL Editor → New Query → paste the contents of `supabase-schema.sql` → Run.

## 2. Add your Supabase keys as Replit Secrets
In Replit, open Secrets (lock icon) and add:
- `VITE_SUPABASE_URL` → from Supabase Project Settings → API
- `VITE_SUPABASE_ANON_KEY` → from Supabase Project Settings → API

## 3. Install dependencies
In the Replit Shell:
```
npm install
```

## 4. Run it
```
npm run dev
```

## 5. Create your first invite code
Since the gate requires an invite code and there are none yet, create one manually:
In Supabase → Table Editor → `invites` table → Insert row → set `code` to something like `FIRST1` (leave `created_by` and `used_by` empty) → Save.
Use that code to sign up as your first account. Once you're in, you can generate more invite codes from the Home screen to share with friends.
