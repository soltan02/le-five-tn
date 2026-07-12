# Vérification manuelle — Le Five

Open **http://127.0.0.1:8090/**. If you see a black screen, hard-refresh
(**Ctrl+F5**) — an old cached bundle. To start clean, open DevTools → Application
→ Local Storage → delete `lefive.v1`, then refresh.

Tip: use two browser profiles / a normal + a private window to be "player" in
one and "owner" (gérant) in the other at the same time.

## A — Player: booking

1. Bottom tab **Réserver**. You should see the day strip, three stadium cards
   (**Terrain A 6v6**, **Terrain B 7v7**, **Grand Stade 11v11**) with pitch
   illustrations + prices, and a slot grid.
2. Pick a stadium and a **Libre** slot → a confirm sheet opens with the photo,
   date, time, price → **Réserver**.
3. First time, it sends you to **Connexion**: enter any number (e.g.
   `+216 20 123 456`) + a prénom → **Continuer**. You're in **instantly — no
   code** (the owner confirms each booking, which is the anti-fake guard).
   On **Mes réservations** you can tap **Activer** to get a real notification
   the moment the owner confirms (works while the app is open).
4. Back on the schedule, tap your slot → **Envoyer la demande**. A screen
   appears: **"Demande envoyée ! … reviens vérifier dans ~5 minutes"** with a
   button to Mes réservations. (No SMS — this in-app message is the free path.)
5. Tab **Mes résas** → your booking shows **En attente** + the hint *"reviens
   vérifier dans ~5 min"*, with **Annuler**. Once the owner confirms, it flips to
   **Confirmé** here.

**Privacy check:** that booked slot now shows **Réservé** with *no name* — a
second player must not see who booked it.

**No-overlap check:** the slot you booked is disabled. You cannot book the same
stadium at the same time twice.

**Limit check:** book until you have **2** active bookings, then try a 3rd →
blocked with "Limite de 2 réservations actives".

## B — Owner (gérant)

Log out (top-right pill → **Se déconnecter**) or use a second window. Log in
with **`+216 20 000 000`** → you land on **Gérer** (the owner tab appears).

1. **Notifications** card lists the request(s) players just made. The 🔔 bell
   in the top bar shows an unread count. (Click **Activer** to also get desktop
   notifications.)
2. **Demandes à confirmer** → **Confirmer** or **Refuser** one. Then check as
   the player: **Mes résas** now shows **Confirmé** (or **Refusé**).
3. **Vos terrains**:
   - **Maintenance** on a stadium → as a player, that stadium shows a
     **Maintenance** badge and its slots are not bookable.
   - **Retirer** a stadium → it disappears from the player's choices.
   - **+ Ajouter** → fill name / format (6v6…11v11) / price → it appears for
     players immediately.
4. **Réserver pour un client** (top right) / **Planning** tab → click any
   **free** slot → enter the **caller's name** → **Réserver**. Created
   **Confirmé** right away (no player action needed).
5. **Change / free a booking:** on **Planning**, click a **confirmed** slot
   (owners see the client's name on it) → **Gérer le créneau** → **Libérer le
   créneau** to free it (e.g. the client cancelled by phone). A freed slot
   becomes bookable again.
6. **Competing requests (pick one):** if several players requested the *same*
   slot, the owner sees **"N demandes"** on it. There's a seeded example:
   **Terrain A, 12:00, in 2 days (day "+2")** has **3 demandes**. Click it →
   **Choisir une demande** lists all three → **Confirmer** one (the others are
   auto-refused) or **Refuser** individually.
   - To reproduce live: as a player request a free slot; as a *second* player
     (other window) request the *same* slot — both succeed. Each player only
     ever sees it as **Libre / En attente** (never who else asked). The owner
     sees the stack and chooses.

Note: the owner's tabs are **Planning** and **Gérer** only — no personal
"Mes résas" and no "Idées" (owners review suggestions, they don't submit them).

## B2 — SMS (simulation)

No real SMS is sent (that needs a paid gateway + backend). Instead each message
is generated and shown in the owner's **SMS envoyés** card on **Gérer**.

1. As owner, **Confirmer** any booking (or a request from the chooser). A
   booking made by a logged-in player already has their number; for a walk-in,
   fill **Téléphone du client** in the booking sheet.
2. Open **Gérer** → **SMS envoyés** → you'll see a **Confirmation** SMS with the
   real text ("… votre reservation … est CONFIRMEE").
3. **1h reminder:** a booking whose start is within the next hour gets a
   **Rappel 1h** SMS (the app checks every 30 s while open). To see it live,
   make a walk-in booking with a phone on a slot that starts in <1 h.

## C — Stats

On **Gérer**: occupancy %, weekly revenue estimate, a bookings-per-day bar
chart, and "créneaux les plus demandés" (which hours fill up). These move as you
add/confirm bookings.

## D — Suggestions

As a player, tab **Idées** → send a suggestion. As owner, it appears in
**Suggestions des joueurs** → mark **Traité**.

---

### What is NOT real yet (needs the backend)

- The OTP code is shown on screen (no SMS gateway). Anyone could read it — real
  security requires server-side OTP.
- All data lives in your browser (localStorage), per device. Two phones won't
  see each other's bookings yet, and owner notifications only arrive while the
  owner has the app open. A backend makes it shared + secure + real-time.
