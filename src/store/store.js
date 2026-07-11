import { FACILITY } from "../config/facility.js";
import { upcomingDays, slotsForDay, isPast } from "../lib/dates.js";

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
        status: d === 0 || i === 0 ? "confirmed" : "pending",
        createdAt: Date.now() - d * 86400000,
      });
    }
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

export function logout() {
  set({ ...state, session: null });
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
function isActive(b) {
  return b.status === "pending" || b.status === "confirmed";
}

export function bookingAt(dayKey, pitchId, slotStart) {
  return state.bookings.find(
    (b) => b.dayKey === dayKey && b.pitchId === pitchId && b.slotStart === slotStart && isActive(b),
  );
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
  if (bookingAt(dayKey, pitchId, slotStart)) return { ok: false, error: "Ce créneau vient d'être pris." };
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
  // Notify the owner that a new request needs confirmation.
  notify(`Nouvelle demande — ${s.name} · ${pitch.name} · ${slotStart}`, { type: "booking", bookingId: booking.id });
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
  if (bookingAt(dayKey, pitchId, slotStart)) return { ok: false, error: "Ce créneau est déjà pris." };
  const booking = {
    id: uid(),
    dayKey, pitchId, slotStart, slotEnd,
    phone: phone?.trim() || "—", name: name?.trim() || "Client",
    status: "confirmed", byOwner: true,
    createdAt: Date.now(),
  };
  set({ ...state, bookings: [...state.bookings, booking] });
  return { ok: true, booking };
}

function setStatus(id, status) {
  set({ ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)) });
}
export const cancelBooking = (id) => setStatus(id, "cancelled");
export const confirmBooking = (id) => setStatus(id, "confirmed");
export const declineBooking = (id) => setStatus(id, "declined");

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
      Notification.requestPermission();
    }
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// Owner analytics (derived)
// ---------------------------------------------------------------------------
export function ownerStats() {
  const days = upcomingDays(7).map((d) => d.key);
  const bookablePitches = state.pitches.filter((p) => p.status === "active").length;
  const slotsPerDay = slotsForDay().length * Math.max(1, bookablePitches);
  const weekActive = state.bookings.filter((b) => days.includes(b.dayKey) && isActive(b));
  const capacity = slotsPerDay * days.length;
  const occupancy = capacity ? Math.round((weekActive.length / capacity) * 100) : 0;

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

  const revenue = weekActive.reduce((sum, b) => {
    const pitch = pitchById(b.pitchId);
    return sum + (pitch ? pitch.price : 0);
  }, 0);

  const pending = state.bookings.filter((b) => b.status === "pending" && !isPast(b.dayKey, b.slotStart));

  return { occupancy, perDay, perHour, revenue, pendingCount: pending.length, pending, weekCount: weekActive.length };
}
