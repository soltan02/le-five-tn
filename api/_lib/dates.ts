// Ported from src/lib/dates.js — kept byte-for-byte equivalent so server-side
// "is this slot in the past" / "what slots exist today" checks agree exactly
// with what the client shows. Only reads static facility hours (openHour/
// closeHour/slotMinutes), not pitches (those live in the DB now).
import { FACILITY } from "../../src/config/facility.js";

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface UpcomingDay {
  key: string;
  weekday: string;
  dayNum: number;
  isToday: boolean;
  isTomorrow: boolean;
}

const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const JOURS_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function upcomingDays(count = 14): UpcomingDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      key: dateKey(d),
      weekday: JOURS[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
      isTomorrow: i === 1,
    };
  });
}

export function longDate(key: string): string {
  const d = parseKey(key);
  return `${JOURS_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

export interface Slot {
  start: string;
  end: string;
  minutes: number;
}

function toHM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function slotsForDay(): Slot[] {
  const out: Slot[] = [];
  const startMin = FACILITY.openHour * 60;
  const endMin = FACILITY.closeHour * 60;
  for (let m = startMin; m + FACILITY.slotMinutes <= endMin; m += FACILITY.slotMinutes) {
    out.push({ start: toHM(m), end: toHM(m + FACILITY.slotMinutes), minutes: m });
  }
  return out;
}

export function slotStartMs(dayKey: string, slotStart: string): number {
  const d = parseKey(dayKey);
  const [h, m] = slotStart.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function isPast(dayKey: string, slotStart: string): boolean {
  return slotStartMs(dayKey, slotStart) <= Date.now();
}
