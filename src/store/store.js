import { FACILITY } from "../config/facility.js";
import { upcomingDays, slotsForDay, isPast, slotStartMs, longDate } from "../lib/dates.js";

// ---------------------------------------------------------------------------
// Tiny external store (localStorage-backed) with pub/sub, consumed via
// useSyncExternalStore. This is the PROTOTYPE data layer — all client-side.
//
// SECURITY NOTE: real anti-fraud (OTP delivery, booking validation, the active-
// bookings limit) must live on a server; a browser can't be trusted to enforce
// them. The backend phase moves createBooking/verifyOtp server-side. Here the
// rules exist so the UX and flows are complete and testable.
// ---------------------------------------------------------------------------

const KEY = "lefive.v1";
const listeners = new Set();
// Hydrated at the bottom of this module — AFTER uid()/seed() are initialized
// (seed() uses uid, a const; hydrating here would hit its temporal dead zone).
let state;

function load() {
  const base = seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Forward-compatible merge so saves from an earlier version gain new keys
      // (pitches, notifications) instead of crashing on `undefined`.
      return {
        ...base,
        ...saved,
        pitches: saved.pitches ?? base.pitches,
        notifications: saved.notifications ?? base.notifications,
        sms: saved.sms ?? base.sms,
      };
    }
  } catch { /* fall through to seed */ }
  return base;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* quota / private mode — keep in memory */ }
}

function set(next) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getState() {
  return state;
}

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

// ---------------------------------------------------------------------------
// Seed — a believable week so the schedule and owner dashboard aren't empty.
// ---------------------------------------------------------------------------
function seed() {
  const days = upcomingDays(14);
  const slots = slotsForDay();
  const bookings = [];
  const players = [
    { phone: "+216 22 111 222", name: "Aymen" },
    { phone: "+216 55 333 444", name: "Skander" },
    { phone: "+216 98 555 666", name: "Yassine" },
    { phone: "+216 24 777 888", name: "Rami" },
  ];
  // Evening slots (18:00+) are the popular ones — bias the seed that way.
  const evening = slots.filter((s) => s.minutes >= 18 * 60);
  let seedIdx = 0;
  for (let d = 0; d < 6; d++) {
    const day = days[d];
    const take = 2 + (d % 3); // a few per day
    for (let i = 0; i < take; i++) {
      const slot = evening[(i + d) % evening.length];
      const pitch = FACILITY.pitches[i % FACILITY.pitches.length];
      const player = players[seedIdx % players.length];
      seedIdx++;
      bookings.push({
        id: uid(),
        dayKey: day.key,
        pitchId: pitch.id,
        slotStart: slot.start,
        slotEnd: slot.end,
        phone: player.phone,
        name: player.name,
        status: (d + i) % 3 === 0 ? "pending" : "confirmed",
        createdAt: Date.now() - d * 86400000,
      });
    }
  }

  // A live example of COMPETING requests on one free slot (Terrain A, 12:00, in
  // 2 days): three players want it — the owner picks one from the stack.
  const contestDay = days[2].key;
  for (let i = 0; i < 3; i++) {
    bookings.push({
      id: uid(),
      dayKey: contestDay,
      pitchId: "a",
      slotStart: "12:00",
      slotEnd: "13:30",
      phone: players[i].phone,
      name: players[i].name,
      status: "pending",
      createdAt: Date.now() - i * 3600000,
    });
  }

  const users = {};
  players.forEach((p) => (users[p.phone] = { ...p, role: "player", createdAt: Date.now() }));
  users[FACILITY.ownerPhone] = { phone: FACILITY.ownerPhone, name: "Propriétaire", role: "owner", createdAt: Date.now() };

  return {
    session: null,
    users,
    // Stadiums live in the store so the owner can add / remove / set maintenance
    // at runtime. Seeded from the facility defaults; each gains a `status`.
    pitches: FACILITY.pitches.map((p) => ({ ...p, status: "active" })),
    notifications: [],
    sms: [], // outbox (simulated delivery — see the SMS section below)
    bookings,
    suggestions: [
      { id: uid(), phone: "+216 22 111 222", name: "Aymen", text: "Des filets neufs sur le Terrain B svp.", createdAt: Date.now() - 2 * 86400000, status: "open" },
      { id: uid(), phone: "+216 98 555 666", name: "Yassine", text: "Plus d'éclairage côté vestiaires le soir.", createdAt: Date.now() - 5 * 3600000, status: "open" },
    ],
    pendingOtp: null,
  };
}

// Now uid() and seed() exist — safe to hydrate the store.
state = load();

// ---------------------------------------------------------------------------
// Auth — phone + OTP. DEV: the code is returned so the UI can show it (no paid
// SMS gateway). PROD: generate + send server-side; never expose the code.
// ---------------------------------------------------------------------------
export function requestOtp(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  set({ ...state, pendingOtp: { phone, code, expires: Date.now() + 5 * 60000 } });
  return code; // dev only
}

export function verifyOtp(phone, code, name) {
  const p = state.pendingOtp;
  if (!p || p.phone !== phone) return { ok: false, error: "Aucun code demandé pour ce numéro." };
  if (Date.now() > p.expires) return { ok: false, error: "Code expiré, redemandez-en un." };
  if (p.code !== code) return { ok: false, error: "Code incorrect." };

  const users = { ...state.users };
  let user = users[phone];
  if (!user) {
    const role = phone === FACILITY.ownerPhone ? "owner" : "player";
    user = { phone, name: name?.trim() || "Joueur", role, createdAt: Date.now() };
    users[phone] = user;
  } else if (name?.trim()) {
    user = { ...user, name: name.trim() };
    users[phone] = user;
  }
  set({ ...state, users, pendingOtp: null, session: { phone: user.phone, name: user.name, role: user.role } });
  return { ok: true, user };
}

/**
 * Instant sign-up / sign-in — no code to confirm (owner approval + the booking
 * limit are the anti-fake guard). The phone becomes the account id; the owner
 * phone gets the owner role.
 */
export function signIn(phone, name) {
  const clean = (phone || "").trim();
  if (clean.replace(/\D/g, "").length < 8) return { ok: false, error: "Numéro invalide." };
  const users = { ...state.users };
  let user = users[clean];
  if (!user) {
    const role = clean === FACILITY.ownerPhone ? "owner" : "player";
    user = { phone: clean, name: name?.trim() || "Joueur", role, createdAt: Date.now() };
  } else if (name?.trim()) {
    user = { ...user, name: name.trim() };
  }
  users[clean] = user;
  set({ ...state, users, session: { phone: user.phone, name: user.name, role: user.role } });
  return { ok: true, user };
}

export function logout() {
  set({ ...state, session: null });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
function isActive(b) {
  return b.status === "pending" || b.status === "confirmed";
}
const sameSlot = (b, dayKey, pitchId, slotStart) =>
  b.dayKey === dayKey && b.pitchId === pitchId && b.slotStart === slotStart;

/** The single confirmed booking on a slot (a slot locks only once confirmed). */
export function confirmedAt(dayKey, pitchId, slotStart) {
  return state.bookings.find((b) => sameSlot(b, dayKey, pitchId, slotStart) && b.status === "confirmed");
}
/** All pending requests competing for a slot — the owner picks one. */
export function pendingAt(dayKey, pitchId, slotStart) {
  return state.bookings.filter((b) => sameSlot(b, dayKey, pitchId, slotStart) && b.status === "pending");
}

export function activeCount(phone) {
  return state.bookings.filter((b) => b.phone === phone && isActive(b) && !isPast(b.dayKey, b.slotStart)).length;
}

export function myBookings(phone) {
  return state.bookings
    .filter((b) => b.phone === phone)
    .sort((a, b) => (a.dayKey + a.slotStart).localeCompare(b.dayKey + b.slotStart));
}

export function createBooking({ dayKey, pitchId, slotStart, slotEnd }) {
  const s = state.session;
  if (!s) return { ok: false, error: "auth" };
  const pitch = pitchById(pitchId);
  if (!pitch || pitch.status === "removed") return { ok: false, error: "Terrain indisponible." };
  if (pitch.status === "maintenance") return { ok: false, error: "Terrain en maintenance." };
  if (isPast(dayKey, slotStart)) return { ok: false, error: "Ce créneau est déjà passé." };
  if (confirmedAt(dayKey, pitchId, slotStart)) return { ok: false, error: "Ce créneau est déjà réservé." };
  // Multiple people MAY request the same free slot — they stack and the owner
  // chooses. Only block a duplicate request from the same person.
  if (pendingAt(dayKey, pitchId, slotStart).some((b) => b.phone === s.phone)) {
    return { ok: false, error: "Tu as déjà demandé ce créneau." };
  }
  if (activeCount(s.phone) >= FACILITY.maxActiveBookingsPerUser) {
    return { ok: false, error: `Limite de ${FACILITY.maxActiveBookingsPerUser} réservations actives atteinte.` };
  }
  const booking = {
    id: uid(),
    dayKey, pitchId, slotStart, slotEnd,
    phone: s.phone, name: s.name,
    status: "pending",
    createdAt: Date.now(),
  };
  set({ ...state, bookings: [...state.bookings, booking] });
  const competing = pendingAt(dayKey, pitchId, slotStart).length; // includes the one just added
  notify(
    `Nouvelle demande — ${s.name} · ${pitch.name} · ${slotStart}` + (competing > 1 ? ` (${competing} demandes sur ce créneau)` : ""),
    { type: "booking", bookingId: booking.id },
  );
  return { ok: true, booking };
}

// The owner books on behalf of a caller (walk-in / phone). Goes straight to
// CONFIRMED (the owner is arranging it) and bypasses the per-user limit, but
// still respects no-overlap and maintenance.
export function ownerCreateBooking({ dayKey, pitchId, slotStart, slotEnd, name, phone }) {
  const s = state.session;
  if (!s || s.role !== "owner") return { ok: false, error: "Réservé au gérant." };
  const pitch = pitchById(pitchId);
  if (!pitch || pitch.status === "removed") return { ok: false, error: "Terrain indisponible." };
  if (pitch.status === "maintenance") return { ok: false, error: "Terrain en maintenance." };
  if (isPast(dayKey, slotStart)) return { ok: false, error: "Ce créneau est déjà passé." };
  if (confirmedAt(dayKey, pitchId, slotStart)) return { ok: false, error: "Ce créneau est déjà réservé." };
  const booking = {
    id: uid(),
    dayKey, pitchId, slotStart, slotEnd,
    phone: phone?.trim() || "—", name: name?.trim() || "Client",
    status: "confirmed", byOwner: true,
    createdAt: Date.now(),
  };
  // Owner grants the slot to this walk-in → any competing requests are declined.
  const declined = new Set(pendingAt(dayKey, pitchId, slotStart).map((b) => b.id));
  set({
    ...state,
    bookings: [
      ...state.bookings.map((b) => (declined.has(b.id) ? { ...b, status: "declined" } : b)),
      booking,
    ],
  });
  // Confirmation SMS if the owner entered the client's number.
  if (validPhone(booking.phone)) deliver(booking.phone, confirmationText(booking), "confirmation");
  return { ok: true, booking };
}

function setStatus(id, status) {
  set({ ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)) });
}
export const cancelBooking = (id) => setStatus(id, "cancelled");
export const declineBooking = (id) => setStatus(id, "declined");

// ---------------------------------------------------------------------------
// Past-match outcome + actual payment (owner-recorded, after the fact).
// A "confirmed" booking just means the slot was granted — it doesn't tell you
// whether the match actually happened (no-shows, last-minute cancellations)
// or how much really changed hands (the pitch's listed price is a default,
// not always what's collected — discounts, split payments, etc.). Both are
// free-standing fields the owner sets once the slot is in the past; neither
// touches `status`, which stays the booking-lifecycle field.
// ---------------------------------------------------------------------------
export function setBookingOutcome(id, outcome) {
  set({ ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, outcome } : b)) });
}
export function setBookingPayment(id, amountPaid) {
  const n = Number(amountPaid);
  set({
    ...state,
    bookings: state.bookings.map((b) => (b.id === id ? { ...b, amountPaid: Number.isFinite(n) ? n : null } : b)),
  });
}

/** Confirmed bookings whose slot has already started — the owner reconciles
 *  these after the fact (outcome + actual amount paid). Most recent first. */
export function pastConfirmedBookings() {
  return state.bookings
    .filter((b) => b.status === "confirmed" && isPast(b.dayKey, b.slotStart))
    .sort((a, b) => (b.dayKey + b.slotStart).localeCompare(a.dayKey + a.slotStart));
}

// Confirm one request and auto-decline every OTHER pending request competing
// for the same date/stadium/slot — the manager picked a winner.
export function confirmBooking(id) {
  const target = state.bookings.find((b) => b.id === id);
  if (!target) return;
  set({
    ...state,
    bookings: state.bookings.map((b) => {
      if (b.id === id) return { ...b, status: "confirmed" };
      if (b.status === "pending" && sameSlot(b, target.dayKey, target.pitchId, target.slotStart)) {
        return { ...b, status: "declined" };
      }
      return b;
    }),
  });
  // SMS the booker that their reservation is confirmed.
  if (validPhone(target.phone)) deliver(target.phone, confirmationText(target), "confirmation");
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
export function addSuggestion(text) {
  const s = state.session;
  if (!s || !text.trim()) return;
  const item = { id: uid(), phone: s.phone, name: s.name, text: text.trim(), createdAt: Date.now(), status: "open" };
  set({ ...state, suggestions: [item, ...state.suggestions] });
}
export function resolveSuggestion(id) {
  set({ ...state, suggestions: state.suggestions.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)) });
}

// ---------------------------------------------------------------------------
// Stadiums (owner-managed)
// ---------------------------------------------------------------------------
/** Bookable/visible pitches (everything except removed). */
export function getPitches() {
  return state.pitches.filter((p) => p.status !== "removed");
}
export function pitchById(id) {
  return state.pitches.find((p) => p.id === id);
}
export function addPitch(data) {
  const id = (uid().replace(/-/g, "").slice(0, 6)) || String(Date.now());
  const pitch = {
    id,
    name: data.name?.trim() || "Nouveau terrain",
    players: data.players || "5 vs 5",
    perSide: Number(data.perSide) || 5,
    price: Number(data.price) || 0,
    surface: data.surface || "Gazon synthétique",
    covered: !!data.covered,
    tint: data.tint || "#166b3c",
    image: null,
    status: "active",
  };
  set({ ...state, pitches: [...state.pitches, pitch] });
  return pitch;
}
export function setPitchStatus(id, status) {
  set({ ...state, pitches: state.pitches.map((p) => (p.id === id ? { ...p, status } : p)) });
}
export const removePitch = (id) => setPitchStatus(id, "removed");

// ---------------------------------------------------------------------------
// Notifications (owner) — in-app center; fires a desktop notification too if
// the browser granted permission. Real cross-device push needs the backend.
// ---------------------------------------------------------------------------
function notify(text, meta = {}) {
  const n = { id: uid(), text, ...meta, createdAt: Date.now(), read: false };
  set({ ...state, notifications: [n, ...state.notifications].slice(0, 50) });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Le Five", { body: text, tag: n.id });
    }
  } catch { /* notifications unsupported */ }
}
export function markNotificationsRead() {
  if (!state.notifications.some((n) => !n.read)) return;
  set({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) });
}
export function unreadCount() {
  return state.notifications.filter((n) => !n.read).length;
}
export function requestNotifPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      return Notification.requestPermission();
    }
  } catch { /* unsupported */ }
  return Promise.resolve(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
}

// ---------------------------------------------------------------------------
// SMS (SIMULATION). Each message is built with its real text + timing rules and
// dropped into an outbox; nothing actually leaves the browser. To send for real,
// replace deliver() with a gateway call on the BACKEND (Twilio / a Tunisian SMS
// API). The 1h reminder MUST be scheduled server-side so it fires even when no
// one has the app open — a browser can't do that reliably.
// ---------------------------------------------------------------------------
const validPhone = (p) => !!p && p.replace(/\D/g, "").length >= 8;

function deliver(to, body, kind) {
  const sms = { id: uid(), to, body, kind, at: Date.now() };
  set({ ...state, sms: [sms, ...state.sms].slice(0, 100) });
}
export function smsOutbox() {
  return state.sms;
}

function confirmationText(b) {
  const p = pitchById(b.pitchId);
  return `${FACILITY.name}: Bonjour ${b.name}, votre reservation ${p?.name || ""} le ${longDate(b.dayKey)} a ${b.slotStart} est CONFIRMEE.`;
}
function reminderText(b) {
  const p = pitchById(b.pitchId);
  return `${FACILITY.name}: Rappel - votre match ${p?.name || ""} commence a ${b.slotStart} (dans 1h). Bon match!`;
}

/** Confirmed bookings starting within the next hour that haven't been reminded. */
export function remindersDue(nowMs = Date.now()) {
  return state.bookings.filter((b) => {
    if (b.status !== "confirmed" || b.reminded || !validPhone(b.phone)) return false;
    const diff = slotStartMs(b.dayKey, b.slotStart) - nowMs;
    return diff > 0 && diff <= 60 * 60000;
  });
}
export function sendDueReminders(nowMs = Date.now()) {
  const due = remindersDue(nowMs);
  if (!due.length) return 0;
  const ids = new Set(due.map((b) => b.id));
  set({ ...state, bookings: state.bookings.map((b) => (ids.has(b.id) ? { ...b, reminded: true } : b)) });
  due.forEach((b) => deliver(b.phone, reminderText(b), "reminder"));
  return due.length;
}

// ---------------------------------------------------------------------------
// Owner analytics (derived)
// ---------------------------------------------------------------------------
export function ownerStats() {
  const days = upcomingDays(7).map((d) => d.key);
  const bookablePitches = state.pitches.filter((p) => p.status === "active").length;
  const slotsPerDay = slotsForDay().length * Math.max(1, bookablePitches);
  const weekActive = state.bookings.filter((b) => days.includes(b.dayKey) && isActive(b));
  // Occupancy + revenue reflect CONFIRMED bookings only (many pending requests
  // may stack on one slot; they mustn't inflate real usage).
  const weekConfirmed = state.bookings.filter((b) => days.includes(b.dayKey) && b.status === "confirmed");
  const capacity = slotsPerDay * days.length;
  const occupancy = capacity ? Math.round((weekConfirmed.length / capacity) * 100) : 0;

  // Bookings per weekday (next 7 days) for the bar chart.
  const perDay = upcomingDays(7).map((d) => ({
    ...d,
    count: state.bookings.filter((b) => b.dayKey === d.key && isActive(b)).length,
  }));

  // Popular start hours → "what to improve" (which slots fill / stay empty).
  const perHour = {};
  slotsForDay().forEach((s) => (perHour[s.start] = 0));
  state.bookings.filter((b) => isActive(b)).forEach((b) => {
    perHour[b.slotStart] = (perHour[b.slotStart] || 0) + 1;
  });

  const revenue = weekConfirmed.reduce((sum, b) => {
    const pitch = pitchById(b.pitchId);
    return sum + (pitch ? pitch.price : 0);
  }, 0);

  const pending = state.bookings.filter((b) => b.status === "pending" && !isPast(b.dayKey, b.slotStart));

  return {
    occupancy, perDay, perHour, revenue,
    pendingCount: pending.length, pending,
    weekCount: weekConfirmed.length,
  };
}
