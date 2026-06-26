# Stride — Fitness Dashboard

A personal fitness dashboard that auto-syncs from **Hevy** (lifting) and **Strava**
(running). Dark theme with electric-lime accents, glowing charts, and a monthly
workout calendar. Built with Next.js (App Router), TypeScript, Tailwind, Recharts,
and Prisma 6 on MongoDB. Deploys to Vercel with a cron job that keeps data fresh.

## What it shows

- **Body weight** hero chart with a dashed goal line (Hevy `/body_measurements`)
- **Bench / Body Weight / 5K** stat cards with progress + deltas
- **Current Lifts** — top working set per key lift, with session-over-session delta
- **Weekly Mileage** (last 8 weeks) and **Latest Run** splits (Strava)
- **Workout Calendar** — lift + run days for the current month
- Top-bar: weekly mileage, total calories, day streak

## Setup

### 1. Database (MongoDB Atlas — free)
Create a free **M0** cluster at <https://www.mongodb.com/atlas>, add a database user,
allow network access (`0.0.0.0/0` for simplicity), and copy the connection string
(`mongodb+srv://...`). Atlas is a replica set, which Prisma needs for MongoDB.

### 2. Environment
Copy `.env.example` to `.env` and fill in:

| Var | Where to get it |
| --- | --- |
| `DATABASE_URL` | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `HEVY_API_KEY` | <https://hevy.com/settings?developer> (Hevy Pro) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | <https://www.strava.com/settings/api> |
| `STRAVA_REDIRECT_URI` | `http://localhost:3000/api/auth/strava/callback` (local) |
| `CRON_SECRET` | any random string |

> In your Strava API application settings, set **Authorization Callback Domain**
> to `localhost` for local dev and `your-app.vercel.app` for production.

### 3. Migrate + run
```bash
npm install
npm run db:push           # creates collections/indexes in MongoDB
npm run check:apis        # optional: verify Hevy/Strava connectivity
npm run dev               # http://localhost:3000
```
Open the app, go to **Settings → Connect Strava**, then click **Sync now**.

## Auto-sync
`vercel.json` schedules `GET /api/sync` once daily (06:00 UTC — within the Vercel
Hobby cron limit; bump to a more frequent cron on Pro). The route requires
`Authorization: Bearer $CRON_SECRET`; Vercel Cron sends this automatically when
`CRON_SECRET` is set as an environment variable. The dashboard's **Sync now**
button triggers the same sync via a server action.

- Hevy workouts: full pull on first run, then incremental via `/workouts/events`.
- Strava: lists activities after the last cursor; fetches each new run's detail
  once for `best_efforts` (5K PR) + splits + calories.

## Deploy to Vercel
1. Push to GitHub and import the repo in Vercel.
2. Add all env vars from `.env` (set `STRAVA_REDIRECT_URI` and the Strava callback
   domain to your Vercel URL).
3. Deploy. Push the schema to the DB once (`npm run db:push` with the prod
   `DATABASE_URL`). Atlas is shared between local and prod, so this is usually
   already done from step 3 above.
4. Visit `/settings`, connect Strava, click **Sync now** (cron then keeps it fresh).

## Scripts
- `npm run dev` / `build` / `start`
- `npm run db:push` — push schema (collections + indexes) to MongoDB
- `npm run check:apis` — sample-fetch Hevy + Strava to verify field shapes
- `npm run sync` — run one sync from the CLI
