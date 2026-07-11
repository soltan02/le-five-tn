# Le Five — réservation de terrain

A booking website for a **single football facility** (one owner, several
stadiums) in Tunisia. Players reserve 1h30 games; the owner approves each
request. **React + Vite**, UI in French.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5173
# or a production build:
npm run build && npm run preview   # http://127.0.0.1:8090
```

Node 20+. (On this machine, esbuild's postinstall is gated — run
`npm approve-scripts esbuild` once after install.)

## What it does

- **Réserver** — pick a day, pick a **stadium** (photo + format 6v6 / 7v7 /
  11v11), pick a free 1h30 slot. Taken slots show only "Réservé" — never *who*
  booked (privacy). Booking a stadium+slot blocks anyone else from that same
  slot (no double-booking).
- **Connexion** — phone + SMS code. **Dev-free:** the 6-digit code is shown on
  screen instead of a paid SMS gateway (see Security below).
- **Mes réservations** — your bookings with status (En attente / Confirmé) and
  an **Annuler** button.
- **Idées** — players submit improvement suggestions.
- **Gérer** (owner) — occupancy %, weekly revenue estimate, bookings-per-day
  chart, most-requested hours ("what to improve"), a **pending queue** to
  Confirmer/Refuser, the suggestions inbox, and your stadiums.

## Try it

- Player: log in with any number (e.g. `+216 20 123 456`), enter the on-screen
  code, book a slot.
- Owner: log in with **`+216 20 000 000`** → the **Gérer** tab appears with the
  dashboard and the confirm/decline queue.

## Configure the facility

Everything the owner controls lives in [`src/config/facility.js`](src/config/facility.js):
name, hours, slot length, the **stadiums** (name, format, price, photo, tint),
the per-user active-booking limit, and the owner's phone.

## Anti-fake bookings

Phone-verified accounts + a max of 2 active bookings per user + owner
confirmation. **These are enforced client-side only for now** — a real backend
must re-check them server-side (a browser can't be trusted).

## Security note (SMS + data)

This is a **frontend prototype**: everything (accounts, OTP, bookings) lives in
`localStorage` via `src/store/store.js`, so the OTP is visible and the rules are
not truly secure. Production needs a server that: generates/sends OTP through a
real gateway (Firebase Phone Auth or a Tunisian SMS provider) and never reveals
the code, validates every booking, and owns the anti-fraud limits.
