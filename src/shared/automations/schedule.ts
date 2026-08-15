import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type RecurringSchedule = {
  time: string;
  days: DayKey[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeNextRunAt(schedule: RecurringSchedule, timezone: string, from: Date): Date | null {
  if (schedule.days.length === 0) return null;

  const [hourStr, minuteStr] = schedule.time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const allowedDays = new Set(schedule.days);
  const zonedNow = toZonedTime(from, timezone);

  for (let offset = 0; offset <= 7; offset++) {
    const candidateZoned = new Date(zonedNow.getTime() + offset * MS_PER_DAY);
    candidateZoned.setHours(hour, minute, 0, 0);

    const dayKey = DAY_KEYS[candidateZoned.getDay()];
    if (!dayKey || !allowedDays.has(dayKey)) continue;

    const candidateUtc = fromZonedTime(candidateZoned, timezone);
    if (candidateUtc.getTime() > from.getTime()) {
      return candidateUtc;
    }
  }

  return null;
}
