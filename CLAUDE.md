# Le Five — context & continuation (read me first)

This file is the hand-off so any Claude session (on any machine) can pick up
where the last one left off. Repo: **soltan02/9assa.tn** (branch `main`).

## What this is
A booking website for **one** football facility in Tunisia (one owner, several
stadiums). Players reserve 1h30 games; the owner approves each request.
**React + Vite**, UI in **French**. Deploys to **Vercel** (auto-deploy on push).

## Status: FRONTEND COMPLETE — no backend yet
Everything runs client-side. All state + rules live in
[`src/store/store.js`](src/store/store.js), persisted to `localStorage`
(pub/sub via `useSyncExternalStore`). So today: **data is per-browser**.

## Run / build / deploy
```bash
npm install          # if esbuild postinstall is blocked: npm approve-scripts esbuild
npm run dev          # http://127.0.0.1:5173
npm run build        # -> dist/   (npm run preview to serve it)
```
- **Vercel:** import the repo → auto-detects Vite → deploy. Uses **BrowserRouter**
  (clean URLs); `vercel.json` has the SPA rewrite; `vite base:"/"`.
- **Logins:** players = any phone + prénom (instant, no code). Owner =
  **`+216 20 000 000`** → unlocks the **Gérer** tab.

## Architecture
```
src/config/facility.js   the facility + stadiums (EDIT for name/city/pitches/prices)
src/store/store.js       ALL state + rules (localStorage). ← backend replaces persistence here
src/store/hooks.js       useStore / useSession (React bindings)
src/lib/dates.js         slots, dates, French formatting, slotStartMs
src/components/          ui.jsx (Button/Card/Modal[portals to body]/Toast/StatusBadge/Field),
                         Layout (glass topbar + bottom tabs + owner bell), PitchPhoto
src/pages/               Schedule (core booking + owner planning/chooser/walk-in/manage),
                         MyBookings, Login (instant), Account, Suggestions
src/pages/owner/         Dashboard (KPIs, charts, pending queue, stadium mgmt,
                         SMS outbox, notifications, "Matchs passés" reconciliation)
src/App.jsx              routes + ReminderScheduler + AcceptedNotifier
```

## Product rules — DO NOT REGRESS
- **Instant accounts** (phone + name, no code). Anti-fake = owner approval +
  max **2** active bookings/user + no double-booking. (`signIn`)
- **Requests STACK per slot:** many `pending` allowed; a slot locks only when
  **one** is `confirmed`. Confirming one **auto-declines** the other pending on
  that slot (`confirmBooking`). Owner walk-in also declines competitors
  (`ownerCreateBooking`). Free slot check = `confirmedAt`; competitors = `pendingAt`.
- **Privacy:** players NEVER see who booked or how many requested — only
  *Libre* / *En attente* (their own) / *Réservé* (confirmed).
- **Owner = manager.** Owner tabs are **Planning + Gérer** only (no personal
  Mes résas / Idées). Owner *reviews* suggestions in the dashboard.
- **Stadiums** live in the store: add / remove (soft) / maintenance; each has a
  format (6v6 / 7v7 / 11v11), price, photo/tint. `getPitches`, `addPitch`,
  `removePitch`, `setPitchStatus`.
- **Owner actions:** walk-in booking by client name (+ optional phone),
  free/manage any slot, choose among competing requests, confirm/decline.
- **Past-match reconciliation** (owner): "Matchs passés" card →
  `pastConfirmedBookings()`, `setBookingOutcome(id,'played'|'cancelled')`,
  `setBookingPayment(id, amount)` (amount pre-fills the pitch price, overridable).
- **SMS is SIMULATED** — the owner's "SMS envoyés" outbox. `deliver()` is the
  gateway seam; confirmation-on-approve + 1h-reminder logic exist but send nothing.
- **Notifications:** `AcceptedNotifier` (in App.jsx) fires a browser
  Notification to the player when their booking is confirmed, **while the app is
  open**. Owner gets in-app notifications (bell) on new requests.

## How we verify (no test runner)
- **Build must pass:** `npm run build`.
- **Logic:** run a Node script that imports `src/store/store.js` directly — the
  store runs in plain Node (localStorage is guarded in try/catch → falls back to
  seed). Assert stacking, the 2-booking limit, maintenance blocking, walk-in,
  confirm-declines-competitors, SMS/reminder timing.
- **UI:** drive **headless Edge via the DevTools Protocol** (Node has global
  `WebSocket` + `fetch`): launch `msedge --headless=new --remote-debugging-port=9222
  --user-data-dir=<fresh>`, open a tab via `/json/new`, enable `Runtime`, read
  `Runtime.exceptionThrown` + the `#root` innerHTML. This is how a **black
  screen** gets diagnosed — read the real console (a TDZ in store.js was caught
  this way). For clicks, `Runtime.evaluate` with `awaitPromise:true`.
- Windows gotchas: **`localhost` resolves to IPv6 — probe `127.0.0.1`**; the app
  binds IPv4. LF/CRLF git warnings are harmless. `npm approve-scripts esbuild`
  is a machine-specific npm gate, not needed on Vercel.

## NEXT: the backend (planned — user chose Web Push, no paid SMS)
Goal: shared data across phones, real accounts, **real push**, server-enforced
rules. Suggested stack: **Supabase** (hosted Postgres + realtime + edge functions
— least ops) OR **Fastify + Prisma + Postgres** on Render/Railway free tier.

Build order:
1. **Data model:** User(phone unique, name, role), Pitch(status, format, price,
   tint), Booking(dayKey, pitchId, slotStart/End, phone, name, status, byOwner,
   outcome, amountPaid), Suggestion, PushSubscription, Notification.
2. **Port the store rules server-side** as the source of truth, keeping the SAME
   semantics as `store.js` (createBooking stacks; confirmBooking declines
   competitors; ownerCreateBooking; cancel/decline; pitch mgmt; past-match
   outcome/payment; the 2-active limit; no-overlap). The Node logic test doubles
   as the spec.
3. **Auth:** instant (phone + name) → issue a JWT session. Owner = ownerPhone.
   (No code, per the user's decision. Optional later: email/Telegram verify.)
4. **Realtime:** WebSocket / Supabase realtime so the owner sees new requests and
   players see confirmations live (closes the per-browser gap).
5. **Web Push:** save a PushSubscription per user (VAPID keys, `web-push`); on
   confirm, push "Réservation confirmée" — works when the app is CLOSED. The 1h
   reminder becomes a **server cron** (replaces the client `ReminderScheduler`).
   Add a service worker on the client + wire `requestNotifPermission` to
   subscribe.
6. **Wire the frontend:** replace `store.js` persistence with an API client +
   realtime subscription, keeping the store's shape/selectors so the pages don't
   change (mirror a repository pattern). Seams already there: `store.js` (data),
   `deliver()` (SMS), `AcceptedNotifier`/`notify()` (notifications).

## Honest limits of today's deploy
Per-browser data · notifications only while app open · SMS simulated · anti-fake
rules client-side. The backend above fixes all four.

## Working across machines
`git pull` before you start, `git add -A && git commit && git push` when done.
This file is committed, so it travels with the repo. (Session-specific test
scripts are NOT committed — they live in the scratchpad.)
