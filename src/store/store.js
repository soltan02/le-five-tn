import { isPast } from "../lib/dates.js";
import { apiGet, apiPost, getStoredSession, storeSession, clearStoredSession } from "../lib/apiClient.js";

// ---------------------------------------------------------------------------
// The API returns Prisma rows as-is (ISO date strings, DB column names). The
// old localStorage version always stored `createdAt` as `Date.now()` (a
// number) and used `to`/`at` for SMS entries — normalize at the cache
// boundary so every page keeps doing the same `Date.now() - x.createdAt`
// arithmetic and field access it always did, instead of learning the wire
// format.
// ---------------------------------------------------------------------------
const toMs = (x) => (x ? new Date(x).getTime() : x);
const withMsCreatedAt = (row) => ({ ...row, createdAt: toMs(row.createdAt) });
const normalizeSms = (m) => ({ id: m.id, to: m.toPhone, body: m.body, kind: m.kind, at: toMs(m.createdAt) });

// ---------------------------------------------------------------------------
// Client-side cache of server state, synced via polling + optimistic refetch
// after every mutation. useSyncExternalStore needs a SYNCHRONOUS snapshot, so
// subscribe()/getState()/set() work exactly as the old localStorage version
// did — only how the cache gets populated changed (network instead of
// localStorage), which is why page components barely need to change.
// ---------------------------------------------------------------------------

const listeners = new Set();

const storedSession = getStoredSession();

let state = {
  session: storedSession?.user ?? null, // optimistic — refetches will clear it if the token turns out invalid
  pitches: [],
  bookings: [], // from get-schedule: redacted, windowed to ~14 days — Schedule.jsx + AcceptedNotifier
  suggestions: [], // player: own only: owner: all — populated by whichever refresh ran for that role
  notifications: [], // owner only
  loading: true,
};

// Data not read via useSyncExternalStore's snapshot (only ever read through
// the exported accessor functions below, never via raw `state.x`), so it's
// fine for these to live outside the subscribed `state` object.
let myBookingsCache = [];
let smsCache = [];
let pendingBookingsCache = [];
let pastConfirmedCache = [];
let unpaidPlayedCache = [];
let ownerStatsCache = { occupancy: 0, perDay: [], perHour: {}, revenueProjected: 0, pendingCount: 0, weekCount: 0 };
let financeCache = null;
let currentFinancePeriod = "week7";

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getState() {
  return state;
}

function handleAuthFailure(result) {
  if (result.ok === false && (result.error === "unauthorized" || result.error === "forbidden")) {
    clearStoredSession();
    set({ session: null });
  }
}

// ---------------------------------------------------------------------------
// Refresh — one function per data slice, called on load, on a poll interval,
// and immediately after any mutation so the actor's own action feels instant.
// ---------------------------------------------------------------------------
async function refreshSchedule() {
  const result = await apiGet("get-schedule", { days: 14 });
  if (result.ok) set({ pitches: result.pitches, bookings: result.bookings.map(withMsCreatedAt) });
}

async function refreshPlayerState() {
  if (!state.session) return;
  const result = await apiGet("get-player-state");
  if (result.ok) {
    myBookingsCache = result.bookings.map(withMsCreatedAt);
    set({ suggestions: result.suggestions.map(withMsCreatedAt) });
  } else {
    handleAuthFailure(result);
  }
}

async function refreshOwnerDashboard() {
  if (!state.session || state.session.role !== "owner") return;
  const result = await apiGet("get-owner-dashboard", { period: currentFinancePeriod });
  if (result.ok) {
    pendingBookingsCache = result.pendingBookings.map(withMsCreatedAt);
    pastConfirmedCache = result.pastConfirmedBookings.map(withMsCreatedAt);
    unpaidPlayedCache = result.unpaidPlayedBookings.map(withMsCreatedAt);
    ownerStatsCache = result.stats;
    financeCache = result.finance;
    smsCache = result.sms.map(normalizeSms);
    set({
      pitches: result.pitches,
      notifications: result.notifications.map(withMsCreatedAt),
      suggestions: result.suggestions.map(withMsCreatedAt),
    });
  } else {
    handleAuthFailure(result);
  }
}

async function refreshAll() {
  await Promise.all([refreshSchedule(), refreshPlayerState(), refreshOwnerDashboard()]);
  set({ loading: false });
}

// Single shared poll loop, paused while the tab is hidden.
const POLL_MS = 9000;
let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") refreshAll();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll();
  });
}

refreshAll();
startPolling();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function signIn(phone, name) {
  const result = await apiPost("login", { phone, name });
  if (!result.ok) return { ok: false, error: result.error };
  storeSession({ token: result.token, user: result.user });
  set({ session: result.user });
  await refreshAll();
  return { ok: true, user: result.user };
}

export async function logout() {
  await apiPost("logout", {});
  clearStoredSession();
  set({ session: null });
}

// ---------------------------------------------------------------------------
// Bookings — reads (synchronous, from cache)
// ---------------------------------------------------------------------------
const sameSlot = (b, dayKey, pitchId, slotStart) =>
  b.dayKey === dayKey && b.pitchId === pitchId && b.slotStart === slotStart;

export function confirmedAt(dayKey, pitchId, slotStart) {
  return state.bookings.find((b) => sameSlot(b, dayKey, pitchId, slotStart) && b.status === "confirmed");
}
export function pendingAt(dayKey, pitchId, slotStart) {
  return state.bookings.filter((b) => sameSlot(b, dayKey, pitchId, slotStart) && b.status === "pending");
}
export function myBookings() {
  return myBookingsCache;
}

// ---------------------------------------------------------------------------
// Bookings — mutations (async: call the API, then refetch)
// ---------------------------------------------------------------------------
export async function createBooking({ dayKey, pitchId, slotStart, slotEnd }) {
  if (!state.session) return { ok: false, error: "auth" };
  const result = await apiPost("create-booking", { dayKey, pitchId, slotStart, slotEnd });
  if (result.ok) await refreshSchedule();
  return result;
}

export async function ownerCreateBooking({ dayKey, pitchId, slotStart, slotEnd, name, phone }) {
  const result = await apiPost("owner-create-booking", { dayKey, pitchId, slotStart, slotEnd, name, phone });
  if (result.ok) await refreshSchedule();
  return result;
}

export async function confirmBooking(id) {
  const result = await apiPost("manage-booking", { action: "confirm", bookingId: id });
  await Promise.all([refreshSchedule(), refreshOwnerDashboard()]);
  return result;
}
export async function declineBooking(id) {
  const result = await apiPost("manage-booking", { action: "decline", bookingId: id });
  await Promise.all([refreshSchedule(), refreshOwnerDashboard()]);
  return result;
}
export async function cancelBooking(id) {
  const result = await apiPost("manage-booking", { action: "cancel", bookingId: id });
  await Promise.all([refreshSchedule(), refreshPlayerState(), refreshOwnerDashboard()]);
  return result;
}

export async function setBookingOutcome(id, outcome) {
  const result = await apiPost("set-booking-result", { bookingId: id, outcome });
  await refreshOwnerDashboard();
  return result;
}
export async function setBookingPayment(id, amountPaid) {
  const result = await apiPost("set-booking-result", { bookingId: id, amountPaid });
  await refreshOwnerDashboard();
  return result;
}

/** Confirmed bookings whose slot has already started — reconciled by the
 *  owner (outcome + actual amount paid). Most recent first (server-sorted). */
export function pastConfirmedBookings() {
  return pastConfirmedCache;
}

/** Played matches with no amount recorded yet — an actionable queue. */
export function unpaidPlayedBookings() {
  return unpaidPlayedCache;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
export async function addSuggestion(text) {
  if (!state.session || !text.trim()) return;
  const result = await apiPost("add-suggestion", { text: text.trim() });
  if (result.ok) await refreshPlayerState();
  return result;
}
export async function resolveSuggestion(id) {
  const result = await apiPost("resolve-suggestion", { suggestionId: id });
  if (result.ok) await refreshOwnerDashboard();
  return result;
}

// ---------------------------------------------------------------------------
// Stadiums (owner-managed)
// ---------------------------------------------------------------------------
export function getPitches() {
  return state.pitches.filter((p) => p.status !== "removed");
}
export function pitchById(id) {
  return state.pitches.find((p) => p.id === id);
}
export async function addPitch(data) {
  const result = await apiPost("add-pitch", data);
  if (result.ok) await Promise.all([refreshSchedule(), refreshOwnerDashboard()]);
  return result.pitch;
}
export async function setPitchStatus(id, status) {
  const result = await apiPost("set-pitch-status", { pitchId: id, status });
  await Promise.all([refreshSchedule(), refreshOwnerDashboard()]);
  return result;
}
export const removePitch = (id) => setPitchStatus(id, "removed");

// ---------------------------------------------------------------------------
// Notifications (owner)
// ---------------------------------------------------------------------------
export async function markNotificationsRead() {
  if (!state.notifications.some((n) => !n.read)) return;
  set({ notifications: state.notifications.map((n) => ({ ...n, read: true })) });
  await apiPost("mark-notifications-read", {});
}
export function unreadCount() {
  return state.notifications.filter((n) => !n.read).length;
}
export function requestNotifPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      return Notification.requestPermission();
    }
  } catch {
    /* unsupported */
  }
  return Promise.resolve(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
}

// ---------------------------------------------------------------------------
// SMS (still simulated — see api/send-due-reminders.ts)
// ---------------------------------------------------------------------------
export function smsOutbox() {
  return smsCache;
}
export async function sendDueReminders() {
  const result = await apiPost("send-due-reminders", {});
  if (result.ok && result.count > 0) await refreshOwnerDashboard();
  return result.ok ? result.count : 0;
}

// ---------------------------------------------------------------------------
// Owner analytics (derived server-side now — see api/get-owner-dashboard.ts)
// ---------------------------------------------------------------------------
export function ownerStats() {
  return {
    ...ownerStatsCache,
    pending: pendingBookingsCache,
  };
}

// ---------------------------------------------------------------------------
// Expenses / finance (Stage 2)
// ---------------------------------------------------------------------------
export function financeSummary() {
  return financeCache;
}
export async function setFinancePeriod(period) {
  currentFinancePeriod = period;
  await refreshOwnerDashboard();
}
export async function addExpense(data) {
  const result = await apiPost("add-expense", data);
  if (result.ok) await refreshOwnerDashboard();
  return result;
}
export async function deleteExpense(id) {
  const result = await apiPost("delete-expense", { expenseId: id });
  if (result.ok) await refreshOwnerDashboard();
  return result;
}

// isPast re-exported for convenience where store.js was the one-stop import
// (kept minimal — most pages already import it from lib/dates.js directly).
export { isPast };
