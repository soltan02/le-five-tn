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
   `+216 20 123 456`) + a prénom → **Envoyer le code** → the 6-digit code shows
   on screen (demo) → type it → **Vérifier**.
4. Back on the schedule, tap your slot again → **Réserver**. Toast: "en attente
   de confirmation".
5. Tab **Mes résas** → your booking shows **En attente**, with **Annuler**.

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
5. **Change / free a booking:** on **Planning**, click a **taken** slot (owners
   see the client's name on it) → **Gérer le créneau** → **Confirmer** a pending
   request, or **Libérer le créneau** to free it (e.g. the client cancelled by
   phone). A freed slot immediately becomes bookable again.

Note: the owner's tabs are **Planning** and **Gérer** only — no personal
"Mes résas" and no "Idées" (owners review suggestions, they don't submit them).

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
