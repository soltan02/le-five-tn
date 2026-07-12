# Le Five — réservation de terrain

A booking website for a **single football facility** (one owner, several
stadiums) in Tunisia. Players reserve 1h30 games; the owner approves each
request. **React + Vite**, UI in French.

Live demo (single-file build): https://claude.ai/code/artifact/05de94f6-2edc-4069-ac9d-a0d466651e43

## Run locally

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

Node 20+. (If `npm install` warns that esbuild's postinstall was blocked, run
`npm approve-scripts esbuild` once — that's a machine-specific npm setting, not
needed on Vercel.)

## Deploy to Vercel

The project is Vercel-ready — no config needed (Vite is auto-detected, and it
uses HashRouter so there are no server rewrites to set up).

1. Go to **vercel.com** → sign in with GitHub.
2. **Add New… → Project** → import **`soltan02/9assa.tn`**.
3. Vercel auto-fills: Framework **Vite**, Build `npm run build`, Output `dist`.
   Leave everything as-is → **Deploy**.
4. You get a URL like `9assa-tn.vercel.app`. **Every `git push` to `main`
   auto-deploys.**

No environment variables are needed (there's no backend yet).
For a drag-and-drop alternative: `npm run build`, then drop `dist/` on
https://app.netlify.com/drop.

## What it does

- **Réserver** — pick a day, pick a **stadium** (photo + format 6v6 / 7v7 /
  11v11), pick a free 1h30 slot. A confirmed slot shows only "Réservé" — never
  *who* booked it. Several players may request the **same** free slot; the
  requests **stack** and the owner picks one.
- **Connexion** — **instant**: phone + prénom → you're in (no code). The owner
  confirming each booking is the anti-fake guard.
- **Mes réservations** — your bookings (En attente / Confirmé), an **Annuler**
  button, and **Activer** to get a notification when the owner confirms.
- **Idées** — players submit improvement suggestions.
- **Gérer** (owner) — occupancy %, weekly revenue estimate, bookings-per-day
  chart, most-requested hours, the pending queue (**Confirmer / Refuser**, or
  pick among competing requests), walk-in booking by client name, stadium
  management (add / remove / maintenance), notifications, SMS outbox (simulated),
  and the suggestions inbox.

## Try it

- **Player:** log in with any number (e.g. `+216 20 123 456`) + a prénom → book.
- **Owner:** log in with **`+216 20 000 000`** → the **Gérer** tab appears.

Seeded example: **Terrain A, 12:00, in 2 days** has 3 competing requests to try
the owner's chooser.

## Configure the facility

Everything the owner controls lives in
[`src/config/facility.js`](src/config/facility.js): name, city, hours, slot
length, the **stadiums** (name, format, price, tint), the per-user
active-booking limit, and the owner's phone.

## Project layout

```
src/
  config/facility.js     the owner's facility + stadiums (edit this)
  store/store.js         all state + rules (localStorage-backed)
  store/hooks.js         React bindings (useStore / useSession)
  lib/dates.js           slots, dates, French formatting
  components/            ui.jsx, Layout, PitchPhoto
  pages/                 Schedule, MyBookings, Login, Account, Suggestions
  pages/owner/           Dashboard
  App.jsx                routes + reminder/notify schedulers
```

## Honest limits (needs a backend to go real)

This is still a **frontend** app: accounts, bookings, and the SMS/notification
logic live in the browser (`localStorage`). So:

- **Data is per-browser** — two phones don't share bookings yet.
- **Notifications** fire only while the app is open (real push-when-closed needs
  a server + push service).
- **SMS is simulated** (shown in the owner's outbox) — real delivery needs a
  paid gateway.
- The **anti-fake rules** (booking limit, no-overlap) run client-side; a real
  backend must re-check them.

The next step is a small backend to make data shared, secure, and real-time.
