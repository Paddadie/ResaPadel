// Période de recherche : quelles dates interroger.

import { MAX_DAYS_AHEAD } from "../config";
import { addDays, fromIsoDate, toIsoDate } from "./time";
import type { Period, Weekday } from "./types";

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Dates couvertes par une période, à partir de `now`. Les semaines vont du lundi au dimanche.
 * La période doit être valide (voir validatePeriod).
 */
export function periodRange(period: Period, now: Date): DateRange {
  const today = addDays(now, 0);
  const sunday = addDays(today, (7 - today.getDay()) % 7); // dimanche de la semaine en cours

  switch (period.kind) {
    case "all":
      return { from: today, to: addDays(today, MAX_DAYS_AHEAD - 1) };
    case "week":
      return { from: today, to: sunday };
    case "weekend":
      return { from: addDays(sunday, -1), to: sunday };
    case "next":
      return { from: addDays(sunday, 1), to: addDays(sunday, 7) };
    case "custom":
      return { from: fromIsoDate(period.from), to: fromIsoDate(period.to) };
  }
}

/**
 * Dates ("YYYY-MM-DD") à interroger : les jours demandés dans la période,
 * sans remonter avant aujourd'hui ni dépasser le plafond MAX_DAYS_AHEAD.
 */
export function datesToCheck(days: Weekday[], range: DateRange, now: Date): string[] {
  const today = addDays(now, 0);
  const lastAllowed = addDays(today, MAX_DAYS_AHEAD - 1);
  const from = range.from < today ? today : range.from;
  const to = range.to > lastAllowed ? lastAllowed : range.to;
  const wanted = new Set(days);

  const dates: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (wanted.has(day.getDay())) dates.push(toIsoDate(day));
  }
  return dates;
}
