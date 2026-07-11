import { FACILITY } from "../config/facility.js";

const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const JOURS_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** A stable YYYY-MM-DD key in local time. */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The next `count` days starting today, as {key,label,weekday,dayNum,isToday}. */
export function upcomingDays(count = 14) {
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

/** e.g. "Mardi 12 mars". */
export function longDate(key) {
  const d = parseKey(key);
  return `${JOURS_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** Generate the day's slots from the facility hours. Each: {start,end,label}. */
export function slotsForDay() {
  const out = [];
  const startMin = FACILITY.openHour * 60;
  const endMin = FACILITY.closeHour * 60;
  for (let m = startMin; m + FACILITY.slotMinutes <= endMin; m += FACILITY.slotMinutes) {
    out.push({
      start: toHM(m),
      end: toHM(m + FACILITY.slotMinutes),
      minutes: m,
    });
  }
  return out;
}

function toHM(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Has this date+slot already started (relative to now)? */
export function isPast(dayKey, slotStart) {
  const d = parseKey(dayKey);
  const [h, m] = slotStart.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime() <= Date.now();
}
