# MISAO – Project Specification

**Version**: 1.0 (Initial Locked Spec)  
**Date**: July 2026  
**Goal**: A small, invite-only, human-first social pocket. Anti-performative, cozy, meme-inspired, privacy-respecting.

## 1. Vision & Philosophy

MISAO is an open social network with private pockets, inspired by meme culture (Pepe, Kek). A **fren** is anyone who strips away titles, professions, and performance. No LinkedIn masks. No Instagram highlights. Just humans being real.

**Core Idea**  
The cave is a safe, warm place to remember what it feels like to be human. Memes make us laugh. We celebrate genuine joy and allow real pain. Hope is human — we reach for it without pretending. The ultimate invitation is to **step out of the cave** when ready — back into the real world (wind on your face, sun on your skin, smiling at ants).

**Key Principles**
- Human-first, anti-performative, anti-capitalist
- Free will and choice above all
- Privacy by default, anonymity supported
- Freedom both ways (speak and be judged)
- Real joy and real pain both welcome
- Screenshot protection is cultural + technical
- Redemption and growth are possible

## 2. Overall Structure

- **Main Platform** — Open social network (feed, Echoes, challenges, profiles)
- **Personal Caves** — Optional private groups any fren can create (invite-only)
- **Rabbit Hole** — Open public forum for topics and debates (initially moderated, later open with rules)
- **Cave Letters (Owl Post)** — Optional physical letter feature (trust-based, voluntary)

## 3. Onboarding & Proof of Human

**Flow**
- Personal invite (note + code + emojis)
- Warm welcome screen: “Welcome fren 🐸”
- Profile basics (silly name, one human thing, current vibe)
- 3 gentle Grok questions
- Live photo capture inside the app (metadata stripped + steganography)
- Optional analog proof
- Choice of anonymity level

**Security**
- All uploads (photos, videos) have automatic metadata stripping + invisible watermark
- Live photo only for initial verification or bot concerns

## 4. Core Features

**Profiles**
- Round pixel avatar frame
- Bio, current vibe
- Location toggle (on/off)
- Frens list (following / followers)
- Aura / trust level (future discussion)

**Daily Challenges**
- Fun, optional, light prompts (silly, creative, sensory)
- No streaks or pressure

**Cave Echoes (Map)**
- Leave notes, photos, voice messages on the world map (city level)
- Optional “Walk & Listen” discovery
- Treasure Chest for saved finds

**Rabbit Hole**
- Open forum for topics and debates
- Anyone can comment
- Topics initially moderated, later open (rules against harassment, nudity, etc.)

**Cave Letters (Owl Post)**
- Optional physical letter feature
- Trust-based, voluntary printer connection
- Subscribers don’t know if you print or not

**Self-Publishing (Cave Press)**
- Easy creation of articles, stories, zines
- Add photos, short videos
- Optional physical print link (external service)

**Privacy & Security**
- Screenshot protection (cultural + technical)
- All uploads cleaned
- Anonymity options everywhere

## 5. Graphic Design & UI

**Overall Style**
- Minimal, cozy, pixel-inspired
- Black & white default for landing page and onboarding
- Light/dark mode toggle
- Monospace / code-inspired font for text
- High-quality pixel frog as main logo (Pepe-inspired, friendly)

**Icons**
- Pixel bat (for Echoes)
- White rabbit (for Rabbit Hole)
- Pixel cave (for Personal Caves)
- Other icons to match pixel aesthetic

**Profile**
- Round avatar frame
- Clean, minimal layout

## 6. Tech Stack & Non-Functional

- React + Vite + Tailwind (frontend)
- Supabase (auth, database)
- Vercel (hosting)
- Grok API (light usage for verification, badges)
- Low budget, non-monetized